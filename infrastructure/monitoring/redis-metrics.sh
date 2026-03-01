#!/bin/bash
# redis-metrics.sh
# Extract Redis metrics for performance monitoring during load tests
# Collects: memory, connections, ops/sec, pub/sub, evictions, keyspace stats
#
# Usage:
#   ./redis-metrics.sh [--host HOST] [--port PORT] [--output DIR] [--container NAME]
#
# Example:
#   ./redis-metrics.sh --container live-commerce-redis --output results/
#   ./redis-metrics.sh --host localhost --port 6379 --output results/

set -euo pipefail

REDIS_HOST="localhost"
REDIS_PORT="6379"
CONTAINER_NAME="live-commerce-redis"
OUTPUT_DIR="$(pwd)/monitoring"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
USE_DOCKER=true

while [[ $# -gt 0 ]]; do
  case $1 in
    --host)      REDIS_HOST="$2"; USE_DOCKER=false; shift 2 ;;
    --port)      REDIS_PORT="$2"; shift 2 ;;
    --container) CONTAINER_NAME="$2"; shift 2 ;;
    --output)    OUTPUT_DIR="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

OUTPUT_FILE="${OUTPUT_DIR}/redis-metrics-${TIMESTAMP}.json"
mkdir -p "$OUTPUT_DIR"

log() { echo "[redis-metrics] $(date '+%H:%M:%S') $*" >&2; }

# ============================================================================
# Execute redis-cli command (via Docker or direct)
# ============================================================================
redis_cmd() {
  if [[ "$USE_DOCKER" == "true" ]]; then
    docker exec "$CONTAINER_NAME" redis-cli "$@" 2>/dev/null
  else
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" "$@" 2>/dev/null
  fi
}

# ============================================================================
# Collect Redis INFO sections
# ============================================================================
collect_redis_info() {
  local info
  info=$(redis_cmd INFO ALL 2>/dev/null || echo "")

  if [[ -z "$info" ]]; then
    echo '{"error":"cannot_connect","message":"Cannot connect to Redis"}'
    return
  fi

  # Parse key fields from INFO output
  local used_memory used_memory_human used_memory_rss used_memory_peak
  local mem_fragmentation_ratio maxmemory maxmemory_human maxmemory_policy
  local connected_clients blocked_clients
  local total_connections_received total_commands_processed
  local instantaneous_ops_per_sec instantaneous_input_kbps instantaneous_output_kbps
  local keyspace_hits keyspace_misses
  local pubsub_channels pubsub_patterns
  local evicted_keys expired_keys
  local used_cpu_sys used_cpu_user
  local uptime_in_seconds
  local db0_keys

  used_memory=$(echo "$info" | grep "^used_memory:" | cut -d: -f2 | tr -d '\r')
  used_memory_human=$(echo "$info" | grep "^used_memory_human:" | cut -d: -f2 | tr -d '\r')
  used_memory_rss=$(echo "$info" | grep "^used_memory_rss:" | cut -d: -f2 | tr -d '\r')
  used_memory_peak=$(echo "$info" | grep "^used_memory_peak:" | cut -d: -f2 | tr -d '\r')
  mem_fragmentation_ratio=$(echo "$info" | grep "^mem_fragmentation_ratio:" | cut -d: -f2 | tr -d '\r')
  maxmemory=$(echo "$info" | grep "^maxmemory:" | cut -d: -f2 | tr -d '\r')
  maxmemory_human=$(echo "$info" | grep "^maxmemory_human:" | cut -d: -f2 | tr -d '\r')
  maxmemory_policy=$(echo "$info" | grep "^maxmemory_policy:" | cut -d: -f2 | tr -d '\r')
  connected_clients=$(echo "$info" | grep "^connected_clients:" | cut -d: -f2 | tr -d '\r')
  blocked_clients=$(echo "$info" | grep "^blocked_clients:" | cut -d: -f2 | tr -d '\r')
  total_connections_received=$(echo "$info" | grep "^total_connections_received:" | cut -d: -f2 | tr -d '\r')
  total_commands_processed=$(echo "$info" | grep "^total_commands_processed:" | cut -d: -f2 | tr -d '\r')
  instantaneous_ops_per_sec=$(echo "$info" | grep "^instantaneous_ops_per_sec:" | cut -d: -f2 | tr -d '\r')
  instantaneous_input_kbps=$(echo "$info" | grep "^instantaneous_input_kbps:" | cut -d: -f2 | tr -d '\r')
  instantaneous_output_kbps=$(echo "$info" | grep "^instantaneous_output_kbps:" | cut -d: -f2 | tr -d '\r')
  keyspace_hits=$(echo "$info" | grep "^keyspace_hits:" | cut -d: -f2 | tr -d '\r')
  keyspace_misses=$(echo "$info" | grep "^keyspace_misses:" | cut -d: -f2 | tr -d '\r')
  pubsub_channels=$(echo "$info" | grep "^pubsub_channels:" | cut -d: -f2 | tr -d '\r')
  pubsub_patterns=$(echo "$info" | grep "^pubsub_patterns:" | cut -d: -f2 | tr -d '\r')
  evicted_keys=$(echo "$info" | grep "^evicted_keys:" | cut -d: -f2 | tr -d '\r')
  expired_keys=$(echo "$info" | grep "^expired_keys:" | cut -d: -f2 | tr -d '\r')
  used_cpu_sys=$(echo "$info" | grep "^used_cpu_sys:" | cut -d: -f2 | tr -d '\r')
  used_cpu_user=$(echo "$info" | grep "^used_cpu_user:" | cut -d: -f2 | tr -d '\r')
  uptime_in_seconds=$(echo "$info" | grep "^uptime_in_seconds:" | cut -d: -f2 | tr -d '\r')

  # Keyspace: db0 keys count
  db0_keys=$(echo "$info" | grep "^db0:" | grep -o "keys=[0-9]*" | cut -d= -f2 || echo "0")

  # Calculate hit rate
  local total_keyspace_ops hit_rate_pct
  total_keyspace_ops=$(( ${keyspace_hits:-0} + ${keyspace_misses:-0} ))
  if [[ $total_keyspace_ops -gt 0 ]]; then
    hit_rate_pct=$(echo "scale=2; ${keyspace_hits:-0} * 100 / $total_keyspace_ops" | bc 2>/dev/null || echo "0")
  else
    hit_rate_pct="100.00"
  fi

  # Calculate memory usage percentage
  local mem_usage_pct
  if [[ -n "$maxmemory" && "$maxmemory" != "0" ]]; then
    mem_usage_pct=$(echo "scale=2; ${used_memory:-0} * 100 / $maxmemory" | bc 2>/dev/null || echo "0")
  else
    mem_usage_pct="0"
  fi

  # Get Dorami-specific key counts
  local chat_keys stream_keys socket_keys
  chat_keys=$(redis_cmd KEYS 'chat:*' 2>/dev/null | wc -l || echo "0")
  stream_keys=$(redis_cmd KEYS 'stream:*' 2>/dev/null | wc -l || echo "0")
  socket_keys=$(redis_cmd KEYS 'socket.io*' 2>/dev/null | wc -l || echo "0")

  cat << EOF
{
  "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "source": "${USE_DOCKER:+docker:}${CONTAINER_NAME}",
  "uptime_seconds": ${uptime_in_seconds:-0},
  "memory": {
    "used_bytes": ${used_memory:-0},
    "used_human": "${used_memory_human:-0B}",
    "rss_bytes": ${used_memory_rss:-0},
    "peak_bytes": ${used_memory_peak:-0},
    "maxmemory_bytes": ${maxmemory:-0},
    "maxmemory_human": "${maxmemory_human:-0B}",
    "maxmemory_policy": "${maxmemory_policy:-noeviction}",
    "usage_pct": ${mem_usage_pct},
    "fragmentation_ratio": ${mem_fragmentation_ratio:-0}
  },
  "clients": {
    "connected": ${connected_clients:-0},
    "blocked": ${blocked_clients:-0},
    "total_received": ${total_connections_received:-0}
  },
  "throughput": {
    "ops_per_sec": ${instantaneous_ops_per_sec:-0},
    "total_commands": ${total_commands_processed:-0},
    "input_kbps": ${instantaneous_input_kbps:-0},
    "output_kbps": ${instantaneous_output_kbps:-0}
  },
  "keyspace": {
    "hits": ${keyspace_hits:-0},
    "misses": ${keyspace_misses:-0},
    "hit_rate_pct": ${hit_rate_pct},
    "db0_keys": ${db0_keys:-0}
  },
  "pubsub": {
    "channels": ${pubsub_channels:-0},
    "patterns": ${pubsub_patterns:-0}
  },
  "eviction": {
    "evicted_keys": ${evicted_keys:-0},
    "expired_keys": ${expired_keys:-0}
  },
  "cpu": {
    "sys": ${used_cpu_sys:-0},
    "user": ${used_cpu_user:-0}
  },
  "dorami_keys": {
    "chat_keys": ${chat_keys:-0},
    "stream_keys": ${stream_keys:-0},
    "socketio_keys": ${socket_keys:-0}
  },
  "alerts": {
    "memory_over_80pct": $(echo "${mem_usage_pct} > 80" | bc -l 2>/dev/null || echo 0),
    "evictions_detected": $([ "${evicted_keys:-0}" -gt 0 ] && echo "true" || echo "false"),
    "fragmentation_high": $(echo "${mem_fragmentation_ratio:-1} > 1.5" | bc -l 2>/dev/null || echo 0),
    "hit_rate_low": $(echo "${hit_rate_pct} < 90" | bc -l 2>/dev/null || echo 0)
  }
}
EOF
}

# ============================================================================
# Main
# ============================================================================
log "Collecting Redis metrics from ${USE_DOCKER:+container }${CONTAINER_NAME}..."
RESULT=$(collect_redis_info)

echo "$RESULT" > "$OUTPUT_FILE"
log "Redis metrics saved to: $OUTPUT_FILE"

# Print summary
python3 - << PYEOF 2>/dev/null || echo "$RESULT"
import json

with open("$OUTPUT_FILE") as f:
    data = json.load(f)

mem = data.get("memory", {})
clients = data.get("clients", {})
tp = data.get("throughput", {})
ks = data.get("keyspace", {})
ev = data.get("eviction", {})
dorami = data.get("dorami_keys", {})
alerts = data.get("alerts", {})

print()
print("=== REDIS METRICS SUMMARY ===")
print(f"Uptime              : {data.get('uptime_seconds', 0):,}s")
print()
print("Memory:")
print(f"  Used               : {mem.get('used_human', '0B')}")
print(f"  Max                : {mem.get('maxmemory_human', '0B')}")
print(f"  Usage              : {mem.get('usage_pct', 0)}%")
print(f"  Fragmentation      : {mem.get('fragmentation_ratio', 0)}")
print(f"  Policy             : {mem.get('maxmemory_policy', 'n/a')}")
print()
print("Throughput:")
print(f"  Ops/sec            : {tp.get('ops_per_sec', 0):,}")
print(f"  Connected clients  : {clients.get('connected', 0):,}")
print()
print("Keyspace:")
print(f"  Hit rate           : {ks.get('hit_rate_pct', 0)}%")
print(f"  DB0 keys           : {ks.get('db0_keys', 0):,}")
print()
print("Eviction:")
print(f"  Evicted keys       : {ev.get('evicted_keys', 0):,}")
print(f"  Expired keys       : {ev.get('expired_keys', 0):,}")
print()
print("Dorami Keys:")
print(f"  Chat               : {dorami.get('chat_keys', 0):,}")
print(f"  Stream             : {dorami.get('stream_keys', 0):,}")
print(f"  Socket.IO          : {dorami.get('socketio_keys', 0):,}")
print()

alert_flags = []
if alerts.get("memory_over_80pct"): alert_flags.append("MEMORY >80%")
if alerts.get("evictions_detected"): alert_flags.append("EVICTIONS DETECTED")
if alerts.get("fragmentation_high"): alert_flags.append("HIGH FRAGMENTATION")
if alerts.get("hit_rate_low"): alert_flags.append("LOW HIT RATE")
if alert_flags:
    print(f"ALERTS: {', '.join(alert_flags)}")
else:
    print("ALERTS: None")
print()
print(f"Output: $OUTPUT_FILE")
PYEOF
