# Production Docker Compose Unification — Verification Checklist

**Date:** 2026-02-27
**Status:** Pre-deployment
**Objective:** Verify that the production Docker Compose setup with unified nginx container works correctly

---

## Pre-Deployment Verification

### 1. Configuration Files Verification

#### nginx/production.conf

- [x] File created at `nginx/production.conf`
- [x] Contains HTTP → HTTPS redirect
- [x] Contains doremi-live.com → www.doremi-live.com redirect
- [x] SSL certificate paths: `/etc/letsencrypt/live/doremi-live.com/`
- [x] TLS 1.2+ configured
- [x] Security headers configured (HSTS, X-Frame-Options, X-Content-Type-Options)
- [x] Upstream backends configured:
  - [x] backend:3001 (NestJS)
  - [x] frontend:3000 (Next.js)
  - [x] srs:8080 (SRS media server)
- [x] Location blocks configured:
  - [x] /api/ → backend
  - [x] /socket.io/ → backend (WebSocket)
  - [x] /live/live/ → srs (HTTP-FLV)
  - [x] /hls/ → srs (HLS)
  - [x] /uploads/ → /var/www/uploads/ (static files)
  - [x] / → frontend (Next.js)
- [x] Rate limiting configured
- [x] Gzip compression enabled

#### docker-compose.prod.yml

- [x] nginx service added with:
  - [x] Image: nginx:alpine
  - [x] Container name: dorami-nginx-prod
  - [x] Ports: 80:80, 443:443
  - [x] Volume mounts:
    - [x] ./nginx/production.conf → /etc/nginx/conf.d/default.conf (ro)
    - [x] /etc/letsencrypt → /etc/letsencrypt (ro)
    - [x] /var/www/certbot → /var/www/certbot (ro)
    - [x] uploads_data → /var/www/uploads (ro)
  - [x] Depends on backend, frontend, srs
  - [x] Healthcheck configured
- [x] SRS port modified to 127.0.0.1:8080:8080 (internal only)
- [x] RTMP port remains 0.0.0.0:1935:1935 (external)
- [x] uploads_data volume shared between backend (rw) and nginx (ro)

#### deploy-production.yml

- [x] Host nginx stop/disable step added
- [x] Certbot renewal hook setup step added
- [x] nginx service startup in deployment script
- [x] nginx healthcheck wait step added
- [x] HTTPS health check in smoke tests
- [x] HTTP → HTTPS redirect check in smoke tests
- [x] HTTP-FLV routing check
- [x] HLS routing check
- [x] nginx/production.conf copied to server

#### prod-maintenance.yml

- [x] logs-proxy command renamed to use dorami-nginx-prod
- [x] diagnose command updated to reference nginx (not nginx-proxy)
- [x] fix-ssl command updated to use nginx container and host /etc/letsencrypt mount

---

## Post-Deployment Verification Checklist

### 2. Docker Container Health

```bash
# Run after deployment
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Verify dorami-nginx-prod container:
# - Status: healthy
# - Ports: 0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

**Expected Result:** dorami-nginx-prod container is running and healthy

---

### 3. Network Connectivity

```bash
# Verify Docker internal networking
docker inspect dorami-nginx-prod --format '{{json .NetworkSettings.Networks}}'

# Should show dorami-internal network with IP assignment
```

**Expected Result:** nginx container is on dorami-internal network

---

### 4. HTTPS Health Check

```bash
curl -s https://www.doremi-live.com/api/health

# Expected response:
# {"data":{"status":"ok"},"success":true,"timestamp":"..."}
```

**Expected Result:** 200 OK with valid health response

---

### 5. HTTP Redirect Check

```bash
curl -I http://www.doremi-live.com

# Expected response headers:
# HTTP/1.1 301 Moved Permanently
# Location: https://www.doremi-live.com/
```

**Expected Result:** HTTP requests redirect to HTTPS (301/302)

---

### 6. SSL Certificate Validity

```bash
curl -vI https://www.doremi-live.com 2>&1 | grep -E "SSL|expire|subject"

# Or check directly on server:
openssl s_client -connect www.doremi-live.com:443 -showcerts < /dev/null 2>/dev/null | \
  openssl x509 -noout -dates -subject

# Should show:
# - subject: CN=doremi-live.com (or www.doremi-live.com)
# - notBefore: (valid)
# - notAfter: (expiration date in future)
```

**Expected Result:** SSL certificate is valid and matches domain

---

### 7. WebSocket Connectivity

```bash
# Visit live page in browser and check WebSocket connection
# 1. Navigate to https://www.doremi-live.com/live
# 2. Open DevTools → Network tab
# 3. Look for WebSocket connection to /socket.io/
# 4. Status should be "101 Switching Protocols"

# Or test via curl:
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  https://www.doremi-live.com/socket.io/?transport=websocket
```

**Expected Result:** WebSocket connection established successfully

---

### 8. Static File Serving (/uploads/)

```bash
# Test upload endpoint with valid auth
curl -s https://www.doremi-live.com/api/upload/image \
  -F "file=@test.png" \
  -H "Authorization: Bearer <valid_token>"

# Should respond with upload result (not 413 Payload Too Large)
```

**Expected Result:** nginx passes upload requests to backend (200, 201, or 401/403 - NOT 413)

---

### 9. Streaming Routes

```bash
# Test HTTP-FLV route
curl -sk -o /dev/null -w "%{http_code}" \
  "https://www.doremi-live.com/live/live/test.flv"
# Expected: 404 (stream not active) or 200 (stream active)
# NOT 502 (bad gateway)

# Test HLS route
curl -sk -o /dev/null -w "%{http_code}" \
  "https://www.doremi-live.com/hls/test.m3u8"
# Expected: 404 or 200
# NOT 502
```

**Expected Result:** nginx → SRS routing works (no 502 errors)

---

### 10. API Endpoint Routing

```bash
# Test API endpoint
curl -s https://www.doremi-live.com/api/streaming/upcoming | jq '.data'

# Should return valid JSON array
```

**Expected Result:** Backend API requests routed correctly through nginx

---

### 11. Frontend Routing

```bash
# Test Next.js routing
curl -s https://www.doremi-live.com/ -L -I | head -5

# Should return 200 with HTML content
```

**Expected Result:** Frontend pages load correctly through nginx

---

### 12. Certbot Renewal Hook

```bash
# Verify hook exists and is executable
ls -la /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh

# Expected:
# -rwxr-xr-x 1 root root ... /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh

# Test hook
sudo bash /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh
# Should output: nginx reloaded successfully (if nginx is running)
```

**Expected Result:** Hook is installed and executable

---

### 13. Security Headers

```bash
curl -sI https://www.doremi-live.com | grep -E "Strict-Transport|X-Frame|X-Content-Type|X-XSS"

# Expected headers:
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
```

**Expected Result:** All security headers present

---

### 14. Rate Limiting

```bash
# Test rate limiting (should not be hit during normal usage)
for i in {1..150}; do
  curl -s https://www.doremi-live.com/api/health > /dev/null
done

# Should receive HTTP 200 responses, not 429 (Too Many Requests)
```

**Expected Result:** Rate limiting allows normal traffic, only blocks abuse

---

### 15. Host Nginx Status

```bash
# Verify host nginx is stopped and disabled
systemctl is-active nginx
# Should output: inactive

systemctl is-enabled nginx
# Should output: disabled

# Verify port 80/443 are handled by Docker nginx
ss -tlnp | grep -E ':80|:443'
# Should show docker-proxy listening, not nginx
```

**Expected Result:** Host nginx is stopped and Docker nginx handles ports 80/443

---

### 16. Rollback Readiness

```bash
# Verify host nginx config still exists for rollback
ls -la /etc/nginx/sites-enabled/doremi-live.com

# Should exist and be readable
cat /etc/nginx/sites-enabled/doremi-live.com | head -5
```

**Expected Result:** Host nginx config remains available for quick rollback

---

## Critical Issues to Catch

| Issue                        | Symptom                         | Fix                                                              |
| ---------------------------- | ------------------------------- | ---------------------------------------------------------------- |
| nginx not starting           | Container exits or unhealthy    | Check `/opt/dorami/nginx/production.conf` syntax with `nginx -t` |
| SSL certs not mounted        | HTTPS returns 502               | Verify `/etc/letsencrypt/live/doremi-live.com/` exists on host   |
| SRS port conflict            | nginx → SRS returns 502         | Verify SRS port is 127.0.0.1:8080:8080 (internal only)           |
| uploads directory permission | nginx returns 403 for /uploads/ | Ensure uploads_data volume exists and nginx has read access      |
| WebSocket timeout            | Real-time features don't work   | Check Socket.IO proxy headers in nginx config                    |
| 413 errors on upload         | Upload endpoint blocked         | Verify client_max_body_size in nginx production.conf             |

---

## Deployment Verification Sign-Off

- [ ] All configuration files validated
- [ ] nginx container running and healthy
- [ ] HTTPS works (health check 200 OK)
- [ ] HTTP redirects to HTTPS
- [ ] SSL certificate valid
- [ ] WebSocket connections work
- [ ] Static files served correctly
- [ ] Streaming routes working (HTTP-FLV, HLS)
- [ ] API endpoints routed correctly
- [ ] Frontend pages load correctly
- [ ] Certbot renewal hook installed
- [ ] Security headers present
- [ ] Rate limiting active
- [ ] Host nginx stopped and disabled
- [ ] Rollback plan ready

**Approved By:** ********\_********
**Date:** ********\_********
**Notes:** ****************\_****************

---

## Post-Deployment Support

### Monitoring

Monitor these logs during first 24 hours:

```bash
# nginx error/access logs
docker logs dorami-nginx-prod -f --tail=100

# Backend API logs
docker logs dorami-backend-prod -f --tail=50

# Check metrics
docker stats dorami-nginx-prod
```

### Common Troubleshooting

**503 Service Unavailable**

- Check backend/frontend containers are running: `docker ps | grep dorami`
- Check container health: `docker ps --format "table {{.Names}}\t{{.Status}}"`

**SSL Certificate Error**

- Check cert files exist: `ls -la /etc/letsencrypt/live/doremi-live.com/`
- Check nginx config syntax: `docker exec dorami-nginx-prod nginx -t`

**Upload endpoint returns 413**

- Verify `client_max_body_size 10M;` in `/opt/dorami/nginx/production.conf`

**Real-time features don't work**

- Check WebSocket route in nginx config
- Verify backend Socket.IO is accessible
- Check browser console for connection errors

### Certbot Renewal Test

```bash
# Dry-run renewal (doesn't actually renew, just tests)
sudo certbot renew --dry-run

# Check renewal hook will fire
sudo certbot renew --dry-run --verbose
```

---

**End of Verification Checklist**
