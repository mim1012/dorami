#!/bin/bash
# Phase 3: Combined Load Test (HLS + WebSocket + API)
# 30분 복합 부하 테스트
#
# Usage:
#   bash scripts/load-test-combined.sh [staging_url] [stream_key]
#
# Example:
#   bash scripts/load-test-combined.sh https://staging.doremi-live.com smoke-check

set -e

STAGING_URL="${1:?Staging URL required (e.g., https://staging.doremi-live.com)}"
STREAM_KEY="${2:?Stream key required (e.g., smoke-check)}"
DURATION=1800  # 30 minutes
LOG_DIR="/tmp/load-test-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$LOG_DIR"

echo "
╔════════════════════════════════════════════════════════╗
║     Combined Load Test (Phase 3) - 30 minutes          ║
╚════════════════════════════════════════════════════════╝

📊 Configuration:
  URL: $STAGING_URL
  Stream: $STREAM_KEY
  Duration: ${DURATION}s (30 min)
  Log Dir: $LOG_DIR

📈 Load Profile:
  1. HLS: 300 concurrent (5 Mbps total)
  2. WebSocket: 300 concurrent (60 msg/s)
  3. API: 5 concurrent requests (10 msg/s)
  4. Background: Chat history, product updates

🚀 Starting test in 5 seconds...
"

sleep 5

# ============================================================================
# Start HLS load (background)
# ============================================================================
start_hls_load() {
  echo "[HLS] Starting 300 concurrent HLS streams..."

  for i in {1..6}; do
    concurrency=$((50 * i))
    (
      ab -c $concurrency -t $DURATION \
        "$STAGING_URL/hls/${STREAM_KEY}.m3u8" \
        > "$LOG_DIR/hls-phase-$concurrency.log" 2>&1
    ) &

    sleep 5  # Stagger phases
  done
}

# ============================================================================
# Start WebSocket load (background)
# ============================================================================
start_websocket_load() {
  echo "[WebSocket] Starting 300 concurrent WebSocket connections..."

  timeout $DURATION \
    node scripts/load-test-websocket.mjs \
    "$STAGING_URL" \
    "$STREAM_KEY" \
    $DURATION \
    > "$LOG_DIR/websocket.log" 2>&1 &
}

# ============================================================================
# Start API load (background)
# ============================================================================
start_api_load() {
  echo "[API] Starting API load (5 concurrent)..."

  # Dev login to get cookie
  COOKIE=$(curl -s -X POST "$STAGING_URL/api/auth/dev-login" \
    -H "Content-Type: application/json" \
    -d '{"email":"load-test@example.com","name":"LoadTest"}' \
    -c /tmp/load-test-cookies.txt \
    -o /dev/null && echo "cookies")

  local elapsed=0
  while [ $elapsed -lt $DURATION ]; do
    # Random API calls
    api_call=$(($RANDOM % 5))

    case $api_call in
      0)
        # Get products
        curl -s "$STAGING_URL/api/products?limit=20" \
          -b /tmp/load-test-cookies.txt \
          >> "$LOG_DIR/api-get-products.log" 2>&1 &
        ;;
      1)
        # Get cart
        curl -s "$STAGING_URL/api/cart" \
          -b /tmp/load-test-cookies.txt \
          >> "$LOG_DIR/api-get-cart.log" 2>&1 &
        ;;
      2)
        # Get notifications
        curl -s "$STAGING_URL/api/notifications" \
          -b /tmp/load-test-cookies.txt \
          >> "$LOG_DIR/api-get-notifications.log" 2>&1 &
        ;;
      3)
        # Get user profile
        curl -s "$STAGING_URL/api/users/me" \
          -b /tmp/load-test-cookies.txt \
          >> "$LOG_DIR/api-get-profile.log" 2>&1 &
        ;;
      4)
        # Get streaming status
        curl -s "$STAGING_URL/api/streaming/$STREAM_KEY" \
          >> "$LOG_DIR/api-get-streaming.log" 2>&1 &
        ;;
    esac

    sleep 1
    elapsed=$((elapsed + 1))
  done

  rm -f /tmp/load-test-cookies.txt
}

# ============================================================================
# Monitoring (background)
# ============================================================================
start_monitoring() {
  echo "[Monitor] Starting metrics collection..."

  local start_time=$(date +%s)
  while true; do
    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))

    if [ $elapsed -ge $DURATION ]; then
      break
    fi

    # Docker stats
    {
      echo "=== [$(date)] Docker Stats ==="
      docker compose -f docker-compose.base.yml -f docker-compose.staging.yml stats --no-stream 2>/dev/null || true
    } >> "$LOG_DIR/metrics-docker-stats.log" 2>&1

    # Nginx connections
    {
      echo "=== [$(date)] Nginx Connections ==="
      docker compose -f docker-compose.base.yml -f docker-compose.staging.yml exec nginx \
        sh -c 'netstat -an | grep ESTABLISHED | wc -l' 2>/dev/null || echo "0"
    } >> "$LOG_DIR/metrics-nginx-connections.log" 2>&1

    # Redis memory
    {
      echo "=== [$(date)] Redis Memory ==="
      docker compose -f docker-compose.base.yml -f docker-compose.staging.yml exec redis \
        redis-cli INFO memory | grep used_memory_human 2>/dev/null || echo "N/A"
    } >> "$LOG_DIR/metrics-redis-memory.log" 2>&1

    # Database connections
    {
      echo "=== [$(date)] DB Connections ==="
      docker compose -f docker-compose.base.yml -f docker-compose.staging.yml exec postgres \
        psql -U postgres -d live_commerce \
        -c "SELECT count(*) as active_connections FROM pg_stat_activity;" 2>/dev/null || echo "N/A"
    } >> "$LOG_DIR/metrics-db-connections.log" 2>&1

    # Nginx errors
    {
      echo "=== [$(date)] Nginx 5xx Errors ==="
      docker compose -f docker-compose.base.yml -f docker-compose.staging.yml logs nginx 2>/dev/null | \
        grep -c " 5[0-9]{2}" || echo "0"
    } >> "$LOG_DIR/metrics-nginx-errors.log" 2>&1

    sleep 30
  done
}

# ============================================================================
# Main execution
# ============================================================================

# Start all load generators
start_hls_load &
HLS_PID=$!

start_websocket_load &
WS_PID=$!

start_api_load &
API_PID=$!

start_monitoring &
MONITOR_PID=$!

echo "
✅ All load generators started
  HLS: PID=$HLS_PID
  WebSocket: PID=$WS_PID
  API: PID=$API_PID
  Monitor: PID=$MONITOR_PID

📊 Monitoring metrics in: $LOG_DIR

🎯 Test running for ${DURATION}s (30 min)...
"

# Wait for duration
sleep $DURATION

# Stop all processes
echo "
⏹️  Stopping all processes...
"
kill $HLS_PID $WS_PID $API_PID $MONITOR_PID 2>/dev/null || true
sleep 2
killall ab curl node 2>/dev/null || true

# ============================================================================
# Generate summary report
# ============================================================================

echo "
╔════════════════════════════════════════════════════════╗
║              COMBINED TEST SUMMARY                     ║
╚════════════════════════════════════════════════════════╝

📊 Results saved to: $LOG_DIR

📈 Key Metrics:

1️⃣  HLS (300 concurrent):
  Logs: ls -lh $LOG_DIR/hls-*.log
  Analysis: grep 'Failed requests' $LOG_DIR/hls-*.log

2️⃣  WebSocket (300 concurrent):
  Logs: $LOG_DIR/websocket.log
  Analysis: tail -50 $LOG_DIR/websocket.log

3️⃣  API (background):
  Logs: ls -lh $LOG_DIR/api-*.log
  Analysis: wc -l $LOG_DIR/api-*.log

4️⃣  System Metrics:
  Docker Stats: tail -100 $LOG_DIR/metrics-docker-stats.log
  Nginx Connections: tail -30 $LOG_DIR/metrics-nginx-connections.log
  Redis Memory: tail -30 $LOG_DIR/metrics-redis-memory.log
  DB Connections: tail -30 $LOG_DIR/metrics-db-connections.log
  Nginx Errors: tail -30 $LOG_DIR/metrics-nginx-errors.log

🔧 Analysis Commands:

  # HLS success rate
  for f in $LOG_DIR/hls-*.log; do
    echo \"\$f:\"
    grep 'Requests per second' \"\$f\"
  done

  # WebSocket latency
  grep 'msg/s' $LOG_DIR/websocket.log

  # Total API requests
  find $LOG_DIR -name 'api-*.log' -exec wc -l {} +

  # Peak Redis memory
  grep 'used_memory_human' $LOG_DIR/metrics-redis-memory.log | tail -1

  # Max DB connections
  grep 'active_connections' $LOG_DIR/metrics-db-connections.log | sed 's/.*| //' | sort -n | tail -1

🎯 Success Criteria:

  □ HLS 5xx error rate < 0.1%
  □ WebSocket success rate > 95%
  □ API response time < 2000ms
  □ Nginx errors < 10 total
  □ Redis memory peak < 1GB
  □ DB connections peak < 80

Generated: $(date)
"
