#!/usr/bin/env bash
# Rollback Script — Task #23
# Rolls back to a previous deployment state
# Usage:
#   bash scripts/rollback.sh                        # Rollback to known-good commit 54dd099
#   bash scripts/rollback.sh --file .backups/rollback-xxx.env  # Rollback using saved state
#   bash scripts/rollback.sh --tag sha-54dd099      # Rollback to specific tag

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Defaults — known good commit
DEFAULT_ROLLBACK_TAG="sha-54dd099"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io/mim1012}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3001}"
MAX_RETRIES=20
RETRY_INTERVAL=5

ROLLBACK_TAG=""
ROLLBACK_FILE=""

log()      { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"; }
log_ok()   { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) ROLLBACK_FILE="$2"; shift 2 ;;
    --tag)  ROLLBACK_TAG="$2"; shift 2 ;;
    *)      echo "Unknown arg: $1"; exit 1 ;;
  esac
done

log "=== ROLLBACK INITIATED ==="
log "Timestamp: $(date)"

# Determine rollback target
if [[ -n "$ROLLBACK_FILE" && -f "$ROLLBACK_FILE" ]]; then
  log "Using rollback file: ${ROLLBACK_FILE}"
  source "$ROLLBACK_FILE"
  BACKEND_IMAGE="${ROLLBACK_BACKEND_IMAGE:-}"
  FRONTEND_IMAGE="${ROLLBACK_FRONTEND_IMAGE:-}"

  if [[ -z "$BACKEND_IMAGE" || "$BACKEND_IMAGE" == "unknown" ]]; then
    log_fail "Rollback file has no valid backend image. Falling back to default."
    ROLLBACK_TAG="$DEFAULT_ROLLBACK_TAG"
  fi
elif [[ -n "$ROLLBACK_TAG" ]]; then
  log "Rolling back to tag: ${ROLLBACK_TAG}"
  BACKEND_IMAGE="${DOCKER_REGISTRY}/dorami-backend:${ROLLBACK_TAG}"
  FRONTEND_IMAGE="${DOCKER_REGISTRY}/dorami-frontend:${ROLLBACK_TAG}"
else
  log "Rolling back to default known-good: ${DEFAULT_ROLLBACK_TAG}"
  ROLLBACK_TAG="$DEFAULT_ROLLBACK_TAG"
  BACKEND_IMAGE="${DOCKER_REGISTRY}/dorami-backend:${ROLLBACK_TAG}"
  FRONTEND_IMAGE="${DOCKER_REGISTRY}/dorami-frontend:${ROLLBACK_TAG}"
fi

# Pull rollback images
log "Pulling rollback images..."
if [[ -n "${BACKEND_IMAGE:-}" ]]; then
  docker pull "$BACKEND_IMAGE" 2>/dev/null || log_fail "Could not pull ${BACKEND_IMAGE}"
fi
if [[ -n "${FRONTEND_IMAGE:-}" ]]; then
  docker pull "$FRONTEND_IMAGE" 2>/dev/null || log_fail "Could not pull ${FRONTEND_IMAGE}"
fi

# Apply rollback
log "Applying rollback..."
if [[ -n "$ROLLBACK_TAG" ]]; then
  export IMAGE_TAG="$ROLLBACK_TAG"
fi

docker compose -f "$COMPOSE_FILE" up -d --no-deps backend frontend 2>/dev/null || {
  log_fail "docker compose up failed. Trying direct container restart..."
  docker restart dorami-backend-1 dorami-frontend-1 2>/dev/null || true
}

# Wait for health
log "Waiting for services to recover..."
retries=0
while [[ $retries -lt $MAX_RETRIES ]]; do
  if curl -sf "${HEALTH_URL}/api/health/live" >/dev/null 2>&1; then
    log_ok "Services healthy after rollback ($((retries * RETRY_INTERVAL))s)"
    break
  fi
  retries=$((retries + 1))
  sleep "$RETRY_INTERVAL"
done

if [[ $retries -ge $MAX_RETRIES ]]; then
  log_fail "Services did NOT recover after rollback. Manual intervention required."
  exit 1
fi

log ""
log_ok "=== ROLLBACK COMPLETE ==="
log_ok "Target: ${ROLLBACK_TAG:-from file}"
log_ok "Health: verified"
