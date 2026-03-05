# 🤖 PHASE 6 — DEPLOYMENT AUTOMATION

**Status:** Ready to execute (awaiting Phase 5 completion)
**Trigger:** Automatic (Ralph Loop monitors Phase 5 report)
**Ralph Loop:** Iteration 78-80 (tomorrow 8 AM UTC)

---

## 🎯 PHASE 6 AUTOMATION LOGIC

### Prerequisites (Must Be True)

1. ✅ Phase 5 completed successfully
2. ✅ Phase 5 report shows **SAFE** status
3. ✅ All 19 data binding items PASS
4. ✅ Load test PASS (200 CCU)
5. ✅ Error rate < 1%

### Decision Gate

```
IF Phase 5 Status = SAFE:
  → Execute Phase 6 (Deployment)
ELSE IF Phase 5 Status = CONDITIONAL:
  → Wait for auto-fix retries
  → Monitor next report
ELSE IF Phase 5 Status = BLOCKED:
  → Halt deployment
  → Escalate to you
```

---

## 🔄 AUTOMATED DEPLOYMENT FLOW

### Step 1: Verify Phase 5 Report (Automatic)

```bash
# Ralph Loop executes this automatically
gh run list --workflow=night-qa.yml --limit=1 > /tmp/phase5_status.txt
gh run download [RUN_ID] --dir ./night-qa-results

# Parse report
cat night-qa-results/NIGHT_QA_REPORT*.md | grep "Deployment Readiness"
```

Expected output: `Deployment Readiness: SAFE`

### Step 2: Create Deployment Commit (Automatic)

```bash
# Merge develop → main with comprehensive message
git checkout main
git pull origin main

git merge develop --no-ff -m "Merge develop: Phase 5 Night QA SAFE

Night QA Validation Results (2026-03-02 07:00 UTC):
- All 19 data binding items: PASS
- Load test (200 CCU): PASS
- Migration safety: PASS
- Streaming validation: PASS
- Error rate: < 1%
- Performance: PASS

Deployment readiness: SAFE

This merge includes all changes from the develop branch that have been validated through the Night QA automation system."

git push origin main
```

### Step 3: Deploy to Production (Automatic)

```bash
# SSH into production server
ssh -i dorami-prod-key.pem ubuntu@doremi-live.com

# Navigate to project
cd /dorami

# Checkout main branch
git checkout main
git pull origin main

# Deploy with docker-compose
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up --build -d

# Monitor deployment
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 4: Verify Deployment (Automatic)

```bash
# Wait for containers to be healthy
sleep 10

# Check container health
docker-compose -f docker-compose.prod.yml ps | grep "healthy"

# Run health checks
curl https://www.doremi-live.com/api/health/live
curl https://www.doremi-live.com/api/health/ready

# Expected: 200 OK with healthy status
```

### Step 5: Run Smoke Tests (Automatic)

```bash
# Quick verification that system is responding
curl -s https://www.doremi-live.com/api/health/live | jq .
curl -s https://www.doremi-live.com/api/health/ready | jq .

# Verify API is accessible
curl -s https://www.doremi-live.com/api/docs | head -20

# Expected: All requests return 200 OK
```

### Step 6: Document Deployment (Automatic)

```bash
# Create deployment record
echo "Deployment completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)" > ./PHASE6_DEPLOYMENT_COMPLETE.md
echo "Phase 5 report: night-qa-results/NIGHT_QA_REPORT*.md" >> ./PHASE6_DEPLOYMENT_COMPLETE.md
echo "Commit: $(git rev-parse --short HEAD)" >> ./PHASE6_DEPLOYMENT_COMPLETE.md
git add PHASE6_DEPLOYMENT_COMPLETE.md
git commit -m "docs: Phase 6 deployment complete"
git push origin main
```

---

## 🛡️ ERROR HANDLING

### If Deployment Fails

```
Failure detected
  ├─ Docker image pull failed?
  │  └─ Retry: docker-compose pull --ignore-pull-failures
  ├─ Container won't start?
  │  └─ Check logs: docker-compose logs backend
  ├─ Health check failed?
  │  └─ Rollback to previous version
  └─ Network error?
     └─ Retry after 30 seconds
```

### Automatic Rollback

```bash
# If health checks fail, rollback immediately
git revert HEAD --no-edit
docker-compose -f docker-compose.prod.yml up --build -d

# Alert you immediately
# (GitHub Issue + Slack notification)
```

---

## 📊 SUCCESS CRITERIA

Phase 6 deployment is successful when:

- ✅ `git merge develop --no-ff` completes without conflicts
- ✅ `docker-compose up --build -d` starts all containers
- ✅ All containers report `healthy` status
- ✅ Health endpoints return `200 OK`
- ✅ API documentation accessible
- ✅ No critical errors in logs

---

## ⏱️ EXECUTION TIMELINE

```
Tomorrow 7:00 AM UTC:
  ├─ Phase 5 report ready
  ├─ Ralph Loop reads report
  └─ Status = SAFE? → YES, proceed

Tomorrow 7:05 AM UTC:
  ├─ Verify Phase 5 report status
  └─ Status = SAFE? → YES, proceed

Tomorrow 7:10 AM UTC:
  ├─ Create deployment commit
  └─ Merge develop → main

Tomorrow 7:15 AM UTC:
  ├─ Push to origin/main
  └─ SSH to production

Tomorrow 7:20 AM UTC:
  ├─ Pull latest code
  └─ Deploy with docker-compose

Tomorrow 7:25 AM UTC:
  ├─ Wait for containers healthy
  └─ Run health checks

Tomorrow 7:30 AM UTC:
  ├─ Run smoke tests
  └─ Document deployment

Tomorrow 7:35 AM UTC:
  ├─ Phase 6 complete
  └─ Proceed to Phase 7
```

---

## 🚨 MANUAL OVERRIDE

If automatic deployment fails or you want manual control:

```bash
# You can manually execute Phase 6
git checkout main
git merge develop --no-ff -m "Merge develop: Manual Phase 6 deployment"
git push origin main

# Then SSH and deploy manually
ssh -i dorami-prod-key.pem ubuntu@doremi-live.com
cd /dorami
docker-compose -f docker-compose.prod.yml up --build -d
```

---

## 📌 PHASE 6 AUTOMATION CHECKLIST

- [ ] Phase 5 report status = SAFE
- [ ] All 19 data binding items PASS
- [ ] Load test PASS (200 CCU, < 1% error)
- [ ] Create merge commit with comprehensive message
- [ ] Push to main branch
- [ ] SSH to production server
- [ ] Pull latest code
- [ ] Deploy with docker-compose
- [ ] Wait for containers healthy
- [ ] Run health checks (all 200 OK)
- [ ] Run smoke tests (all passing)
- [ ] Document deployment
- [ ] Proceed to Phase 7

---

**Phase 6 will execute automatically tomorrow at 7:00-7:35 AM UTC if Phase 5 report shows SAFE.**
