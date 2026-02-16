#!/bin/sh
set -e

# Replace __NEXT_PUBLIC_*__ placeholders in built JS files with runtime environment variables
find /app/client-app/.next -name "*.js" -type f | while read file; do
  if grep -q '__NEXT_PUBLIC_' "$file" 2>/dev/null; then
    sed -i \
      -e "s|__NEXT_PUBLIC_API_URL__|${NEXT_PUBLIC_API_URL:-/api}|g" \
      -e "s|__NEXT_PUBLIC_WS_URL__|${NEXT_PUBLIC_WS_URL:-}|g" \
      -e "s|__NEXT_PUBLIC_CDN_URL__|${NEXT_PUBLIC_CDN_URL:-}|g" \
      -e "s|__NEXT_PUBLIC_ENABLE_DEV_AUTH__|${NEXT_PUBLIC_ENABLE_DEV_AUTH:-false}|g" \
      -e "s|__NEXT_PUBLIC_PREVIEW_ENABLED__|${NEXT_PUBLIC_PREVIEW_ENABLED:-false}|g" \
      -e "s|__NEXT_PUBLIC_VAPID_PUBLIC_KEY__|${NEXT_PUBLIC_VAPID_PUBLIC_KEY:-}|g" \
      -e "s|__NEXT_PUBLIC_KAKAO_JS_KEY__|${NEXT_PUBLIC_KAKAO_JS_KEY:-}|g" \
      -e "s|__NEXT_PUBLIC_SENTRY_DSN__|${NEXT_PUBLIC_SENTRY_DSN:-}|g" \
      -e "s|__NEXT_PUBLIC_APP_VERSION__|${NEXT_PUBLIC_APP_VERSION:-1.0.0}|g" \
      -e "s|__NEXT_PUBLIC_APP_ENV__|${NEXT_PUBLIC_APP_ENV:-production}|g" \
      "$file"
  fi
done

exec "$@"
