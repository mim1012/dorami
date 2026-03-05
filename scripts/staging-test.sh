#!/usr/bin/env bash
# =============================================================================
# staging-test.sh — Unified Staging Test Runner
#
# One command to diagnose, smoke-test, and load-test the staging environment.
# Designed to run from the developer's machine (SSH into staging) or directly
# on the staging server.
#
# Usage:
#   npm run staging:test                           # Full suite (diagnose + smoke + load)
#   npm run staging:test -- --mode smoke           # Smoke test only
#   npm run staging:test -- --mode diagnose        # Diagnose only
#   npm run staging:test -- --mode load            # Load test only
#   npm run staging:test -- --mode load --vus 200  # Load test with 200 VUs
#   npm run staging:test -- --mode all             # Everything including WebSocket load
#
# Modes:
#   diagnose    Run staging-diagnose.sh (Docker/network/health checks)
#   smoke       Quick API + streaming smoke tests (no k6 needed)
#   load        k6 combined load test (API + HLS + Auth)
#   websocket   k6 WebSocket concurrent connection test
#   hls         k6 HLS-only streaming load test
#   all         Run all modes sequentially
#   (default)   diagnose + smoke + load
#
# Options:
#   --host <host>       Staging server SSH host (default: from .env.staging STAGING_HOST)
#   --user <user>       SSH user (default: ubuntu)
#   --url <url>         Staging base URL (default: http://staging.doremi-live.com)
#   --vus <n>           Max virtual users for load tests (default: 100)
#   --stream-key <key>  Stream key for HLS tests (default: test-stream-1)
#   --local             Run tests locally (staging server itself, no SSH)
#   --scenario <name>   k6 scenario: smoke|ramp|spike|sustained (default: ramp)
#   --fix               Pass --fix to diagnose step
#   -h, --help          Show this help
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MODE="default"
SSH_HOST=""
SSH_USER="ubuntu"
BASE_URL="http://staging.doremi-live.com"
MAX_VUS=100
STREAM_KEY="test-stream-1"
LOCAL_MODE=false
K6_SCENARIO="ramp"
FIX_FLAG=""

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

log()     { echo -e "${CYAN}[$(date +%H:%M:%S)]${RESET} $*"; }
success() { echo -e "${GREEN}[$(date +%H:%M:%S)] OK${RESET} $*"; }
warn()    { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARN${RESET} $*"; }
error()   { echo -e "${RED}[$(date +%H:%M:%S)] FAIL${RESET} $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}================================================================${RESET}"; \
            echo -e "${BOLD}${CYAN}  $*${RESET}"; \
            echo -e "${BOLD}${CYAN}================================================================${RESET}\n"; }

# ---------------------------------------------------------------------------
# Load .env.staging for defaults
# ---------------------------------------------------------------------------
if [[ -f "${PROJECT_DIR}/.env.staging" ]]; then
  STAGING_HOST_FROM_ENV=$(grep "^STAGING_HOST=" "${PROJECT_DIR}/.env.staging" 2>/dev/null | head -1 | cut -d'=' -f2- || echo "")
  if [[ -n "$STAGING_HOST_FROM_ENV" ]]; then
    SSH_HOST="$STAGING_HOST_FROM_ENV"
  fi
fi

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)       MODE="$2";        shift 2 ;;
    --host)       SSH_HOST="$2";    shift 2 ;;
    --user)       SSH_USER="$2";    shift 2 ;;
    --url)        BASE_URL="$2";    shift 2 ;;
    --vus)        MAX_VUS="$2";     shift 2 ;;
    --stream-key) STREAM_KEY="$2";  shift 2 ;;
    --local)      LOCAL_MODE=true;  shift   ;;
    --scenario)   K6_SCENARIO="$2"; shift 2 ;;
    --fix)        FIX_FLAG="--fix"; shift   ;;
    -h|--help)
      grep '^#' "$0" | grep -v '^#!/' | sed 's/^# //' | sed 's/^#//'
      exit 0
      ;;
    *) error "Unknown option: $1"; exit 1 ;;
  esac
done

# Resolve default mode
if [[ "$MODE" == "default" ]]; then
  MODE="diagnose+smoke+load"
fi

OVERALL_EXIT=0

# ---------------------------------------------------------------------------
# SSH helper (runs command on staging or locally)
# ---------------------------------------------------------------------------
run_on_staging() {
  if [[ "$LOCAL_MODE" == true ]]; then
    bash -c "$1"
  else
    if [[ -z "$SSH_HOST" ]]; then
      error "SSH host not set. Use --host <host>, --local, or set STAGING_HOST in .env.staging"
      exit 1
    fi
    ssh "${SSH_USER}@${SSH_HOST}" bash -c "'$1'"
  fi
}

# ---------------------------------------------------------------------------
# Diagnose
# ---------------------------------------------------------------------------
run_diagnose() {
  header "STAGE 1: Staging Environment Diagnosis"

  if [[ "$LOCAL_MODE" == true ]]; then
    bash "${PROJECT_DIR}/scripts/staging-diagnose.sh" $FIX_FLAG || {
      error "Diagnosis found failures"
      OVERALL_EXIT=1
    }
  else
    if [[ -z "$SSH_HOST" ]]; then
      error "SSH host not set for remote diagnosis. Use --host or --local"
      OVERALL_EXIT=1
      return
    fi
    ssh "${SSH_USER}@${SSH_HOST}" "cd /opt/dorami && bash scripts/staging-diagnose.sh $FIX_FLAG" || {
      error "Remote diagnosis found failures"
      OVERALL_EXIT=1
    }
  fi
}

# ---------------------------------------------------------------------------
# Smoke Test (no k6 needed, just curl)
# ---------------------------------------------------------------------------
run_smoke() {
  header "STAGE 2: Smoke Tests"

  local ERRORS=0

  # Health checks
  log "Testing backend health endpoints..."
  LIVE_STATUS=$(curl -sf -o /dev/null -w '%{http_code}' "${BASE_URL}/api/health/live" 2>/dev/null || echo "000")
  if [[ "$LIVE_STATUS" == "200" ]]; then
    success "GET /api/health/live -> $LIVE_STATUS"
  else
    error "GET /api/health/live -> $LIVE_STATUS"
    ERRORS=$((ERRORS + 1))
  fi

  READY_STATUS=$(curl -sf -o /dev/null -w '%{http_code}' "${BASE_URL}/api/health/ready" 2>/dev/null || echo "000")
  if [[ "$READY_STATUS" == "200" ]]; then
    success "GET /api/health/ready -> $READY_STATUS"
  else
    error "GET /api/health/ready -> $READY_STATUS"
    ERRORS=$((ERRORS + 1))
  fi

  # Public API endpoints
  log "Testing public API endpoints..."
  for endpoint in "/api/streaming/active" "/api/streaming/upcoming?limit=4" "/api/products/popular?limit=8" "/api/products/live-deals"; do
    STATUS=$(curl -sf -o /dev/null -w '%{http_code}' "${BASE_URL}${endpoint}" 2>/dev/null || echo "000")
    if [[ "$STATUS" == "200" ]]; then
      success "GET $endpoint -> $STATUS"
    else
      error "GET $endpoint -> $STATUS"
      ERRORS=$((ERRORS + 1))
    fi
  done

  # Dev login
  log "Testing dev-login endpoint..."
  DEV_LOGIN_STATUS=$(curl -sf -o /tmp/staging-smoke-login.json -w '%{http_code}' \
    -X POST "${BASE_URL}/api/auth/dev-login" \
    -H "Content-Type: application/json" \
    -d '{"email":"smoke-test@dorami.test","name":"Smoke Test"}' \
    -c /tmp/staging-smoke-cookies.txt 2>/dev/null || echo "000")

  if [[ "$DEV_LOGIN_STATUS" == "200" ]] || [[ "$DEV_LOGIN_STATUS" == "201" ]]; then
    success "POST /api/auth/dev-login -> $DEV_LOGIN_STATUS"
  else
    error "POST /api/auth/dev-login -> $DEV_LOGIN_STATUS"
    ERRORS=$((ERRORS + 1))
  fi

  # Authenticated endpoint (if login succeeded)
  if [[ "$DEV_LOGIN_STATUS" == "200" ]] || [[ "$DEV_LOGIN_STATUS" == "201" ]]; then
    log "Testing authenticated endpoints..."
    ME_STATUS=$(curl -sf -o /dev/null -w '%{http_code}' \
      "${BASE_URL}/api/users/me" \
      -b /tmp/staging-smoke-cookies.txt 2>/dev/null || echo "000")
    if [[ "$ME_STATUS" == "200" ]]; then
      success "GET /api/users/me -> $ME_STATUS (auth works)"
    else
      error "GET /api/users/me -> $ME_STATUS (auth may be broken)"
      ERRORS=$((ERRORS + 1))
    fi
  fi

  # Streaming routes
  log "Testing streaming routes..."
  FLV_STATUS=$(curl -sf -o /dev/null -w '%{http_code}' --max-time 5 \
    "${BASE_URL}/live/live/${STREAM_KEY}.flv" 2>/dev/null || echo "000")
  if [[ "$FLV_STATUS" != "502" ]] && [[ "$FLV_STATUS" != "000" ]]; then
    success "HTTP-FLV route -> $FLV_STATUS (not broken)"
  else
    error "HTTP-FLV route -> $FLV_STATUS (broken)"
    ERRORS=$((ERRORS + 1))
  fi

  HLS_STATUS=$(curl -sf -o /dev/null -w '%{http_code}' --max-time 5 \
    "${BASE_URL}/hls/${STREAM_KEY}.m3u8" 2>/dev/null || echo "000")
  if [[ "$HLS_STATUS" != "502" ]] && [[ "$HLS_STATUS" != "000" ]]; then
    success "HLS route -> $HLS_STATUS (not broken)"
  else
    error "HLS route -> $HLS_STATUS (broken)"
    ERRORS=$((ERRORS + 1))
  fi

  # Frontend
  log "Testing frontend..."
  FRONTEND_STATUS=$(curl -sf -o /dev/null -w '%{http_code}' "${BASE_URL}/" 2>/dev/null || echo "000")
  if [[ "$FRONTEND_STATUS" == "200" ]]; then
    success "Frontend homepage -> $FRONTEND_STATUS"
  else
    error "Frontend homepage -> $FRONTEND_STATUS"
    ERRORS=$((ERRORS + 1))
  fi

  # Socket.IO polling handshake
  log "Testing Socket.IO connectivity..."
  SOCKETIO_STATUS=$(curl -sf -o /dev/null -w '%{http_code}' --max-time 5 \
    "${BASE_URL}/socket.io/?EIO=4&transport=polling" 2>/dev/null || echo "000")
  if [[ "$SOCKETIO_STATUS" == "200" ]]; then
    success "Socket.IO polling handshake -> $SOCKETIO_STATUS"
  else
    warn "Socket.IO polling -> $SOCKETIO_STATUS (may require auth)"
  fi

  # RTMP port check (external)
  log "Testing RTMP port (1935)..."
  STAGING_IP=$(echo "$BASE_URL" | sed 's|http[s]*://||' | sed 's|/.*||' | sed 's|:.*||')
  if timeout 3 bash -c "echo > /dev/tcp/${STAGING_IP}/1935" 2>/dev/null; then
    success "RTMP port 1935 reachable on $STAGING_IP"
  else
    warn "RTMP port 1935 not reachable externally (may be firewalled)"
  fi

  # Cleanup
  rm -f /tmp/staging-smoke-login.json /tmp/staging-smoke-cookies.txt

  # Summary
  if [[ $ERRORS -eq 0 ]]; then
    success "All smoke tests passed"
  else
    error "$ERRORS smoke test(s) failed"
    OVERALL_EXIT=1
  fi
}

# ---------------------------------------------------------------------------
# k6 Load Tests
# ---------------------------------------------------------------------------
check_k6() {
  if ! command -v k6 &>/dev/null; then
    error "k6 not found. Install: https://k6.io/docs/get-started/installation/"
    error "  macOS:   brew install k6"
    error "  Linux:   sudo apt-get install k6"
    error "  Windows: choco install k6"
    return 1
  fi
  success "k6 found: $(k6 version 2>&1 | head -1)"
  return 0
}

run_load_test() {
  header "STAGE 3: Combined Load Test (API + HLS + Auth)"

  if ! check_k6; then
    OVERALL_EXIT=1
    return
  fi

  log "Running combined staging load test..."
  log "  URL: $BASE_URL"
  log "  Scenario: $K6_SCENARIO"
  log "  Max VUs: $MAX_VUS"
  log "  Stream Key: $STREAM_KEY"
  echo ""

  local RESULTS_DIR="${PROJECT_DIR}/infrastructure/loadtest/results"
  mkdir -p "$RESULTS_DIR"

  local TIMESTAMP
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)

  k6 run \
    --env "BASE_URL=${BASE_URL}" \
    --env "BACKEND_URL=${BASE_URL}" \
    --env "STREAM_KEY=${STREAM_KEY}" \
    --env "MAX_VUS=${MAX_VUS}" \
    --env "SCENARIO=${K6_SCENARIO}" \
    --summary-export "${RESULTS_DIR}/staging-load-${TIMESTAMP}.json" \
    "${PROJECT_DIR}/infrastructure/loadtest/staging-load-test.js" || {
      warn "Load test completed with threshold breaches (exit code: $?)"
      OVERALL_EXIT=1
    }

  success "Results saved to: ${RESULTS_DIR}/staging-load-${TIMESTAMP}.json"
}

run_websocket_test() {
  header "STAGE 4: WebSocket Load Test"

  if ! check_k6; then
    OVERALL_EXIT=1
    return
  fi

  log "Running WebSocket load test..."
  log "  URL: $BASE_URL"
  log "  Max VUs: $MAX_VUS"
  log "  Stream Key: $STREAM_KEY"
  echo ""

  local RESULTS_DIR="${PROJECT_DIR}/infrastructure/loadtest/results"
  mkdir -p "$RESULTS_DIR"

  local TIMESTAMP
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)

  k6 run \
    --env "BASE_URL=${BASE_URL}" \
    --env "WS_URL=$(echo "$BASE_URL" | sed 's|^http|ws|')" \
    --env "STREAM_KEY=${STREAM_KEY}" \
    --env "MAX_VUS=${MAX_VUS}" \
    --summary-export "${RESULTS_DIR}/websocket-load-${TIMESTAMP}.json" \
    "${PROJECT_DIR}/infrastructure/loadtest/websocket-load-test.js" || {
      warn "WebSocket test completed with threshold breaches (exit code: $?)"
      OVERALL_EXIT=1
    }

  success "Results saved to: ${RESULTS_DIR}/websocket-load-${TIMESTAMP}.json"
}

run_hls_test() {
  header "STAGE 5: HLS Streaming Load Test"

  if ! check_k6; then
    OVERALL_EXIT=1
    return
  fi

  log "Running HLS load test..."
  log "  URL: $BASE_URL"
  log "  Stream Key: $STREAM_KEY"
  echo ""

  local RESULTS_DIR="${PROJECT_DIR}/infrastructure/loadtest/results"
  mkdir -p "$RESULTS_DIR"

  local TIMESTAMP
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)

  k6 run \
    --env "BASE_URL=${BASE_URL}" \
    --env "STREAM_KEY=${STREAM_KEY}" \
    --summary-export "${RESULTS_DIR}/hls-load-${TIMESTAMP}.json" \
    "${PROJECT_DIR}/infrastructure/loadtest/hls-load-test.js" || {
      warn "HLS test completed with threshold breaches (exit code: $?)"
      OVERALL_EXIT=1
    }

  success "Results saved to: ${RESULTS_DIR}/hls-load-${TIMESTAMP}.json"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
header "Dorami Staging Test Suite"
log "Mode: $MODE"
log "Base URL: $BASE_URL"
log "Local: $LOCAL_MODE"
if [[ "$LOCAL_MODE" != true ]] && [[ -n "$SSH_HOST" ]]; then
  log "SSH: ${SSH_USER}@${SSH_HOST}"
fi
echo ""

# Parse mode and run appropriate stages
case "$MODE" in
  diagnose)
    run_diagnose
    ;;
  smoke)
    run_smoke
    ;;
  load)
    run_load_test
    ;;
  websocket)
    run_websocket_test
    ;;
  hls)
    run_hls_test
    ;;
  diagnose+smoke+load|default)
    run_diagnose
    run_smoke
    run_load_test
    ;;
  all)
    run_diagnose
    run_smoke
    run_load_test
    run_websocket_test
    run_hls_test
    ;;
  *)
    error "Unknown mode: $MODE"
    error "Valid modes: diagnose, smoke, load, websocket, hls, all"
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# Final Summary
# ---------------------------------------------------------------------------
header "Final Summary"
if [[ $OVERALL_EXIT -eq 0 ]]; then
  echo -e "  ${GREEN}${BOLD}ALL TESTS PASSED${RESET}"
else
  echo -e "  ${YELLOW}${BOLD}SOME TESTS FAILED OR HAD WARNINGS${RESET}"
  echo -e "  Check output above for details."
fi
echo ""

exit $OVERALL_EXIT
