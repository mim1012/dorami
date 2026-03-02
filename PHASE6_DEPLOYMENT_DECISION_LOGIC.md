# 🚀 PHASE 6 — Automated Deployment Decision Logic

**Purpose:** Provide Ralph Loop with precise decision tree for Phase 6 execution
**Ralph Loop:** Iterations 81-82 (tomorrow 7:30-8:00 AM UTC)

---

## 🎯 DEPLOYMENT DECISION TREE

```
PHASE 5 REPORT RECEIVED
    ↓
IF Overall Status = SAFE:
    ├─ AND Data Binding: 19/19 PASS
    ├─ AND Load Test: PASS
    ├─ AND Error Rate: < 1%
    └─ DECISION: PROCEED TO PHASE 6 ✅
        ↓
        EXECUTE PHASE 6 DEPLOYMENT
        ├─ Merge develop → main
        ├─ Deploy to production
        ├─ Run health checks
        └─ Proceed to Phase 7

ELSE IF Overall Status = CONDITIONAL:
    ├─ AND Auto-fix Retries: < 3
    └─ DECISION: WAIT & MONITOR ⚠️
        ↓
        WAIT FOR NEXT AUTO-FIX ATTEMPT
        ├─ Monitor auto-fix progress
        ├─ Check next report
        └─ Re-evaluate when ready

ELSE IF Overall Status = BLOCKED:
    ├─ OR Auto-fix Retries: = 3 (failed)
    └─ DECISION: ESCALATE & HALT 🛑
        ↓
        STOP EXECUTION
        ├─ Create GitHub Issue
        ├─ Send Slack alert
        ├─ Log error details
        └─ Wait for manual fix
```

---

## ✅ PHASE 6 EXECUTION CHECKLIST

Ralph Loop will verify these before deploying:

```
PRE-DEPLOYMENT CHECKS:
[ ] Phase 5 Report Status: SAFE
[ ] Data Binding Items: 19/19 PASS
[ ] Load Test: PASS (200 CCU)
[ ] Error Rate: < 1%
[ ] CPU Max: < 70%
[ ] Memory Max: < 75%
[ ] No critical errors in logs
[ ] Architect approval verified
[ ] Production backup exists

DEPLOYMENT EXECUTION:
[ ] Git checkout main
[ ] Git pull origin main
[ ] Merge develop → main (--no-ff)
[ ] Push to origin/main
[ ] SSH to production
[ ] Git pull latest code
[ ] Docker-compose pull
[ ] Docker-compose up --build -d
[ ] Wait for containers healthy
[ ] Run health checks
[ ] Verify no critical errors

POST-DEPLOYMENT CHECKS:
[ ] All containers running
[ ] Health endpoints: 200 OK
[ ] No critical errors
[ ] Database accessible
[ ] Redis working
[ ] Logs clean

SUCCESS CRITERIA:
[ ] Deployment completed
[ ] Health checks passing
[ ] Proceed to Phase 7
```

---

## 🔄 AUTOMATED DEPLOYMENT PROCEDURE

Ralph Loop will execute (exactly in this order):

### Step 1: Pre-Deployment Verification

```bash
# Verify Phase 5 report
if [ "$PHASE5_STATUS" != "SAFE" ]; then
  echo "Phase 5 not SAFE - abort deployment"
  exit 1
fi

# Verify data binding items
if [ "$DATA_BINDING_PASS" != "19" ]; then
  echo "Data binding items not all PASS - abort deployment"
  exit 1
fi

# Verify load test
if [ "$LOAD_TEST_STATUS" != "PASS" ]; then
  echo "Load test failed - abort deployment"
  exit 1
fi
```

### Step 2: Create Merge Commit

```bash
# Navigate to project root
cd D:\Project\dorami

# Ensure on main branch
git checkout main
git pull origin main

# Create comprehensive merge message
git merge develop --no-ff -m "Merge develop: Phase 5 Night QA SAFE

Night QA Validation Results ($(date -u +%Y-%m-%d)):
- Phase 5 Status: SAFE
- All 19 data binding items: PASS
- Load test (200 CCU): PASS
- Performance: CPU $(CPU_MAX)%, Memory $(MEMORY_MAX)%
- Error rate: < 1%

This merge includes all changes from develop branch that have been validated through the automated Night QA system.

Architect Approval: APPROVED (ARCHITECT_APPROVAL.md)
Deployment Decision: SAFE TO DEPLOY"

# Push to remote
git push origin main
```

### Step 3: SSH to Production

```bash
# SSH with key
ssh -i dorami-prod-key.pem ubuntu@doremi-live.com

# Navigate to project
cd /dorami

# Verify on main branch
git status | grep "On branch main"

# Pull latest code
git pull origin main
```

### Step 4: Deploy with Docker

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Build and start containers
docker-compose -f docker-compose.prod.yml up --build -d

# Wait for containers to be healthy
sleep 10
docker-compose -f docker-compose.prod.yml ps | grep "healthy"
```

### Step 5: Health Checks

```bash
# Check liveness
curl -s https://www.doremi-live.com/api/health/live
# Expected: {"status":"ok"} with 200 status

# Check readiness
curl -s https://www.doremi-live.com/api/health/ready
# Expected: {"status":"ok","db":"ok","redis":"ok"} with 200 status

# Check API docs
curl -s https://www.doremi-live.com/api/docs | head -20
# Expected: HTML response, 200 status
```

### Step 6: Deployment Validation

```bash
# Check container logs for errors
docker-compose -f docker-compose.prod.yml logs | grep -i "error"

# If errors found:
if [ $? -eq 0 ]; then
  echo "Errors found - reviewing..."
  docker-compose -f docker-compose.prod.yml logs | grep -i "error" | head -20

  # If critical errors:
  # ROLLBACK IMMEDIATELY
fi
```

### Step 7: Document Deployment

```bash
# Create deployment record
cat > PHASE6_DEPLOYMENT_COMPLETE.md << 'EOF'
# Phase 6: Deployment Complete

**Timestamp:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Commit:** $(git rev-parse --short HEAD)
**Phase 5 Status:** SAFE
**Deployment Result:** SUCCESS

All containers healthy and responsive.
Ready to proceed to Phase 7 verification.
EOF

# Commit record
git add PHASE6_DEPLOYMENT_COMPLETE.md
git commit -m "docs: Phase 6 deployment complete"
git push origin main
```

---

## 🛡️ ERROR HANDLING

### If Health Check Fails

```bash
if [ "$HEALTH_CHECK" != "200" ]; then
  echo "Health check failed - investigating..."

  # Get container status
  docker-compose ps

  # Check logs
  docker-compose logs backend

  # If critical failure:
  ROLLBACK=true
fi
```

### If Critical Error Detected

```bash
if [ "$CRITICAL_ERROR" = "true" ]; then
  echo "Critical error detected - rolling back..."

  # Revert merge
  git revert HEAD --no-edit

  # Deploy previous version
  docker-compose -f docker-compose.prod.yml up --build -d

  # Verify rollback
  curl -s https://www.doremi-live.com/api/health/live

  # Alert and escalate
  ESCALATE=true
fi
```

---

## ✅ SUCCESS CRITERIA

Phase 6 is successful when:

```
✅ Merge commit created and pushed
✅ Code pulled on production server
✅ Docker containers started
✅ All containers report "healthy"
✅ Health endpoints return 200 OK
✅ No critical errors in logs
✅ Deployment record created
✅ Ready to proceed to Phase 7
```

---

## ⏰ TIMING

```
T+21h (8:00 AM UTC):
  ├─ Phase 5 report status: SAFE
  └─ Decision: DEPLOY

T+21:05h (8:05 AM UTC):
  ├─ Create merge commit
  └─ Push to main

T+21:10h (8:10 AM UTC):
  ├─ SSH to production
  ├─ Pull latest code
  └─ Deploy with docker-compose

T+21:20h (8:20 AM UTC):
  ├─ Containers healthy
  ├─ Health checks passing
  └─ Deployment successful

T+21:30h (8:30 AM UTC):
  ├─ Phase 6 complete
  └─ Proceed to Phase 7
```

---

## 📊 DEPLOYMENT LOG

Ralph Loop maintains deployment log:

```bash
# Log file: phase6_deployment.log
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Phase 6 deployment started" >> phase6_deployment.log
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Merge commit created: $(git rev-parse --short HEAD)" >> phase6_deployment.log
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Deployment to production: SUCCESS" >> phase6_deployment.log
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Health checks: PASS" >> phase6_deployment.log
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Ready for Phase 7" >> phase6_deployment.log
```

---

## 🚨 ROLLBACK PROCEDURE

If deployment fails:

```bash
# Immediate rollback
git log --oneline -1
git revert HEAD --no-edit
docker-compose -f docker-compose.prod.yml up --build -d

# Verify rollback
curl -s https://www.doremi-live.com/api/health/live

# Document
echo "[ROLLBACK] Deployment failed, reverted to previous version" >> phase6_deployment.log
echo "[ROLLBACK] Reason: [error details]" >> phase6_deployment.log

# Alert
ESCALATE=true
CREATE_GITHUB_ISSUE=true
SEND_SLACK_ALERT=true
```

---

**Ralph Loop uses this decision logic to autonomously execute Phase 6 deployment tomorrow morning if Phase 5 is SAFE.**
