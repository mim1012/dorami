#!/bin/bash
# postgres-metrics.sh
# Extract PostgreSQL metrics for performance monitoring during load tests
# Collects: connections, cache hit ratio, transaction rate, deadlocks, slow queries
#
# Usage:
#   ./postgres-metrics.sh [--container NAME] [--output DIR] [--dbname NAME]
#
# Example:
#   ./postgres-metrics.sh --container live-commerce-postgres --output results/
#   ./postgres-metrics.sh --container live-commerce-postgres --dbname live_commerce

set -euo pipefail

CONTAINER_NAME="live-commerce-postgres"
OUTPUT_DIR="$(pwd)/monitoring"
DB_NAME="live_commerce"
DB_USER="postgres"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

while [[ $# -gt 0 ]]; do
  case $1 in
    --container) CONTAINER_NAME="$2"; shift 2 ;;
    --output)    OUTPUT_DIR="$2"; shift 2 ;;
    --dbname)    DB_NAME="$2"; shift 2 ;;
    --user)      DB_USER="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

OUTPUT_FILE="${OUTPUT_DIR}/postgres-metrics-${TIMESTAMP}.json"
mkdir -p "$OUTPUT_DIR"

log() { echo "[postgres-metrics] $(date '+%H:%M:%S') $*" >&2; }

# ============================================================================
# Execute psql command inside Docker container
# ============================================================================
pg_query() {
  docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "$1" 2>/dev/null || echo ""
}

pg_query_csv() {
  docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -F'|' -c "$1" 2>/dev/null || echo ""
}

# ============================================================================
# Collect PostgreSQL metrics
# ============================================================================
collect_pg_metrics() {
  # Test connection
  local version
  version=$(pg_query "SELECT version();" 2>/dev/null || echo "")
  if [[ -z "$version" ]]; then
    echo '{"error":"cannot_connect","message":"Cannot connect to PostgreSQL container"}'
    return
  fi

  # ---- Connection stats ----
  local max_connections active_connections idle_connections waiting_connections
  max_connections=$(pg_query "SHOW max_connections;" || echo "100")
  active_connections=$(pg_query "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" || echo "0")
  idle_connections=$(pg_query "SELECT count(*) FROM pg_stat_activity WHERE state = 'idle';" || echo "0")
  waiting_connections=$(pg_query "SELECT count(*) FROM pg_stat_activity WHERE wait_event IS NOT NULL AND state = 'active';" || echo "0")
  local total_connections
  total_connections=$(pg_query "SELECT count(*) FROM pg_stat_activity;" || echo "0")

  # ---- Connection usage percentage ----
  local conn_usage_pct
  conn_usage_pct=$(echo "scale=1; ${total_connections:-0} * 100 / ${max_connections:-100}" | bc 2>/dev/null || echo "0")

  # ---- Database stats ----
  local xact_commit xact_rollback blks_hit blks_read deadlocks conflicts temp_files temp_bytes
  local db_stats
  db_stats=$(pg_query_csv "SELECT xact_commit, xact_rollback, blks_hit, blks_read, deadlocks, conflicts, temp_files, temp_bytes FROM pg_stat_database WHERE datname = '${DB_NAME}';" || echo "")

  if [[ -n "$db_stats" ]]; then
    IFS='|' read -r xact_commit xact_rollback blks_hit blks_read deadlocks conflicts temp_files temp_bytes <<< "$db_stats"
  else
    xact_commit=0; xact_rollback=0; blks_hit=0; blks_read=0; deadlocks=0; conflicts=0; temp_files=0; temp_bytes=0
  fi

  # ---- Cache hit ratio ----
  local cache_hit_ratio
  local total_blocks=$(( ${blks_hit:-0} + ${blks_read:-0} ))
  if [[ $total_blocks -gt 0 ]]; then
    cache_hit_ratio=$(echo "scale=4; ${blks_hit:-0} * 100 / $total_blocks" | bc 2>/dev/null || echo "0")
  else
    cache_hit_ratio="100.0000"
  fi

  # ---- Transaction rate (commits + rollbacks) ----
  local total_transactions
  total_transactions=$(( ${xact_commit:-0} + ${xact_rollback:-0} ))

  # ---- Table stats (top tables by seq scans — indicates missing indexes) ----
  local table_stats
  table_stats=$(pg_query_csv "
    SELECT relname, seq_scan, idx_scan, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup, n_dead_tup
    FROM pg_stat_user_tables
    ORDER BY seq_scan DESC
    LIMIT 10;" || echo "")

  local table_json="["
  local first=true
  while IFS='|' read -r relname seq_scan idx_scan n_ins n_upd n_del n_live n_dead; do
    [[ -z "$relname" ]] && continue
    if [[ "$first" == "false" ]]; then table_json+=","; fi
    table_json+="{\"table\":\"${relname}\",\"seq_scan\":${seq_scan:-0},\"idx_scan\":${idx_scan:-0},\"inserts\":${n_ins:-0},\"updates\":${n_upd:-0},\"deletes\":${n_del:-0},\"live_tuples\":${n_live:-0},\"dead_tuples\":${n_dead:-0}}"
    first=false
  done <<< "$table_stats"
  table_json+="]"

  # ---- Long-running queries (>1s) ----
  local slow_queries
  slow_queries=$(pg_query "
    SELECT count(*)
    FROM pg_stat_activity
    WHERE state = 'active'
      AND now() - query_start > interval '1 second'
      AND query NOT LIKE '%pg_stat%';" || echo "0")

  # ---- Lock stats ----
  local lock_count
  lock_count=$(pg_query "SELECT count(*) FROM pg_locks WHERE NOT granted;" || echo "0")

  # ---- Database size ----
  local db_size
  db_size=$(pg_query "SELECT pg_size_pretty(pg_database_size('${DB_NAME}'));" || echo "unknown")

  # ---- Uptime ----
  local pg_uptime
  pg_uptime=$(pg_query "SELECT extract(epoch from now() - pg_postmaster_start_time())::integer;" || echo "0")

  # ---- Replication lag (if applicable) ----
  local replication_lag
  replication_lag=$(pg_query "SELECT CASE WHEN pg_is_in_recovery() THEN extract(epoch from now() - pg_last_xact_replay_timestamp())::integer ELSE 0 END;" || echo "0")

  cat << EOF
{
  "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "container": "${CONTAINER_NAME}",
  "database": "${DB_NAME}",
  "version": "$(echo "$version" | head -1 | sed 's/"/\\"/g')",
  "uptime_seconds": ${pg_uptime:-0},
  "database_size": "${db_size}",
  "connections": {
    "max": ${max_connections:-100},
    "total": ${total_connections:-0},
    "active": ${active_connections:-0},
    "idle": ${idle_connections:-0},
    "waiting": ${waiting_connections:-0},
    "usage_pct": ${conn_usage_pct}
  },
  "transactions": {
    "committed": ${xact_commit:-0},
    "rolled_back": ${xact_rollback:-0},
    "total": ${total_transactions}
  },
  "cache": {
    "blocks_hit": ${blks_hit:-0},
    "blocks_read": ${blks_read:-0},
    "hit_ratio_pct": ${cache_hit_ratio}
  },
  "issues": {
    "deadlocks": ${deadlocks:-0},
    "conflicts": ${conflicts:-0},
    "slow_queries_active": ${slow_queries:-0},
    "waiting_locks": ${lock_count:-0},
    "temp_files_created": ${temp_files:-0},
    "temp_bytes_written": ${temp_bytes:-0}
  },
  "replication_lag_seconds": ${replication_lag:-0},
  "top_tables_by_seq_scan": ${table_json},
  "alerts": {
    "connection_usage_high": $(echo "${conn_usage_pct} > 80" | bc -l 2>/dev/null || echo 0),
    "cache_hit_ratio_low": $(echo "${cache_hit_ratio} < 95" | bc -l 2>/dev/null || echo 0),
    "deadlocks_detected": $([ "${deadlocks:-0}" -gt 0 ] && echo "true" || echo "false"),
    "slow_queries_active": $([ "${slow_queries:-0}" -gt 0 ] && echo "true" || echo "false"),
    "waiting_locks": $([ "${lock_count:-0}" -gt 5 ] && echo "true" || echo "false")
  }
}
EOF
}

# ============================================================================
# Main
# ============================================================================
log "Collecting PostgreSQL metrics from container '${CONTAINER_NAME}' (db: ${DB_NAME})..."
RESULT=$(collect_pg_metrics)

echo "$RESULT" > "$OUTPUT_FILE"
log "PostgreSQL metrics saved to: $OUTPUT_FILE"

# Print summary
python3 - << PYEOF 2>/dev/null || echo "$RESULT"
import json

with open("$OUTPUT_FILE") as f:
    data = json.load(f)

conn = data.get("connections", {})
txn = data.get("transactions", {})
cache = data.get("cache", {})
issues = data.get("issues", {})
alerts = data.get("alerts", {})
tables = data.get("top_tables_by_seq_scan", [])

print()
print("=== POSTGRESQL METRICS SUMMARY ===")
print(f"Database             : {data.get('database', 'n/a')}")
print(f"Size                 : {data.get('database_size', 'n/a')}")
print(f"Uptime               : {data.get('uptime_seconds', 0):,}s")
print()
print("Connections:")
print(f"  Total / Max        : {conn.get('total', 0)} / {conn.get('max', 100)}")
print(f"  Active             : {conn.get('active', 0)}")
print(f"  Idle               : {conn.get('idle', 0)}")
print(f"  Waiting            : {conn.get('waiting', 0)}")
print(f"  Usage              : {conn.get('usage_pct', 0)}%")
print()
print("Transactions:")
print(f"  Committed          : {txn.get('committed', 0):,}")
print(f"  Rolled back        : {txn.get('rolled_back', 0):,}")
print()
print("Cache:")
print(f"  Hit ratio          : {cache.get('hit_ratio_pct', 0)}%")
print(f"  Blocks hit         : {cache.get('blocks_hit', 0):,}")
print(f"  Blocks read        : {cache.get('blocks_read', 0):,}")
print()
print("Issues:")
print(f"  Deadlocks          : {issues.get('deadlocks', 0):,}")
print(f"  Slow queries       : {issues.get('slow_queries_active', 0):,}")
print(f"  Waiting locks      : {issues.get('waiting_locks', 0):,}")
print()

if tables:
    print("Top Tables (by seq scans):")
    for t in tables[:5]:
        print(f"  {t['table']:30s}  seq={t.get('seq_scan',0):>8,}  idx={t.get('idx_scan',0):>8,}  live={t.get('live_tuples',0):>8,}")
    print()

alert_flags = []
if alerts.get("connection_usage_high"): alert_flags.append("CONNECTIONS >80%")
if alerts.get("cache_hit_ratio_low"): alert_flags.append("CACHE HIT RATIO <95%")
if alerts.get("deadlocks_detected"): alert_flags.append("DEADLOCKS DETECTED")
if alerts.get("slow_queries_active"): alert_flags.append("SLOW QUERIES ACTIVE")
if alerts.get("waiting_locks"): alert_flags.append("LOCK CONTENTION")
if alert_flags:
    print(f"ALERTS: {', '.join(alert_flags)}")
else:
    print("ALERTS: None")
print()
print(f"Output: $OUTPUT_FILE")
PYEOF
