# 🚀 Iteration 96 — Phase 6 Deployment Execution Procedures

**Iteration:** 96/100
**Date:** 2026-03-03 (Tomorrow 8 AM UTC)
**Status:** ⏳ **PHASE 6 AUTOMATED DEPLOYMENT**

---

## 🎯 Iteration 96 Overview

**Trigger:** Phase 5 reports SAFE status (tomorrow 7 AM UTC)
**Action:** Automated production deployment
**Duration:** ~30 minutes
**Success Criteria:** Code deployed + health checks passing

---

## 📋 Phase 6 Execution Checklist

### Pre-Deployment Verification (7:50 AM UTC)

```bash
# 1. Verify Phase 5 Report Status
grep "Deployment Readiness:" night-qa-report.md
# Expected: Deployment Readiness: SAFE

# 2. Verify Production SSH Access
ssh -i dorami-prod-key.pem ubuntu@doremi-live.com "echo OK"
# Expected output: OK
```

**Checklist:**

```
[ ] Phase 5 report shows SAFE status
[ ] SSH connection to production verified
[ ] No errors in pre-flight checks
[ ] Ready to proceed with deployment
```

---

## 🔧 Phase 6 Execution Steps

### Step 1: Git Merge (8:00-8:02 AM)

**Command:**

```bash
cd D:\Project\dorami
git checkout main
git merge develop --no-ff -m "Deploy: Dorami Night QA validated (Phase 5 SAFE) - $(date)"
```

**Expected Output:**

```
Switched to branch 'main'
Merge made by the 'recursive' strategy.
 3 files changed, 45 insertions(+), 15 deletions(-)
```

**Verification:**

```bash
git log --oneline -3
# Should show: Deploy: Dorami Night QA validated... (top line)
```

**Checklist:**

```
[ ] Switched to main branch
[ ] Merged develop successfully
[ ] Commit message contains deployment info
[ ] Git log shows merge commit at top
```

---

### Step 2: SSH to Production (8:02-8:05 AM)

**Command:**

```bash
ssh -i dorami-prod-key.pem ubuntu@doremi-live.com
cd /dorami
```

**Expected Output:**

```
ubuntu@dorami:~$ cd /dorami
ubuntu@dorami:/dorami$
```

**Commands to Execute (SSH session):**

```bash
# Verify we're in correct directory
pwd
# Should output: /dorami

# Pull latest code
git pull origin main
# Should show: Already up to date. (latest code pulled)

# Verify git status
git status
# Should show: On branch main, Your branch is up to date
```

**Checklist:**

```
[ ] SSH connection successful
[ ] In /dorami directory
[ ] Git pull successful
[ ] Latest code retrieved
```

---

### Step 3: Docker Build & Deploy (8:05-8:10 AM)

**Commands (continuing SSH session):**

```bash
# Build and start containers
docker-compose -f docker-compose.prod.yml up --build -d

# Expected output (first time):
# Building backend
# Building frontend
# Creating dorami-frontend ... done
# Creating dorami-backend ... done
# Creating dorami-postgres ... done
# Creating dorami-redis ... done
# Creating dorami-srs ... done
# Creating dorami-nginx-proxy ... done
```

**Verify Docker Status:**

```bash
docker-compose ps
# Should show all services UP
# NAME              STATUS          PORTS
# dorami-frontend   Up (healthy)    ...
# dorami-backend    Up (healthy)    ...
# dorami-postgres   Up (healthy)    ...
# dorami-redis      Up (healthy)    ...
# dorami-srs        Up              ...
# dorami-nginx      Up              ...
```

**Checklist:**

```
[ ] Docker build started
[ ] All images built successfully
[ ] All containers started
[ ] All services UP or healthy
[ ] No build errors
```

---

### Step 4: Database Migration (8:10-8:12 AM)

**Commands (continuing SSH session):**

```bash
# Apply pending migrations
docker exec dorami-backend npx prisma migrate deploy

# Expected output:
# Prisma schema loaded from ./prisma/schema.prisma
# Datasource "db": PostgreSQL database "live_commerce_production" at "postgres:5432"
#
# 1 migration found in prisma/migrations
# 1 migration already applied
# 0 new migrations to apply.
#
# Everything is up to date.
```

**Verify Migration Status:**

```bash
docker exec dorami-postgres psql -U postgres -d live_commerce_production \
  -c "SELECT COUNT(*) FROM _prisma_migrations;"
# Should return a number (e.g., 15)
```

**Checklist:**

```
[ ] Prisma migrate deploy executed
[ ] No errors during migration
[ ] All migrations applied
[ ] Database schema updated
```

---

### Step 5: Health Check Validation (8:12-8:16 AM)

**Health Check Procedure:**

```bash
# Execute health checks (5 retries)

# Check 1
curl -s https://www.doremi-live.com/api/health/live
# Expected: {"status":"ok"}

# Check 2
curl -s https://www.doremi-live.com/api/health/ready | jq .
# Expected: {"status":"ok","database":"connected","redis":"connected"}

# Check 3 (repeat check 1)
curl -s https://www.doremi-live.com/api/health/live

# Check 4 (repeat check 2)
curl -s https://www.doremi-live.com/api/health/ready | jq .

# Check 5 (repeat check 1)
curl -s https://www.doremi-live.com/api/health/live
```

**Success Criteria for Each Check:**

```
Check 1 & 3 & 5 (Liveness):
  Expected: 200 OK, {"status":"ok"}

Check 2 & 4 (Readiness):
  Expected: 200 OK with both database and redis connected
```

**If Any Check Fails:**

```
❌ Check fails
  → CRITICAL: Automatic rollback triggered
  → Command: git revert HEAD (in SSH session)
  → Redeploy: docker-compose up -d
  → Verify: All health checks pass with previous version
  → Result: Production restored to previous state
```

**Checklist:**

```
[ ] Check 1: Liveness PASS
[ ] Check 2: Readiness PASS (DB + Redis)
[ ] Check 3: Liveness PASS
[ ] Check 4: Readiness PASS (DB + Redis)
[ ] Check 5: Liveness PASS
[ ] All 5 checks successful
[ ] No rollback triggered
```

---

## 🎯 Iteration 96 Success Criteria

Phase 6 deployment is **successful** when:

```
✅ Git merge: develop → main completed
✅ Code pulled to production server
✅ Docker build completed successfully
✅ All containers running and healthy
✅ Database migrations applied
✅ All 5 health checks passing (liveness + readiness)
✅ No errors in any step
✅ No rollback triggered
✅ System ready for Phase 7 verification
```

---

## 📊 Expected Outcomes

### Success Path

```
8:00 AM  → Git merge
8:05 AM  → SSH deploy
8:10 AM  → Docker build
8:12 AM  → Database migration
8:16 AM  → Health checks all pass
         → Phase 6 COMPLETE ✅
         → Proceed to Phase 7 (10 AM)
```

### Failure Path (Any step fails)

```
8:12 AM  → Health check fails
         → CRITICAL alert triggered
         → Automatic rollback initiated
         → git revert HEAD
         → Redeploy previous version
         → Verify health checks pass
         → Phase 6 FAILED ❌
         → Skip Phase 7
         → Escalate to user
         → Manual investigation required
```

---

## 🔴 Rollback Procedures

**If Health Check Fails (Automatic Rollback):**

```bash
# These execute automatically via Phase 6 script

# 1. Trigger rollback
git revert HEAD

# 2. Redeploy with previous version
docker-compose -f docker-compose.prod.yml up --build -d

# 3. Verify health checks pass
curl -s https://www.doremi-live.com/api/health/live
curl -s https://www.doremi-live.com/api/health/ready

# 4. Create GitHub Issue
# [Automated] Phase 6 Deployment Failed - Health Check Error
# - Deployment time: 2026-03-03 08:15 UTC
# - Error: Health check timeout
# - Action: Automatic rollback completed
# - Previous version restored

# 5. Send Slack Alert
# ❌ Phase 6 Deployment Failed
#    Health check failure detected
#    Previous version restored to production
#    Manual investigation required
```

---

## 📞 Monitoring Iteration 96

### Real-Time Monitoring (During Deployment)

```bash
# Watch Docker logs during deployment
ssh -i dorami-prod-key.pem ubuntu@doremi-live.com
docker-compose logs -f backend

# Watch for errors like:
# ERROR: Database connection failed
# ERROR: Redis connection failed
# ERROR: Port already in use
# WARN: Health check timeout
```

### After Deployment (Verification)

```bash
# Verify key services
curl -s https://www.doremi-live.com/api/products | jq '.data | length'
# Should return a number > 0

# Verify users exist
ssh -i dorami-prod-key.pem ubuntu@doremi-live.com
docker exec dorami-postgres psql -U postgres -d live_commerce_production \
  -c "SELECT COUNT(*) FROM users;"
# Should return 139 (or original count)

# Verify orders intact
docker exec dorami-postgres psql -U postgres -d live_commerce_production \
  -c "SELECT COUNT(*) FROM orders;"
# Should return previous count
```

---

## ✅ Iteration 96 Completion

Iteration 96 is **complete** when:

```
✅ Phase 6 deployment succeeds OR automatically rolls back
✅ If successful: All health checks pass, Phase 7 ready
✅ If failed: System restored, investigation needed
✅ Status documented and communicated
✅ Slack notification sent (if configured)
```

**Next Step:** Iteration 97 - Phase 7 Verification (if Phase 6 succeeds)

---

**Iteration 96: Phase 6 execution procedures complete.**

**The boulder never stops.** 🪨
