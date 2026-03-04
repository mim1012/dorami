#!/bin/bash
# Destructive Migration Detector
# Prevents accidental data loss from DROP/TRUNCATE operations in production
# Usage: bash scripts/check-destructive-migrations.sh [migration_path]
# Exit code: 0 if safe, 1 if destructive operations detected

set -e

MIGRATION_PATH="${1:-.}"

echo "🔍 Checking for Destructive SQL Operations..."
echo ""

# Find all migration.sql files
MIGRATION_FILES=$(find "$MIGRATION_PATH" -path "*/prisma/migrations/*/migration.sql" 2>/dev/null)

if [ -z "$MIGRATION_FILES" ]; then
  echo "❌ No migration files found in $MIGRATION_PATH"
  exit 1
fi

# Patterns that are dangerous in production
DANGEROUS_PATTERNS=(
  "DROP TABLE"
  "DROP COLUMN"
  "TRUNCATE"
  "DELETE FROM.*;" # DELETE statements
  "ALTER TABLE.*DROP COLUMN"
)

DANGER_FOUND=false
TOTAL_MIGRATIONS=$(echo "$MIGRATION_FILES" | wc -l)

echo "Found $TOTAL_MIGRATIONS migration files"
echo ""
echo "=== Scanning for Destructive Operations ==="
echo ""

while IFS= read -r migration_file; do
  for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if grep -q -i "$pattern" "$migration_file"; then
      echo "❌ DESTRUCTIVE OPERATION DETECTED:"
      echo "   File: $migration_file"
      echo "   Pattern: $pattern"
      echo ""
      
      # Show the dangerous lines
      echo "   Dangerous SQL:"
      grep -n -i "$pattern" "$migration_file" | sed 's/^/      Line /'
      echo ""
      
      DANGER_FOUND=true
    fi
  done
done <<< "$MIGRATION_FILES"

echo "=========================================="
echo ""

if [ "$DANGER_FOUND" = true ]; then
  echo "❌ DESTRUCTIVE OPERATIONS DETECTED!"
  echo ""
  echo "⚠️  DO NOT DEPLOY TO PRODUCTION"
  echo ""
  echo "Actions required:"
  echo "1. Review the destructive SQL above"
  echo "2. Confirm this is intentional and necessary"
  echo "3. Backup production database first"
  echo "4. Get approval from team lead"
  echo "5. Deploy with caution"
  echo ""
  echo "Command to force deploy (if intentional):"
  echo "  export SKIP_DESTRUCTIVE_CHECK=true"
  echo "  npx prisma migrate deploy"
  exit 1
else
  echo "✅ All migrations are safe (no DROP/TRUNCATE operations)"
  echo ""
  echo "Safe to deploy to production ✓"
  exit 0
fi
