# Staging Deployment Test Checklist

**Purpose:** Verify safe-deploy-staging.sh works correctly before production deployment

---

## Pre-Test Setup

### SSH to Staging Server

```bash
ssh ubuntu@staging.doremi-live.com
cd /opt/dorami-staging
```

### Set Image Tag

```bash
export IMAGE_TAG="sha-abc123def"  # Replace with actual commit SHA
echo "Deploying image: ghcr.io/your-org/dorami-backend:${IMAGE_TAG}"
```

---

## Test Execution

### Run Staging Deployment Script

```bash
bash scripts/safe-deploy-staging.sh
```

**Expected Output:**

```
=== STAGING DEPLOYMENT TEST
This tests the production deployment procedure in staging
Image: ghcr.io/your-org/dorami-backend:sha-abc123def

✅ STEP 1: DB Backup
✅ STEP 2: DB Connectivity Test
✅ STEP 3: Network Verification
✅ STEP 4: Migration Preview (Status Check)
✅ STEP 5: Destructive Migration Safety Check
✅ STEP 6: Deploy Backend Container
✅ STEP 7: Wait for Backend Startup
✅ STEP 8: API Health Check
✅ STEP 9: Database Connectivity from Backend

✅ STAGING DEPLOYMENT TEST SUCCESS
```

---

## Test Verification Checklist

### 1️⃣ Backend Container Started

```bash
# Check container is running
docker ps | grep dorami-backend

# Expected: dorami-backend container should be RUNNING
```

**✅ Verify:**

- [ ] Container name appears in docker ps output
- [ ] Status shows "Up X minutes"
- [ ] Port binding visible (3001)

---

### 2️⃣ Migrations Applied

```bash
# Check migration status inside backend container
docker exec dorami-backend npx prisma migrate status

# Expected output: Database schema is up to date
```

**✅ Verify:**

- [ ] Command completes without errors
- [ ] Shows "Migrations to apply: 0" or lists applied migrations
- [ ] No "pending migration" warnings

---

### 3️⃣ Health Check Passes

```bash
# Test health endpoint on port 3001 (staging localhost)
curl -v http://localhost:3001/api/health/ready

# Expected response: 200 OK with health data
```

**✅ Verify:**

- [ ] HTTP status is 200
- [ ] Response contains JSON with health information
- [ ] Response time < 500ms

---

### 4️⃣ API is Accessible

```bash
# Test basic API connectivity
curl -v http://localhost:3001/api/health/live

# Expected: 200 OK response
```

**✅ Verify:**

- [ ] Can reach API endpoint
- [ ] No connection refused errors
- [ ] Response is valid JSON

---

### 5️⃣ Backend Logs Look Healthy

```bash
# Check recent logs for errors
docker logs dorami-backend --tail 50 | grep -i "error\|warn\|fail" || echo "✅ No errors found"

# Show last 20 lines
docker logs dorami-backend --tail 20
```

**✅ Verify:**

- [ ] No startup errors in logs
- [ ] No database connection errors
- [ ] No Redis connection errors
- [ ] Application initialized successfully

---

### 6️⃣ Database Connection Works

```bash
# Test database connectivity from backend
docker exec dorami-backend npx prisma db execute --stdin << 'SQL'
SELECT 1 as connection_test;
SQL

# Expected: Returns result without error
```

**✅ Verify:**

- [ ] Command executes successfully
- [ ] No "ECONNREFUSED" or "connection failed" errors
- [ ] Receives response from database

---

### 7️⃣ Network Configuration Correct

```bash
# Verify all containers are on dorami-internal network
docker network inspect dorami-internal | grep -A 20 "Containers"

# Expected: postgres, redis, backend all connected
```

**✅ Verify:**

- [ ] postgres container listed
- [ ] redis container listed
- [ ] backend container listed
- [ ] All containers have proper network aliases

---

## Full Test Report Template

```
=== STAGING DEPLOYMENT TEST REPORT ===
Date: $(date)
Image Tag: sha-abc123def

STEP 1: Backend Container Startup
- Container running: YES/NO
- Port 3001 bound: YES/NO
- Status: Running X minutes

STEP 2: Migrations
- Migration status: UP TO DATE / PENDING
- Pending migrations: 0 / N
- Last migration: <migration-name>

STEP 3: Health Check (localhost:3001/api/health/ready)
- Response code: 200 / ???
- Response time: XXXms
- Health status: OK / FAILED

STEP 4: API Accessibility
- Reachable: YES / NO
- Connection: SUCCESS / TIMEOUT / REFUSED

STEP 5: Backend Logs
- Errors found: YES / NO
- Database connected: YES / NO
- Redis connected: YES / NO

STEP 6: Database Connectivity
- Direct connection: SUCCESS / FAILED
- Query execution: SUCCESS / FAILED

STEP 7: Network Setup
- postgres on network: YES / NO
- redis on network: YES / NO
- backend on network: YES / NO

OVERALL RESULT: ✅ PASS / ❌ FAIL

Issues found:
[List any issues here]

Ready for production deploy: YES / NO
```

---

## Troubleshooting During Test

### Backend not starting

```bash
docker logs dorami-backend | tail -100
docker ps -a | grep backend  # Check if crashed
```

### Migration fails

```bash
docker logs dorami-backend | grep -i "migration\|prisma"
# Check migration files are valid:
ls -la backend/prisma/migrations/ | tail -5
```

### Health check fails

```bash
# Backend may still be initializing - wait 30 seconds and retry
sleep 30
curl http://localhost:3001/api/health/ready

# Or check logs:
docker logs dorami-backend | tail -50
```

### Network not found

```bash
# Create network if missing:
docker network create dorami-internal 2>/dev/null || true

# Verify network:
docker network ls | grep dorami-internal
docker network inspect dorami-internal
```

---

## Success Criteria ✅

All of the following must be true:

1. ✅ Backend container running
2. ✅ Migrations status shows "up to date"
3. ✅ Health endpoint returns 200
4. ✅ No errors in backend logs
5. ✅ Database connection working
6. ✅ All containers on dorami-internal network
7. ✅ API responds to requests within timeout

---

## Next Step

If all checks pass: **Ready for production deployment**

Use safe-deploy-production.sh with same IMAGE_TAG on production server.
