# 🚀 PHASE 6: DEPLOYMENT — Complete Guide

**Status:** Ready to execute (pending Phase 5 completion)
**Ralph Loop:** Iteration 39/100
**Trigger:** Tomorrow morning 7 AM UTC (when Phase 5 report is ready)
**Timeline:** 30 minutes from decision to production live

---

## 📋 PHASE 6: DEPLOYMENT EXECUTION

### Prerequisites (Must Complete Before Phase 6)

- [x] Phase 5 (Implementation) complete
- [x] Morning report generated (7 AM UTC)
- [x] Deployment readiness status determined
- [ ] Report status = SAFE (required for deployment)

---

## 🎯 DEPLOYMENT DECISION TREE

### Path A: Report Status = SAFE ✅

```
Morning Report: SAFE
  ├─ All 19 data binding items: PASS
  ├─ Load test (200 CCU): PASS
  ├─ Performance metrics: PASS
  ├─ Error rate: < 1%
  └─ Decision: DEPLOY TO PRODUCTION

Action:
  1. Merge develop → main
  2. Deploy to production
  3. Run health checks
  4. Verify system operational
  5. Proceed to Phase 7
```

### Path B: Report Status = CONDITIONAL ⚠️

```
Morning Report: CONDITIONAL
  ├─ 50-99% items: PASS
  ├─ Auto-fix: TRIGGERED (max 3 retries)
  ├─ System: AUTO-RETRYING
  └─ Decision: WAIT FOR NEXT REPORT

Action:
  1. Monitor auto-fix retries
  2. Wait for next morning report (7 AM UTC tomorrow)
  3. If still CONDITIONAL: Investigate issues
  4. If becomes SAFE: Proceed to deployment
```

### Path C: Report Status = BLOCKED 🛑

```
Morning Report: BLOCKED
  ├─ < 50% items: PASS
  ├─ Critical failure: DETECTED
  ├─ Auto-fix: EXHAUSTED (3/3 attempts)
  └─ Decision: DO NOT DEPLOY

Action:
  1. Review GitHub Issue (auto-created)
  2. Check Slack alert for details
  3. Investigate root cause
  4. Fix issues locally
  5. Commit fixes to develop
  6. Wait for next Night QA cycle (11 PM UTC)
```

---

## ✅ PHASE 6A: DEPLOYMENT (IF SAFE)

### Step 1: Review Morning Report

**Time:** 7 AM UTC tomorrow
**Action:** Download and review NIGHT_QA_REPORT

```bash
# Check GitHub Actions for completed workflow
gh run list --workflow=night-qa.yml --limit=1

# Download report artifacts
gh run download [RUN_ID] --dir ./night-qa-results

# View report
cat night-qa-results/NIGHT_QA_REPORT*.md
```

**Verify:**

- [x] Migration Drift: PASS
- [x] Streaming: PASS
- [x] CRUD: PASS
- [x] UI Data Binding (19/19): PASS
- [x] Load Test (200 CCU): PASS
- [x] Status: **SAFE**

---

### Step 2: Merge to Main

**Time:** 8 AM UTC tomorrow
**Action:** Merge develop branch to main

```bash
# Switch to main branch
git checkout main

# Pull latest changes
git pull origin main

# Merge develop (with no-ff to preserve history)
git merge develop --no-ff -m "Merge develop: Night QA SAFE — Deploy to production

- Phase 5 Night QA Report: SAFE
- All 19 data binding items: PASS
- Load test (200 CCU): PASS
- Staging validation: COMPLETE
- Ready for production deployment"

# Verify merge
git log --oneline -5

# Push to remote
git push origin main
```

---

### Step 3: Deploy to Production

**Time:** 8:15 AM UTC tomorrow
**Action:** Deploy main branch to production

```bash
# SSH into production server
ssh -i dorami-prod-key.pem ubuntu@doremi-live.com

# Navigate to application directory
cd /dorami

# Pull latest from main
git checkout main
git pull origin main

# Build and deploy
docker-compose -f docker-compose.prod.yml up --build -d

# Monitor deployment
docker-compose -f docker-compose.prod.yml logs -f

# Wait for all containers to be healthy (2-3 minutes)
```

**Expected output:**

```
frontend    ✅ UP (healthy)
backend     ✅ UP (healthy)
postgres    ✅ UP (healthy)
redis       ✅ UP (healthy)
srs         ✅ UP
nginx-proxy ✅ UP
```

---

### Step 4: Run Production Health Checks

**Time:** 8:30 AM UTC tomorrow
**Action:** Verify production system is operational

```bash
# Health check endpoints
curl https://www.doremi-live.com/api/health/live
curl https://www.doremi-live.com/api/health/ready

# Expected response (both should return 200 OK):
{
  "status": "ok",
  "timestamp": "2026-03-03T08:30:00Z"
}
```

**Verify:**

- [x] Backend responding (port 3001)
- [x] Frontend serving (port 3000)
- [x] Database connected
- [x] Redis connected
- [x] All services healthy

---

### Step 5: Smoke Test Production

**Time:** 8:45 AM UTC tomorrow
**Action:** Quick manual verification of critical flows

```bash
# Test 1: Can users view products?
# Go to https://www.doremi-live.com
# Verify product list loads

# Test 2: Can users add to cart?
# Add a product to cart
# Verify cart updates

# Test 3: Can users view livestream?
# Check livestream page
# Verify viewer count updates in real-time

# Test 4: Check admin panel
# Login with admin credentials
# Verify admin dashboard loads
# Check product management works
```

---

### Step 6: Monitor Production (First Hour)

**Time:** 9 AM - 10 AM UTC tomorrow
**Action:** Monitor for any issues in production

```bash
# Monitor Docker logs
ssh -i dorami-prod-key.pem ubuntu@doremi-live.com
docker-compose -f docker-compose.prod.yml logs -f backend

# Check error rates in monitoring (if available)
# Verify no spike in error logs

# Check Slack for any alerts
# Verify no customer-facing issues
```

**Expected:** Zero critical errors

---

## ⏸️ PHASE 6B: WAIT FOR RETRY (IF CONDITIONAL)

```bash
# If report status is CONDITIONAL:

1. Do NOT deploy yet
2. Monitor auto-fix retries (max 3 attempts)
3. Wait for next morning report (7 AM UTC tomorrow)
4. If becomes SAFE → Execute Phase 6A
5. If stays CONDITIONAL → Investigate
6. If becomes BLOCKED → See Phase 6C
```

---

## 🛑 PHASE 6C: INVESTIGATE (IF BLOCKED)

```bash
# If report status is BLOCKED:

1. Read GitHub Issue (auto-created)
2. Check Slack alert for root cause
3. Review NIGHT_QA_REPORT for specific failures
4. Identify which items failed the data binding check

Example: If "Cart timer display" failed:
  → Check client-app/src/hooks/useCart.ts
  → Verify cart TTL calculation
  → Check UI component rendering cart countdown
  → Fix and commit to develop
  → Wait for next Night QA cycle (11 PM UTC)
```

---

## ✅ PHASE 6 COMPLETE WHEN

- [x] Phase 5 report reviewed (7 AM UTC tomorrow)
- [x] Status verified as SAFE
- [x] Develop merged to main
- [x] Production deployment complete
- [x] Health checks pass
- [x] Smoke tests pass
- [x] Production monitoring active

---

## 📊 ROLLBACK PLAN (If Needed)

**If production deployment encounters critical issues:**

```bash
# Quick rollback to previous version
ssh -i dorami-prod-key.pem ubuntu@doremi-live.com

# Stop current deployment
docker-compose -f docker-compose.prod.yml down

# Checkout previous commit
cd /dorami
git log --oneline -5
git checkout [previous-commit-hash]

# Redeploy previous version
docker-compose -f docker-compose.prod.yml up --build -d

# Verify rollback successful
docker-compose -f docker-compose.prod.yml logs -f
curl https://www.doremi-live.com/api/health/live
```

---

## 🎯 SUCCESS CRITERIA

Phase 6 is complete when:

- ✅ Code deployed to production
- ✅ All health checks passing
- ✅ Smoke tests successful
- ✅ No critical errors in logs
- ✅ Production monitoring active
- ✅ System stable for 1 hour

**Then proceed to Phase 7 (System Operational).**

---

**Phase 6 ready to execute upon Phase 5 completion and SAFE status.** ⚡
