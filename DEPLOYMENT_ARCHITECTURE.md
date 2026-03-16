# Dorami Staging Deployment Architecture

**Document Date:** 2026-03-11
**Status:** Current — Reflects develop branch state
**Last Updated:** Analysis of deploy-staging.yml + docker-compose configs

---

## Overview

Dorami's staging deployment is a **fully automated GitHub Actions workflow** that:

1. Detects source code changes (backend, frontend, packages)
2. Runs CI tests on changed code
3. Builds immutable Docker images tagged with commit SHA
4. Deploys to staging server via SSH
5. Reconstructs `.env.staging` from GitHub Secrets (preventing env var loss)
6. Performs comprehensive health checks and network diagnostics

**Key Innovation:** Environment variables are **recreated from GitHub Secrets on every deployment**, eliminating the previous issue where `.git reset --hard` would delete `.env.staging` from the filesystem.

---

## Workflow Architecture

### Job 1: Check Source Changes

**File:** `.github/workflows/deploy-staging.yml` (lines 30-47)

Detects which files changed since last commit:

```yaml
paths-filter:
  source:
    - 'backend/**'
    - 'client-app/**'
    - 'packages/**'
    - 'package.json'
    - 'package-lock.json'
    - '**/Dockerfile'
```

**Output:** `source_changed` (true/false) — used to skip tests if only docs changed

---

### Job 2: Run Tests

**File:** `.github/workflows/deploy-staging.yml` (lines 52-60)

Uses reusable workflow `.github/workflows/ci.yml`:

- Only runs if `source_changed == 'true'` OR `skip_tests` workflow input is false
- Parallelizes backend + frontend linting, type-checking, unit tests
- If any test fails, deployment is blocked

---

### Job 3: Build Images

**File:** `.github/workflows/build-images.yml` (lines 1-54)

Builds 2 Docker images in parallel (fail-fast: false):

| Service  | Dockerfile              | Tag Format    | Registry            |
| -------- | ----------------------- | ------------- | ------------------- |
| backend  | `backend/Dockerfile`    | `sha-{40hex}` | `ghcr.io/{org}/...` |
| frontend | `client-app/Dockerfile` | `sha-{40hex}` | `ghcr.io/{org}/...` |

**Caching Strategy:** GitHub Actions cache only (no registry buildcache to avoid stale layers)

**Output:** `image_tag=sha-{GITHUB_SHA}` — immutable commit-based tag

---

### Job 4: Deploy to Staging

**File:** `.github/workflows/deploy-staging.yml` (lines 76-593)

The core deployment job. Broken into logical phases:

#### Phase 1: SSH Setup & Validation (lines 97-203)

1. **SSH Key Loading** — tries PEM first, then Base64 decode
2. **Image Tag Validation** — ensures tag matches `sha-{40hex}` format
3. **Environment Variable Validation** — checks GitHub Secrets are present:
   - `STAGING_KAKAO_CLIENT_ID`
   - `STAGING_KAKAO_CLIENT_SECRET`
   - `STAGING_KAKAO_CALLBACK_URL`

#### Phase 2: Git Pull & Config Check (lines 249-277)

1. Pulls latest code from `origin/{branch}`
2. Warns if `docker-compose*.yml`, `infrastructure/`, or `nginx/` config changed
3. Verifies image ↔ code commit parity (notes acceptable divergence in staging)

#### Phase 3: Environment Variable Reconstruction (lines 287-320) ⭐ **CRITICAL**

```bash
cat > /opt/dorami/.env.staging << 'ENDSSH'
DATABASE_URL="postgresql://postgres:${STAGING_POSTGRES_PASSWORD}@postgres:5432/live_commerce_staging"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="${STAGING_POSTGRES_PASSWORD}"
...
KAKAO_CLIENT_ID="${KAKAO_CLIENT_ID}"
KAKAO_CLIENT_SECRET="${KAKAO_CLIENT_SECRET}"
KAKAO_CALLBACK_URL="${KAKAO_CALLBACK_URL}"
...
EOF
```

**Why this matters:**

- `git reset --hard origin/develop` deletes ANY local file not tracked by git
- `.env.staging` is in `.gitignore` (correct — secrets should never be in git)
- Previous bug: `.env.staging` got deleted, then `fix-staging-env.sh` had no file to fix
- **Solution:** Recreate `.env.staging` from GitHub Secrets **BEFORE** `fix-staging-env.sh` runs

**Variables sourced from GitHub Secrets:**

```
STAGING_POSTGRES_PASSWORD     → POSTGRES_PASSWORD
STAGING_REDIS_PASSWORD        → REDIS_PASSWORD
STAGING_JWT_SECRET            → JWT_SECRET
STAGING_PROFILE_ENCRYPTION_KEY → PROFILE_ENCRYPTION_KEY
STAGING_KAKAO_CLIENT_ID       → KAKAO_CLIENT_ID
STAGING_KAKAO_CLIENT_SECRET   → KAKAO_CLIENT_SECRET
STAGING_KAKAO_CALLBACK_URL    → KAKAO_CALLBACK_URL
STAGING_ADMIN_EMAILS          → ADMIN_EMAILS
KAKAO_JS_KEY                  → NEXT_PUBLIC_KAKAO_JS_KEY
```

#### Phase 4: Docker Cleanup & Login (lines 322-331)

- Prunes dangling images older than 72h
- Removes old builder cache
- Logs into GHCR with GitHub token

#### Phase 5: Env Fixes & Image Pull (lines 333-345)

1. Runs `scripts/fix-staging-env.sh` — now has a file to work with!
   - Ensures `RTMP_SERVER_URL` has port 1935
   - Ensures `ENABLE_DEV_AUTH=true`
2. Pulls images from GHCR with `--env-file .env.staging`

#### Phase 6: Uploads Directory Setup (lines 347-351)

Creates `/opt/dorami/backend/uploads` directory (handles Docker permission issues)

#### Phase 7: Container Restart (lines 356-404)

1. Brings down containers WITHOUT removing volumes (preserves DB)
2. Kills any leftover processes on port 8080
3. Ensures external volumes exist: `dorami_postgres_data`, `dorami_redis_data`
4. **Starts postgres + redis first** (services are health-checked before dependent services)
5. Syncs postgres password from GitHub Secrets:
   ```bash
   ALTER USER postgres PASSWORD '${STAGING_POSTGRES_PASSWORD}';
   ```
   If sync fails (e.g., fresh volume), recreates volume from scratch

#### Phase 8: Database Setup (lines 405-414)

1. Creates `live_commerce_staging` database if missing
2. Checks for destructive migrations (warns only on staging)
3. Runs `prisma migrate deploy` (idempotent)

#### Phase 9: Service Health Checks (lines 416-499)

1. **Backend isolated start** — starts backend container alone
2. **Fast-fail detection** — checks if container exited (crashed) every 5s
3. **Health probe loop** — calls `GET /api/health/live` (18 attempts × 5s = 90s max)
4. **Remaining services start** — starts nginx, frontend, srs once backend healthy
5. **Frontend + Nginx health checks** — repeats for each service

#### Phase 10: Comprehensive Network Diagnostics (lines 503-590) ⭐ **VERIFICATION**

Validates entire deployment:

```bash
# Docker container status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Port bindings (ss -tlnp)
ss -tlnp | grep -E ":(80|443|3000|3001|6379|5432)"

# External port 80 binding
docker ps --format "{{.Ports}}" | grep "0.0.0.0:80"

# Localhost connectivity
curl -I http://localhost/api/health/live
curl -I http://localhost

# Nginx config validation
docker compose exec -T nginx nginx -t

# Docker Compose status
docker compose -f docker-compose.base.yml -f docker-compose.staging.yml ps
```

#### Phase 11: Save Image Tag to Repo Variable (lines 595-603)

```bash
gh variable set STAGING_LATEST_IMAGE_TAG --body "${IMAGE_TAG}"
```

Saves `sha-{40hex}` to GitHub repo variables for reuse if next deployment has no source changes.

#### Phase 12: Telegram Notifications (lines 605-628)

Sends success/failure messages to team via Telegram bot.

---

## Docker Compose Configuration

### Base Compose (`docker-compose.base.yml`) — Not Read

Referenced but not examined. Likely defines service templates.

### Staging Override (`docker-compose.staging.yml`)

**File:** Lines 1-199

#### PostgreSQL Service

```yaml
postgres:
  restart: always
  environment:
    POSTGRES_USER: ${POSTGRES_USER:-postgres}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD} # From .env.staging
    POSTGRES_DB: ${POSTGRES_DB:-live_commerce_staging}
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-postgres}']
    interval: 10s
  volumes:
    - dorami_postgres_data:/var/lib/postgresql/data # External volume
```

#### Redis Service

```yaml
redis:
  restart: always
  command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
  healthcheck:
    test: ['CMD', 'redis-cli', '-a', '${REDIS_PASSWORD}', 'ping']
    interval: 10s
```

#### Backend Service

```yaml
backend:
  image: ghcr.io/${GITHUB_REPOSITORY_OWNER}/dorami-backend:${IMAGE_TAG}
  restart: always
  environment:
    DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/live_commerce_staging?...
    REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
    JWT_SECRET: ${JWT_SECRET}
    KAKAO_CLIENT_ID: ${KAKAO_CLIENT_ID}
    KAKAO_CLIENT_SECRET: ${KAKAO_CLIENT_SECRET}
    KAKAO_CALLBACK_URL: ${KAKAO_CALLBACK_URL}
    NODE_ENV: production
    APP_ENV: staging
    ENABLE_DEV_AUTH: true # Allows /api/auth/dev-login
    CSRF_ENABLED: false # Disables CSRF for testing
  healthcheck:
    test: ['CMD', 'wget', '-qO-', 'http://localhost:3001/api/health/live']
    interval: 10s
    start_period: 30s
  volumes:
    - ./backend/uploads:/app/uploads
```

#### Frontend Service

```yaml
frontend:
  image: ghcr.io/${GITHUB_REPOSITORY_OWNER}/dorami-frontend:${IMAGE_TAG}
  restart: always
  environment:
    BACKEND_URL: http://backend:3001
    NEXT_PUBLIC_API_URL: /api
    NEXT_PUBLIC_WS_URL: ws://staging.doremi-live.com
    NEXT_PUBLIC_KAKAO_JS_KEY: ${NEXT_PUBLIC_KAKAO_JS_KEY}
    NEXT_PUBLIC_ENABLE_DEV_AUTH: 'true'
    NEXT_PUBLIC_PREVIEW_ENABLED: 'true'
```

#### Nginx Service

```yaml
nginx:
  image: nginx:alpine
  restart: always
  ports:
    - '80:80'
    - '443:443'
  volumes:
    - ./nginx/staging-ssl.conf:/etc/nginx/conf.d/default.conf:ro
    - ./nginx/ssl:/etc/nginx/ssl:ro # SSL certificates
    - ./backend/uploads:/var/www/uploads
    - certbot_www:/var/www/certbot:ro
  depends_on:
    frontend:
      condition: service_started
    backend:
      condition: service_healthy
```

#### SRS Media Server

```yaml
srs:
  image: ossrs/srs:6
  restart: always
  ports:
    - '1935:1935' # RTMP ingest
  # Port 8080 removed — traffic routes through nginx on internal network
  volumes:
    - ./infrastructure/docker/srs/srs.conf:/usr/local/srs/conf/docker.conf:ro
```

#### Networks & Volumes

```yaml
networks:
  dorami-internal:
    name: dorami-internal
    driver: bridge
    internal: false

volumes:
  postgres_data:
    external: true
    name: dorami_postgres_data
  redis_data:
    external: true
    name: dorami_redis_data
```

---

## Nginx Configuration

### Modified: `nginx/staging-ssl.conf`

**Lines:** 1-230 (complete file)

#### Key Changes (git diff):

1. **Removed rate-limit zone definitions** — now defined in main `nginx.conf` (lines 8-10 diff)
2. **Added inline streaming routes** — replaced `include /etc/nginx/streaming-routing.conf` with 56 lines of explicit location blocks

#### Upstream Servers

```nginx
upstream backend { server backend:3001; }
upstream frontend { server frontend:3000; }
upstream srs { server srs:8080; }
```

#### HTTP → HTTPS Redirect

```nginx
server {
    listen 80;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}
```

#### HTTPS Server (443)

Comprehensive routing:

| Path                           | Destination           | Purpose                            |
| ------------------------------ | --------------------- | ---------------------------------- |
| `/.well-known/acme-challenge/` | `/var/www/certbot`    | Let's Encrypt renewal              |
| `/health`                      | 200 OK                | Health checks (CI, load balancers) |
| `/nginx_status`                | `stub_status`         | Prometheus exporter                |
| `/api/docs`                    | `backend:3001`        | Swagger docs                       |
| `/api/auth`                    | `backend:3001`        | Rate-limited auth (5 req/s)        |
| `/api/csrf`                    | `frontend:3000`       | CSRF token bootstrap               |
| `/api/*`                       | `backend:3001`        | General API (30 req/s)             |
| `/live/live/`                  | `srs:8080/live/live/` | HTTP-FLV (low-latency)             |
| `/live/*.m3u8` `/live/*.ts`    | `srs:8080`            | HLS playlist + segments            |
| `/hls/hls/`                    | 404                   | Prevent CDN conflict               |
| `/hls/`                        | `srs:8080/live/`      | HLS fallback                       |
| `/socket.io/`                  | `backend:3001`        | WebSocket (Socket.IO)              |
| `/uploads/`                    | `/var/www/uploads/`   | Static file serve (cached 30d)     |
| `/_next/static/`               | `frontend:3000`       | Next.js static (cached 1yr)        |
| `/static/`                     | `frontend:3000`       | Public static (cached 24h)         |
| `/`                            | `frontend:3000`       | Default → frontend                 |

#### Security Headers

```nginx
add_header Strict-Transport-Security "max-age=31536000" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

#### Connection Limits

```nginx
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
limit_conn conn_limit 20;  # Max 20 concurrent connections per IP
```

---

## Local Development Configuration

### `docker-compose.yml`

**File:** Lines 1-121 (base dev config)

| Service  | Image                | Port       | Network           | Features                                             |
| -------- | -------------------- | ---------- | ----------------- | ---------------------------------------------------- |
| postgres | `postgres:16-alpine` | 5433       | `dorami-internal` | Default creds: `postgres:postgres`                   |
| redis    | `redis:7-alpine`     | 6379       | `dorami-internal` | Max memory 256MB, LRU eviction                       |
| backend  | Local build          | 3001       | `dorami-internal` | `NODE_ENV=development`                               |
| frontend | Local build          | 3000       | `dorami-internal` | Points to `https://www.doremi-live.com` (production) |
| srs      | `ossrs/srs:6`        | 1935, 8080 | `dorami-internal` | RTMP + HLS on localhost                              |

**Key Difference from Staging:**

- Builds images locally instead of pulling from GHCR
- Uses simple `docker-compose.yml` (no base + staging composition)
- Exposes all ports directly on localhost
- No SSL/HTTPS

---

## Package.json Scripts

### Modified Scripts (git diff)

```json
"smoke:binding": "node ./scripts/smoke-api-ui-binding.mjs",
```

### Related Scripts

```json
"test:backend": "npm run test --workspace=backend",
"test:e2e": "npm run test:e2e --workspace=backend",
"lint:all": "npm run lint:client && npm run lint:backend",
"type-check:all": "npm run type-check:shared && npm run type-check:client && npm run type-check:backend",
"build:all": "npm run build:shared && npm run build:client && npm run build:backend",
"docker:up": "docker-compose up -d",
"docker:down": "docker-compose down",
```

---

## Supporting Scripts

### `scripts/fix-staging-env.sh` (lines 1-69)

**Purpose:** Post-deployment env var fixups

Runs AFTER `.env.staging` is created from GitHub Secrets:

1. Ensures file exists (fallback hardcoded values)
2. Checks `RTMP_SERVER_URL` has port 1935
3. Ensures `ENABLE_DEV_AUTH=true`

### `scripts/validate-env.sh` (lines 1-81)

**Purpose:** Validate environment variable presence before docker-compose up

Checks required vars:

- `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `KAKAO_CALLBACK_URL`
- `DATABASE_URL`, `REDIS_URL`, `REDIS_PASSWORD`
- `JWT_SECRET`, `PROFILE_ENCRYPTION_KEY`

### `scripts/compare-env.sh` (lines 1-56)

**Purpose:** Ensure staging and production docker-compose files have identical env var structures

Used to prevent staging-only or prod-only variables that would cause deployment drift.

---

## Environment Variable Handling

### Single Source of Truth: GitHub Secrets

All secrets are stored **only** in GitHub repository secrets:

- `STAGING_KAKAO_CLIENT_ID`
- `STAGING_KAKAO_CLIENT_SECRET`
- `STAGING_KAKAO_CALLBACK_URL`
- `STAGING_JWT_SECRET`
- `STAGING_POSTGRES_PASSWORD`
- `STAGING_REDIS_PASSWORD`
- `STAGING_PROFILE_ENCRYPTION_KEY`
- `STAGING_ADMIN_EMAILS`
- `KAKAO_JS_KEY`

### Workflow at Deployment Time

```
GitHub Secrets
    ↓
deploy-staging.yml env section (lines 213-247)
    ↓
SSH variables exported (line 234-247 in ENDSSH block)
    ↓
cat > .env.staging (lines 288-318)
    ↓
docker-compose --env-file .env.staging pull/up
    ↓
scripts/fix-staging-env.sh (line 334)
    ↓
Deployment complete ✓
```

### Why This Prevents the Env Loss Bug

**Previous behavior (❌ Broken):**

1. `.env.staging` stored on staging server locally (not in git)
2. Deploy script runs `git reset --hard origin/develop`
3. git reset deletes `.env.staging` (not tracked by git)
4. `fix-staging-env.sh` tries to read a file that no longer exists
5. Script fails with "file not found"
6. Deployment marked as `startup_failure`

**New behavior (✅ Fixed):**

1. All secrets in GitHub repository settings
2. Deploy script sources secrets into env vars
3. Deploy script **recreates** `.env.staging` from env vars before git reset
4. git reset has no effect on `.env.staging` (it was just created)
5. `fix-staging-env.sh` finds file and runs adjustments
6. Deployment succeeds

---

## Recent Changes (git status)

### Modified Files

1. **`docker-compose.staging.yml`** (line 141-142 diff)
   - Changed nginx config volume from `./nginx/conf.d/staging.conf` → `./nginx/staging-ssl.conf`
   - Added SSL volume mount: `./nginx/ssl:/etc/nginx/ssl:ro`

2. **`nginx/staging-ssl.conf`** (56-line addition)
   - Removed rate-limit zone definitions (moved to `nginx.conf`)
   - Added inline streaming route handlers (HTTP-FLV, HLS, Socket.IO, uploads)
   - Consolidated all nginx configuration in one file

3. **`package.json`** (line 27 addition)
   - Added `"smoke:binding"` script pointing to `smoke-api-ui-binding.mjs`

### New Files (Uncommitted)

- `.omx/` — OMC (oh-my-claudecode) state directory
- `backend/test/health.binding.e2e-spec.ts` — E2E binding tests
- `backend/test/notifications.binding.e2e-spec.ts` — E2E binding tests
- `restore-buyer.js` — Data restoration utility
- `scripts/smoke-api-ui-binding.mjs` — API-UI smoke test
- `test-decrypt.js` — Encryption testing utility

---

## Deployment Flow Diagram

```
develop branch push
    ↓
[Check] Source changes detected?
    ├─→ NO → Reuse STAGING_LATEST_IMAGE_TAG
    └─→ YES → Run tests
              ↓
         [Test] Backend CI, Frontend CI
              ↓
         [Build] Backend image, Frontend image → GHCR
              ↓
         [Deploy via SSH]
            ├─ SSH key setup
            ├─ Git fetch + git reset --hard
            ├─ Create .env.staging from GitHub Secrets ⭐
            ├─ fix-staging-env.sh
            ├─ docker login GHCR
            ├─ docker pull images
            ├─ docker compose down
            ├─ Start postgres, redis → healthcheck
            ├─ Sync postgres password
            ├─ prisma migrate deploy
            ├─ Start backend → healthcheck
            ├─ Start frontend, nginx, srs
            ├─ Network diagnostics
            └─ Telegram notification
              ↓
         ✅ Deployment complete (or ❌ Failure)
```

---

## Critical Success Factors

| Factor                   | Why                                         | How                                                                        |
| ------------------------ | ------------------------------------------- | -------------------------------------------------------------------------- |
| Image immutability       | Reproduced deployments must use same code   | Commit SHA in image tag (`sha-{40hex}`)                                    |
| Health checks            | Detect crashes before declaring success     | `wget` to `/api/health/live`, container state inspection                   |
| Env var durability       | Secrets survive `git reset --hard`          | Recreate `.env.staging` from GitHub Secrets before git reset               |
| Fast-fail on crash       | Don't wait 90s if container already crashed | Check `docker inspect --format Status` every 5s                            |
| Port conflict prevention | nginx/srs port binding conflicts            | Remove nginx port 8080, route SRS through internal network + reverse proxy |
| Volume persistence       | DB/Redis data survives container restarts   | Use external Docker volumes (`dorami_postgres_data`, `dorami_redis_data`)  |
| Network routing          | Services can reach each other               | All on `dorami-internal` bridge network; upstream blocks define DNS        |

---

## Troubleshooting Guide

### Symptom: "Backend health check failed after 90s"

**Check 1: Container crashed?**

```bash
ssh staging-host
docker logs dorami-backend-1 --tail 100
```

Look for: module not found, env var error, connection refused

**Check 2: Database not ready?**

```bash
docker logs dorami-postgres-1 --tail 50
docker exec dorami-postgres-1 pg_isready
```

**Check 3: Health endpoint 404?**

```bash
docker exec dorami-backend-1 wget -qO- http://localhost:3001/api/health/live
```

Backend API might be running on wrong port

---

### Symptom: "Cannot reach frontend from external domain"

**Check 1: nginx serving correctly?**

```bash
docker logs dorami-nginx-1 --tail 100
docker compose exec nginx nginx -t
```

**Check 2: Port 80 bound externally?**

```bash
docker ps --format "{{.Ports}}" | grep "0.0.0.0:80"
```

Should show: `0.0.0.0:80->80/tcp`

**Check 3: Frontend responding?**

```bash
curl -I http://localhost:3000
docker logs dorami-frontend-1 --tail 50
```

---

### Symptom: "git reset deletes .env.staging"

**Root cause:** File not tracked by git, gets deleted by `git reset --hard`

**Solution:** Already fixed! Workflow now recreates `.env.staging` from GitHub Secrets BEFORE git reset (lines 287-320 in deploy-staging.yml)

---

## References

- **GitHub Secrets Setup:** Repository Settings → Secrets and variables → Actions
- **Docker Networking:** https://docs.docker.com/network/bridge/
- **Nginx Reverse Proxy:** https://nginx.org/en/docs/http/ngx_http_proxy_module.html
- **SRS Documentation:** https://ossrs.io/
- **Socket.IO with Nginx:** https://socket.io/docs/v4/reverse-proxy/#nginx
