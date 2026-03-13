#!/usr/bin/env bash
# Docker Resource Monitoring Script — Task #22
# Tracks CPU, memory, and network for all doremi containers
# Usage: bash scripts/monitor-resources.sh [--once] [--interval 10]

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

INTERVAL="${INTERVAL:-10}"
ONCE=false
LOG_DIR="$(dirname "$0")/../reports"
LOG_FILE="${LOG_DIR}/resource-monitor.log"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --once) ONCE=true; shift ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

mkdir -p "$LOG_DIR"

log() {
  echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_docker() {
  if ! command -v docker &>/dev/null; then
    log "${RED}Docker not found. Exiting.${NC}"
    exit 1
  fi
  if ! docker info &>/dev/null; then
    log "${RED}Docker daemon not running. Exiting.${NC}"
    exit 1
  fi
}

monitor_once() {
  log "${CYAN}=== Docker Resource Snapshot ===${NC}"

  # Container status
  log "--- Container Status ---"
  docker ps --filter "name=doremi" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | while IFS= read -r line; do
    log "  $line"
  done

  # Resource usage (CPU / MEM / NET)
  log "--- Resource Usage ---"
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" 2>/dev/null | \
    grep -E "doremi|NAME" | while IFS= read -r line; do
    log "  $line"
  done

  # Disk usage for volumes
  log "--- Volume Disk Usage ---"
  docker system df -v 2>/dev/null | grep -E "VOLUME|doremi|postgres" | head -10 | while IFS= read -r line; do
    log "  $line"
  done

  # Warnings
  local mem_warnings=0
  while IFS= read -r line; do
    local pct
    pct=$(echo "$line" | awk '{print $2}' | tr -d '%')
    if [[ -n "$pct" ]] && (( $(echo "$pct > 80" | bc -l 2>/dev/null || echo 0) )); then
      local name
      name=$(echo "$line" | awk '{print $1}')
      log "${YELLOW}WARNING: ${name} memory at ${pct}%${NC}"
      ((mem_warnings++))
    fi
  done < <(docker stats --no-stream --format "{{.Name}} {{.MemPerc}}" 2>/dev/null | grep doremi)

  if [[ $mem_warnings -eq 0 ]]; then
    log "${GREEN}All containers within normal resource limits.${NC}"
  fi
}

# Main
check_docker

if $ONCE; then
  monitor_once
  exit 0
fi

log "Starting resource monitor (interval: ${INTERVAL}s). Press Ctrl+C to stop."
while true; do
  monitor_once
  echo ""
  sleep "$INTERVAL"
done

