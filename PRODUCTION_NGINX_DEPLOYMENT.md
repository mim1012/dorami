# Production Nginx Deployment & Verification Guide (2026-03-04)

## 📋 Summary of Changes

### docker-compose.prod.yml (Updated)

```yaml
volumes:
  - ./infrastructure/docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
  - ./infrastructure/docker/nginx/conf.d:/etc/nginx/conf.d:ro
  - /etc/letsencrypt:/etc/letsencrypt:ro
  - /var/www/certbot:/var/www/certbot:ro
  - uploads_data:/var/www/uploads:ro
```

**Advantages:**

- ✅ Loads nginx main config + all conf.d configs atomically
- ✅ Eliminates file path mismatches
- ✅ No compose modification needed when adding new config files
- ✅ More robust and maintainable structure

---

## 🔴 CRITICAL RULE: Docker Compose DNS Resolution

**All internal service communication MUST use SERVICE NAME, never container_name:**

```yaml
# ✅ CORRECT (Docker Compose DNS resolves service name)
proxy_pass http://backend:3001;        # service: backend
proxy_pass http://frontend:3000;       # service: frontend
proxy_pass http://postgres:5432;       # service: postgres
proxy_pass http://redis:6379;          # service: redis
proxy_pass http://srs:8080;            # service: srs

# ❌ WRONG (container_name causes DNS resolution failure)
proxy_pass http://dorami-backend-prod:3001;      # upstream host not found!
proxy_pass http://dorami-frontend-prod:3000;     # upstream host not found!
```

**Why?** Docker Compose's internal DNS only recognizes service names defined in `services:` block. `container_name` is cosmetic (for `docker ps` display) and cannot be used for networking.

**Verification:** All proxy_pass routes in `default.conf` use correct service names ✅

---

## 🚀 Production Deployment Steps

### Step 1: Push changes to git

```bash
git add docker-compose.prod.yml
git commit -m "fix: Correct Nginx config volume paths in docker-compose.prod.yml"
git push origin main
```

### Step 2: SSH to production server

```bash
ssh -i dorami-prod-key.pem ubuntu@15.165.66.23
cd /opt/dorami
git pull origin main
```

### Step 3: Deploy with force-recreate (IMPORTANT)

Since volume paths changed, container must be recreated:

```bash
docker compose \
  --env-file .env.production \
  -f docker-compose.prod.yml \
  up -d --force-recreate nginx
```

**Why `--force-recreate`?**

- Volume path changes require container recreation
- Without it, old volume mounts will persist
- This ensures clean, correct deployment

---

## ✅ Verification Checklist (CRITICAL)

Follow this sequence AFTER deployment:

### 1️⃣ Container Status

```bash
docker ps | grep dorami-nginx-prod
```

**Expected:** Container shows `Up X seconds` with `(healthy)`

### 2️⃣ Check Nginx Logs

```bash
docker logs dorami-nginx-prod
```

**Expected:** No error messages. Should see something like:

```
nginx: [notice] signal process started
```

### 3️⃣ Verify Nginx Config Syntax ⚠️ CRITICAL

```bash
docker exec dorami-nginx-prod nginx -t
```

**Expected Output:**

```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**If this fails:**

- ❌ Do NOT restart the container
- Check logs: `docker logs dorami-nginx-prod`
- Verify config files exist: `docker exec dorami-nginx-prod ls -la /etc/nginx/conf.d/`
- Manually test: `docker exec -it dorami-nginx-prod sh` then `cat /etc/nginx/conf.d/default.conf`

### 4️⃣ Verify Docker Network Connectivity

```bash
docker network inspect dorami_dorami-internal
```

**Expected:** All containers in `Containers` section:

```json
"Containers": {
  "...nginx_container_id...": {
    "Name": "dorami-nginx-prod",
    ...
  },
  "...frontend_container_id...": {
    "Name": "dorami-frontend-prod",
    ...
  },
  "...backend_container_id...": {
    "Name": "dorami-backend-prod",
    ...
  },
  "...srs_container_id...": {
    "Name": "dorami-srs-prod",
    ...
  }
}
```

**If any container is missing:**

- ❌ Nginx cannot proxy to that service
- Result: `upstream host not found` errors
- Fix: Ensure all services are running on same network

### 5️⃣ Test Internal DNS & Proxy (Inside Container)

```bash
docker exec -it dorami-nginx-prod sh
```

Inside the container shell:

```bash
# Test backend connectivity
wget -qO- http://backend:3001/api/health

# Test frontend connectivity
wget -qO- http://frontend:3000

# Test SRS connectivity
wget -qO- http://srs:8080/api/v1/servers

# Exit
exit
```

**Expected:** Each returns HTTP 200/similar status

**If you get:**

- `Resolving backend... failed: Temporary failure in name resolution` → Network issue
- `Connection refused` → Service not running
- `Connection timed out` → Service not listening

### 6️⃣ Test Health Endpoint (External)

```bash
# From your local machine:
curl -i http://15.165.66.23/health

# Or from production server:
curl -i http://localhost/health
```

**Expected:**

```
HTTP/1.1 200 OK
Content-Type: text/plain
Content-Length: 8

healthy
```

### 7️⃣ Test HTTP → HTTPS Redirect

```bash
curl -i http://15.165.66.23/
```

**Expected:**

```
HTTP/1.1 301 Moved Permanently
Location: https://15.165.66.23/
```

### 8️⃣ Test HTTPS Access (Most Important)

```bash
curl -I https://www.doremi-live.com/
```

**Expected:**

```
HTTP/2 200
content-type: text/html; charset=utf-8
```

**Common Issues:**

| Issue                                    | Cause                              | Fix                                |
| ---------------------------------------- | ---------------------------------- | ---------------------------------- |
| `curl: (7) Failed to connect... refused` | Nginx not listening on 443         | Check `docker ps`, logs            |
| `SSL certificate problem`                | Let's Encrypt cert missing/expired | Renew certs (see below)            |
| `upstream host not found`                | Network connectivity issue         | Check Step 4️⃣ (network)            |
| `502 Bad Gateway`                        | Backend/frontend not responding    | Check `docker exec` test (Step 5️⃣) |

### 9️⃣ Test Frontend Access

```bash
# Via domain
curl -I https://www.doremi-live.com/

# Or in browser:
# https://www.doremi-live.com
```

**Expected:** HTTP 200, HTML content loads

### 🔟 Test API Access

```bash
curl https://www.doremi-live.com/api/health/live
```

**Expected:** JSON response (health status)

---

## 🔐 SSL Certificate Management

### Check Current Certificates

```bash
docker exec dorami-nginx-prod ls -la /etc/letsencrypt/live/doremi-live.com/
```

**Expected files:**

- `fullchain.pem` (public certificate)
- `privkey.pem` (private key)

### Renew Expired Certificates (if needed)

```bash
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot renew
```

---

## 🏗️ Final Architecture Verification

After all steps pass, architecture should be:

```
Internet (clients)
    ↓ HTTPS (80/443)
Nginx Container (dorami-nginx-prod)
    ↓
Docker Internal Network (dorami_dorami-internal)
    ├→ Frontend Container (3000) — Next.js app
    ├→ Backend Container (3001) — NestJS API
    └→ SRS Container (8080) — Media streaming
```

**Key Points:**

- ✅ All traffic encrypted (HTTPS via Let's Encrypt)
- ✅ Single entry point (Nginx on 80/443)
- ✅ Internal services protected (only exposed via Nginx)
- ✅ Reverse proxy handles routing by path/domain
- ✅ 139 production users preserved (database untouched)

---

## 📊 Complete Verification Summary

Create a checklist file `DEPLOYMENT_VERIFICATION.txt`:

```
PRODUCTION DEPLOYMENT - 2026-03-04

Docker Image Versions:
- Nginx: nginx:alpine ✓
- PostgreSQL: postgres:16-alpine ✓
- Redis: redis:7-alpine ✓
- SRS: ossrs/srs:6 ✓
- Backend: ghcr.io/{owner}/dorami-backend:latest ✓
- Frontend: ghcr.io/{owner}/dorami-frontend:latest ✓

Container Status:
- [ ] dorami-nginx-prod UP & healthy
- [ ] dorami-postgres-prod UP & healthy
- [ ] dorami-redis-prod UP & healthy
- [ ] dorami-srs-prod UP & healthy
- [ ] dorami-backend-prod UP & healthy
- [ ] dorami-frontend-prod UP & healthy

Config Validation:
- [ ] nginx -t passes (syntax check)
- [ ] docker network has all 6 containers
- [ ] /etc/nginx/conf.d/default.conf exists in container
- [ ] /etc/letsencrypt/live/doremi-live.com/ has fullchain.pem & privkey.pem

Internal Connectivity (from nginx container):
- [ ] wget -qO- http://backend:3001/api/health → 200
- [ ] wget -qO- http://frontend:3000 → 200
- [ ] wget -qO- http://srs:8080/api/v1/servers → 200

External Access:
- [ ] curl http://localhost/health → 200 "healthy"
- [ ] curl http://15.165.66.23/ → 301 (redirect to HTTPS)
- [ ] curl -I https://www.doremi-live.com/ → 200
- [ ] curl https://www.doremi-live.com/api/health/live → JSON response

Business Functionality:
- [ ] Frontend loads at https://www.doremi-live.com
- [ ] Kakao OAuth works (login button visible)
- [ ] Socket.IO WebSocket connects (chat/streaming real-time)
- [ ] Product list loads (API data binding)
- [ ] 139 production users intact (SELECT COUNT(*) FROM "User";)
```

---

## 🚨 Troubleshooting

### Nginx container restarts in loop

```bash
docker logs dorami-nginx-prod
# If "connection refused" → backend/frontend not ready
# If "syntax error" → Check Step 3️⃣ (nginx -t)
```

### "upstream host not found"

```bash
# Check network:
docker network inspect dorami_dorami-internal
# All 4 services must be present
```

### SSL certificate errors

```bash
# Check cert validity:
docker exec dorami-nginx-prod openssl x509 -in /etc/letsencrypt/live/doremi-live.com/fullchain.pem -noout -dates

# Should show:
# notBefore=... (past)
# notAfter=... (future, >30 days)
```

### 502 Bad Gateway

```bash
# Check if backend/frontend are responding:
docker exec dorami-nginx-prod curl -I http://backend:3001/api/health
docker exec dorami-nginx-prod curl -I http://frontend:3000
```

---

## ✅ Deployment Complete Criteria

All of the following must be TRUE:

1. ✅ docker-compose.prod.yml pushed to main
2. ✅ Nginx container recreated with `--force-recreate`
3. ✅ `docker exec ... nginx -t` shows "test is successful"
4. ✅ All 6 containers healthy (`docker ps`)
5. ✅ All 4 services in docker network (`docker network inspect`)
6. ✅ Internal proxy tests pass (wget from nginx container)
7. ✅ `curl https://www.doremi-live.com/` returns 200
8. ✅ Frontend + API accessible via domain
9. ✅ 139 production users verified in database
10. ✅ WebSocket connects successfully

**When all 10 are TRUE → DEPLOYMENT COMPLETE & SAFE**
