# 📡 Phase 5 Monitoring Template

**Purpose:** Help Ralph Loop monitor GitHub Actions execution tonight in real-time
**Ralph Loop:** Iterations 83-90 (tonight through tomorrow morning)
**Window:** 11 PM UTC tonight → 7 AM UTC tomorrow

---

## 🎯 MONITORING OBJECTIVES

Ralph Loop will monitor:

1. Workflow start time
2. Each stage completion
3. Resource usage during load test
4. Report generation
5. Final status determination

---

## 📊 MONITORING CHECKLIST

### Pre-Execution (10:50 PM UTC - 11:00 PM UTC)

```bash
# 10 minutes before scheduled start
echo "[MONITORING] Checking GitHub Actions readiness..."

# Verify workflow file exists and is valid
gh workflow list | grep night-qa.yml
# Expected: night-qa (enabled)

# Verify secrets are set
gh secret list | wc -l
# Expected: >= 6 secrets configured

# Verify repository state
git status | grep "nothing to commit"
# Expected: Clean working directory

# Set up monitoring log
cat > phase5_monitoring.log << 'EOF'
Phase 5 Monitoring Log
Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

echo "[MONITORING] Phase 5 execution ready ✅"
```

---

### Execution Monitoring (11:00 PM UTC - 3:30 AM UTC)

Ralph Loop monitors every 10 minutes:

```bash
#!/bin/bash
# PHASE5_MONITOR.sh

monitor_interval=600  # 10 minutes
max_duration=14400    # 4 hours
start_time=$(date +%s)

while true; do
  current_time=$(date +%s)
  elapsed=$((current_time - start_time))

  echo "[$(date -u +%H:%M:%S)] Monitoring Phase 5 execution..."

  # Get workflow status
  WORKFLOW_STATUS=$(gh run list --workflow=night-qa.yml --limit=1 --json status --jq '.[0].status')
  WORKFLOW_ID=$(gh run list --workflow=night-qa.yml --limit=1 --json databaseId --jq '.[0].databaseId')

  echo "[MONITORING] Workflow status: $WORKFLOW_STATUS"
  echo "[MONITORING] Workflow ID: $WORKFLOW_ID"

  # Log status
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Status: $WORKFLOW_STATUS (Elapsed: ${elapsed}s)" >> phase5_monitoring.log

  # Check for completion
  if [ "$WORKFLOW_STATUS" = "completed" ]; then
    echo "[MONITORING] Phase 5 workflow COMPLETED ✅"
    WORKFLOW_COMPLETED=true
    break
  fi

  # Check for failure
  if [ "$WORKFLOW_STATUS" = "failure" ]; then
    echo "[MONITORING] Phase 5 workflow FAILED ❌"
    WORKFLOW_FAILED=true
    break
  fi

  # Check timeout (4 hours)
  if [ $elapsed -gt $max_duration ]; then
    echo "[MONITORING] Phase 5 TIMEOUT (exceeded 4 hours) ❌"
    WORKFLOW_TIMEOUT=true
    break
  fi

  # Sleep before next check
  echo "[MONITORING] Next check in 10 minutes..."
  sleep $monitor_interval
done
```

---

### Stage-Level Monitoring

Ralph Loop can optionally drill into stage details:

```bash
# Get detailed job information
gh run view $WORKFLOW_ID --json jobs

# Check each stage status
gh run view $WORKFLOW_ID --json jobs --jq '.jobs[] | {name, conclusion, status}'

# Expected progression:
# Stage 1: DB Drift → COMPLETED
# Stage 2: Streaming → COMPLETED
# Stage 3: CRUD → COMPLETED
# Stage 4: UI Data Binding → COMPLETED
# Stage 5: Load Test → COMPLETED
# Stage 6: Report → COMPLETED
```

---

## 🔍 REAL-TIME METRICS DURING LOAD TEST

During Phase 5 Stage 5 (Load Test), Ralph Loop can monitor:

```bash
# Get backend logs during execution
gh run view $WORKFLOW_ID --json logs --jq '.logs' | tail -100 > /tmp/phase5_logs.txt

# Look for key metrics:
grep -i "50 users\|100 users\|150 users\|200 users" /tmp/phase5_logs.txt

# Look for performance data:
grep -i "cpu\|memory\|response time\|error rate" /tmp/phase5_logs.txt

# Look for warnings:
grep -i "warning\|error" /tmp/phase5_logs.txt
```

---

## 📈 KEY MILESTONES TO MONITOR

```
11:00 PM UTC: Phase 5 workflow starts
  └─ Monitor: GitHub Actions job creation

11:05 PM UTC: Stage 1 (DB Drift) starts
  └─ Monitor: Completion, should finish ~5 min

11:10 PM UTC: Stage 2 (Streaming) starts
  └─ Monitor: RTMP ingest test completion

11:13 PM UTC: Stage 3 (CRUD) starts
  └─ Monitor: Product operations verification

11:15 PM UTC: Stage 4 (UI Data Binding) starts
  └─ Monitor: Playwright test results

11:20 PM UTC: Stage 5 (Load Test) starts
  └─ Monitor: 50→100→150→200 CCU progression
  └─ Expected duration: 150 minutes

1:50 AM UTC: Stage 5 completes
  └─ Monitor: Load test metrics

1:55 AM UTC: Stage 6 (Report) starts
  └─ Monitor: Report generation

2:00 AM UTC: Phase 5 COMPLETE
  └─ Workflow status: COMPLETED ✅
```

---

## ⚠️ MONITORING ALERTS

Ralph Loop watches for these conditions:

### Status Alerts

```bash
# GREEN: Workflow progressing normally
if [ "$WORKFLOW_STATUS" = "in_progress" ]; then
  echo "✅ Phase 5 execution in progress - all good"
fi

# YELLOW: Workflow taking longer than expected
EXPECTED_DURATION=14400  # 4 hours
if [ $elapsed -gt $((EXPECTED_DURATION * 0.8)) ] && \
   [ "$WORKFLOW_STATUS" = "in_progress" ]; then
  echo "⚠️ Phase 5 taking longer than expected (80% of max time)"
fi

# RED: Workflow failed
if [ "$WORKFLOW_STATUS" = "failure" ]; then
  echo "🔴 Phase 5 FAILED - investigate immediately"
fi

# CRITICAL: Workflow timeout
if [ $elapsed -gt $EXPECTED_DURATION ]; then
  echo "🔴 CRITICAL: Phase 5 TIMEOUT - exceeded 4 hours"
fi
```

---

## 📝 MONITORING LOG

Ralph Loop maintains detailed log:

```bash
# phase5_monitoring.log format:
[2026-03-03T01:05:00Z] Phase 5 monitoring started
[2026-03-03T01:05:15Z] Workflow status: in_progress
[2026-03-03T01:05:15Z] Workflow ID: 12345678
[2026-03-03T01:15:30Z] Workflow status: in_progress
[2026-03-03T01:15:30Z] Stage 1 complete: DB Drift ✅
[2026-03-03T01:25:45Z] Stage 2 complete: Streaming ✅
[2026-03-03T01:27:50Z] Stage 3 complete: CRUD ✅
[2026-03-03T01:30:00Z] Stage 4 complete: UI Data Binding ✅
[2026-03-03T01:35:00Z] Stage 5 starting: Load Test (50 users)
[2026-03-03T02:05:00Z] Stage 5 complete: Load Test ✅
[2026-03-03T02:10:00Z] Stage 6 complete: Report ✅
[2026-03-03T02:10:30Z] Workflow status: completed
[2026-03-03T02:10:30Z] Phase 5 COMPLETE ✅
```

---

## 🔄 MONITORING WORKFLOW

```bash
#!/bin/bash
# Complete Phase 5 monitoring procedure

# 1. Pre-check
echo "Phase 5 Monitoring Starting..."
gh workflow list | grep night-qa
gh secret list

# 2. Monitor loop
MONITORING=true
ITERATION=0
MAX_ITERATIONS=30  # 5 hours of monitoring (10 min intervals)

while [ $MONITORING = true ]; do
  ITERATION=$((ITERATION + 1))
  echo "[Iteration $ITERATION] Checking Phase 5 status..."

  # Get current status
  STATUS=$(gh run list --workflow=night-qa.yml --limit=1 --json status --jq '.[0].status')
  RUN_ID=$(gh run list --workflow=night-qa.yml --limit=1 --json databaseId --jq '.[0].databaseId')

  # Log
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Status: $STATUS" >> phase5_monitoring.log

  # Check result
  if [ "$STATUS" = "completed" ]; then
    echo "✅ Phase 5 COMPLETED"
    MONITORING=false
    PHASE5_COMPLETE=true
  elif [ "$STATUS" = "failure" ]; then
    echo "❌ Phase 5 FAILED"
    MONITORING=false
    PHASE5_FAILED=true
  elif [ $ITERATION -ge $MAX_ITERATIONS ]; then
    echo "⏱️ Phase 5 TIMEOUT"
    MONITORING=false
    PHASE5_TIMEOUT=true
  else
    # Continue monitoring
    echo "Waiting... next check in 10 minutes"
    sleep 600
  fi
done

# 3. When complete, download report
if [ "$PHASE5_COMPLETE" = true ]; then
  echo "Downloading Phase 5 report..."
  gh run download $RUN_ID --dir ./night-qa-results
  echo "Report downloaded ✅"

  # Parse results
  REPORT_STATUS=$(grep "Overall Status:" night-qa-results/NIGHT_QA_REPORT*.md | awk '{print $NF}')
  echo "Deployment Readiness: $REPORT_STATUS"

  if [ "$REPORT_STATUS" = "SAFE" ]; then
    echo "✅ Phase 5 SAFE - Proceed to Phase 6"
    PROCEED_PHASE6=true
  else
    echo "⚠️ Phase 5 $REPORT_STATUS - Monitor auto-fix"
  fi
fi
```

---

## 📞 MONITORING NOTIFICATIONS

Ralph Loop sends Slack alerts:

```bash
# Progress notification (every hour)
SEND_SLACK_MESSAGE="🔵 Phase 5 Progress Update
Status: In Progress
Elapsed: 1 hour
Next Stage: [current stage]
Estimated Completion: [time]"

# Completion notification
SEND_SLACK_MESSAGE="✅ Phase 5 Complete
Overall Status: SAFE
Data Binding: 19/19 PASS
Load Test: PASS
Ready for Phase 6 deployment"

# Failure notification
SEND_SLACK_MESSAGE="🔴 Phase 5 Failed
Status: BLOCKED
Failures: [details]
Action: Awaiting auto-fix retry"
```

---

## ✅ MONITORING SUCCESS CRITERIA

Phase 5 monitoring is successful when:

```
✅ Workflow starts at 11 PM UTC
✅ All 6 stages execute in sequence
✅ Report generates by 2:00 AM UTC
✅ Overall status determined (SAFE/CONDITIONAL/BLOCKED)
✅ Report available for download
✅ Monitoring log complete
✅ Ready for Phase 6 decision
```

---

**Ralph Loop uses this monitoring template to actively track Phase 5 execution tonight and ensure all stages complete successfully.** 📡
