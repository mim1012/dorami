#!/bin/bash
# Dorami Staging Deployment Script
# Run this on the staging server at /opt/dorami
# Usage: ssh ubuntu@staging.doremi-live.com "cd /opt/dorami && bash deploy-staging.sh"

set -e

DEPLOY_DIR="/opt/dorami"

echo "🚀 Starting Dorami Staging Deployment..."

# Step 1: Pull latest code
echo "📥 Pulling latest develop branch..."
cd $DEPLOY_DIR && git pull origin develop

# Step 2: Stop containers (preserving data)
echo "🛑 Stopping containers (preserving data)..."
docker-compose -f docker-compose.base.yml -f docker-compose.staging.yml down 2>/dev/null || true

# Step 3: Start services with env file
echo "🚀 Starting services with environment file..."
docker-compose --env-file .env.staging -f docker-compose.base.yml -f docker-compose.staging.yml up -d

# Step 4: Wait for database
echo "⏳ Waiting for database to be healthy..."
sleep 10

# Step 5: Run migrations
echo "🔄 Running database migrations..."
docker exec dorami-backend-1 npx prisma migrate deploy --schema prisma/schema.prisma

# Step 6: Seed database (only on first setup)
# Skip seeding on staging to preserve admin-created products
# echo "🌱 Seeding database..."
# docker exec dorami-backend-1 sh -c 'cd /app && npx tsc prisma/seed.ts --module commonjs --target es2020 --esModuleInterop --skipLibCheck && node prisma/seed.js'
echo "⏭️ Seed skipped (preserving existing products)"

# Step 7: Verify
echo "✅ Verifying deployment..."
docker exec dorami-postgres-1 psql -U dorami -d live_commerce -c 'SELECT COUNT(*) as product_count FROM products;'

echo "🎉 Deployment completed successfully!"
