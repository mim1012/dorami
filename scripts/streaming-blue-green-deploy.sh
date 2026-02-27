#!/usr/bin/env bash
# Blue/Green production deploy helper:
# 1) start target slot (green <-> blue)
# 2) run streaming soak check on canary nginx
# 3) switch production routing to target slot and reload nginx
# 4) remove old slot and leave canary down

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Usage: streaming-blue-green-deploy.sh [options]

Required:
  --image-tag <sha-...>
  --host <ssh-host>
  --user <ssh-user>
  --ssh-key <path>

Optional:
  --ssh-port <port>                     default 22
  --workdir /opt/dorami
  --compose-base docker-compose.base.yml
  --compose-overlay docker-compose.prod-blue-green.yml
  --target-slot blue|green (auto-detect opposite)
  --state-file /opt/dorami/.dorami-active-slot
  --canary-url http://127.0.0.1:13080
  --canary-port 13080
  --soak-duration 1200
  --soak-interval 30
  --soak-max-users 300
  --soak-stream-key smoke-check
  --soak-only
  --skip-soak
  --force
EOF
}

IMAGE_TAG=""
HOST=""
USER=""
SSH_KEY=""
SSH_PORT="22"
WORKDIR="/opt/dorami"
COMPOSE_BASE="docker-compose.base.yml"
COMPOSE_OVERLAY="docker-compose.prod-blue-green.yml"
STATE_FILE="/opt/dorami/.dorami-active-slot"
TARGET_SLOT=""
CANARY_URL="http://127.0.0.1:13080"
CANARY_PORT="13080"
SOAK_DURATION="1200"
SOAK_INTERVAL="30"
SOAK_MAX_USERS="300"
SOAK_STREAM_KEY="smoke-check"
SOAK_ONLY="0"
SKIP_SOAK="0"
FORCE="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image-tag) IMAGE_TAG="$2"; shift 2 ;;
    --host) HOST="$2"; shift 2 ;;
    --user) USER="$2"; shift 2 ;;
    --ssh-key) SSH_KEY="$2"; shift 2 ;;
    --ssh-port) SSH_PORT="$2"; shift 2 ;;
    --workdir) WORKDIR="$2"; shift 2 ;;
    --compose-base) COMPOSE_BASE="$2"; shift 2 ;;
    --compose-overlay) COMPOSE_OVERLAY="$2"; shift 2 ;;
    --state-file) STATE_FILE="$2"; shift 2 ;;
    --target-slot) TARGET_SLOT="$2"; shift 2 ;;
    --canary-url) CANARY_URL="$2"; shift 2 ;;
    --canary-port) CANARY_PORT="$2"; shift 2 ;;
    --soak-duration) SOAK_DURATION="$2"; shift 2 ;;
    --soak-interval) SOAK_INTERVAL="$2"; shift 2 ;;
    --soak-max-users) SOAK_MAX_USERS="$2"; shift 2 ;;
    --soak-stream-key) SOAK_STREAM_KEY="$2"; shift 2 ;;
    --soak-only) SOAK_ONLY="1"; shift ;;
    --skip-soak) SKIP_SOAK="1"; shift ;;
    --force) FORCE="1"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

if [[ -z "$IMAGE_TAG" || -z "$HOST" || -z "$USER" || -z "$SSH_KEY" ]]; then
  echo "ERROR: --image-tag, --host, --user, --ssh-key are required."
  usage
  exit 1
fi

if [[ ! "$IMAGE_TAG" =~ ^sha-[0-9a-f]{40}$ ]]; then
  echo "ERROR: IMAGE_TAG must be sha-<40hex>"
  exit 1
fi

SSH_ARGS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -i "$SSH_KEY" -p "$SSH_PORT")
SSH_TARGET="${USER}@${HOST}"

run_remote() {
  ssh "${SSH_ARGS[@]}" "$SSH_TARGET" "$1"
}

upload_file() {
  scp "${SSH_ARGS[@]}" "$1" "$SSH_TARGET:$2"
}

compose_cmd() {
  local extra="$1"
  echo "docker compose -f \"$WORKDIR/$COMPOSE_BASE\" -f \"$WORKDIR/$COMPOSE_OVERLAY\" --env-file \"$WORKDIR/.env.production\" $extra"
}

run_compose() {
  local command="$1"
  run_remote "cd '$WORKDIR' && $(compose_cmd "$command")"
}

SCRIPT_TMP_DIR="${TMPDIR:-/tmp}"
RENDERED_ROUTE_LOCAL="$(mktemp "$SCRIPT_TMP_DIR/dorami-streaming-route-XXXXXX.conf")"
CANARY_ROUTE_LOCAL="$SCRIPT_DIR/../nginx/streaming-routing.blue-green.template.conf"
CANARY_ROUTE_REMOTE="$WORKDIR/nginx/streaming-routing.blue-green.conf"
ACTIVE_ROUTE_REMOTE="$WORKDIR/nginx/streaming-routing.conf"
CANARY_ROUTE_BACKUP="${WORKDIR}/nginx/streaming-routing.blue-green.conf.bak.$(date +%s)"
ACTIVE_ROUTE_BACKUP="${WORKDIR}/nginx/streaming-routing.conf.bak.$(date +%s)"
SWITCH_COMPLETED="0"
TARGET_BACKEND_CONTAINER=""
TARGET_FRONTEND_CONTAINER=""

if [ ! -f "$CANARY_ROUTE_LOCAL" ] && [ -f "$WORKDIR/nginx/streaming-routing.blue-green.template.conf" ]; then
  CANARY_ROUTE_LOCAL="$WORKDIR/nginx/streaming-routing.blue-green.template.conf"
fi

cleanup() {
  if [ -n "${CANARY_PID:-}" ]; then
    kill "$CANARY_PID" >/dev/null 2>&1 || true
  fi

  if [ -n "$WORKDIR" ]; then
    if run_remote "docker ps --filter name=dorami-nginx-blue-green-canary --format '{{.Names}}' | grep -q 'dorami-nginx-blue-green-canary'" ; then
      run_compose "--profile canary down nginx_blue_green_canary" || true
    fi
    if [ -f "$CANARY_ROUTE_BACKUP" ]; then
      run_remote "if [ -f '$CANARY_ROUTE_BACKUP' ]; then mv -f '$CANARY_ROUTE_BACKUP' '$CANARY_ROUTE_REMOTE'; fi" || true
    fi
    if [ -f "$ACTIVE_ROUTE_BACKUP" ]; then
      run_remote "if [ -f '$ACTIVE_ROUTE_BACKUP' ]; then mv -f '$ACTIVE_ROUTE_BACKUP' '$ACTIVE_ROUTE_REMOTE'; fi" || true
    fi

    if [ "$SWITCH_COMPLETED" != "1" ] && [ "$SOAK_ONLY" != "1" ] && [ -n "$TARGET_BACKEND_CONTAINER" ] && [ -n "$TARGET_FRONTEND_CONTAINER" ]; then
      run_remote "docker rm -f '$TARGET_BACKEND_CONTAINER' '$TARGET_FRONTEND_CONTAINER' >/dev/null 2>&1 || true"
    fi
  fi

  rm -f "$RENDERED_ROUTE_LOCAL"
}

trap 'cleanup' EXIT

get_active_slot() {
  local from_state
  from_state="$(run_remote "if [ -f '$STATE_FILE' ]; then cat '$STATE_FILE' 2>/dev/null; fi" || true)"
  from_state="$(printf '%s' "$from_state" | tr -d ' \r\n')"
  case "$from_state" in
    blue|green) echo "$from_state"; return ;;
  esac

  if run_remote "docker ps --filter name=dorami-backend-blue --format '{{.Names}}' | grep -q '^dorami-backend-blue$'"; then
    echo "blue"
    return
  fi
  if run_remote "docker ps --filter name=dorami-backend-green --format '{{.Names}}' | grep -q '^dorami-backend-green$'"; then
    echo "green"
    return
  fi
  if run_remote "docker ps --filter name=dorami-backend-prod --format '{{.Names}}' | grep -q '^dorami-backend-prod$'"; then
    echo "legacy"
    return
  fi

  echo "blue"
}

set_slot_state() {
  local slot="$1"
  run_remote "mkdir -p '$(dirname "$STATE_FILE")' && echo '$slot' > '$STATE_FILE'"
}

active_slot="$(get_active_slot)"
if [[ -z "$active_slot" ]]; then
  active_slot="blue"
fi

if [[ -z "$TARGET_SLOT" ]]; then
  if [[ "$active_slot" == "blue" ]]; then
    TARGET_SLOT="green"
  else
    TARGET_SLOT="blue"
  fi
fi

if [[ "$TARGET_SLOT" != "blue" && "$TARGET_SLOT" != "green" ]]; then
  echo "ERROR: --target-slot must be blue or green"
  exit 1
fi

if [[ "$SOAK_ONLY" == "1" && "$FORCE" != "1" ]]; then
  echo "ERROR: --soak-only requires --force"
  exit 1
fi

echo "Deploy target slot: ${TARGET_SLOT} (current ${active_slot})"

if [[ ! -f "$CANARY_ROUTE_LOCAL" ]]; then
  echo "ERROR: template not found: $CANARY_ROUTE_LOCAL"
  exit 1
fi

backend_slot="backend_${TARGET_SLOT}"
frontend_slot="frontend_${TARGET_SLOT}"
TARGET_BACKEND_CONTAINER="dorami-${backend_slot}"
TARGET_FRONTEND_CONTAINER="dorami-${frontend_slot}"

sed -e "s/__BACKEND_SLOT__/${backend_slot}/g" -e "s/__FRONTEND_SLOT__/${frontend_slot}/g" "$CANARY_ROUTE_LOCAL" > "$RENDERED_ROUTE_LOCAL"

echo "Syncing canary routing template..."
run_remote "if [ -f '$CANARY_ROUTE_REMOTE' ]; then cp '$CANARY_ROUTE_REMOTE' '$CANARY_ROUTE_BACKUP'; fi"
upload_file "$RENDERED_ROUTE_LOCAL" "$CANARY_ROUTE_REMOTE"

echo "Pulling target slot images and starting services..."
run_compose "pull backend_${TARGET_SLOT} frontend_${TARGET_SLOT}"
run_compose "up -d --no-deps --force-recreate backend_${TARGET_SLOT} frontend_${TARGET_SLOT}"

echo "Starting canary nginx..."
run_compose "--profile canary up -d nginx_blue_green_canary"

if [[ "$SKIP_SOAK" != "1" ]]; then
  echo "Running streaming soak test against ${CANARY_URL}"
  node "$SCRIPT_DIR/streaming-soak-check.mjs" \
    --url "$CANARY_URL" \
    --duration "$SOAK_DURATION" \
    --ingest-duration "$SOAK_DURATION" \
    --interval "$SOAK_INTERVAL" \
    --max-users "$SOAK_MAX_USERS" \
    --stream-key "$SOAK_STREAM_KEY" \
    --output "$SCRIPT_DIR/.streaming-soak-${TARGET_SLOT}.json" \
    --ssh-host "$HOST" \
    --ssh-user "$USER" \
    --ssh-key "$SSH_KEY" \
    --ssh-port "$SSH_PORT" \
    --ssh-workdir "$WORKDIR" \
    --compose-base "$COMPOSE_BASE" \
    --compose-overlay "$COMPOSE_OVERLAY" \
    --nginx-container "dorami-nginx-blue-green-canary"
  soak_status=$?
  if [[ $soak_status -ne 0 ]]; then
    echo "Soak test failed for ${TARGET_SLOT}. Keeping existing slot ${active_slot}."
    exit $soak_status
  fi
  echo "Soak test passed."
else
  echo "Skip soak requested."
fi

if [[ "$SOAK_ONLY" == "1" ]]; then
  echo "soak-only completed."
  exit 0
fi

echo "Switching production route to ${TARGET_SLOT}..."
run_remote "cp '$ACTIVE_ROUTE_REMOTE' '$ACTIVE_ROUTE_BACKUP'"
upload_file "$RENDERED_ROUTE_LOCAL" "$ACTIVE_ROUTE_REMOTE"
run_remote "cd '$WORKDIR' && docker compose -f docker-compose.base.yml -f docker-compose.prod.yml --env-file .env.production up -d --no-deps nginx && docker compose -f docker-compose.base.yml -f docker-compose.prod.yml --env-file .env.production exec -T nginx nginx -s reload"
SWITCH_COMPLETED="1"

if [[ "$active_slot" == "blue" ]]; then
  OLD_BACKEND="dorami-backend-blue"
  OLD_FRONTEND="dorami-frontend-blue"
elif [[ "$active_slot" == "green" ]]; then
  OLD_BACKEND="dorami-backend-green"
  OLD_FRONTEND="dorami-frontend-green"
else
  OLD_BACKEND="dorami-backend-prod"
  OLD_FRONTEND="dorami-frontend-prod"
fi

echo "Stopping old slot containers: ${OLD_BACKEND}, ${OLD_FRONTEND}"
run_remote "docker rm -f '$OLD_BACKEND' '$OLD_FRONTEND' >/dev/null 2>&1 || true"
set_slot_state "$TARGET_SLOT"

echo "Blue/Green switch complete. Active slot=${TARGET_SLOT}"
