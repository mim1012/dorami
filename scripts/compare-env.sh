#!/bin/bash
# Environment Variable Structure Comparison Script
# Compares environment variables between staging and production docker-compose files
# Usage: bash scripts/compare-env.sh
# Exit code: 0 if structures match, 1 if differences found

echo "🔍 Comparing environment variable structures between Staging and Production..."
echo ""

# Simple extraction: find all UPPERCASE_WITH_UNDERSCORES: patterns in the backend sections
echo "=== Extracting Staging backend environment variables ==="
STAGING_VARS=$(grep -A 200 'backend:' docker-compose.staging.yml | grep -B 200 'depends_on:' | grep '^      [A-Z_]*:' | awk '{print $1}' | sed 's/:$//' | sort | uniq)
STAGING_COUNT=$(echo "$STAGING_VARS" | grep -c . || true)
echo "Staging backend environment variables ($STAGING_COUNT):"
echo "$STAGING_VARS" | sed 's/^/  - /'

echo ""
echo "=== Extracting Production backend environment variables ==="
PROD_VARS=$(grep -A 200 'backend:' docker-compose.prod.yml | grep -B 200 'depends_on:' | grep '^      [A-Z_]*:' | awk '{print $1}' | sed 's/:$//' | sort | uniq)
PROD_COUNT=$(echo "$PROD_VARS" | grep -c . || true)
echo "Production backend environment variables ($PROD_COUNT):"
echo "$PROD_VARS" | sed 's/^/  - /'

echo ""
echo "=== Comparing structures ==="

# Check for differences
STAGING_ONLY=$(comm -23 <(echo "$STAGING_VARS") <(echo "$PROD_VARS"))
PROD_ONLY=$(comm -13 <(echo "$STAGING_VARS") <(echo "$PROD_VARS"))

ERROR=false

if [ -n "$STAGING_ONLY" ]; then
  echo "❌ Variables in Staging but NOT in Production:"
  echo "$STAGING_ONLY" | sed 's/^/   - /'
  ERROR=true
fi

if [ -n "$PROD_ONLY" ]; then
  echo "❌ Variables in Production but NOT in Staging:"
  echo "$PROD_ONLY" | sed 's/^/   - /'
  ERROR=true
fi

if [ "$ERROR" = "false" ]; then
  echo "✅ All environment variables match between Staging and Production!"
  echo ""
  echo "Total variables: ${STAGING_COUNT}"
  exit 0
else
  echo ""
  echo "⚠️  Environment variable structure MISMATCH detected!"
  echo "Staging and Production must have identical environment variable structures."
  exit 1
fi
