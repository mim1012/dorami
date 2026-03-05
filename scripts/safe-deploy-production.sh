#!/usr/bin/env bash
# Safe Production Deployment Script
# Ensures 7-step enterprise-grade deployment with safeguards
# Usage: IMAGE_TAG=sha-abc123 bash scripts/safe-deploy-production.sh
# Requirements:
#   - IMAGE_TAG environment variable (docker image tag)
#   - .env.production file with DB credentials
#   - docker-compose.base.yml and docker-compose.prod.yml in current directory
#   - All containers on dorami-internal network (backend, postgres, redis, nginx)

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${BACKUP_DIR:-.backups}"
IMAGE_TAG="${IMAGE_TAG:?ERROR: IMAGE_TAG environment variable required (e.g., sha-abc123def)}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io/your-org}"
BACKEND_IMAGE="${DOCKER_REGISTRY}/dorami-backend:${IMAGE_TAG}"
DOCKER_NETWORK="${DOCKER_NETWORK:-dorami-internal}"
COMPOSE_BASE="${COMPOSE_BASE:-docker-compose.base.yml}"
COMPOSE_PROD="${COMPOSE_PROD:-docker-compose.prod.yml}"
DB_HOST="${DB_HOST:-dorami-postgres-prod}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-live_commerce_production}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

# Ensure backup directory exists
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

# Trap errors
trap 'log_error "Deployment failed at step"; exit 1' ERR

# ============================================
# STEP 1: DB Backup
# ============================================
log_step "STEP 1: DB Backup"

BACKUP_FILE="${BACKUP_DIR}/backup_$(date +%F_%H%M%S).sql"

if ! docker exec "$DB_HOST" \
  pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"; then
  log_error "Failed to backup database"
  exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log_success "Database backed up to $BACKUP_FILE (Size: $BACKUP_SIZE)"

# Verify backup is not empty
if [ ! -s "$BACKUP_FILE" ]; then
  log_error "Backup file is empty"
  exit 1
fi

# ============================================
# STEP 2: DB Connectivity Test
# ============================================
log_step "STEP 2: DB Connectivity Test"

if ! docker exec "$DB_HOST" \
  psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
  log_error "Failed to connect to database"
  log_error "Verify: DATABASE_URL, DB_HOST, DB_USER credentials"
  exit 1
fi

log_success "Database connectivity verified"

# ============================================
# STEP 3: Network Verification
# ============================================
log_step "STEP 3: Network Verification"

REQUIRED_CONTAINERS=(
  "dorami-backend-prod"
  "dorami-postgres-prod"
  "dorami-redis-prod"
  "dorami-nginx"
)

for container in "${REQUIRED_CONTAINERS[@]}"; do
  if ! docker network inspect "$DOCKER_NETWORK" | grep -q "$container"; then
    log_warning "Container $container not found on network $DOCKER_NETWORK"
  else
    log_success "Container $container verified on $DOCKER_NETWORK"
  fi
done

# ============================================
# STEP 4: Migration Preview (Dry Run)
# ============================================
log_step "STEP 4: Migration Preview (Status Check)"

log_warning "Running migration status check..."

if ! docker run --rm \
  --network "$DOCKER_NETWORK" \
  --env-file .env.production \
  "$BACKEND_IMAGE" \
  npx prisma migrate status; then
  log_error "Migration status check failed"
  log_error "Verify: .env.production exists and contains DATABASE_URL"
  exit 1
fi

log_success "Migration status check completed"

# ============================================
# STEP 5: Destructive Migration Check
# ============================================
log_step "STEP 5: Destructive Migration Safety Check"

# Run the destructive migration checker
if ! bash scripts/check-destructive-migrations.sh; then
  log_error "Destructive operations detected in migrations"
  log_error "Deployment blocked to protect production data"
  exit 1
fi

log_success "No destructive operations detected in pending migrations"

# ============================================
# STEP 6: Apply Migration
# ============================================
log_step "STEP 6: Apply Migration"

log_warning "Applying pending migrations..."

if ! docker run --rm \
  --network "$DOCKER_NETWORK" \
  --env-file .env.production \
  "$BACKEND_IMAGE" \
  npx prisma migrate deploy; then
  log_error "Migration failed"
  log_error "Database NOT modified. Backup available at: $BACKUP_FILE"
  exit 1
fi

log_success "Migrations applied successfully"

# ============================================
# STEP 7: Deploy Backend Container
# ============================================
log_step "STEP 7: Deploy Backend Container"

log_warning "Pulling latest backend image..."

if ! docker compose -f "$COMPOSE_BASE" -f "$COMPOSE_PROD" --env-file .env.production pull backend; then
  log_error "Failed to pull backend image"
  exit 1
fi

log_warning "Starting new backend container..."

if ! docker compose -f "$COMPOSE_BASE" -f "$COMPOSE_PROD" --env-file .env.production up -d backend; then
  log_error "Failed to start backend container"
  exit 1
fi

log_success "Backend container deployed"

# ============================================
# STEP 8: Wait for Backend Startup
# ============================================
log_step "STEP 8: Wait for Backend Startup"

sleep 5

MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if docker ps | grep -q "dorami-backend-prod"; then
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
# STEP 9: API Health Check
# ============================================
log_step "STEP 9: API Health Check"

sleep 5  # Give backend time to initialize

MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -sf http://localhost/api/health/ready > /dev/null 2>&1; then
    log_success "API health check passed"
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "API health check failed after $MAX_RETRIES retries"
    log_warning "Backend may still be initializing. Check logs: docker logs dorami-backend-prod"
    exit 1
  fi

  log_warning "Health check attempt $RETRY_COUNT/$MAX_RETRIES..."
  sleep 2
done

# ============================================
# STEP 10: Database Connectivity from Backend
# ============================================
log_step "STEP 10: Database Connectivity from Backend"

if ! curl -sf "http://localhost/api/health/ready" | grep -q "ok"; then
  log_error "Backend database connectivity check failed"
  exit 1
fi

log_success "Backend-to-database connectivity verified"

# ============================================
# DEPLOYMENT SUCCESS
# ============================================
log_step "DEPLOYMENT SUCCESS ✅"

echo ""
echo "Summary:"
echo "  ✅ Backup: $BACKUP_FILE"
echo "  ✅ Database: Connected"
echo "  ✅ Migrations: Applied"
echo "  ✅ Backend: Deployed (Image: $BACKEND_IMAGE)"
echo "  ✅ Health: All systems operational"
echo ""
echo "Deployment timestamp: $(date)"
echo ""

# Optional: Archive backup if requested
if [ "${ARCHIVE_BACKUP:-false}" = "true" ]; then
  log_step "Archiving backup to S3..."
  # Example: aws s3 cp "$BACKUP_FILE" s3://dorami-db-backups-prod/
fi

exit 0
