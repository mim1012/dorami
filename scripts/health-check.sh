#!/usr/bin/env bash
# Health Check Script — Task #22
# Polls health endpoints every 30 seconds and logs results
# Usage: bash scripts/health-check.sh [--once] [--url https://www.doremi-live.com]
# Flags:
#   --once    Run a single check and exit (for CI)
#   --url     Override base URL (default: http://localhost:3001)

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Defaults
BASE_URL="${BASE_URL:-http://localhost:3001}"
INTERVAL=30
ONCE=false
LOG_DIR="$(dirname "$0")/../reports"
LOG_FILE="${LOG_DIR}/health-check.log"

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --once) ONCE=true; shift ;;
    --url) BASE_URL="$2"; shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

mkdir -p "$LOG_DIR"

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo -e "$msg" | tee -a "$LOG_FILE"
}

check_endpoint() {
  local name="$1"
  local url="$2"
  local start end duration http_code body

  start=$(date +%s%N)
  http_code=$(curl -s -o /tmp/health_body.txt -w "%{http_code}" --connect-timeout 5 --max-time 10 "$url" 2>/dev/null || echo "000")
  end=$(date +%s%N)
  duration=$(( (end - start) / 1000000 ))
  body=$(cat /tmp/health_body.txt 2>/dev/null || echo "")

  if [[ "$http_code" == "200" ]]; then
    log "${GREEN}[PASS]${NC} ${name}: HTTP ${http_code} (${duration}ms)"
    return 0
  else
    log "${RED}[FAIL]${NC} ${name}: HTTP ${http_code} (${duration}ms) — ${body:0:200}"
    return 1
  fi
}

run_checks() {
  local failures=0

  log "--- Health Check @ ${BASE_URL} ---"

  check_endpoint "Liveness  (/api/health/live)"  "${BASE_URL}/api/health/live"  || ((failures++))
  check_endpoint "Readiness (/api/health/ready)" "${BASE_URL}/api/health/ready" || ((failures++))

  # Optional: check frontend if port 3000 is up
  local frontend_url="${FRONTEND_URL:-http://localhost:3000}"
  if curl -s --connect-timeout 2 "$frontend_url" >/dev/null 2>&1; then
    check_endpoint "Frontend  (/)" "$frontend_url" || ((failures++))
  fi

  if [[ $failures -eq 0 ]]; then
    log "${GREEN}All health checks passed.${NC}"
  else
    log "${RED}${failures} check(s) failed.${NC}"
  fi

  return $failures
}

# Main
if $ONCE; then
  run_checks
  exit $?
fi

log "Starting continuous health check (interval: ${INTERVAL}s). Press Ctrl+C to stop."
while true; do
  run_checks || true
  sleep "$INTERVAL"
done
