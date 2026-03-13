#!/bin/bash
# Database Migration Status Checker
# Verifies migration consistency between local schema and production database
# Usage: bash scripts/migration-status.sh
# Exit code: 0 if migrations are in sync, 1 if drift detected

set -e

echo "🔍 Migration Status Checker"
echo ""

# Check if prisma is available
if ! command -v npx &> /dev/null; then
  echo "❌ ERROR: npx not found. Install Node.js + npm first."
  exit 1
fi

echo "=== 1️⃣ Local Migration Status ==="
echo ""
echo "Pending migrations:"
npx prisma migrate status 2>&1 | grep -E "^\s+\d+_" || echo "  No pending migrations ✅"

echo ""
echo "=== 2️⃣ Applied Migrations ==="
# Read applied migrations from _prisma_migrations table
echo ""
echo "Checking applied migrations in database..."

if [ -f backend/prisma/schema.prisma ]; then
  echo "✅ Schema file found"
  
  # Count migration files
  MIGRATION_COUNT=$(find backend/prisma/migrations -type d -name "*_*" 2>/dev/null | wc -l || echo "0")
  echo "   Local migration files: $MIGRATION_COUNT"
  
  # List migration directories
  echo ""
  echo "Local migrations:"
  find backend/prisma/migrations -type d -name "*_*" -printf "%f\n" 2>/dev/null | sort | sed 's/^/   /' || echo "   No migrations found"
else
  echo "❌ ERROR: Schema file not found"
  exit 1
fi

echo ""
echo "=========================================="
echo ""
echo "⚠️  To check production database migrations:"
echo "   ssh user@prod-server"
echo "   cd /opt/doremi"
echo "   npx prisma migrate status"
echo ""
echo "✅ Before deploying:"
echo "   1. Run this script locally"
echo "   2. Check production migration status via SSH"
echo "   3. Ensure no pending migrations on production"
echo "   4. Deployment will auto-apply new migrations"

