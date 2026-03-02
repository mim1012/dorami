#!/bin/bash
# backend-metrics.sh
# Extract Socket.IO and general backend metrics from NestJS backend logs
# Counts: concurrent connections, message throughput, connection error rate
#
# Usage:
#   ./backend-metrics.sh [--container NAME] [--output DIR] [--since DURATION]
#
# Example:
#   ./backend-metrics.sh --container dorami-backend --output results/ --since 1h

set -euo pipefail

CONTAINER_NAME="dorami-backend"
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

OUTPUT_FILE="${OUTPUT_DIR}/backend-metrics-${TIMESTAMP}.json"
mkdir -p "$OUTPUT_DIR"

log() { echo "[backend-metrics] $(date '+%H:%M:%S') $*" >&2; }

# ============================================================================
# Fetch backend logs
# ============================================================================
fetch_backend_logs() {
  docker logs --since "$SINCE" "$CONTAINER_NAME" 2>&1 || {
    log "Warning: Cannot read backend container '$CONTAINER_NAME'."
    echo ""
  }
}

# ============================================================================
# Live metrics via health endpoint
# ============================================================================
fetch_live_metrics() {
  local backend_url="${BACKEND_URL:-http://localhost:3001}"

  # Health check
  local health_json
  health_json=$(curl -s --max-time 5 "${backend_url}/api/health/ready" 2>/dev/null || echo '{}')

  echo "$health_json"
}

# ============================================================================
# Parse NestJS + Socket.IO log patterns
#
# Key patterns:
#   Socket.IO connection:    "client connected" / "new connection" / "socket connected"
#   Socket.IO disconnect:    "client disconnected" / "socket disconnected"
#   Socket.IO message:       "chat:message" / "emit" / "broadcast"
#   Socket.IO error:         "connection error" / "socket error" / "transport error"
#   NestJS request:          "[NestJS] GET /api/..." or "200 GET /api/..."
#   NestJS error:            "ERROR" / "[error]" / "Exception"
#   WebSocket namespace:     "/chat" / "/streaming" namespace events
# ============================================================================
analyze_backend_logs() {
  local logs="$1"

  if [[ -z "$logs" ]]; then
    cat << 'EOF'
{
  "error": "no_log_data",
  "message": "No backend log data available"
}
EOF
    return
  fi

  local tmpfile
  tmpfile=$(mktemp /tmp/backend-XXXXXX.log)
  echo "$logs" > "$tmpfile"
  local total_lines
  total_lines=$(wc -l < "$tmpfile")

  # ---- Socket.IO connection events ----
  local sio_connects sio_disconnects sio_errors
  sio_connects=$(grep -ci "client connected\|socket.*connect\|new.*connection\|\[socket\].*connect" "$tmpfile" 2>/dev/null || echo 0)
  sio_disconnects=$(grep -ci "client disconnected\|socket.*disconnect\|connection.*closed\|\[socket\].*disconnect" "$tmpfile" 2>/dev/null || echo 0)
  sio_errors=$(grep -ci "connection error\|socket.*error\|transport.*error\|socket.*fail\|\[socket\].*error" "$tmpfile" 2>/dev/null || echo 0)

  # ---- Socket.IO namespaces ----
  local ns_general ns_chat ns_streaming
  ns_general=$(grep -ci "namespace.*\"/\"\|join.*room\|room.*join" "$tmpfile" 2>/dev/null || echo 0)
  ns_chat=$(grep -ci "namespace.*/chat\|/chat.*connect\|chat.*namespace\|chat:message" "$tmpfile" 2>/dev/null || echo 0)
  ns_streaming=$(grep -ci "namespace.*/streaming\|/streaming.*connect\|streaming.*namespace\|viewer.*count" "$tmpfile" 2>/dev/null || echo 0)

  # ---- Message throughput ----
  local msg_sent msg_received msg_broadcast
  msg_sent=$(grep -ci "emit\|message.*sent\|send.*message\|chat:message" "$tmpfile" 2>/dev/null || echo 0)
  msg_received=$(grep -ci "on.*message\|message.*received\|recv.*message" "$tmpfile" 2>/dev/null || echo 0)
  msg_broadcast=$(grep -ci "broadcast\|broadcast.*room\|to.*emit" "$tmpfile" 2>/dev/null || echo 0)

  # ---- HTTP request stats ----
  local http_total http_errors http_2xx http_4xx http_5xx
  http_total=$(grep -cE "(GET|POST|PUT|DELETE|PATCH) /api" "$tmpfile" 2>/dev/null || echo 0)
  http_2xx=$(grep -cE "20[0-9] (GET|POST|PUT|DELETE|PATCH)" "$tmpfile" 2>/dev/null || echo 0)
  http_4xx=$(grep -cE "4[0-9]{2} (GET|POST|PUT|DELETE|PATCH)" "$tmpfile" 2>/dev/null || echo 0)
  http_5xx=$(grep -cE "5[0-9]{2} (GET|POST|PUT|DELETE|PATCH)" "$tmpfile" 2>/dev/null || echo 0)

  # ---- NestJS errors/exceptions ----
  local nestjs_errors nestjs_warnings
  nestjs_errors=$(grep -ci "\[ERROR\]\|ERROR\b\|Exception\|BusinessException\|InternalServerError" "$tmpfile" 2>/dev/null || echo 0)
  nestjs_warnings=$(grep -ci "\[WARN\]\|WARN\b\|Warning\|Deprecat" "$tmpfile" 2>/dev/null || echo 0)

  # ---- Auth events ----
  local auth_logins auth_failures auth_token_refresh
  auth_logins=$(grep -ci "login\|authenticated\|kakao.*callback\|dev-login" "$tmpfile" 2>/dev/null || echo 0)
  auth_failures=$(grep -ci "unauthorized\|authentication.*fail\|invalid.*token\|jwt.*error" "$tmpfile" 2>/dev/null || echo 0)
  auth_token_refresh=$(grep -ci "token.*refresh\|refresh.*token" "$tmpfile" 2>/dev/null || echo 0)

  # ---- Database events ----
  local db_errors db_slow
  db_errors=$(grep -ci "PrismaClientKnownRequestError\|database.*error\|db.*error\|query.*fail" "$tmpfile" 2>/dev/null || echo 0)
  db_slow=$(grep -ci "slow.*query\|query.*slow\|execution.*time" "$tmpfile" 2>/dev/null || echo 0)

  # ---- Calculate connection error rate ----
  local total_conn_attempts error_rate_pct
  total_conn_attempts=$((sio_connects + sio_disconnects))
  if [[ $total_conn_attempts -gt 0 ]]; then
    error_rate_pct=$(echo "scale=2; $sio_errors * 100 / $total_conn_attempts" | bc 2>/dev/null || echo "0")
  else
    error_rate_pct=0
  fi

  # ---- Timeline: events per minute ----
  local timeline_json
  timeline_json=$(awk '
  {
    # Match ISO timestamp: YYYY-MM-DDTHH:MM or NestJS: [YYYY-MM-DD HH:MM
    if (match($0, /[0-9]{4}-[0-9]{2}-[0-9]{2}[ T]([0-9]{2}:[0-9]{2})/, arr)) {
      minute = arr[1]
      total[minute]++
      if (tolower($0) ~ /connect/) connects[minute]++
      if (tolower($0) ~ /disconnect/) disconnects[minute]++
      if (tolower($0) ~ /error|exception/) errors[minute]++
      if (tolower($0) ~ /chat:message|emit/) msgs[minute]++
    }
  }
  END {
    first = 1
    printf "["
    for (m in total) {
      if (!first) printf ","
      first = 0
      printf "{\"minute\":\"%s\",\"total\":%d,\"connects\":%d,\"disconnects\":%d,\"errors\":%d,\"messages\":%d}",
        m, total[m], connects[m]+0, disconnects[m]+0, errors[m]+0, msgs[m]+0
    }
    printf "]"
  }
  ' "$tmpfile")

  # ---- Top error messages ----
  local top_errors
  top_errors=$(grep -i "error\|exception\|fail" "$tmpfile" 2>/dev/null | \
    sed 's/^.*\(ERROR\|Exception\|error\)/\1/' | \
    sort | uniq -c | sort -rn | head -10 | \
    awk '{count=$1; $1=""; msg=substr($0,2); gsub(/"/, "\\\"", msg); printf "{\"count\":%d,\"message\":\"%s\"},", count, msg}' | \
    sed 's/,$//' || echo "")
  [[ -z "$top_errors" ]] && top_errors=""

  rm -f "$tmpfile"

  cat << EOF
{
  "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "container": "${CONTAINER_NAME}",
  "since": "${SINCE}",
  "log_lines_analyzed": ${total_lines},
  "socketio": {
    "connects": ${sio_connects},
    "disconnects": ${sio_disconnects},
    "errors": ${sio_errors},
    "connection_error_rate_pct": ${error_rate_pct},
    "namespaces": {
      "general": ${ns_general},
      "chat": ${ns_chat},
      "streaming": ${ns_streaming}
    },
    "messages": {
      "emitted": ${msg_sent},
      "received": ${msg_received},
      "broadcast": ${msg_broadcast}
    }
  },
  "http": {
    "total_requests": ${http_total},
    "2xx": ${http_2xx},
    "4xx": ${http_4xx},
    "5xx": ${http_5xx}
  },
  "auth": {
    "logins": ${auth_logins},
    "failures": ${auth_failures},
    "token_refreshes": ${auth_token_refresh}
  },
  "database": {
    "errors": ${db_errors},
    "slow_queries": ${db_slow}
  },
  "application": {
    "errors": ${nestjs_errors},
    "warnings": ${nestjs_warnings}
  },
  "top_errors": [${top_errors}],
  "timeline": ${timeline_json}
}
EOF
}

# ============================================================================
# Main
# ============================================================================
log "Fetching backend logs from container '${CONTAINER_NAME}' (since ${SINCE})..."
BACKEND_LOGS=$(fetch_backend_logs)

log "Analyzing $(echo "$BACKEND_LOGS" | wc -l) log lines..."
RESULT=$(analyze_backend_logs "$BACKEND_LOGS")

# Also try to get live health data
log "Fetching live health endpoint..."
LIVE_HEALTH=$(fetch_live_metrics)

# Merge live health into result
FINAL=$(python3 - << PYEOF
import json, sys

result = json.loads('''${RESULT}''')
try:
    live = json.loads('''${LIVE_HEALTH}''')
    result["live_health"] = live
except:
    result["live_health"] = None

print(json.dumps(result, indent=2))
PYEOF
)

echo "$FINAL" > "$OUTPUT_FILE"
log "Backend metrics saved to: $OUTPUT_FILE"

# Print summary
python3 - << PYEOF
import json

with open("$OUTPUT_FILE") as f:
    data = json.load(f)

sio = data.get("socketio", {})
http = data.get("http", {})
auth = data.get("auth", {})
app = data.get("application", {})

print()
print("=== BACKEND METRICS SUMMARY ===")
print(f"Log lines analyzed  : {data.get('log_lines_analyzed', 0):,}")
print()
print("Socket.IO:")
print(f"  Connects           : {sio.get('connects', 0):,}")
print(f"  Disconnects        : {sio.get('disconnects', 0):,}")
print(f"  Errors             : {sio.get('errors', 0):,}")
print(f"  Error rate         : {sio.get('connection_error_rate_pct', 0)}%")
msgs = sio.get("messages", {})
print(f"  Messages emitted   : {msgs.get('emitted', 0):,}")
print()
print("HTTP:")
print(f"  Total requests     : {http.get('total_requests', 0):,}")
print(f"  5xx errors         : {http.get('5xx', 0):,}")
print()
print("Auth:")
print(f"  Logins             : {auth.get('logins', 0):,}")
print(f"  Auth failures      : {auth.get('failures', 0):,}")
print()
print(f"App errors           : {app.get('errors', 0):,}")
print()
print(f"Output: $OUTPUT_FILE")
PYEOF
