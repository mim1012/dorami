#!/usr/bin/env bash
# Log Aggregation Script — Task #22
# Collects ERROR and CRITICAL logs from all doremi containers
# Usage: bash scripts/aggregate-logs.sh [--since 1h] [--output reports/error-log.txt]

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SINCE="${SINCE:-1h}"
LOG_DIR="$(dirname "$0")/../reports"
OUTPUT="${OUTPUT:-${LOG_DIR}/aggregated-errors.log}"
CONTAINERS="doremi"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --since) SINCE="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --filter) CONTAINERS="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

mkdir -p "$(dirname "$OUTPUT")"

log() {
  echo -e "$1"
}

log "${CYAN}=== Log Aggregation (since ${SINCE}) ===${NC}"
log "Output: ${OUTPUT}"
log ""

# Header
{
  echo "============================================"
  echo "Error/Critical Log Aggregation"
  echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "Period: last ${SINCE}"
  echo "============================================"
  echo ""
} > "$OUTPUT"

total_errors=0
total_criticals=0
total_warnings=0

# Iterate all matching containers
while IFS= read -r container; do
  [[ -z "$container" ]] && continue

  error_count=0
  critical_count=0
  warning_count=0

  {
    echo "--- Container: ${container} ---"
    echo ""
  } >> "$OUTPUT"

  # Collect ERROR lines
  errors=$(docker logs --since "$SINCE" "$container" 2>&1 | grep -iE "error|exception|fail" || true)
  if [[ -n "$errors" ]]; then
    error_count=$(echo "$errors" | wc -l)
    echo "$errors" >> "$OUTPUT"
  fi

  # Collect CRITICAL lines
  criticals=$(docker logs --since "$SINCE" "$container" 2>&1 | grep -iE "critical|fatal|panic" || true)
  if [[ -n "$criticals" ]]; then
    critical_count=$(echo "$criticals" | wc -l)
    echo "$criticals" >> "$OUTPUT"
  fi

  # Collect WARNING lines (separate section)
  warnings=$(docker logs --since "$SINCE" "$container" 2>&1 | grep -iE "warn" | grep -viE "error|critical|fatal" || true)
  if [[ -n "$warnings" ]]; then
    warning_count=$(echo "$warnings" | wc -l)
  fi

  echo "" >> "$OUTPUT"

  total_errors=$((total_errors + error_count))
  total_criticals=$((total_criticals + critical_count))
  total_warnings=$((total_warnings + warning_count))

  # Print per-container summary
  if [[ $critical_count -gt 0 ]]; then
    log "${RED}  ${container}: ${critical_count} CRITICAL, ${error_count} ERROR, ${warning_count} WARN${NC}"
  elif [[ $error_count -gt 0 ]]; then
    log "${YELLOW}  ${container}: ${error_count} ERROR, ${warning_count} WARN${NC}"
  else
    log "${GREEN}  ${container}: clean (${warning_count} WARN)${NC}"
  fi

done < <(docker ps --format '{{.Names}}' | grep -i "$CONTAINERS" 2>/dev/null)

# Summary
{
  echo ""
  echo "============================================"
  echo "SUMMARY"
  echo "  Critical: ${total_criticals}"
  echo "  Errors:   ${total_errors}"
  echo "  Warnings: ${total_warnings}"
  echo "============================================"
} >> "$OUTPUT"

log ""
log "${CYAN}=== Summary ===${NC}"
if [[ $total_criticals -gt 0 ]]; then
  log "${RED}CRITICAL: ${total_criticals} critical issues found!${NC}"
fi
if [[ $total_errors -gt 0 ]]; then
  log "${YELLOW}ERRORS: ${total_errors} error(s) found.${NC}"
else
  log "${GREEN}No errors found in the last ${SINCE}.${NC}"
fi
log "Full output: ${OUTPUT}"

