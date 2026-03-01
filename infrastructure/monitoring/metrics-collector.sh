#!/bin/bash
# metrics-collector.sh
# Continuous metrics collection during load tests
# Collects Docker stats, system metrics, and exports as JSON with 1-second granularity
#
# Usage:
#   ./metrics-collector.sh [--duration SECONDS] [--output DIR] [--interval SECONDS]
#
# Example:
#   ./metrics-collector.sh --duration 3600 --output results/ --interval 1

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================
DURATION=3600
OUTPUT_DIR="$(pwd)/monitoring"
INTERVAL=1
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTPUT_FILE=""
COMPOSE_FILES="-f docker-compose.yml"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --duration) DURATION="$2"; shift 2 ;;
    --output)   OUTPUT_DIR="$2"; shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    --compose)  COMPOSE_FILES="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

OUTPUT_FILE="${OUTPUT_DIR}/metrics-${TIMESTAMP}.json"
mkdir -p "$OUTPUT_DIR"

# ============================================================================
# Utility functions
# ============================================================================
log() { echo "[metrics-collector] $(date '+%H:%M:%S') $*" >&2; }

# Parse docker stats output into JSON fields
# Input line: "name cpu% mem_usage/limit mem% net_in/net_out block_in/block_out pids"
parse_docker_stats() {
  local line="$1"
  # Docker stats --no-stream --format outputs tab-separated fields
  local name cpu mem_usage mem_limit mem_pct net_in net_out block_in block_out pids
  read -r name cpu mem_usage mem_limit mem_pct net_in net_out block_in block_out pids <<< "$line"

  # Strip % from cpu/mem_pct
  cpu="${cpu//%/}"
  mem_pct="${mem_pct//%/}"

  printf '{"name":"%s","cpu_pct":%s,"mem_usage":"%s","mem_limit":"%s","mem_pct":%s,"net_in":"%s","net_out":"%s","block_in":"%s","block_out":"%s","pids":%s}' \
    "$name" "${cpu:-0}" "${mem_usage:-0}" "${mem_limit:-0}" "${mem_pct:-0}" \
    "${net_in:-0}" "${net_out:-0}" "${block_in:-0}" "${block_out:-0}" "${pids:-0}"
}

# Collect system-level metrics
collect_system_metrics() {
  local uptime_info cpu_idle mem_total mem_free mem_used mem_pct load1 load5 load15

  # Load average
  read -r load1 load5 load15 _ < /proc/loadavg 2>/dev/null || { load1=0; load5=0; load15=0; }

  # Memory from /proc/meminfo
  if [[ -f /proc/meminfo ]]; then
    mem_total=$(grep '^MemTotal:' /proc/meminfo | awk '{print $2}')
    mem_free=$(grep '^MemAvailable:' /proc/meminfo | awk '{print $2}')
    mem_used=$((mem_total - mem_free))
    mem_pct=$(echo "scale=1; $mem_used * 100 / $mem_total" | bc 2>/dev/null || echo "0")
  else
    mem_total=0; mem_free=0; mem_used=0; mem_pct=0
  fi

  # CPU idle from vmstat (1-sample)
  cpu_idle=$(vmstat 1 2 2>/dev/null | tail -1 | awk '{print $15}' || echo "0")
  local cpu_used=$((100 - cpu_idle))

  printf '{"cpu_used_pct":%s,"load1":%s,"load5":%s,"load15":%s,"mem_total_kb":%s,"mem_used_kb":%s,"mem_free_kb":%s,"mem_used_pct":%s}' \
    "${cpu_used:-0}" "${load1:-0}" "${load5:-0}" "${load15:-0}" \
    "${mem_total:-0}" "${mem_used:-0}" "${mem_free:-0}" "${mem_pct:-0}"
}

# Collect Docker stats for all containers
collect_docker_metrics() {
  local containers_json="["
  local first=true

  while IFS=$'\t' read -r name cpu mem_usage mem_limit mem_pct net_in net_out block_in block_out pids; do
    [[ "$name" == "NAME" ]] && continue  # skip header
    [[ -z "$name" ]] && continue

    cpu="${cpu//%/}"
    mem_pct="${mem_pct//%/}"

    if [[ "$first" == "false" ]]; then
      containers_json+=","
    fi
    containers_json+="{\"name\":\"${name}\",\"cpu_pct\":${cpu:-0},\"mem_usage\":\"${mem_usage:-0}\",\"mem_limit\":\"${mem_limit:-0}\",\"mem_pct\":${mem_pct:-0},\"net_in\":\"${net_in:-0}\",\"net_out\":\"${net_out:-0}\",\"block_in\":\"${block_in:-0}\",\"block_out\":\"${block_out:-0}\",\"pids\":${pids:-0}}"
    first=false
  done < <(docker stats --no-stream --format $'{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}\t{{.PIDs}}' 2>/dev/null | \
    awk -F'\t' '{split($4,a,"/"); print $1"\t"$2"\t"a[1]"\t"a[2]"\t"$3"\t"split($5,b,"/")?b[1]:0"\t"split($5,c,"/")?c[2]:0"\t"split($6,d,"/")?d[1]:0"\t"split($6,e,"/")?e[2]:0"\t"$7}' 2>/dev/null || true)

  containers_json+="]"
  echo "$containers_json"
}

# ============================================================================
# Main collection loop — writes NDJSON (one JSON object per line)
# ============================================================================
log "Starting metrics collection"
log "  Duration: ${DURATION}s"
log "  Interval: ${INTERVAL}s"
log "  Output:   $OUTPUT_FILE"

# Write JSON array opener
echo "[" > "$OUTPUT_FILE"
FIRST_RECORD=true

cleanup() {
  # Close JSON array
  echo "" >> "$OUTPUT_FILE"
  echo "]" >> "$OUTPUT_FILE"
  log "Metrics saved to: $OUTPUT_FILE"
}
trap cleanup EXIT INT TERM

start_time=$(date +%s)
elapsed=0

while [[ $elapsed -lt $DURATION ]]; do
  ts=$(date +%s)
  iso_ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  elapsed=$((ts - start_time))

  # Collect all metrics
  system_json=$(collect_system_metrics)
  docker_json=$(collect_docker_metrics)

  # Build record
  record="{\"timestamp\":\"${iso_ts}\",\"elapsed_sec\":${elapsed},\"system\":${system_json},\"containers\":${docker_json}}"

  # Append to file
  if [[ "$FIRST_RECORD" == "false" ]]; then
    echo "," >> "$OUTPUT_FILE"
  fi
  echo -n "$record" >> "$OUTPUT_FILE"
  FIRST_RECORD=false

  # Print live summary to stderr
  log "t+${elapsed}s | System: ${system_json} | Containers collected"

  sleep "$INTERVAL"
done

log "Collection complete after ${elapsed}s"
