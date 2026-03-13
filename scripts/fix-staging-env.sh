#!/bin/bash
# Fix staging environment variables
# This script ensures critical env vars are set correctly on the staging server

set -e

ENV_FILE="/opt/dorami/.env.staging"

echo "Fixing staging environment variables..."

# Create .env.staging if it doesn't exist (git reset may have deleted it)
if [ ! -f "$ENV_FILE" ]; then
  echo "Creating .env.staging from environment variables..."
  cat > "$ENV_FILE" << 'EOF'
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/live_commerce_staging"
REDIS_URL="redis://redis:6379"
JWT_SECRET="dev-jwt-secret-change-in-production"
PROFILE_ENCRYPTION_KEY="012345678901234567890123456789ab012345678901234567890123456789ab"
KAKAO_CLIENT_ID=""
KAKAO_CLIENT_SECRET=""
KAKAO_CALLBACK_URL=""
ADMIN_EMAILS=""
APP_ENV="staging"
NODE_ENV="production"
PORT="3001"
CORS_ORIGINS="http://staging.doremi-live.com,http://localhost:3000,http://localhost:8080"
CSRF_ENABLED="true"
RTMP_SERVER_URL="rtmp://staging.doremi-live.com/live"
HLS_SERVER_URL="http://staging.doremi-live.com/hls"
MEDIA_SERVER_URL="http://localhost:8080"
ENABLE_DEV_AUTH="false"
LOG_LEVEL="debug"
EOF
  echo "✓ .env.staging created"
fi

# Ensure RTMP_SERVER_URL has explicit port 1935
if [ -f "$ENV_FILE" ]; then
  # Check if RTMP_SERVER_URL exists but without port
  if grep -q "RTMP_SERVER_URL=rtmp://staging.doremi-live.com/live$" "$ENV_FILE"; then
    echo "Updating RTMP_SERVER_URL to include port 1935..."
    sed -i 's|RTMP_SERVER_URL=rtmp://staging\.doremi-live\.com/live|RTMP_SERVER_URL=rtmp://staging.doremi-live.com:1935/live|g' "$ENV_FILE"
    echo "✓ RTMP_SERVER_URL fixed"
  elif grep -q "RTMP_SERVER_URL=rtmp://staging.doremi-live.com:1935/live" "$ENV_FILE"; then
    echo "✓ RTMP_SERVER_URL already correct (has port 1935)"
  else
    echo "⚠ RTMP_SERVER_URL present but in unexpected format"
    grep "RTMP_SERVER_URL" "$ENV_FILE" || true
  fi

  # Ensure ENABLE_DEV_AUTH=true for staging
  if grep -q "ENABLE_DEV_AUTH=" "$ENV_FILE"; then
    if grep -q "ENABLE_DEV_AUTH=true" "$ENV_FILE"; then
      echo "✓ ENABLE_DEV_AUTH already enabled"
    else
      echo "Enabling ENABLE_DEV_AUTH..."
      sed -i 's/ENABLE_DEV_AUTH=.*/ENABLE_DEV_AUTH=true/g' "$ENV_FILE"
      echo "✓ ENABLE_DEV_AUTH enabled"
    fi
  else
    echo "⚠ ENABLE_DEV_AUTH not found in .env.staging"
  fi
else
  echo "ERROR: $ENV_FILE not found"
  exit 1
fi

echo "Environment fixes complete!"
