#!/bin/bash
# 24시간 안정화 모니터링 스크립트
# Production & Staging 서버 상태 실시간 확인

set -e

PROD_HOST="doremi-live.com"
PROD_KEY="$HOME/.ssh/doremi-production-key.pem"
STAGING_HOST="54.180.94.30"
STAGING_KEY="$HOME/.ssh/id_ed25519"

echo "==============================================="
echo "🔍 Doremi Stability Monitoring (24h Check)"
echo "==============================================="
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ===== PRODUCTION CHECKS =====
echo "📍 PRODUCTION (https://www.doremi-live.com)"
echo "───────────────────────────────────────────────"

echo "1️⃣ Container Status:"
ssh -i "$PROD_KEY" ubuntu@$PROD_HOST "docker ps --format 'table {{.Names}}\t{{.Status}}'" 2>/dev/null | grep -E "(nginx|backend|frontend|postgres|redis|srs)" || echo "  ⚠️  SSH connection issue"

echo ""
echo "2️⃣ Docker Stats (CPU/RAM):"
ssh -i "$PROD_KEY" ubuntu@$PROD_HOST "docker stats --no-stream --format 'table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}'" 2>/dev/null | head -8 || echo "  ⚠️  Cannot fetch stats"

echo ""
echo "3️⃣ Nginx Error Check (last 5 errors):"
ssh -i "$PROD_KEY" ubuntu@$PROD_HOST "docker compose -f docker-compose.prod.yml logs nginx 2>&1 | grep -E '\[emerg\]|\[crit\]|\[error\]' | tail -5 || echo '  ✓ No errors'" 2>/dev/null

echo ""
echo "4️⃣ Backend Error Check (last 5 errors):"
ssh -i "$PROD_KEY" ubuntu@$PROD_HOST "docker compose -f docker-compose.prod.yml logs backend 2>&1 | grep -iE 'error|exception|failed' | tail -5 || echo '  ✓ No errors'" 2>/dev/null

echo ""
echo "5️⃣ Health Check:"
HEALTH=$(curl -s https://www.doremi-live.com/health 2>/dev/null || echo "FAILED")
if [ "$HEALTH" = "healthy" ]; then
  echo "  ✅ Nginx health: $HEALTH"
else
  echo "  ❌ Nginx health: $HEALTH"
fi

echo ""
echo "6️⃣ API Test:"
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://www.doremi-live.com/api/health/ready 2>/dev/null)
if [ "$API_STATUS" = "200" ]; then
  echo "  ✅ Backend API: HTTP $API_STATUS"
else
  echo "  ⚠️  Backend API: HTTP $API_STATUS (expected 200)"
fi

echo ""
echo "7️⃣ WebSocket Test:"
WS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://www.doremi-live.com/socket.io/?transport=websocket" 2>/dev/null)
echo "  WebSocket endpoint: HTTP $WS_STATUS"

echo ""
echo ""

# ===== STAGING CHECKS =====
echo "📍 STAGING (http://staging.doremi-live.com)"
echo "───────────────────────────────────────────────"

echo "1️⃣ Container Status:"
ssh -i "$STAGING_KEY" ubuntu@$STAGING_HOST "docker ps --format 'table {{.Names}}\t{{.Status}}'" 2>/dev/null | grep -E "(nginx|backend|frontend|postgres|redis|srs)" || echo "  ⚠️  SSH connection issue"

echo ""
echo "2️⃣ Docker Stats (CPU/RAM):"
ssh -i "$STAGING_KEY" ubuntu@$STAGING_HOST "docker stats --no-stream --format 'table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}'" 2>/dev/null | head -8 || echo "  ⚠️  Cannot fetch stats"

echo ""
echo "3️⃣ Nginx Error Check (last 5 errors):"
ssh -i "$STAGING_KEY" ubuntu@$STAGING_HOST "docker compose logs nginx 2>&1 | grep -E '\[emerg\]|\[crit\]|\[error\]' | tail -5 || echo '  ✓ No errors'" 2>/dev/null

echo ""
echo "4️⃣ Health Check:"
HEALTH=$(curl -s http://54.180.94.30/health 2>/dev/null || echo "FAILED")
if [ "$HEALTH" = "healthy" ]; then
  echo "  ✅ Nginx health: $HEALTH"
else
  echo "  ⚠️  Nginx health: $HEALTH"
fi

echo ""
echo "==============================================="
echo "✅ Check Complete - $(date '+%Y-%m-%d %H:%M:%S')"
echo "==============================================="


