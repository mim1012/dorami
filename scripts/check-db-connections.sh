#!/usr/bin/env bash
# DB Connection Tracking Script — Task #22
# Monitors PostgreSQL active connections, idle connections, and pool usage
# Usage: bash scripts/check-db-connections.sh [--once] [--container dorami-postgres-1]

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

CONTAINER="${DB_CONTAINER:-dorami-postgres-1}"
DB_NAME="${DB_NAME:-dorami}"
DB_USER="${DB_USER:-postgres}"
INTERVAL="${INTERVAL:-30}"
ONCE=false
WARN_THRESHOLD="${WARN_THRESHOLD:-80}"
LOG_DIR="$(dirname "$0")/../reports"
LOG_FILE="${LOG_DIR}/db-connections.log"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --once) ONCE=true; shift ;;
    --container) CONTAINER="$2"; shift 2 ;;
    --db) DB_NAME="$2"; shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

mkdir -p "$LOG_DIR"

log() {
  echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

run_sql() {
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "$1" 2>/dev/null
}

check_connections() {
  log "${CYAN}=== DB Connection Check (${CONTAINER}) ===${NC}"

  # Check container is running
  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    log "${RED}Container ${CONTAINER} is not running.${NC}"
    return 1
  fi

  # Max connections
  local max_conn
  max_conn=$(run_sql "SHOW max_connections;" 2>/dev/null || echo "unknown")
  log "  Max connections: ${max_conn}"

  # Current connections by state
  log "  --- Connections by State ---"
  run_sql "SELECT state, count(*) FROM pg_stat_activity WHERE datname='${DB_NAME}' GROUP BY state ORDER BY count DESC;" 2>/dev/null | while IFS='|' read -r state count; do
    state="${state:-unknown}"
    log "    ${state}: ${count}"
  done

  # Total active
  local total_conn
  total_conn=$(run_sql "SELECT count(*) FROM pg_stat_activity WHERE datname='${DB_NAME}';" 2>/dev/null || echo "0")
  log "  Total connections: ${total_conn}"

  # Waiting queries
  local waiting
  waiting=$(run_sql "SELECT count(*) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND wait_event IS NOT NULL AND state='active';" 2>/dev/null || echo "0")
  if [[ "$waiting" -gt 0 ]]; then
    log "${YELLOW}  Waiting queries: ${waiting}${NC}"
  fi

  # Long-running queries (>30s)
  local long_running
  long_running=$(run_sql "SELECT count(*) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND state='active' AND now() - query_start > interval '30 seconds';" 2>/dev/null || echo "0")
  if [[ "$long_running" -gt 0 ]]; then
    log "${YELLOW}  Long-running queries (>30s): ${long_running}${NC}"
    run_sql "SELECT pid, now() - query_start AS duration, LEFT(query, 100) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND state='active' AND now() - query_start > interval '30 seconds';" 2>/dev/null | while IFS='|' read -r pid dur query; do
      log "    PID=${pid} duration=${dur} query=${query}"
    done
  fi

  # Connection usage percentage
  if [[ "$max_conn" != "unknown" && "$max_conn" -gt 0 ]]; then
    local pct=$(( total_conn * 100 / max_conn ))
    if [[ $pct -ge $WARN_THRESHOLD ]]; then
      log "${RED}  CONNECTION WARNING: ${pct}% usage (${total_conn}/${max_conn})${NC}"
      return 1
    else
      log "${GREEN}  Connection usage: ${pct}% (${total_conn}/${max_conn}) — OK${NC}"
    fi
  fi

  return 0
}

# Main
if $ONCE; then
  check_connections
  exit $?
fi

log "Starting DB connection monitor (interval: ${INTERVAL}s). Press Ctrl+C to stop."
while true; do
  check_connections || true
  sleep "$INTERVAL"
done
