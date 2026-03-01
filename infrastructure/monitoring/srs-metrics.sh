#!/bin/bash
# srs-metrics.sh
# Extract SRS (Simple Realtime Server) metrics from container logs
# Counts frame drops, publisher timeouts, client disconnects, bandwidth
#
# Usage:
#   ./srs-metrics.sh [--container NAME] [--output DIR] [--since DURATION]
#
# Example:
#   ./srs-metrics.sh --container dorami-srs --output results/ --since 1h

set -euo pipefail

CONTAINER_NAME="dorami-srs"
OUTPUT_DIR="$(pwd)/monitoring"
SINCE="1h"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

while [[ $# -gt 0 ]]; do
  case $1 in
    --container) CONTAINER_NAME="$2"; shift 2 ;;
    --output)    OUTPUT_DIR="$2"; shift 2 ;;
    --since)     SINCE="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

OUTPUT_FILE="${OUTPUT_DIR}/srs-metrics-${TIMESTAMP}.json"
mkdir -p "$OUTPUT_DIR"

log() { echo "[srs-metrics] $(date '+%H:%M:%S') $*" >&2; }

# ============================================================================
# Fetch SRS logs
# ============================================================================
fetch_srs_logs() {
  docker logs --since "$SINCE" "$CONTAINER_NAME" 2>&1 || {
    log "Warning: Cannot read SRS container '$CONTAINER_NAME'. Using empty dataset."
    echo ""
  }
}

# ============================================================================
# Parse SRS log patterns
# SRS log format: [YYYY-MM-DD HH:MM:SS.mmm][LEVEL][pid][tid] message
#
# Key SRS log patterns:
#   - "drop" / "frame drop"       -> frame drops
#   - "publisher timeout"          -> publisher timeouts
#   - "client disconnect"          -> client disconnects
#   - "client leaving"             -> normal client leaves
#   - "kbps"                       -> bandwidth stats
#   - "clients=N"                  -> concurrent clients
#   - "send_and_recv_timeout"      -> network timeouts
#   - "RtmpPublishStream"          -> publisher events
#   - "RtmpPlayStream"             -> player events
# ============================================================================
analyze_srs_logs() {
  local logs="$1"

  if [[ -z "$logs" ]]; then
    cat << 'EOF'
{
  "error": "no_log_data",
  "message": "No SRS log data available — container may not be running or name is wrong"
}
EOF
    return
  fi

  # Write to temp for multi-pass
  local tmpfile
  tmpfile=$(mktemp /tmp/srs-XXXXXX.log)
  echo "$logs" > "$tmpfile"
  local total_lines
  total_lines=$(wc -l < "$tmpfile")

  # ---- Frame drops ----
  local frame_drops
  frame_drops=$(grep -ci "drop\|frame_drop\|dropped" "$tmpfile" 2>/dev/null || echo 0)

  # ---- Publisher timeouts ----
  local pub_timeouts
  pub_timeouts=$(grep -ci "publisher.*timeout\|timeout.*publisher\|publish.*timeout\|RtmpPublish.*timeout\|send_and_recv_timeout" "$tmpfile" 2>/dev/null || echo 0)

  # ---- Client disconnects (unexpected) ----
  local client_disconnects
  client_disconnects=$(grep -ci "client.*disconnect\|disconnect.*client\|connection.*closed\|EOF\|broken pipe" "$tmpfile" 2>/dev/null || echo 0)

  # ---- Client leaving (normal) ----
  local client_leaving
  client_leaving=$(grep -ci "client.*leav\|leav.*client\|client.*stop\|stop.*client" "$tmpfile" 2>/dev/null || echo 0)

  # ---- Publisher connect/disconnect events ----
  local pub_connects pub_disconnects
  pub_connects=$(grep -ci "RtmpPublish\|publish.*connect\|client.*publish" "$tmpfile" 2>/dev/null || echo 0)
  pub_disconnects=$(grep -ci "unpublish\|publish.*done\|publish.*close" "$tmpfile" 2>/dev/null || echo 0)

  # ---- Player events ----
  local player_connects player_disconnects
  player_connects=$(grep -ci "RtmpPlay\|client.*play\|play.*connect" "$tmpfile" 2>/dev/null || echo 0)
  player_disconnects=$(grep -ci "play.*close\|play.*done\|play.*stop" "$tmpfile" 2>/dev/null || echo 0)

  # ---- Bandwidth stats: extract kbps values ----
  local bw_samples bw_count bw_avg bw_max
  bw_samples=$(grep -o '[0-9]*kbps\|kbps=[0-9]*\|[0-9]* kbps' "$tmpfile" 2>/dev/null | \
    grep -o '[0-9]*' | sort -n || echo "")
  bw_count=$(echo "$bw_samples" | grep -c '[0-9]' || echo 0)
  if [[ $bw_count -gt 0 ]]; then
    bw_avg=$(echo "$bw_samples" | awk '{s+=$1; n++} END {printf "%.0f", (n>0)?s/n:0}')
    bw_max=$(echo "$bw_samples" | tail -1)
  else
    bw_avg=0; bw_max=0
  fi

  # ---- Peak concurrent clients from "clients=N" patterns ----
  local peak_clients
  peak_clients=$(grep -o 'clients=[0-9]*' "$tmpfile" 2>/dev/null | \
    grep -o '[0-9]*$' | sort -n | tail -1 || echo 0)
  [[ -z "$peak_clients" ]] && peak_clients=0

  # ---- Error/Warning counts ----
  local error_count warn_count
  error_count=$(grep -ci "\[error\]\|ERROR\|\[crit\]" "$tmpfile" 2>/dev/null || echo 0)
  warn_count=$(grep -ci "\[warn\]\|WARNING\|\[notice\]" "$tmpfile" 2>/dev/null || echo 0)

  # ---- Timeline: events per minute ----
  local timeline_json
  timeline_json=$(awk '
  {
    # SRS log: [YYYY-MM-DD HH:MM:SS.mmm]
    if (match($0, /\[([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2})/, arr)) {
      minute = arr[1]
      minute_count[minute]++
      if (tolower($0) ~ /drop/) drop_count[minute]++
      if (tolower($0) ~ /error|crit/) err_count[minute]++
      if (tolower($0) ~ /disconnect|timeout/) dc_count[minute]++
    }
  }
  END {
    first = 1
    printf "["
    for (m in minute_count) {
      if (!first) printf ","
      first = 0
      printf "{\"minute\":\"%s\",\"events\":%d,\"drops\":%d,\"errors\":%d,\"disconnects\":%d}",
        m, minute_count[m], drop_count[m]+0, err_count[m]+0, dc_count[m]+0
    }
    printf "]"
  }
  ' "$tmpfile")

  rm -f "$tmpfile"

  cat << EOF
{
  "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "container": "${CONTAINER_NAME}",
  "since": "${SINCE}",
  "log_lines_analyzed": ${total_lines},
  "stream_events": {
    "publisher_connects": ${pub_connects},
    "publisher_disconnects": ${pub_disconnects},
    "player_connects": ${player_connects},
    "player_disconnects": ${player_disconnects}
  },
  "issues": {
    "frame_drops": ${frame_drops},
    "publisher_timeouts": ${pub_timeouts},
    "client_disconnects_unexpected": ${client_disconnects},
    "client_disconnects_normal": ${client_leaving}
  },
  "capacity": {
    "peak_concurrent_clients": ${peak_clients},
    "bandwidth_samples_count": ${bw_count},
    "bandwidth_avg_kbps": ${bw_avg},
    "bandwidth_max_kbps": ${bw_max}
  },
  "log_quality": {
    "error_lines": ${error_count},
    "warning_lines": ${warn_count}
  },
  "timeline": ${timeline_json}
}
EOF
}

# ============================================================================
# Main
# ============================================================================
log "Fetching SRS logs from container '${CONTAINER_NAME}' (since ${SINCE})..."
SRS_LOGS=$(fetch_srs_logs)

log "Analyzing $(echo "$SRS_LOGS" | wc -l) log lines..."
RESULT=$(analyze_srs_logs "$SRS_LOGS")

echo "$RESULT" > "$OUTPUT_FILE"
log "SRS metrics saved to: $OUTPUT_FILE"

# Print summary
python3 - << PYEOF
import json, sys

with open("$OUTPUT_FILE") as f:
    data = json.load(f)

issues = data.get("issues", {})
cap = data.get("capacity", {})
events = data.get("stream_events", {})

print()
print("=== SRS METRICS SUMMARY ===")
print(f"Log lines analyzed  : {data.get('log_lines_analyzed', 0):,}")
print()
print("Stream Events:")
print(f"  Publisher connects   : {events.get('publisher_connects', 0):,}")
print(f"  Player connects      : {events.get('player_connects', 0):,}")
print()
print("Issues:")
print(f"  Frame drops          : {issues.get('frame_drops', 0):,}")
print(f"  Publisher timeouts   : {issues.get('publisher_timeouts', 0):,}")
print(f"  Client disconnects   : {issues.get('client_disconnects_unexpected', 0):,}")
print()
print("Capacity:")
print(f"  Peak concurrent      : {cap.get('peak_concurrent_clients', 0):,}")
print(f"  Avg bandwidth        : {cap.get('bandwidth_avg_kbps', 0):,} kbps")
print(f"  Max bandwidth        : {cap.get('bandwidth_max_kbps', 0):,} kbps")
print()
print(f"Output: $OUTPUT_FILE")
PYEOF
