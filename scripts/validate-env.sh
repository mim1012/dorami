#!/bin/bash
# Environment variable validation script
# Ensures all required vars are set before docker compose execution
# Usage: source scripts/validate-env.sh

set -e

ENV_TYPE="${1:-.env.local}"
REQUIRED_VARS=(
  # Kakao OAuth
  "KAKAO_CLIENT_ID"
  "KAKAO_CLIENT_SECRET"
  "KAKAO_CALLBACK_URL"
  # Database
  "DATABASE_URL"
  # Redis
  "REDIS_URL"
  "REDIS_PASSWORD"
  # JWT
  "JWT_SECRET"
  # Profile encryption
  "PROFILE_ENCRYPTION_KEY"
)

OPTIONAL_VARS=(
  "NEXT_PUBLIC_KAKAO_JS_KEY"
  "SENTRY_DSN"
)

echo "🔍 Validating environment variables..."
echo "Environment file: $ENV_TYPE"
echo ""

MISSING_VARS=()
EMPTY_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  # Check if variable is set
  if [ -z "${!var+x}" ]; then
    MISSING_VARS+=("$var")
  # Check if variable is empty
  elif [ -z "${!var}" ]; then
    EMPTY_VARS+=("$var")
  else
    echo "✅ $var = ${!var:0:20}..."
  fi
done

echo ""

# Report missing variables
if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo "❌ ERROR: Missing required environment variables:"
  for var in "${MISSING_VARS[@]}"; do
    echo "   - $var"
  done
  exit 1
fi

# Report empty variables
if [ ${#EMPTY_VARS[@]} -gt 0 ]; then
  echo "❌ ERROR: Empty required environment variables:"
  for var in "${EMPTY_VARS[@]}"; do
    echo "   - $var"
  done
  exit 1
fi

echo "✅ All required environment variables are set!"
echo ""
echo "⚠️  Optional variables:"
for var in "${OPTIONAL_VARS[@]}"; do
  if [ -z "${!var+x}" ] || [ -z "${!var}" ]; then
    echo "   ⚪ $var (not set)"
  else
    echo "   ✅ $var (set)"
  fi
done

exit 0
