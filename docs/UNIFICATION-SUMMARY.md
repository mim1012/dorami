# Production Docker Compose Unification — Implementation Summary

**Completed:** 2026-02-27
**Status:** ✅ All Tasks Completed
**Implementation Plan:** `Production Docker Compose 통일 계획`

---

## Executive Summary

Successfully unified the production environment from a **Host nginx (SSL) + Docker hybrid** setup to a **pure Docker Compose** architecture, matching the staging environment structure. This eliminates environment drift and reduces deployment complexity.

### Key Achievement

- **Before:** Host nginx (SSL termination) + Docker apps (ports bound to 127.0.0.1)
- **After:** Docker nginx container handles SSL termination + Docker apps (internal network only)

---

## Completed Deliverables

### 1. ✅ nginx/production.conf (New File)

**Location:** `D:\Project\dorami\nginx\production.conf`

**Features:**

- HTTP (port 80) → HTTPS (port 443) redirect
- Domain redirect: doremi-live.com → www.doremi-live.com
- SSL/TLS 1.2+ with strong ciphers
- Security headers (HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- Upstream services configured for Docker internal network:
  - backend:3001 (NestJS API)
  - frontend:3000 (Next.js)
  - srs:8080 (SRS media server)
- Location blocks:
  - `/api/` → backend
  - `/socket.io/` → backend (WebSocket with upgrade headers)
  - `/live/live/` → srs (HTTP-FLV, low-latency)
  - `/hls/` → srs (HLS fallback)
  - `/uploads/` → /var/www/uploads/ (static files)
  - `/` → frontend (Next.js)
- Rate limiting (100 req/s general, 30 req/s API, 20 req/s chat)
- Gzip compression enabled
- Keep-alive connections configured
- ACME challenge support for certbot

### 2. ✅ docker-compose.prod.yml (Modified)

**Location:** `D:\Project\dorami\docker-compose.prod.yml`

**Changes:**

```yaml
nginx: # NEW SERVICE
  image: nginx:alpine
  container_name: dorami-nginx-prod
  ports:
    - '80:80'
    - '443:443'
  volumes:
    - ./nginx/production.conf:/etc/nginx/conf.d/default.conf:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro
    - /var/www/certbot:/var/www/certbot:ro
    - uploads_data:/var/www/uploads:ro
  depends_on:
    - backend
    - frontend
    - srs
  healthcheck:
    test: ['CMD', 'wget', '-qO-', 'http://localhost/health']
    interval: 10s
    timeout: 5s
    retries: 5
  networks:
    - dorami-internal
```

**SRS Port Change:**

- From: `0.0.0.0:8080:8080` (exposed to all interfaces)
- To: `127.0.0.1:8080:8080` (internal Docker network only)
- RTMP remains: `0.0.0.0:1935:1935` (public for encoders)

**Uploads Volume:**

- backend mounts as: `uploads_data:/app/uploads:rw` (read-write)
- nginx mounts as: `uploads_data:/var/www/uploads:ro` (read-only)
- Shared via named volume (`uploads_data`)

---

### 3. ✅ deploy-production.yml (Modified)

**Location:** `.github/workflows/deploy-production.yml`

**Key Changes:**

#### a) Host nginx Shutdown (Line 360-365)

```yaml
- name: Stop and disable host nginx
  run: |
    ssh $USER@$HOST 'sudo systemctl stop nginx || true; sudo systemctl disable nginx || true'
```

#### b) Copy Files to Server (Line 386)

```yaml
- name: Copy compose files to server
  run: |
    scp nginx/production.conf $USER@$HOST:/opt/dorami/nginx/production.conf
    scp -r infrastructure/docker/srs $USER@$HOST:/opt/dorami/infrastructure/docker/
```

#### c) Deployment Script Updates (Line 622-627)

```bash
# 12. Start nginx service (Now includes nginx service with SSL)
echo "=== Starting nginx ==="
docker compose -f docker-compose.prod.yml --env-file .env.production \
  up -d --no-deps nginx 2>&1 | tail -5
```

#### d) Certbot Renewal Hook (Line 667-682)

```yaml
- name: Setup certbot renewal hook for nginx reload
  run: |
    ssh $USER@$HOST 'bash -s' << 'ENDSSH'
      sudo mkdir -p /etc/letsencrypt/renewal-hooks/post
      cat > /tmp/reload-nginx.sh << 'EOF'
      #!/bin/bash
      cd /home/ubuntu/dorami
      docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload
      EOF
      sudo mv /tmp/reload-nginx.sh /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh
      sudo chmod +x /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh
    ENDSSH
```

#### e) Smoke Tests (Line 734-778)

- HTTPS health check: `curl -s https://www.doremi-live.com/api/health`
- HTTP redirect: `curl -I http://www.doremi-live.com` (expects 301/302)
- SRS API check: `curl -sf http://localhost:1985/api/v1/versions`
- RTMP port check: `nc -zw3 localhost 1935`
- HTTP-FLV routing: `/live/live/smoke-check.flv`
- HLS routing: `/hls/smoke-check.m3u8`
- Live page: `/live` endpoint

#### f) nginx Healthcheck (Line 684-705)

```yaml
- name: Wait for nginx container health
  run: |
    for i in $(seq 1 12); do
      docker compose -f ... ps nginx | grep healthy
      # retry logic
    done
```

---

### 4. ✅ prod-maintenance.yml (Modified)

**Location:** `.github/workflows/prod-maintenance.yml`

**Changes:**

#### a) logs-proxy Command (Line 241-246)

- Updated to use `dorami-nginx-prod` instead of `dorami-proxy-prod`

#### b) diagnose Command (Line 335-338)

- Updated nginx references from `nginx-proxy` to `nginx`
- Removed old volume references

#### c) fix-ssl Command (Line 364-396)

- Removed references to `dorami_certbot_conf` volume
- Now uses host `/etc/letsencrypt` directory
- Simplified cert management for docker nginx container
- Updated to restart `nginx` container (not `nginx-proxy`)

---

### 5. ✅ Verification Checklist (New File)

**Location:** `docs/production-docker-unification-verification.md`

**Comprehensive 16-point verification including:**

1. Configuration files validation
2. Docker container health
3. Network connectivity
4. HTTPS health check
5. HTTP redirect check
6. SSL certificate validity
7. WebSocket connectivity
8. Static file serving
9. Streaming routes (HTTP-FLV, HLS)
10. API endpoint routing
11. Frontend routing
12. Certbot renewal hook
13. Security headers
14. Rate limiting
15. Host nginx status
16. Rollback readiness

---

## Architecture Changes

### Current (Before)

```
Internet
  ↓
Host nginx (SSL, port 80/443)
  ↓
Docker containers (localhost:3001, localhost:3000, localhost:8080)
  ├─ backend (port 3001)
  ├─ frontend (port 3000)
  └─ srs (port 8080)
```

### New (After)

```
Internet
  ↓
Docker nginx (SSL, port 80/443)
  ↓
Docker internal network (dorami-internal)
  ├─ backend:3001 (internal only)
  ├─ frontend:3000 (internal only)
  ├─ srs:8080 (internal only)
  └─ postgres, redis, etc.

RTMP: 0.0.0.0:1935 (external, unchanged)
```

---

## SSL Certificate Management

### Before

- Host certbot managed certificates at `/etc/letsencrypt/live/doremi-live.com/`
- Host nginx loaded and served SSL certs
- No renewal hook coordination needed

### After

- Host certbot still manages certificates at `/etc/letsencrypt/live/doremi-live.com/`
- Docker nginx **mounts** host's `/etc/letsencrypt` read-only
- **Certbot renewal hook** triggers nginx reload:
  ```bash
  /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh
  ↓
  docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload
  ```
- Seamless certificate renewal without downtime

---

## Deployment Steps

1. **Pre-deployment:** Ensure SSL certificates exist at `/etc/letsencrypt/live/doremi-live.com/`
2. **Trigger deployment:** GitHub Actions workflow `deploy-production.yml`
3. **Automatic steps:**
   - Stop and disable host nginx
   - Pull latest Docker images
   - Copy nginx/production.conf to server
   - Start Docker containers (postgres, redis, backend, frontend, srs, **nginx**)
   - Wait for healthchecks
   - Run smoke tests (HTTPS, HTTP redirect, WebSocket, streaming, API)
   - Install certbot renewal hook
   - Create Sentry release
   - Run post-deployment verification

---

## Rollback Plan

If issues occur, rollback is simple:

```bash
# 1. Stop Docker nginx
docker compose -f docker-compose.prod.yml down nginx

# 2. Enable and start host nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# 3. Nginx will serve from /etc/nginx/sites-enabled/doremi-live.com
# (configuration preserved from before deployment)
```

**Estimated downtime:** ~30 seconds

---

## Testing Checklist

Before production deployment, test:

- [ ] Staging environment works with new docker-compose.staging.yml
- [ ] SSL certificate validity checked
- [ ] WebSocket connections tested (real-time features)
- [ ] Upload endpoint tested (nginx passes requests)
- [ ] Streaming routes tested (HTTP-FLV, HLS)
- [ ] API endpoints tested
- [ ] Frontend pages load correctly
- [ ] Rate limiting verified (not overly restrictive)
- [ ] Certbot renewal hook works in test environment
- [ ] Rollback tested (host nginx still functional)

---

## Files Modified

| File                                                 | Changes                                           | Status     |
| ---------------------------------------------------- | ------------------------------------------------- | ---------- |
| `nginx/production.conf`                              | NEW                                               | ✅ Created |
| `docker-compose.prod.yml`                            | nginx service + SRS port change                   | ✅ Updated |
| `.github/workflows/deploy-production.yml`            | Host nginx shutdown + nginx startup + smoke tests | ✅ Updated |
| `.github/workflows/prod-maintenance.yml`             | nginx references updated + fix-ssl simplified     | ✅ Updated |
| `docs/production-docker-unification-verification.md` | NEW                                               | ✅ Created |

---

## Benefits

✅ **Environment Parity:** Production now matches staging structure
✅ **Simplified Deployment:** Single docker-compose command for all infra
✅ **Better Testing:** Staging tests guarantee production behavior
✅ **Reduced Complexity:** No host nginx management
✅ **Improved Security:** Clear network isolation via Docker networking
✅ **Easier Maintenance:** All services in Docker, consistent management
✅ **Faster Iteration:** Can test full stack locally with docker-compose
✅ **Atomic Scaling:** Easy to scale services or replicate setup

---

## Next Steps

1. **Code Review:** Review changes in pull request
2. **Staging Test:** Deploy to staging first
3. **Verification:** Run full verification checklist
4. **Production Approval:** Obtain approval for production deployment
5. **Production Deploy:** Trigger via GitHub Actions workflow
6. **Monitor:** Watch logs for 24 hours post-deployment

---

## Support & Troubleshooting

### Common Issues

**nginx container won't start**

- Check syntax: `docker exec dorami-nginx-prod nginx -t`
- Check logs: `docker logs dorami-nginx-prod`
- Verify config file copied: `cat /opt/dorami/nginx/production.conf | head -20`

**SSL certificate errors**

- Verify certs exist: `ls -la /etc/letsencrypt/live/doremi-live.com/`
- Check mount: `docker exec dorami-nginx-prod ls /etc/letsencrypt/live/`
- Reload nginx: `docker exec dorami-nginx-prod nginx -s reload`

**WebSocket connection fails**

- Check `/socket.io/` proxy configuration in nginx
- Verify upgrade headers: `Upgrade: websocket`, `Connection: upgrade`
- Check backend is running: `docker ps | grep backend`

**Upload endpoint returns 413**

- Verify `client_max_body_size 10M;` in production.conf
- Reload nginx: `docker compose exec nginx nginx -s reload`

### Monitoring Commands

```bash
# Container status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# nginx logs
docker logs dorami-nginx-prod -f --tail=100

# Backend API logs
docker logs dorami-backend-prod -f --tail=50

# Resource usage
docker stats dorami-nginx-prod

# SSL certificate check
openssl s_client -connect www.doremi-live.com:443 -showcerts
```

---

**Prepared by:** Claude Code
**Implementation Date:** 2026-02-27
**Status:** Ready for Deployment
