#!/usr/bin/env bash
# =============================================================================
# 02-prisma-drift-check.sh — Prisma Migration / DB Drift Analysis
# =============================================================================
# Outputs a single JSON blob to stdout with:
#   - prisma migrate status (applied / pending migrations)
#   - live DB introspection (tables, indexes, FK count, enum types)
#   - row counts for key tables
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# 1. Resolve paths
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"

# ---------------------------------------------------------------------------
# 2. Auto-detect DATABASE_URL
# ---------------------------------------------------------------------------
detect_database_url() {
  # Priority: env var → backend/.env → repo root .env
  if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "$DATABASE_URL"
    return
  fi
  for env_file in "$BACKEND_DIR/.env" "$BACKEND_DIR/.env.local" "$REPO_ROOT/.env"; do
    if [[ -f "$env_file" ]]; then
      local url
      url=$(grep -E '^DATABASE_URL=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true)
      if [[ -n "$url" ]]; then
        echo "$url"
        return
      fi
    fi
  done
  # Default for local docker-compose dev
  echo "postgresql://postgres:postgres@localhost:5432/live_commerce"
}

DB_URL="$(detect_database_url)"
export DATABASE_URL="$DB_URL"

# ---------------------------------------------------------------------------
# 3. Auto-detect Postgres Docker container
# ---------------------------------------------------------------------------
detect_postgres_container() {
  local candidates=(
    "live-commerce-postgres"
    "dorami-postgres"
    "postgres"
    "dorami_postgres_1"
    "live-commerce_postgres_1"
  )
  for name in "${candidates[@]}"; do
    if docker inspect "$name" >/dev/null 2>&1; then
      # Verify it is actually running
      local state
      state=$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || echo "")
      if [[ "$state" == "running" ]]; then
        echo "$name"
        return
      fi
    fi
  done
  # Last-resort: find any running container with postgres in the image name
  docker ps --format '{{.Names}}\t{{.Image}}' 2>/dev/null \
    | awk '/postgres/{print $1; exit}'
}

PG_CONTAINER="$(detect_postgres_container)"

# ---------------------------------------------------------------------------
# 4. Helper — run psql inside container (or directly via DATABASE_URL)
# ---------------------------------------------------------------------------
psql_query() {
  local query="$1"
  if [[ -n "$PG_CONTAINER" ]]; then
    docker exec -i "$PG_CONTAINER" \
      psql -U postgres -d live_commerce -tAq -c "$query" 2>/dev/null
  else
    # Fallback: local psql if available
    psql "$DATABASE_URL" -tAq -c "$query" 2>/dev/null
  fi
}

# ---------------------------------------------------------------------------
# 5. Collect Prisma migrate status
# ---------------------------------------------------------------------------
collect_prisma_status() {
  local raw_status=""
  local applied=()
  local pending=()
  local status_line="unknown"
  local migration_count=0

  if command -v npx >/dev/null 2>&1 && [[ -d "$BACKEND_DIR" ]]; then
    raw_status=$(cd "$BACKEND_DIR" && npx prisma migrate status --schema=prisma/schema.prisma 2>&1 || true)
  fi

  if [[ -n "$raw_status" ]]; then
    # Determine overall status
    if echo "$raw_status" | grep -q "Database schema is up to date"; then
      status_line="✔ Up to date"
    elif echo "$raw_status" | grep -q "following migration"; then
      status_line="⚠ Pending migrations detected"
    else
      status_line="$(echo "$raw_status" | grep -oE '(up to date|pending|error|failed)' | head -1 || echo 'unknown')"
    fi

    # Extract applied migrations (lines with "✔" or "[applied]" or timestamp pattern)
    while IFS= read -r line; do
      if echo "$line" | grep -qE '^\s*(✔|✅|\[applied\]|applied)'; then
        local mname
        mname=$(echo "$line" | grep -oE '[0-9]{14}_[a-z_]+' || true)
        [[ -n "$mname" ]] && applied+=("$mname")
      elif echo "$line" | grep -qE '^\s*(✖|❌|\[pending\]|pending|not applied)'; then
        local mname
        mname=$(echo "$line" | grep -oE '[0-9]{14}_[a-z_]+' || true)
        [[ -n "$mname" ]] && pending+=("$mname")
      fi
    done <<< "$raw_status"
  fi

  # Count migrations from filesystem as fallback / cross-check
  local fs_count=0
  if [[ -d "$BACKEND_DIR/prisma/migrations" ]]; then
    fs_count=$(find "$BACKEND_DIR/prisma/migrations" -maxdepth 1 -type d \
      | grep -cE '[0-9]{14}_' || true)

    # If prisma CLI didn't return parsed data, read names from filesystem
    if [[ ${#applied[@]} -eq 0 ]]; then
      while IFS= read -r dir; do
        local mname
        mname=$(basename "$dir")
        applied+=("$mname")
      done < <(find "$BACKEND_DIR/prisma/migrations" -maxdepth 1 -type d \
        | grep -E '[0-9]{14}_' | sort)
    fi
  fi

  migration_count=${#applied[@]}
  [[ "$migration_count" -eq 0 && "$fs_count" -gt 0 ]] && migration_count=$fs_count

  # Build JSON arrays
  local applied_json pending_json
  applied_json=$(printf '"%s",' "${applied[@]}" 2>/dev/null | sed 's/,$//' || echo "")
  pending_json=$(printf '"%s",' "${pending[@]}" 2>/dev/null | sed 's/,$//' || echo "")

  cat <<EOF
  "prisma": {
    "status": "$status_line",
    "applied_migrations": [$applied_json],
    "pending_migrations": [$pending_json],
    "migration_count": $migration_count
  }
EOF
}

# ---------------------------------------------------------------------------
# 6. Collect DB introspection
# ---------------------------------------------------------------------------
collect_db_info() {
  local tables=0 indexes=0 fk_count=0 enum_count=0

  if [[ -n "$PG_CONTAINER" ]] || command -v psql >/dev/null 2>&1; then
    # Table count (public schema, non-system)
    tables=$(psql_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" 2>/dev/null | tr -d '[:space:]' || echo "0")
    tables="${tables:-0}"

    # Index count
    indexes=$(psql_query "SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public';" 2>/dev/null | tr -d '[:space:]' || echo "0")
    indexes="${indexes:-0}"

    # Foreign key count
    fk_count=$(psql_query "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND constraint_schema='public';" 2>/dev/null | tr -d '[:space:]' || echo "0")
    fk_count="${fk_count:-0}"

    # Enum type count
    enum_count=$(psql_query "SELECT COUNT(*) FROM pg_type WHERE typtype='e';" 2>/dev/null | tr -d '[:space:]' || echo "0")
    enum_count="${enum_count:-0}"
  fi

  # ----- Row counts for key tables -----
  local key_tables=(
    users
    live_streams
    products
    orders
    order_items
    carts
    cart_items
    reservations
    point_balances
    point_transactions
    settlements
    re_stream_targets
    notification_subscriptions
    audit_logs
    system_configs
    notices
  )

  local table_data_json=""
  for tbl in "${key_tables[@]}"; do
    if [[ -n "$PG_CONTAINER" ]] || command -v psql >/dev/null 2>&1; then
      local cnt
      cnt=$(psql_query "SELECT COUNT(*) FROM \"$tbl\";" 2>/dev/null | tr -d '[:space:]' || echo "null")
      # Skip if table doesn't exist (query returns empty / error)
      if [[ -n "$cnt" && "$cnt" != "null" && "$cnt" =~ ^[0-9]+$ ]]; then
        table_data_json+="\"$tbl\": $cnt, "
      fi
    fi
  done
  # Trim trailing comma+space
  table_data_json="${table_data_json%, }"

  cat <<EOF
  "database": {
    "container": "${PG_CONTAINER:-local_psql}",
    "database_url_detected": true,
    "tables": $tables,
    "indexes": $indexes,
    "foreign_keys": $fk_count,
    "enum_types": $enum_count,
    "table_data": {
      $table_data_json
    }
  }
EOF
}

# ---------------------------------------------------------------------------
# 7. Collect enum type names (for drift detection)
# ---------------------------------------------------------------------------
collect_enum_types() {
  local enum_json=""

  if [[ -n "$PG_CONTAINER" ]] || command -v psql >/dev/null 2>&1; then
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      # Each line: type_name|values
      local ename evals
      ename=$(echo "$line" | cut -d'|' -f1 | tr -d '[:space:]')
      evals=$(echo "$line" | cut -d'|' -f2)
      [[ -z "$ename" ]] && continue
      # Escape values for JSON
      evals=$(echo "$evals" | sed 's/"/\\"/g')
      enum_json+="\"$ename\": \"$evals\", "
    done < <(psql_query \
      "SELECT t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) \
       FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid \
       WHERE t.typtype='e' \
       GROUP BY t.typname \
       ORDER BY t.typname;" 2>/dev/null || true)
  fi

  enum_json="${enum_json%, }"

  cat <<EOF
  "enum_details": {
    $enum_json
  }
EOF
}

# ---------------------------------------------------------------------------
# 8. Assemble final JSON
# ---------------------------------------------------------------------------
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%SZ")

prisma_block=$(collect_prisma_status)
db_block=$(collect_db_info)
enum_block=$(collect_enum_types)

cat <<JSON
{
  "timestamp": "$TIMESTAMP",
$prisma_block,
$db_block,
$enum_block
}
JSON
