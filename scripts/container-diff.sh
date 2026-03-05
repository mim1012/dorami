#!/bin/bash
# Container Diff Checker - Staging vs Production
# Compares critical container state between staging and production
# Usage: bash scripts/container-diff.sh staging.server prod.server
# Exit code: 0 if all match, 1 if differences found

set -e

STAGING_HOST="${1:-}"
PROD_HOST="${2:-}"
STAGING_USER="${3:-ubuntu}"
PROD_USER="${4:-ubuntu}"

if [ -z "$STAGING_HOST" ] || [ -z "$PROD_HOST" ]; then
  echo "❌ Usage: bash scripts/container-diff.sh <staging_host> <prod_host> [staging_user] [prod_user]"
  echo "   Example: bash scripts/container-diff.sh staging.doremi-live.com prod.example.com"
  exit 1
fi

echo "🔍 Container Diff Checker"
echo "   Staging: $STAGING_HOST"
echo "   Production: $PROD_HOST"
echo ""

TEMP_DIR="/tmp/container-diff-$$"
mkdir -p "$TEMP_DIR"
trap "rm -rf $TEMP_DIR" EXIT

CRITICAL_CONTAINERS=(
  "dorami-backend"
  "dorami-frontend"
  "dorami-postgres-prod"
  "dorami-redis-prod"
  "dorami-nginx-prod"
  "dorami-srs-prod"
)

echo "=== 1️⃣ IMAGE DIGEST (이미지 버전) ==="
ERROR=false

for container in "${CRITICAL_CONTAINERS[@]}"; do
  echo -n "$container: "

  STAGING_IMG=$(ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$STAGING_USER@$STAGING_HOST" \
    "docker inspect $container 2>/dev/null | jq -r '.[0].Image' 2>/dev/null || echo 'NOT_FOUND'" 2>/dev/null || echo "SSH_ERROR")

  PROD_IMG=$(ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$PROD_USER@$PROD_HOST" \
    "docker inspect $container 2>/dev/null | jq -r '.[0].Image' 2>/dev/null || echo 'NOT_FOUND'" 2>/dev/null || echo "SSH_ERROR")

  if [ "$STAGING_IMG" = "NOT_FOUND" ] || [ "$PROD_IMG" = "NOT_FOUND" ]; then
    echo "⚠️  컨테이너 없음"
    continue
  fi

  if [ "$STAGING_IMG" = "$PROD_IMG" ]; then
    echo "✅"
  else
    echo "❌"
    echo "   Staging: $STAGING_IMG"
    echo "   Prod:    $PROD_IMG"
    ERROR=true
  fi
done

echo ""
echo "=== 2️⃣ VOLUME MOUNTS (데이터 저장소) ==="

for container in "dorami-postgres-prod" "dorami-redis-prod"; do
  echo -n "$container: "

  STAGING_VOLS=$(ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$STAGING_USER@$STAGING_HOST" \
    "docker inspect $container 2>/dev/null | jq -r '.[0].Mounts[].Name // empty' 2>/dev/null | sort" 2>/dev/null || echo "")

  PROD_VOLS=$(ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$PROD_USER@$PROD_HOST" \
    "docker inspect $container 2>/dev/null | jq -r '.[0].Mounts[].Name // empty' 2>/dev/null | sort" 2>/dev/null || echo "")

  if [ -z "$STAGING_VOLS" ] || [ -z "$PROD_VOLS" ]; then
    echo "⚠️  볼륨 정보 없음"
    continue
  fi

  echo "$STAGING_VOLS" > "$TEMP_DIR/staging_vols"
  echo "$PROD_VOLS" > "$TEMP_DIR/prod_vols"

  if diff -q "$TEMP_DIR/staging_vols" "$TEMP_DIR/prod_vols" > /dev/null 2>&1; then
    echo "✅"
  else
    echo "❌"
    ERROR=true
  fi
done

echo ""
echo "=== 3️⃣ NETWORK PORTS (포트 바인딩) ==="

for container in "dorami-nginx-prod" "dorami-backend" "dorami-srs-prod"; do
  echo -n "$container: "

  STAGING_PORTS=$(ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$STAGING_USER@$STAGING_HOST" \
    "docker inspect $container 2>/dev/null | jq -r '.[] | .NetworkSettings.Ports | keys[]' 2>/dev/null | sort" 2>/dev/null || echo "")

  PROD_PORTS=$(ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$PROD_USER@$PROD_HOST" \
    "docker inspect $container 2>/dev/null | jq -r '.[] | .NetworkSettings.Ports | keys[]' 2>/dev/null | sort" 2>/dev/null || echo "")

  echo "$STAGING_PORTS" > "$TEMP_DIR/staging_ports"
  echo "$PROD_PORTS" > "$TEMP_DIR/prod_ports"

  if diff -q "$TEMP_DIR/staging_ports" "$TEMP_DIR/prod_ports" > /dev/null 2>&1; then
    echo "✅"
  else
    echo "❌"
    ERROR=true
  fi
done

echo ""
echo "=== 4️⃣ MEMORY LIMITS (메모리 제한) ==="

for container in "dorami-backend" "dorami-postgres-prod" "dorami-redis-prod"; do
  echo -n "$container: "

  STAGING_MEM=$(ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$STAGING_USER@$STAGING_HOST" \
    "docker inspect $container 2>/dev/null | jq -r '.[0].HostConfig.Memory' 2>/dev/null" 2>/dev/null || echo "0")

  PROD_MEM=$(ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$PROD_USER@$PROD_HOST" \
    "docker inspect $container 2>/dev/null | jq -r '.[0].HostConfig.Memory' 2>/dev/null" 2>/dev/null || echo "0")

  if [ "$STAGING_MEM" = "$PROD_MEM" ] && [ "$STAGING_MEM" != "0" ]; then
    echo "✅"
  else
    echo "❌"
    ERROR=true
  fi
done

echo ""
echo "=========================================="
if [ "$ERROR" = false ]; then
  echo "✅모든 컨테이너 상태 동일!"
  echo "   Staging = Production 배포 안전 ✓"
  exit 0
else
  echo "❌ 컨테이너 상태 불일치!"
  echo "   배포 전 차이점 확인 필요"
  exit 1
fi
