# 📡 Real-Time Monitoring Procedures — Phase 5-7 Execution

**Status:** ✅ **MONITORING FRAMEWORK FOR AUTONOMOUS EXECUTION**
**Iteration:** 96/100
**Date:** 2026-03-02

---

## 🎯 Overview

This document provides detailed step-by-step monitoring procedures for each phase of the Night QA Automation System. Use this guide to observe execution and identify issues in real-time.

---

## 📊 Phase 5 Monitoring (Tonight 11 PM → 2 AM UTC)

### Pre-Execution Checklist (10:45 PM UTC)

```bash
# 1. Verify GitHub Secrets are configured
gh secret list

# Expected output (all 6 present):
# STAGING_SSH_HOST
# STAGING_SSH_USER
# STAGING_SSH_KEY
# STAGING_BACKEND_URL
# STAGING_MEDIA_URL
# SLACK_WEBHOOK

# 2. Verify workflow exists and is enabled
gh workflow list

# Expected output includes:
# night-qa.yml              active

# 3. Check recent workflow runs
gh run list --workflow=night-qa.yml --limit=5

# Expected: No errors in recent history
```

### Real-Time Execution Monitoring (11 PM UTC)

#### 11:00 PM — Phase 5 Starts

**What to watch for:**

```bash
# Open GitHub Actions in web browser
open https://github.com/{ORG}/dorami/actions

# OR use GitHub CLI to watch
gh run watch $(gh run list --workflow=night-qa.yml --json databaseId --jq '.[0].databaseId')

# Expected output:
# Workflow: night-qa
# Status: in_progress
# Conclusion: (none, still running)
```

**Slack notifications (if configured):**

- Message: "🚀 Phase 5 Started: Nightly validation in progress"
- Timestamp: 11:00 PM UTC

#### 11:05 PM — Stage 1: DB Drift Analysis

**Monitoring:**

```bash
# Check job logs
gh run view {RUN_ID} --log | grep -A 20 "Stage1_DB_Drift"

# Expected output:
# ✅ Analyzing migrations...
# ✅ Checking for DROP operations... SAFE
# ✅ Checking for TRUNCATE operations... SAFE
# ✅ Checking for ALTER TYPE changes... SAFE
# ✅ Stage 1: PASS

# OR watch live
gh run view {RUN_ID} --log --tail 10
```

**Success criteria:**

```
✅ Job completes in 5 minutes
✅ Returns PASS or CONDITIONAL (not FAIL)
✅ No critical errors logged
```

#### 11:10 PM — Stage 2: Streaming Validation

**Monitoring:**

```bash
# Check streaming validation
gh run view {RUN_ID} --log | grep -A 20 "Stage2_Streaming"

# Expected output:
# ✅ Testing RTMP ingest...
# ✅ Testing HLS generation...
# ✅ Testing playback...
# ✅ Stage 2: PASS

# Check for connection errors
gh run view {RUN_ID} --log | grep -i "error\|timeout\|connection"

# Should return minimal or no errors
```

**Success criteria:**

```
✅ RTMP push successful
✅ HLS m3u8 responds
✅ Playback starts within 5 seconds
✅ No timeout errors
```

#### 11:20 PM — Stage 3: CRUD Verification

**Monitoring:**

```bash
# Check CRUD operations
gh run view {RUN_ID} --log | grep -A 30 "Stage3_CRUD"

# Expected output:
# ✅ Creating product...
# ✅ Adding options...
# ✅ Updating price...
# ✅ Verifying permissions...
# ✅ Testing soft delete...
# ✅ Stage 3: PASS

# Check database queries logged
gh run view {RUN_ID} --log | grep -i "INSERT\|UPDATE\|DELETE"

# Verify correct number of operations
```

**Success criteria:**

```
✅ All CRUD operations complete
✅ Database rows created/modified
✅ Permissions verified
✅ No constraint violations
```

#### 11:30 PM — Stage 4: UI Data Binding Tests

**Monitoring:**

```bash
# Check Playwright test results
gh run view {RUN_ID} --log | grep -A 50 "Stage4_UI_Data_Binding"

# Expected output:
# ✅ Running Playwright tests...
# ✅ Customer UI (8): PASS
# ✅ Admin UI (6): PASS
# ✅ Real-time features (5): PASS
# ✅ Total: 19/19 PASS

# Download test report for details
gh run download {RUN_ID} --name playwright-report

# View detailed results
cat playwright-report/index.html  # Open in browser
```

**Success criteria:**

```
✅ All 19 tests passing
✅ No timeouts
✅ No element not found errors
✅ Page loads within thresholds
```

#### 12:20 AM — Stage 5: Progressive Load Test

**Monitoring (Long-running, ~150 min):**

```bash
# Check load test progress every 15 minutes
watch -n 900 'gh run view {RUN_ID} --log | grep -i "stage5\|users\|latency"'

# OR check logs manually
gh run view {RUN_ID} --log | tail -50

# Expected progression:
# Stage 5: Load Testing
#   Phase 1: 50 users × 30 min ... [████████░░░░░░░░░░] 50%
#   Phase 2: 100 users × 30 min ... [░░░░░░░░░░░░░░░░░░] 0%
#   Phase 3: 150 users × 30 min ... [░░░░░░░░░░░░░░░░░░] 0%
#   Phase 4: 200 users × 60 min ... [░░░░░░░░░░░░░░░░░░] 0%
```

**Metrics to watch (every 15 min):**

```
Expected Range for 50 users (first 30 min):
✅ p95 latency: 200-300ms
✅ p99 latency: 300-500ms
✅ Error rate: 0%
✅ CPU usage: 30-40%
✅ Memory usage: 35-45%

Expected Range for 100 users (30-60 min):
✅ p95 latency: 250-400ms
✅ p99 latency: 400-700ms
✅ Error rate: 0%
✅ CPU usage: 45-55%
✅ Memory usage: 50-60%

Expected Range for 200 users (120-180 min):
✅ p95 latency: 300-500ms (max threshold 500ms)
✅ p99 latency: 500-1000ms (max threshold 1000ms)
✅ Error rate: < 1%
✅ CPU usage: < 70%
✅ Memory usage: < 75%
```

**Warning signs to watch:**

```
🟡 p95 > 400ms during 50 user test → Investigate caching
🟡 Error rate > 0.5% during 100 user test → Check database connections
🟡 Memory creep (steady increase) → Possible memory leak
🟡 p99 > 1200ms during 200 user test → May fail final threshold check
🔴 p99 > 1500ms → Likely to trigger rollback
🔴 Error rate > 2% → Critical issue, may auto-stop
```

#### 2:10 AM → Report Generation

**Monitoring:**

```bash
# Check final report generation
gh run view {RUN_ID} --log | grep -A 50 "Stage6_Report"

# Expected output:
# ✅ Compiling report...
# ✅ Calculating statistics...
# ✅ Generating summary...
# ✅ Uploading artifact...
# ✅ Stage 6: PASS

# Download report
gh run download {RUN_ID} --name night-qa-report

# View final report
cat night-qa-report.md | head -50
```

### Phase 5 Completion Check (2:30 AM UTC)

**Verification:**

```bash
# Check final status
gh run view {RUN_ID} --json conclusion

# Expected output:
# "conclusion": "success"

# OR if failed:
# "conclusion": "failure"

# Verify all artifacts present
gh run download {RUN_ID}

# Should include:
ls -la
# night-qa-report.md ✅
# playwright-report/ ✅
# k6-results.json ✅
# workflow-logs/ ✅
```

**Action based on conclusion:**

```
IF conclusion = "success":
  → Wait for ralph-phase5-monitor.sh to parse report
  → Check Ralph's decision: SAFE / CONDITIONAL / BLOCKED
  → Proceed accordingly

IF conclusion = "failure":
  → Check logs for specific failure
  → Create GitHub Issue
  → Analyze error cause
  → Plan retry for tomorrow night
```

---

## 📊 Phase 6 Monitoring (Tomorrow 8 AM UTC, if SAFE)

### Pre-Deployment Check (7:50 AM UTC)

```bash
# Verify Phase 5 status was SAFE
grep "Deployment Readiness:" night-qa-report.md

# Expected output:
# Deployment Readiness: SAFE

# Check production server accessibility
ssh -i dorami-prod-key.pem ubuntu@doremi-live.com "echo Connected"

# Expected output:
# Connected
```

### Deployment Execution (8:00 AM UTC)

**What to watch:**

```bash
# Monitor Phase 6 deployment script
tail -f deployment-log.txt

# Expected output:
# [08:00] Starting Phase 6 deployment...
# [08:01] Checking git status...
# [08:02] Merging develop → main...
# [08:03] SSH connection established
# [08:04] Pulling latest code...
# [08:05] Building Docker images...
# [08:10] Migrating database...
# [08:12] Health check 1/5... ✅ PASS
# [08:13] Health check 2/5... ✅ PASS
# [08:14] Health check 3/5... ✅ PASS
# [08:15] Health check 4/5... ✅ PASS
# [08:16] Health check 5/5... ✅ PASS
# [08:16] Deployment complete: SUCCESS
```

### Health Check Monitoring (8:05-8:20 AM UTC)

**Liveness Check:**

```bash
# Every 10 seconds during deployment
while true; do
  curl -s https://www.doremi-live.com/api/health/live
  echo " $(date)"
  sleep 10
done

# Expected output:
# {"status":"ok"} 2026-03-02T08:05:00Z
# {"status":"ok"} 2026-03-02T08:05:10Z
# ... (consistent success)
```

**Readiness Check:**

```bash
# Verify database and Redis connectivity
curl -s https://www.doremi-live.com/api/health/ready | jq .

# Expected output:
# {
#   "status": "ok",
#   "database": "connected",
#   "redis": "connected",
#   "timestamp": "2026-03-02T08:15:00Z"
# }
```

### Slack Notifications

```
Expected messages:
✅ 08:00 — Phase 6 Deployment Started
✅ 08:10 — Docker build completed
✅ 08:12 — Database migration successful
✅ 08:15 — Health checks passing
✅ 08:16 — Phase 6 Deployment Complete
```

### Error Detection (Automatic Rollback)

**If any health check fails:**

```bash
# Ralph automatically triggers rollback
# Logs will show:
# [08:15] Health check 3/5... ❌ FAIL
# [08:15] CRITICAL: Health check failure
# [08:16] Initiating rollback...
# [08:17] Running: git revert HEAD
# [08:18] Redeploying previous version...
# [08:20] Rollback complete

# Production is returned to previous state
# Manual investigation required
```

---

## ✅ Phase 7 Monitoring (Tomorrow 10 AM UTC, if deployed)

### Test Execution (10:00 AM UTC)

**Monitoring:**

```bash
# Watch Phase 7 verification tests
gh run view {RUN_ID} --log | grep -A 100 "Phase7_Verification"

# Expected output:
# ✅ Running 32 verification tests...
#
# Health Checks (2):
# ✅ Liveness probe
# ✅ Readiness probe
#
# Customer Features (8):
# ✅ Product discovery
# ✅ Add to cart
# ✅ Checkout
# ✅ Order confirmation
# ✅ Profile view
# ✅ Order history
# ✅ Notifications
# ✅ Live stream join
#
# Admin Features (6):
# ✅ Product CRUD
# ✅ Inventory management
# ✅ Order management
# ✅ Live stream control
# ✅ Settings
# ✅ Analytics
#
# Real-time (5):
# ✅ Chat messages
# ✅ Viewer count
# ✅ Stock updates
# ✅ Status changes
# ✅ Notifications
#
# Performance (4):
# ✅ Page load < 2s
# ✅ API response < 200ms
# ✅ WebSocket latency < 100ms
# ✅ Database query < 50ms
#
# Security (4):
# ✅ HTTPS enforcement
# ✅ CSRF protection
# ✅ Authentication
# ✅ Authorization
#
# Data Integrity (3):
# ✅ User data consistency
# ✅ Order data accuracy
# ✅ Inventory accuracy
```

### Scoring Calculation (10:50 AM UTC)

```bash
# Check final score
gh run view {RUN_ID} --json | jq '.jobs[] | select(.name=="Phase7_Score")'

# Expected output:
# Tests passed: 30/32
# Pass percentage: 93.75%
# Threshold: 93.75%
# Result: ✅ PASS

# System Status: FULLY OPERATIONAL
```

### Success Criteria

```
✅ Score: 30/32 tests passing (93.75%)
✅ Meets or exceeds 93.75% threshold
✅ All critical features operational
✅ No security violations detected
✅ Performance within expected ranges
```

### Failure Detection (Automatic Rollback)

```bash
# If score < 93.75%
# OR critical test fails
# Ralph automatically triggers rollback

# Expected log output:
# ❌ Phase 7 Score: 28/32 (87.5%)
# ❌ Below threshold 93.75%
# [11:00] CRITICAL: Verification failed
# [11:01] Initiating automatic rollback...
# [11:02] Running: git revert HEAD
# [11:03] Redeploying previous version...
# [11:05] Rollback complete
# [11:05] Creating GitHub Issue: Phase 7 Verification Failed
# [11:06] Sending Slack alert
```

---

## 🔔 Slack Notification Timeline

### Expected Notifications

```
2026-03-02

11:00 PM  🚀 Phase 5: Validation Started
11:05 PM  ✅ Stage 1: DB Drift — PASS
11:10 PM  ✅ Stage 2: Streaming — PASS
11:20 PM  ✅ Stage 3: CRUD — PASS
11:30 PM  ✅ Stage 4: UI Tests — PASS
12:20 AM  ⏳ Stage 5: Load Test (1/4 phases)
02:10 AM  ✅ Stage 6: Report — PASS
02:30 AM  📊 Phase 5 Complete: Status SAFE

2026-03-03

07:55 AM  📋 Phase 5 Report Parsed: SAFE → Proceeding to Phase 6
08:00 AM  🚀 Phase 6: Deployment Started
08:10 AM  ✅ Docker build complete
08:12 AM  ✅ Database migration complete
08:15 AM  ✅ Health checks passing (5/5)
08:16 AM  ✅ Phase 6 Complete: Deployment Successful

10:00 AM  🚀 Phase 7: Verification Started
10:50 AM  📊 Phase 7 Score: 30/32 (93.75%)
11:00 AM  ✅ Phase 7 Complete: OPERATIONAL
12:00 PM  🎉 System Fully Operational
```

---

## 📋 Dashboard Monitoring Checklist

### During Execution (Keep these open)

```
[ ] GitHub Actions: https://github.com/{ORG}/dorami/actions
[ ] Slack: Monitor #deployments channel
[ ] Terminal: Watching logs with tail -f
[ ] Production Health: Checking /api/health/live
[ ] Staging Health: Checking staging environment
```

### Metrics to Track (Record every 15 min during Phase 5)

```
Time    | CPU  | Mem  | DB Conn | p95 ms | Errors | Status
--------|------|------|---------|--------|--------|--------
11:05   | 25%  | 32%  | 10/100  | 150    | 0      | ✅
11:20   | 35%  | 40%  | 15/100  | 200    | 0      | ✅
11:35   | 45%  | 48%  | 20/100  | 280    | 0      | ✅
11:50   | 55%  | 55%  | 30/100  | 350    | 0      | ✅
12:05   | 62%  | 62%  | 45/100  | 420    | 0      | ✅
12:20   | 65%  | 65%  | 55/100  | 450    | 0      | ✅
01:20   | 63%  | 63%  | 50/100  | 430    | 0.1%   | ✅
02:10   | 40%  | 45%  | 20/100  | 200    | 0      | ✅ COMPLETE
```

---

## 🚨 Emergency Response

### If Monitoring Detects Issues

**Real-time decision tree:**

```
Detect Error
  ├─ Type: Network timeout?
  │  └─ Action: Monitor auto-retry (should recover)
  │
  ├─ Type: Database error?
  │  ├─ Action: Check DB logs: docker-compose logs postgres
  │  └─ Recovery: Usually auto-recovers after 30s
  │
  ├─ Type: Health check failure?
  │  ├─ Action: Check service logs
  │  └─ Result: Automatic rollback triggered
  │
  ├─ Type: Test failure?
  │  ├─ Action: Review test logs
  │  └─ Result: Marked for investigation, continues to next
  │
  └─ Type: Critical error?
     ├─ Action: STOP and investigate
     └─ Escalate: Create GitHub Issue + Slack alert
```

### Manual Intervention Points

```
❌ Phase 5 reports BLOCKED:
   → Manual investigation required
   → Fix issue
   → Retry tomorrow night

❌ Phase 6 health check fails (automatic rollback triggered):
   → SSH to production: ssh ubuntu@doremi-live.com
   → Check logs: docker-compose logs
   → Investigate root cause
   → Fix and re-push to develop
   → Retry Phase 5 tomorrow

❌ Phase 7 verification fails (automatic rollback triggered):
   → Review failed tests
   → Fix failing features
   → Push to develop
   → Retry Phase 5 tomorrow
```

---

## ✅ Post-Execution Procedures

### After Phase 5 (2:30 AM UTC)

```
[ ] Check final report: night-qa-report.md
[ ] Verify status: SAFE / CONDITIONAL / BLOCKED
[ ] Record metrics in spreadsheet
[ ] Share report with team (if issues)
[ ] Go to sleep or monitor Phase 6 startup
```

### After Phase 6 (8:30 AM UTC, if successful)

```
[ ] Verify production health checks pass
[ ] Test key features manually (optional)
[ ] Check user-facing changes deployed
[ ] Monitor Phase 7 startup
```

### After Phase 7 (11:30 AM UTC, if successful)

```
[ ] Verify score meets threshold
[ ] Confirm system operational
[ ] Document any issues found
[ ] Archive reports and logs
[ ] Celebrate! 🎉
```

---

**The boulder never stops. 🪨**
