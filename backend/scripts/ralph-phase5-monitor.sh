#!/bin/bash

###############################################################################
# Ralph Loop Phase 5 Monitoring Helper
#
# This script is executed by Ralph Loop during iterations 87-90
# to monitor GitHub Actions Phase 5 execution in real-time.
#
# Usage:
#   ./ralph-phase5-monitor.sh [max_wait_minutes] [poll_interval_seconds]
#
# Environment Variables:
#   GITHUB_TOKEN - GitHub API token (required for gh commands)
#   WORKFLOW_ID - GitHub Actions workflow file (default: night-qa.yml)
###############################################################################

set -e

# Configuration
WORKFLOW_FILE="${WORKFLOW_ID:-night-qa.yml}"
MAX_WAIT_MINUTES="${1:-240}"  # 4 hours max
POLL_INTERVAL="${2:-600}"     # 10 minutes between checks
REPO="${GITHUB_REPOSITORY:-$(git config --get remote.origin.url | sed 's/.*://;s/.git$//')}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log file
LOG_FILE="phase5_monitoring_$(date +%Y%m%d_%H%M%S).log"

echo "========================================" | tee -a "$LOG_FILE"
echo "🌙 Ralph Loop Phase 5 Monitoring" | tee -a "$LOG_FILE"
echo "Started: $(date -u +'%Y-%m-%d %H:%M:%S UTC')" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo ""

# Calculate max wait time in seconds
MAX_WAIT_SECONDS=$((MAX_WAIT_MINUTES * 60))
START_TIME=$(date +%s)

###############################################################################
# Function: Get latest workflow run
###############################################################################
get_latest_run() {
  gh run list --workflow="$WORKFLOW_FILE" --limit=1 --json databaseId,status,conclusion,updatedAt --jq '.[0]'
}

###############################################################################
# Function: Check if workflow is complete
###############################################################################
is_complete() {
  local status="$1"
  [[ "$status" == "completed" ]]
}

###############################################################################
# Function: Check if workflow failed
###############################################################################
is_failed() {
  local conclusion="$1"
  [[ "$conclusion" == "failure" || "$conclusion" == "cancelled" ]]
}

###############################################################################
# Main Monitoring Loop
###############################################################################
ITERATION=0
while true; do
  ITERATION=$((ITERATION + 1))
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))
  ELAPSED_MINUTES=$((ELAPSED / 60))

  echo -e "${BLUE}[Iteration $ITERATION]${NC} Checking Phase 5 status..." | tee -a "$LOG_FILE"
  echo "  Elapsed: ${ELAPSED_MINUTES}m / ${MAX_WAIT_MINUTES}m" | tee -a "$LOG_FILE"

  # Get current workflow run
  RUN_DATA=$(get_latest_run)
  RUN_ID=$(echo "$RUN_DATA" | jq -r '.databaseId')
  STATUS=$(echo "$RUN_DATA" | jq -r '.status')
  CONCLUSION=$(echo "$RUN_DATA" | jq -r '.conclusion // empty')

  echo "  Run ID: $RUN_ID" | tee -a "$LOG_FILE"
  echo "  Status: $STATUS" | tee -a "$LOG_FILE"
  [[ -n "$CONCLUSION" ]] && echo "  Conclusion: $CONCLUSION" | tee -a "$LOG_FILE"

  # Log to file
  echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] Status: $STATUS | Conclusion: $CONCLUSION" >> "$LOG_FILE"

  # Check for completion
  if is_complete "$STATUS"; then
    echo "" | tee -a "$LOG_FILE"
    echo -e "${GREEN}✅ Phase 5 Workflow COMPLETED${NC}" | tee -a "$LOG_FILE"

    if is_failed "$CONCLUSION"; then
      echo -e "${RED}❌ Conclusion: FAILED${NC}" | tee -a "$LOG_FILE"
      echo "PHASE5_STATUS=FAILED" >> "$LOG_FILE"
      break
    else
      echo -e "${GREEN}✅ Conclusion: SUCCESS${NC}" | tee -a "$LOG_FILE"
      echo "PHASE5_STATUS=SUCCESS" >> "$LOG_FILE"

      # Download report artifacts
      echo "" | tee -a "$LOG_FILE"
      echo "📥 Downloading Phase 5 report artifacts..." | tee -a "$LOG_FILE"
      mkdir -p ./night-qa-results
      gh run download "$RUN_ID" -D ./night-qa-results || true
      echo "Report downloaded to ./night-qa-results/" | tee -a "$LOG_FILE"
      break
    fi
  fi

  # Check for timeout
  if [[ $ELAPSED -gt $MAX_WAIT_SECONDS ]]; then
    echo -e "${RED}❌ Phase 5 TIMEOUT (exceeded ${MAX_WAIT_MINUTES} minutes)${NC}" | tee -a "$LOG_FILE"
    echo "PHASE5_STATUS=TIMEOUT" >> "$LOG_FILE"
    break
  fi

  # Sleep before next check
  echo "  Next check in ${POLL_INTERVAL}s..." | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"
  sleep "$POLL_INTERVAL"
done

echo "========================================" | tee -a "$LOG_FILE"
echo "Monitoring ended: $(date -u +'%Y-%m-%d %H:%M:%S UTC')" | tee -a "$LOG_FILE"
echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

# Export for Ralph Loop
export PHASE5_LOG_FILE="$LOG_FILE"
