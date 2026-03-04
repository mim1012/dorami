# Docker Compose DNS Resolution Rule

## The One Rule That Prevents All Networking Issues

**Rule: Service communication MUST use SERVICE NAME, NEVER container_name**

This is the single most important rule to prevent networking failures in Docker Compose.

---

## Why This Matters

Docker Compose maintains an internal DNS server that only recognizes **service names** defined in the `services:` block of the compose file.

```yaml
services:
  backend: # ← SERVICE NAME (DNS-resolvable)
    image: node:18
    container_name: dorami-backend-prod # ← COSMETIC ONLY (NOT DNS-resolvable)
```

**What happens:**

| Target                     | Result   | Reason                               |
| -------------------------- | -------- | ------------------------------------ |
| `backend:3001`             | ✅ Works | Service name is DNS-resolvable       |
| `dorami-backend-prod:3001` | ❌ Fails | container_name is NOT DNS-resolvable |

---

## Real-World Example

### ❌ WRONG Configuration (causes upstream host not found)

**nginx/default.conf:**

```nginx
upstream api {
  server dorami-backend-prod:3001;  # ❌ WRONG - uses container_name
}

server {
  listen 443 ssl http2;
  location /api/ {
    proxy_pass http://api;  # → "upstream host not found" error!
  }
}
```

**Error in logs:**

```
2026-03-04 10:15:23 [error] 42#42: *123 upstream host not found in upstream "api"
```

---

### ✅ CORRECT Configuration (works perfectly)

**nginx/default.conf:**

```nginx
server {
  listen 443 ssl http2;
  location /api/ {
    proxy_pass http://backend:3001;  # ✅ CORRECT - uses service name
  }
}
```

**Result:** Nginx resolves `backend` via internal Docker DNS → connects to container successfully

---

## Docker Compose File Structure

### Current Dorami docker-compose.prod.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: dorami-postgres-prod
    # ...

  redis:
    image: redis:7-alpine
    container_name: dorami-redis-prod
    # ...

  backend: # ← SERVICE NAME
    image: ghcr.io/.../dorami-backend
    container_name: dorami-backend-prod # ← Cosmetic only
    # For internal communication, use: backend:3001

  frontend: # ← SERVICE NAME
    image: ghcr.io/.../dorami-frontend
    container_name: dorami-frontend-prod # ← Cosmetic only
    # For internal communication, use: frontend:3000

  srs: # ← SERVICE NAME
    image: ossrs/srs:6
    container_name: dorami-srs-prod # ← Cosmetic only
    # For internal communication, use: srs:8080
```

---

## Communication Examples

### ✅ Correct Service References

```bash
# In Nginx config
proxy_pass http://backend:3001;
proxy_pass http://frontend:3000;
proxy_pass http://srs:8080;
proxy_pass http://postgres:5432;
proxy_pass http://redis:6379;

# In backend Docker Compose env vars
DATABASE_URL: postgresql://user:pass@postgres:5432/db
REDIS_URL: redis://redis:6379

# In docker exec commands
docker exec dorami-backend-prod curl http://backend:3001/api/health
docker exec dorami-postgres-prod psql -h postgres -U user -d mydb
```

### ❌ Incorrect Container Name References

```bash
# ❌ DON'T DO THIS
proxy_pass http://dorami-backend-prod:3001;      # DNS resolution fails
DATABASE_URL: postgresql://user@dorami-postgres-prod:5432/db  # DNS resolution fails
docker exec curl http://dorami-backend-prod:3001  # Same service, but wrong reference style
```

---

## Network Inspection

Verify that Docker Compose DNS is working:

```bash
# Check which services are on the network
docker network inspect dorami_dorami-internal

# Expected output shows Service Name → Container ID mapping
"Containers": {
  "abc123...": {
    "Name": "dorami-postgres-prod",     # Container name (cosmetic)
    "IPv4Address": "172.20.0.2/16"
  },
  "def456...": {
    "Name": "dorami-backend-prod",      # Container name (cosmetic)
    "IPv4Address": "172.20.0.3/16"
  },
  ...
}

# Each service name has a DNS entry:
# - backend → 172.20.0.3
# - frontend → 172.20.0.4
# - postgres → 172.20.0.2
# - redis → 172.20.0.5
# - srs → 172.20.0.6
```

---

## Testing Internal DNS

```bash
# Enter any container
docker exec -it dorami-nginx-prod sh

# Test DNS resolution
nslookup backend
# Output: 172.20.0.3

nslookup frontend
# Output: 172.20.0.4

nslookup dorami-backend-prod
# Output: ❌ No DNS entry found!

# Test connectivity
wget -qO- http://backend:3001/api/health
# Output: ✅ Success

wget -qO- http://dorami-backend-prod:3001/api/health
# Output: ❌ wget: bad address 'dorami-backend-prod'
```

---

## When to Use Service Name vs Container Name

| Context                     | Use            | Example                                       |
| --------------------------- | -------------- | --------------------------------------------- |
| **Nginx/service config**    | Service Name   | `proxy_pass http://backend:3001;`             |
| **Docker Compose env vars** | Service Name   | `DATABASE_URL: postgresql://postgres:5432/db` |
| **docker exec from host**   | Container Name | `docker exec dorami-backend-prod ...`         |
| **docker logs from host**   | Container Name | `docker logs dorami-backend-prod`             |
| **docker ps display**       | Container Name | Shows as `dorami-backend-prod`                |
| **Internal to container**   | Service Name   | curl, wget, app config                        |

---

## Preventing Future Issues

### Add this to docker-compose.prod.yml header:

```yaml
# 🔴 CRITICAL RULE
# Docker internal networking uses SERVICE NAMES ONLY:
#   proxy_pass http://backend:3001      ✅ CORRECT
#   proxy_pass http://dorami-backend-prod:3001  ❌ WRONG (DNS fails)
# container_name is cosmetic only (for docker ps display)
```

### Add this to Nginx config header:

```nginx
# 🔴 CRITICAL RULE FOR PROXY TARGETS
# Use service names from docker-compose.prod.yml services block:
#   ✅ proxy_pass http://backend:3001;
#   ✅ proxy_pass http://frontend:3000;
#   ✅ proxy_pass http://srs:8080;
# NEVER use container_name (won't resolve in Docker DNS)
```

---

## Summary

> **Remember: Service name (backend) works. Container name (dorami-backend-prod) doesn't.**

This single rule prevents 99% of Docker Compose networking issues. When something breaks:

1. Check if you're using service name, not container_name
2. Verify the service exists in the compose file
3. Test with `docker exec ... wget http://servicename:port`
4. Check network with `docker network inspect dorami_dorami-internal`

That's it. 🎯
