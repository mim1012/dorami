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

# Deploy backend with explicit env file passed to docker compose
echo "⏳ Restarting backend..."
docker compose \
  -f docker-compose.prod.yml \
  --project-directory "$DEPLOY_DIR" \
  --env-file "$ENV_FILE" \
  restart backend

sleep 3

# Deploy frontend
echo "⏳ Restarting frontend..."
docker compose \
  -f docker-compose.prod.yml \
  --project-directory "$DEPLOY_DIR" \
  restart frontend

sleep 3

echo "✅ Deployment complete"
echo ""
echo "🔍 Verifying deployed images..."

# Verify backend image using docker inspect
BACKEND_IMAGE=$(docker inspect dorami-backend-1 --format='{{.Config.Image}}' 2>/dev/null || echo "NOT_FOUND")
if [[ "$BACKEND_IMAGE" == *"sha-"* ]]; then
  echo "✅ Backend: $BACKEND_IMAGE"
else
  echo "⚠️ Backend image not found or not immutable (expected sha- tag)"
fi

# Verify frontend image using docker inspect
FRONTEND_IMAGE=$(docker inspect dorami-frontend-prod --format='{{.Config.Image}}' 2>/dev/null || echo "NOT_FOUND")
if [[ "$FRONTEND_IMAGE" == *"sha-"* ]]; then
  echo "✅ Frontend: $FRONTEND_IMAGE"
else
  echo "⚠️ Frontend image not found or not immutable (expected sha- tag)"
fi

# Verify environment variables in backend
echo ""
echo "🔐 Checking backend encryption keys..."
docker exec dorami-backend-1 env | grep PROFILE || echo "⚠️ PROFILE keys not found"
