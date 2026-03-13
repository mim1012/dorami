#!/usr/bin/env bash
# Production Deployment Script — Task #23
# Automated deployment procedure with safety checks
# Usage: IMAGE_TAG=sha-xxx bash scripts/deploy-prod.sh
#
# Steps:
#   1. Preflight check
#   2. DB backup
#   3. Pull new images
#   4. Rolling update (backend first, then frontend)
#   5. Health verification
#   6. Rollback on failure

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
IMAGE_TAG="${IMAGE_TAG:?ERROR: IMAGE_TAG required (e.g., sha-abc123)}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io/mim1012}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-.backups}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3001}"
MAX_HEALTH_RETRIES=20
HEALTH_RETRY_INTERVAL=5

mkdir -p "$BACKUP_DIR"

log()      { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"; }
log_ok()   { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Save current image tags for rollback
ROLLBACK_FILE="${BACKUP_DIR}/rollback-$(date +%Y%m%d_%H%M%S).env"

save_current_state() {
  log "Saving current state for rollback..."
  local backend_img frontend_img
  backend_img=$(docker inspect --format='{{.Config.Image}}' doremi-backend-1 2>/dev/null || echo "unknown")
  frontend_img=$(docker inspect --format='{{.Config.Image}}' doremi-frontend-1 2>/dev/null || echo "unknown")
  cat > "$ROLLBACK_FILE" <<EOF
# Rollback state saved at $(date)
ROLLBACK_BACKEND_IMAGE=${backend_img}
ROLLBACK_FRONTEND_IMAGE=${frontend_img}
ROLLBACK_TIMESTAMP=$(date +%s)
EOF
  log_ok "Rollback state saved: ${ROLLBACK_FILE}"
}

# ============================================
# STEP 1: Preflight
# ============================================
log "STEP 1: Preflight checks"

bash "$(dirname "$0")/preflight-check.sh" || {
  log_fail "Preflight failed. Aborting deployment."
  exit 1
}
log_ok "Preflight passed"

# ============================================
# STEP 2: DB Backup
# ============================================
log "STEP 2: Database backup"

DB_CONTAINER="${DB_CONTAINER:-doremi-postgres-1}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-live_commerce_production}"
BACKUP_FILE="${BACKUP_DIR}/pre-deploy-$(date +%Y%m%d_%H%M%S).sql"

if docker ps --format '{{.Names}}' | grep -q "$DB_CONTAINER"; then
  docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null
  backup_size=$(wc -c < "$BACKUP_FILE")
  if [[ $backup_size -gt 1000 ]]; then
    log_ok "Backup created: ${BACKUP_FILE} ($(( backup_size / 1024 ))KB)"
  else
    log_fail "Backup too small (${backup_size} bytes). Aborting."
    exit 1
  fi
else
  log_warn "DB container not found locally. Skipping backup (assumes remote DB with separate backup)."
fi

# ============================================
# STEP 3: Save state + Pull images
# ============================================
log "STEP 3: Pull new images"

save_current_state

BACKEND_IMAGE="${DOCKER_REGISTRY}/doremi-backend:${IMAGE_TAG}"
FRONTEND_IMAGE="${DOCKER_REGISTRY}/doremi-frontend:${IMAGE_TAG}"

docker pull "$BACKEND_IMAGE" || { log_fail "Failed to pull backend image"; exit 1; }
docker pull "$FRONTEND_IMAGE" || { log_fail "Failed to pull frontend image"; exit 1; }
log_ok "Images pulled successfully"

# ============================================
# STEP 4: Rolling update
# ============================================
log "STEP 4: Rolling update"

export IMAGE_TAG
docker compose -f "$COMPOSE_FILE" up -d --no-deps backend || {
  log_fail "Backend update failed"
  exit 1
}
log "Waiting for backend health..."

# Wait for backend health
retries=0
while [[ $retries -lt $MAX_HEALTH_RETRIES ]]; do
  if curl -sf "${HEALTH_URL}/api/health/ready" >/dev/null 2>&1; then
    log_ok "Backend healthy after $((retries * HEALTH_RETRY_INTERVAL))s"
    break
  fi
  retries=$((retries + 1))
  sleep "$HEALTH_RETRY_INTERVAL"
done

if [[ $retries -ge $MAX_HEALTH_RETRIES ]]; then
  log_fail "Backend failed health check. Initiating rollback..."
  bash "$(dirname "$0")/rollback.sh" --file "$ROLLBACK_FILE"
  exit 1
fi

# Update frontend
docker compose -f "$COMPOSE_FILE" up -d --no-deps frontend || {
  log_fail "Frontend update failed"
  exit 1
}
sleep 10
log_ok "Frontend updated"

# ============================================
# STEP 5: Final verification
# ============================================
log "STEP 5: Final verification"

bash "$(dirname "$0")/health-check.sh" --once --url "$HEALTH_URL" || {
  log_warn "Post-deploy health check had warnings"
}

log ""
log_ok "========================================="
log_ok " Deployment complete: ${IMAGE_TAG}"
log_ok " Rollback file: ${ROLLBACK_FILE}"
log_ok "========================================="

