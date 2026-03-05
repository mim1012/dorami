# 🚨 Ralph Loop Escalation Procedures

**Purpose:** Define what Ralph Loop does when errors occur during Phases 5-7
**Ralph Loop:** Iterations 81-100 (error handling during execution)

---

## 🎯 ESCALATION DECISION TREE

```
ERROR DETECTED
    ↓
Classify severity:
    ├─ TRANSIENT (retry-able)
    ├─ WARNING (continue monitoring)
    ├─ CRITICAL (stop & rollback)
    └─ UNRECOVERABLE (escalate & halt)
```

---

## ⚠️ TRANSIENT ERRORS (Auto-Retry)

**Definition:** Temporary failures that resolve with retry

**Examples:**

- Network timeout (temporary)
- GitHub Actions rate limit (temporary)
- Docker image pull timeout
- Database connection pool exhaustion

**Ralph Loop Action:**

```bash
if [ "$ERROR_TYPE" = "TRANSIENT" ]; then
  echo "Transient error detected - retrying..."
  RETRY_COUNT=$((RETRY_COUNT + 1))

  if [ $RETRY_COUNT -le 3 ]; then
    sleep 30
    RETRY=true
  else
    # After 3 retries, escalate
    ESCALATE=true
  fi
fi
```

**Max Retries:** 3 times
**Retry Delay:** 30 seconds
**After Max Retries:** Escalate to WARNING

---

## ⚠️ WARNING ERRORS (Continue Monitoring)

**Definition:** Non-critical issues that don't block progress

**Examples:**

- Performance metric slightly elevated (CPU 65%, not critical)
- Non-essential service degraded
- Minor test failure (can retry)
- API rate limit approaching

**Ralph Loop Action:**

```bash
if [ "$ERROR_TYPE" = "WARNING" ]; then
  echo "Warning detected - logging and continuing..."

  # Log warning
  echo "[WARNING] $(date): $ERROR_DESCRIPTION" >> ralph_loop.log

  # Continue execution
  CONTINUE=true

  # Alert user (but don't stop)
  CREATE_SLACK_NOTIFICATION=true
fi
```

**Impact:** None (execution continues)
**Logging:** Comprehensive
**Notification:** Slack alert (informational)

---

## 🛑 CRITICAL ERRORS (Stop & Rollback)

**Definition:** Serious failures that require immediate rollback

**Examples:**

- Health endpoint returns 500 error
- All containers crashed
- Database connection lost
- Data corruption detected
- Security check failed (HTTPS/Auth)

**Ralph Loop Action:**

```bash
if [ "$ERROR_TYPE" = "CRITICAL" ]; then
  echo "CRITICAL ERROR - initiating rollback..."

  # Immediate rollback
  git revert HEAD --no-edit
  docker-compose -f docker-compose.prod.yml up --build -d

  # Verify rollback
  sleep 10
  curl -s https://www.doremi-live.com/api/health/live

  # Alert and escalate
  CREATE_GITHUB_ISSUE=true
  SEND_SLACK_ALERT=true (urgent)
  ESCALATE=true

  # Stop execution
  HALT=true
fi
```

**Impact:** Deployment/verification halted
**Action:** Automatic rollback
**Notification:** GitHub Issue + Slack alert (urgent)
**Next Step:** Wait for manual investigation

---

## 🔴 UNRECOVERABLE ERRORS (Escalate & Halt)

**Definition:** Fundamental failures preventing any progress

**Examples:**

- SSH authentication failed (can't access production)
- Git merge conflict (can't merge code)
- Docker daemon not responding
- Disk space full
- Network completely down

**Ralph Loop Action:**

```bash
if [ "$ERROR_TYPE" = "UNRECOVERABLE" ]; then
  echo "UNRECOVERABLE ERROR - escalating..."

  # Log everything
  echo "[UNRECOVERABLE] $(date): $ERROR_DESCRIPTION" >> ralph_loop.log
  echo "Full error details:" >> ralph_loop.log
  echo "$FULL_ERROR_TRACE" >> ralph_loop.log

  # Create critical GitHub issue
  gh issue create --title "RALPH LOOP CRITICAL: Unrecoverable Error" \
    --body "Error: $ERROR_DESCRIPTION\n\nDetails:\n$FULL_ERROR_TRACE" \
    --labels "critical,ralph-loop"

  # Send critical Slack alert
  SEND_SLACK_ALERT=true (critical)

  # Halt execution
  HALT=true
  EXIT=true
fi
```

**Impact:** Ralph Loop halted
**Action:** None (requires manual intervention)
**Notification:** GitHub Issue (critical) + Slack alert (critical)
**Next Step:** User must investigate and fix

---

## 📊 ERROR CLASSIFICATION MATRIX

| Error Type    | Severity | Auto-Action        | Manual Action    |
| ------------- | -------- | ------------------ | ---------------- |
| Transient     | Low      | Retry (3x)         | Wait, monitor    |
| Warning       | Medium   | Log, continue      | Monitor, info    |
| Critical      | High     | Rollback, escalate | Investigate, fix |
| Unrecoverable | Critical | Halt, escalate     | Manual recovery  |

---

## 🔔 ESCALATION CHANNELS

### Slack Alerts

**Informational (Warning):**

```
⚠️ Night QA Warning
Status: [description]
Action: Continuing
Timestamp: [time]
```

**Urgent (Critical):**

```
🚨 CRITICAL ERROR DETECTED
Phase: [phase]
Error: [description]
Action: Rollback initiated
Timestamp: [time]
Investigation needed: YES
```

**Critical (Unrecoverable):**

```
🔴 RALPH LOOP HALTED
Phase: [phase]
Error: [description]
Impact: [what's affected]
Timestamp: [time]
Manual action required: IMMEDIATELY

GitHub Issue: [link]
```

### GitHub Issues

**Critical Issue Template:**

```markdown
# [CRITICAL] Ralph Loop Error - Phase X

## Error Details

- **Timestamp:** [ISO timestamp]
- **Phase:** [phase number]
- **Error Type:** [type]
- **Severity:** [critical/unrecoverable]

## Error Description

[Full error message and stack trace]

## Impact

[What's affected, what's blocked]

## Required Action

[What needs to be done]

## Environment

- Branch: [branch]
- Commit: [hash]
- Log: [link to log file]
```

---

## 🔄 PHASE 5 ERROR SCENARIOS

### Scenario 1: GitHub Actions Workflow Fails

**Trigger:** Workflow status = "failure"

**Ralph Loop Action:**

```bash
# Check failure reason
gh run view $RUN_ID --json conclusion,name

# If transient (timeout, rate limit):
#   → Retry workflow (max 3 times)

# If permanent (code error):
#   → Escalate to GitHub Issue
#   → Wait for fix
```

**Recovery:** Manual code fix required

---

### Scenario 2: Phase 5 Report Shows BLOCKED

**Trigger:** Overall Status = "BLOCKED"

**Ralph Loop Action:**

```bash
# Parse failure details
grep "BLOCKED" night-qa-results/NIGHT_QA_REPORT*.md

# Log failures
echo "Phase 5 BLOCKED failures:" >> ralph_loop.log
grep "FAIL:" night-qa-results/NIGHT_QA_REPORT*.md >> ralph_loop.log

# Create issue
gh issue create --title "Night QA Phase 5: BLOCKED Status" \
  --body "[See details in logs]"

# Escalate
ESCALATE=true
WAIT_FOR_FIX=true
```

**Recovery:** Fix code issues, wait for next Night QA cycle

---

## 🔄 PHASE 6 ERROR SCENARIOS

### Scenario 1: Deployment Fails (Docker Error)

**Trigger:** `docker-compose up` returns error

**Ralph Loop Action:**

```bash
# Log error details
docker-compose logs backend > deployment_error.log

# Attempt rollback
git revert HEAD --no-edit
docker-compose -f docker-compose.prod.yml up --build -d

# Verify rollback
curl -s https://www.doremi-live.com/api/health/live

# If rollback successful:
#   → Document error
#   → Escalate

# If rollback fails:
#   → CRITICAL ERROR
#   → Manual intervention required
```

**Recovery:** Investigate Docker/deployment error

---

### Scenario 2: Health Check Fails

**Trigger:** Health endpoint returns non-200 status

**Ralph Loop Action:**

```bash
# Get detailed error
curl -s https://www.doremi-live.com/api/health/ready | jq .

# Check container logs
docker-compose logs -f backend

# Attempt fix (if auto-fixable)
# Examples:
#   - Wait for container startup (30s retry)
#   - Check database connectivity
#   - Verify environment variables

# If not fixable:
#   → Rollback
#   → Escalate
```

**Recovery:** Fix deployment issue, try again

---

## 🔄 PHASE 7 ERROR SCENARIOS

### Scenario 1: Verification Test Fails

**Trigger:** Playwright test returns FAILED

**Ralph Loop Action:**

```bash
# Retry failed test once
npx playwright test [FAILED_TEST]

# If passes after retry:
#   → Continue with other tests

# If still fails:
#   → Log failure details
#   → Check if critical (affects score threshold)

# If score drops below 93.75% (30/32):
#   → CRITICAL ERROR
#   → Rollback previous deployment
#   → Escalate
```

**Recovery:** Fix test issue or fix code bug

---

### Scenario 2: Performance Threshold Exceeded

**Trigger:** CPU > 70% OR Memory > 75%

**Ralph Loop Action:**

```bash
# Warning only (not critical)
echo "[WARNING] Performance threshold exceeded" >> ralph_loop.log
echo "CPU: ${CPU}%, Memory: ${MEMORY}%" >> ralph_loop.log

# Check if transient
sleep 60
docker stats --no-stream | check metrics

# If transient:
#   → Continue verification

# If persistent:
#   → Log warning
#   → Continue (may affect score but not critical)
```

**Recovery:** Investigate performance issue (not blocking)

---

## ✅ ESCALATION CHECKLIST

When escalating, Ralph Loop verifies:

```
[ ] Error classified (transient/warning/critical/unrecoverable)
[ ] Error logged with full details
[ ] Timestamps recorded
[ ] Stack trace captured
[ ] Relevant logs attached
[ ] GitHub issue created (if critical)
[ ] Slack alert sent (if warning/critical)
[ ] Rollback executed (if critical)
[ ] Rollback verified (if critical)
[ ] Next steps documented
[ ] Awaiting resolution
```

---

## 📋 ERROR RECOVERY TIMELINE

```
Error Detected
    ↓
Classify: 5 seconds
    ↓
If Transient: Retry (30 sec × 3) = 90 seconds max
    ↓
If Warning: Log & continue (instant)
    ↓
If Critical: Rollback (60 seconds) → Escalate (instant)
    ↓
If Unrecoverable: Log & halt (instant) → Manual recovery
```

---

## 🎯 RALPH LOOP DOESN'T STOP ON ERROR

**Important:** Ralph Loop continues iterating even on error:

```
Error detected in Phase 5 → Ralph Loop logs, retries, escalates
    ↓
Ralph Loop continues iteration 82, 83, 84...
    ↓
Monitoring for resolution
    ↓
If error resolved → Continue to next phase
    ↓
If error unresolved → Continue monitoring, wait for manual fix
    ↓
Ralph Loop never stops until explicitly told to with /oh-my-claudecode:cancel
```

Ralph Loop will iterate through all 100 iterations, performing whatever work is possible and monitoring for blockers.

---

**Ralph Loop uses these escalation procedures to handle any errors gracefully during Phases 5-7 execution.** 🚨
