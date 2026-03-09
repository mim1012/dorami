#!/bin/bash
set -e

DEPLOY_DIR="/opt/dorami"
ENV_FILE=".env.production"

cd "$DEPLOY_DIR"

echo "📦 Deploying to production..."
echo "🔧 Using env file: $ENV_FILE"

# Verify env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: $ENV_FILE not found in $DEPLOY_DIR"
  exit 1
fi

# Load env to get IMAGE_TAG for logging
set -a
source "$ENV_FILE"
set +a

echo "🔖 Deploying with IMAGE_TAG: $IMAGE_TAG"

# Step 1: Pull latest images from GHCR
echo "📥 Pulling latest images..."
docker compose \
  -f docker-compose.prod.yml \
  --project-directory "$DEPLOY_DIR" \
  --env-file "$ENV_FILE" \
  pull backend frontend srs

sleep 2

# Step 2: Restart all services (will recreate if image changed)
echo "🚀 Starting services..."
docker compose \
  -f docker-compose.prod.yml \
  --project-directory "$DEPLOY_DIR" \
  --env-file "$ENV_FILE" \
  up -d --no-build

sleep 3

echo "✅ Deployment complete"
echo ""
echo "🔍 Verifying deployed services..."

# Get container IDs dynamically (works regardless of project name)
docker compose \
  -f docker-compose.prod.yml \
  --project-directory "$DEPLOY_DIR" \
  --env-file "$ENV_FILE" \
  ps

echo ""
echo "🔐 Checking backend service health..."
docker compose \
  -f docker-compose.prod.yml \
  --project-directory "$DEPLOY_DIR" \
  --env-file "$ENV_FILE" \
  exec -T backend wget -qO- http://localhost:3001/api/health/live 2>/dev/null && \
  echo "✅ Backend healthy" || echo "⚠️ Backend health check pending"
