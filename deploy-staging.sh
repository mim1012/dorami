#!/bin/bash
# Dorami Staging Deployment Script
# Ensures consistent environment setup and database initialization

set -e

STAGING_HOST="staging.doremi-live.com"
SSH_KEY="D:/Project/dorami/dorami-staging.pem"
DEPLOY_DIR="/opt/dorami"

echo "🚀 Starting Dorami Staging Deployment..."

# Step 1: Pull latest code
echo "📥 Pulling latest develop branch..."
ssh -i "$SSH_KEY" ubuntu@$STAGING_HOST "cd $DEPLOY_DIR && git pull origin develop"

# Step 2: Stop containers (preserving data)
echo "🛑 Stopping containers (preserving data)..."
ssh -i "$SSH_KEY" ubuntu@$STAGING_HOST "cd $DEPLOY_DIR && \
  docker-compose -f docker-compose.base.yml -f docker-compose.staging.yml down 2>/dev/null || true"

# Step 3: Start services with env file
echo "🚀 Starting services with environment file..."
ssh -i "$SSH_KEY" ubuntu@$STAGING_HOST "cd $DEPLOY_DIR && \
  docker-compose --env-file .env.staging -f docker-compose.base.yml -f docker-compose.staging.yml up -d"

# Step 4: Wait for database
echo "⏳ Waiting for database to be healthy..."
ssh -i "$SSH_KEY" ubuntu@$STAGING_HOST "sleep 10"

# Step 5: Run migrations
echo "🔄 Running database migrations..."
ssh -i "$SSH_KEY" ubuntu@$STAGING_HOST "docker exec dorami-backend-1 npx prisma migrate deploy --schema prisma/schema.prisma"

# Step 6: Seed database
echo "🌱 Seeding database..."
ssh -i "$SSH_KEY" ubuntu@$STAGING_HOST "docker exec dorami-backend-1 sh -c 'cd /app && npx tsc prisma/seed.ts --module commonjs --target es2020 --esModuleInterop --skipLibCheck && node prisma/seed.js'"

# Step 7: Verify
echo "✅ Verifying deployment..."
ssh -i "$SSH_KEY" ubuntu@$STAGING_HOST "docker exec dorami-postgres-1 psql -U dorami -d live_commerce -c 'SELECT COUNT(*) as product_count FROM products;'"

echo "🎉 Deployment completed successfully!"
