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

# Deploy with explicit env file passed to docker compose
docker compose \
  -f docker-compose.prod.yml \
  --project-directory "$DEPLOY_DIR" \
  --env-file "$ENV_FILE" \
  restart backend

sleep 3

echo "✅ Deployment complete"
echo "🔍 Verifying PROFILE_LEGACY_ENCRYPTION_KEYS:"
docker exec dorami-backend-1 env | grep PROFILE || echo "⚠️ Not found"
