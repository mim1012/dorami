#!/usr/bin/env bash
# =============================================================================
# run-load-test.sh — Dorami HLS Load Test Runner
#
# Orchestrates the full load test lifecycle:
#   1. Start infrastructure (docker-compose)
#   2. Wait for services to be healthy
#   3. Create test stream entry in the database
#   4. Run each k6 scenario in sequence
#   5. Archive all results with a timestamp
#
# Usage:
#   ./run-load-test.sh [OPTIONS]
#
# Options:
#   --scenario <name>   Run a single scenario (ramp|spike|soak|network_failure|all)
#                       Default: all (sequential)
#   --stream-key <key>  Stream key to use (default: test-stream-001)
#   --base-url <url>    SRS base URL (default: http://localhost:8080)
#   --skip-infra        Skip docker-compose up/down (use existing services)
#   --skip-db-seed      Skip database stream key creation
#   --results-dir <dir> Results output directory (default: ./results)
#   --k6-bin <path>     Path to k6 binary (default: k6)
#   -h, --help          Show this help
#
# Requirements:
#   - k6 (https://k6.io/docs/get-started/installation/)
#   - docker + docker-compose
#   - psql (for DB seeding, or pass --skip-db-seed)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
SCENARIO="all"
STREAM_KEY="test-stream-001"
BASE_URL="http://localhost:8080"
SKIP_INFRA=false
SKIP_DB_SEED=false
K6_BIN="k6"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"
DOCKER_COMPOSE_FILE="${SCRIPT_DIR}/../../docker-compose.yml"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE_DIR="${RESULTS_DIR}/archive/${TIMESTAMP}"

# Database connection (defaults match docker-compose.yml)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-live_commerce}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

log()    { echo -e "${CYAN}[$(date +%H:%M:%S)]${RESET} $*"; }
success(){ echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${RESET} $*"; }
warn()   { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${RESET} $*"; }
error()  { echo -e "${RED}[$(date +%H:%M:%S)] ✗${RESET} $*" >&2; }
header() { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════${RESET}"; \
           echo -e "${BOLD}${CYAN}  $*${RESET}"; \
           echo -e "${BOLD}${CYAN}══════════════════════════════════════════${RESET}\n"; }

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --scenario)      SCENARIO="$2";     shift 2 ;;
    --stream-key)    STREAM_KEY="$2";   shift 2 ;;
    --base-url)      BASE_URL="$2";     shift 2 ;;
    --skip-infra)    SKIP_INFRA=true;   shift   ;;
    --skip-db-seed)  SKIP_DB_SEED=true; shift   ;;
    --results-dir)   RESULTS_DIR="$2";  shift 2 ;;
    --k6-bin)        K6_BIN="$2";       shift 2 ;;
    -h|--help)
      grep '^#' "$0" | grep -v '^#!/' | sed 's/^# //' | sed 's/^#//'
      exit 0
      ;;
    *) error "Unknown option: $1"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
preflight_checks() {
  header "Pre-flight Checks"

  if ! command -v "$K6_BIN" &>/dev/null; then
    error "k6 not found. Install from: https://k6.io/docs/get-started/installation/"
    error "  macOS:  brew install k6"
    error "  Linux:  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkeys.openpgp.org --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69"
    error "          echo 'deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main' | sudo tee /etc/apt/sources.list.d/k6.list"
    error "          sudo apt-get update && sudo apt-get install k6"
    exit 1
  fi
  success "k6 found: $($K6_BIN version)"

  if [[ "$SKIP_INFRA" == false ]] && ! command -v docker &>/dev/null; then
    error "docker not found but --skip-infra not set"
    exit 1
  fi

  mkdir -p "${RESULTS_DIR}" "${ARCHIVE_DIR}"
  success "Results directory: ${RESULTS_DIR}"
}

# ---------------------------------------------------------------------------
# Infrastructure management
# ---------------------------------------------------------------------------
start_infrastructure() {
  if [[ "$SKIP_INFRA" == true ]]; then
    log "Skipping infrastructure startup (--skip-infra)"
    return
  fi

  header "Starting Infrastructure"
  log "docker-compose file: ${DOCKER_COMPOSE_FILE}"

  if [[ ! -f "$DOCKER_COMPOSE_FILE" ]]; then
    error "docker-compose.yml not found at: ${DOCKER_COMPOSE_FILE}"
    exit 1
  fi

  docker compose -f "$DOCKER_COMPOSE_FILE" up -d
  success "docker-compose started"
}

stop_infrastructure() {
  if [[ "$SKIP_INFRA" == true ]]; then
    return
  fi
  log "Stopping infrastructure..."
  docker compose -f "$DOCKER_COMPOSE_FILE" down 2>/dev/null || true
}

wait_for_services() {
  header "Waiting for Services"
  local max_wait=120
  local elapsed=0

  # Wait for SRS HTTP server
  log "Waiting for SRS at ${BASE_URL} ..."
  until curl -sf "${BASE_URL}/" &>/dev/null || [[ $elapsed -ge $max_wait ]]; do
    sleep 2
    elapsed=$((elapsed + 2))
    echo -n "."
  done
  echo ""

  if [[ $elapsed -ge $max_wait ]]; then
    warn "SRS did not become ready within ${max_wait}s — continuing anyway"
  else
    success "SRS is ready"
  fi

  # Wait for backend API
  elapsed=0
  log "Waiting for backend at ${BACKEND_URL}/api/health/live ..."
  until curl -sf "${BACKEND_URL}/api/health/live" &>/dev/null || [[ $elapsed -ge $max_wait ]]; do
    sleep 2
    elapsed=$((elapsed + 2))
    echo -n "."
  done
  echo ""

  if [[ $elapsed -ge $max_wait ]]; then
    warn "Backend did not become ready within ${max_wait}s"
  else
    success "Backend is ready"
  fi
}

# ---------------------------------------------------------------------------
# Database: create test stream key
# ---------------------------------------------------------------------------
seed_test_stream() {
  if [[ "$SKIP_DB_SEED" == true ]]; then
    log "Skipping DB seed (--skip-db-seed)"
    return
  fi

  header "Seeding Test Stream Key"

  # Use backend dev-login + API to create a live stream if possible
  # Fall back to direct SQL if backend unavailable
  if curl -sf "${BACKEND_URL}/api/health/live" &>/dev/null; then
    log "Creating stream via backend API..."

    # Authenticate as dev user
    local auth_response
    auth_response=$(curl -sf -X POST "${BACKEND_URL}/api/auth/dev-login" \
      -H "Content-Type: application/json" \
      -d '{"email":"loadtest@dorami.test","role":"ADMIN"}' \
      -c /tmp/loadtest-cookies.txt 2>/dev/null || echo "")

    if [[ -n "$auth_response" ]]; then
      # Create a live stream with the test stream key
      local stream_response
      stream_response=$(curl -sf -X POST "${BACKEND_URL}/api/streaming/streams" \
        -H "Content-Type: application/json" \
        -b /tmp/loadtest-cookies.txt \
        -d "{\"streamKey\":\"${STREAM_KEY}\",\"title\":\"Load Test Stream\"}" \
        2>/dev/null || echo "")

      if [[ -n "$stream_response" ]]; then
        success "Stream created via API: ${STREAM_KEY}"
        return
      fi
    fi
    warn "API creation failed, attempting direct SQL..."
  fi

  # Direct SQL fallback
  if command -v psql &>/dev/null; then
    PGPASSWORD="$DB_PASSWORD" psql \
      -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
      -c "
        INSERT INTO \"LiveStream\" (id, \"streamKey\", title, status, \"createdAt\", \"updatedAt\")
        VALUES (
          gen_random_uuid(),
          '${STREAM_KEY}',
          'Load Test Stream',
          'LIVE',
          NOW(),
          NOW()
        )
        ON CONFLICT (\"streamKey\") DO UPDATE SET
          status = 'LIVE',
          \"updatedAt\" = NOW();
      " 2>/dev/null && success "Stream key seeded via SQL" || warn "SQL seed failed — stream key may already exist or stream may not be needed for HLS test"
  else
    warn "psql not available; skipping DB seed. Pass --skip-db-seed to suppress this warning."
    warn "Ensure stream key '${STREAM_KEY}' exists and a publisher is connected."
  fi
}

# ---------------------------------------------------------------------------
# k6 runner
# ---------------------------------------------------------------------------
run_scenario() {
  local scenario="$1"
  local out_prefix="${ARCHIVE_DIR}/${scenario}"

  header "Running Scenario: ${scenario}"
  log "Output prefix: ${out_prefix}"

  # Create results subdirectory inside loadtest dir so handleSummary paths work
  mkdir -p "${SCRIPT_DIR}/results"

  local k6_args=(
    run
    --env "SCENARIO=${scenario}"
    --env "BASE_URL=${BASE_URL}"
    --env "STREAM_KEY=${STREAM_KEY}"
    --out "json=${out_prefix}-raw.json"
    --summary-export "${out_prefix}-summary.json"
  )

  # Add CSV output if xk6-csv is available (optional extension)
  # k6_args+=(--out "csv=${out_prefix}-metrics.csv")

  # Run from the loadtest directory so relative result paths resolve correctly
  local exit_code=0
  (cd "${SCRIPT_DIR}" && "$K6_BIN" "${k6_args[@]}" hls-load-test.js) || exit_code=$?

  # Copy results.json to archive
  if [[ -f "${SCRIPT_DIR}/results/results.json" ]]; then
    cp "${SCRIPT_DIR}/results/results.json" "${out_prefix}-results.json"
  fi

  if [[ $exit_code -eq 0 ]]; then
    success "Scenario '${scenario}' PASSED"
  else
    warn "Scenario '${scenario}' FAILED or thresholds breached (exit code: ${exit_code})"
  fi

  return $exit_code
}

run_all_scenarios() {
  local scenarios=("ramp" "spike" "network_failure")
  # Soak is 6 hours — only run if explicitly requested
  if [[ "$SCENARIO" == "soak" ]]; then
    scenarios=("soak")
  elif [[ "$SCENARIO" == "all" ]]; then
    warn "Soak scenario (6h) is excluded from 'all'. Run with --scenario soak explicitly."
    scenarios=("ramp" "spike" "network_failure")
  fi

  local overall_exit=0
  for s in "${scenarios[@]}"; do
    run_scenario "$s" || overall_exit=$?
    sleep 30  # cool-down between scenarios
  done
  return $overall_exit
}

# ---------------------------------------------------------------------------
# Archive results
# ---------------------------------------------------------------------------
archive_results() {
  header "Archiving Results"
  log "Archive location: ${ARCHIVE_DIR}"

  # Write run metadata
  cat > "${ARCHIVE_DIR}/run-metadata.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "scenario": "${SCENARIO}",
  "stream_key": "${STREAM_KEY}",
  "base_url": "${BASE_URL}",
  "k6_version": "$($K6_BIN version 2>&1 | head -1)"
}
EOF

  # Compress the archive
  local tarball="${RESULTS_DIR}/loadtest-${TIMESTAMP}.tar.gz"
  tar -czf "$tarball" -C "${RESULTS_DIR}/archive" "${TIMESTAMP}" 2>/dev/null || true
  success "Results archived: ${tarball}"
  log "Individual result files in: ${ARCHIVE_DIR}/"
}

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
cleanup() {
  log "Cleaning up temporary files..."
  rm -f /tmp/loadtest-cookies.txt
  stop_infrastructure
}

trap cleanup EXIT

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  header "Dorami HLS Load Test Runner"
  log "Timestamp   : ${TIMESTAMP}"
  log "Scenario    : ${SCENARIO}"
  log "Stream Key  : ${STREAM_KEY}"
  log "Base URL    : ${BASE_URL}"

  preflight_checks
  start_infrastructure
  wait_for_services
  seed_test_stream

  local exit_code=0
  if [[ "$SCENARIO" == "all" ]]; then
    run_all_scenarios || exit_code=$?
  else
    run_scenario "$SCENARIO" || exit_code=$?
  fi

  archive_results

  if [[ $exit_code -eq 0 ]]; then
    success "All scenarios completed successfully"
  else
    warn "One or more scenarios failed or breached thresholds. Check results in: ${ARCHIVE_DIR}"
  fi

  exit $exit_code
}

main "$@"
