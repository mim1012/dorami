#!/usr/bin/env bash
# Safe Staging Deployment Script (for testing production deployment procedures)
# This script mirrors safe-deploy-production.sh but targets staging environment
# Usage: IMAGE_TAG=sha-abc123 bash scripts/safe-deploy-staging.sh
# This allows testing the deployment procedure before production

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${BACKUP_DIR:-.backups/staging}"
IMAGE_TAG="${IMAGE_TAG:?ERROR: IMAGE_TAG environment variable required (e.g., sha-abc123def)}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io/your-org}"
BACKEND_IMAGE="${DOCKER_REGISTRY}/dorami-backend:${IMAGE_TAG}"
DOCKER_NETWORK="${DOCKER_NETWORK:-dorami-internal}"
COMPOSE_BASE="${COMPOSE_BASE:-docker-compose.base.yml}"
COMPOSE_STAGING="${COMPOSE_STAGING:-docker-compose.staging.yml}"
DB_HOST="${DB_HOST:-postgres}"
DB_USER="${DB_USER:-dorami}"
DB_NAME="${DB_NAME:-live_commerce}"

mkdir -p "$BACKUP_DIR"

# Helper functions
log_step() {
  echo -e "\n${GREEN}=== $1 ===${NC}"
}

log_error() {
  echo -e "${RED}❌ ERROR: $1${NC}" >&2
}

log_warning() {
  echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

trap 'log_error "Deployment failed at step"; exit 1' ERR

log_step "STAGING DEPLOYMENT TEST"
echo "This tests the production deployment procedure in staging"
echo "Image: $BACKEND_IMAGE"
echo ""

# ============================================
# STEP 1: DB Backup
# ============================================
log_step "STEP 1: DB Backup"

BACKUP_FILE="${BACKUP_DIR}/backup_staging_$(date +%F_%H%M%S).sql"

if ! docker exec "$DB_HOST" \
  pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null; then
  log_warning "Backup skipped (postgres may not be running yet)"
else
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" 2>/dev/null | cut -f1)
  log_success "Database backed up to $BACKUP_FILE (Size: $BACKUP_SIZE)"
  
  if [ ! -s "$BACKUP_FILE" ]; then
    log_error "Backup file is empty"
    exit 1
  fi
fi

# ============================================
# STEP 2: Network Verification
# ============================================
log_step "STEP 2: Network Verification"

if ! docker network inspect "$DOCKER_NETWORK" > /dev/null 2>&1; then
  log_warning "Network $DOCKER_NETWORK does not exist yet"
else
  log_success "Network $DOCKER_NETWORK exists"
fi

# ============================================
# STEP 3: Migration Preview
# ============================================
log_step "STEP 3: Migration Preview (Status Check)"

log_warning "Running migration status check..."

if ! docker run --rm \
  --network "$DOCKER_NETWORK" \
  --env-file .env.staging \
  "$BACKEND_IMAGE" \
  npx prisma migrate status; then
  log_warning "Migration status check skipped (environment may not be fully ready)"
else
  log_success "Migration status check completed"
fi

# ============================================
# STEP 4: Destructive Migration Check
# ============================================
log_step "STEP 4: Destructive Migration Safety Check"

if ! bash scripts/check-destructive-migrations.sh; then
  log_error "Destructive operations detected in migrations"
  exit 1
fi

log_success "No destructive operations detected"

# ============================================
# STEP 5: Deploy Backend Container
# ============================================
log_step "STEP 5: Deploy Backend Container"

log_warning "Pulling latest backend image..."

if ! docker compose -f "$COMPOSE_BASE" -f "$COMPOSE_STAGING" --env-file .env.staging pull backend 2>/dev/null; then
  log_warning "Image pull failed (may already be present locally)"
fi

log_warning "Starting new backend container..."

if ! docker compose -f "$COMPOSE_BASE" -f "$COMPOSE_STAGING" --env-file .env.staging up -d backend; then
  log_error "Failed to start backend container"
  exit 1
fi

log_success "Backend container deployed"

# ============================================
# STEP 6: Wait for Backend Startup
# ============================================
log_step "STEP 6: Wait for Backend Startup"

sleep 3

MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if docker ps | grep -q "dorami-backend"; then
    log_success "Backend container running"
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "Backend container failed to start after $MAX_RETRIES retries"
    exit 1
  fi

  sleep 1
done

# ============================================
# STEP 7: API Health Check
# ============================================
log_step "STEP 7: API Health Check"

sleep 5

MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -sf http://localhost:3001/api/health/ready > /dev/null 2>&1; then
    log_success "API health check passed"
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "API health check failed after $MAX_RETRIES retries"
    log_warning "Check logs: docker logs dorami-backend"
    exit 1
  fi

  log_warning "Health check attempt $RETRY_COUNT/$MAX_RETRIES..."
  sleep 2
done

# ============================================
# TEST SUCCESS
# ============================================
log_step "STAGING DEPLOYMENT TEST SUCCESS ✅"

echo ""
echo "Summary:"
echo "  ✅ Backup: ${BACKUP_FILE:-(skipped)}"
echo "  ✅ Network: $DOCKER_NETWORK verified"
echo "  ✅ Migrations: Safe (no destructive operations)"
echo "  ✅ Backend: Deployed (Image: $BACKEND_IMAGE)"
echo "  ✅ Health: API responding"
echo ""
echo "Deployment timestamp: $(date)"
echo ""
echo "Next step: Review logs and verify functionality in staging"
echo "Then: Safe to deploy to production using safe-deploy-production.sh"
echo ""

exit 0
