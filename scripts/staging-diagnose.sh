#!/usr/bin/env bash
# =============================================================================
# staging-diagnose.sh — Diagnose and fix staging environment issues
#
# Checks Docker network, DNS resolution, container health, and connectivity
# for all staging services (postgres, redis, backend, frontend, nginx, srs).
#
# Usage:
#   SSH into staging server, then:
#     bash scripts/staging-diagnose.sh [--fix]
#
# Options:
#   --fix    Attempt automatic fixes (recreate network, restart containers)
#   --help   Show this help
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
PROJECT_DIR="${PROJECT_DIR:-/opt/dorami}"
COMPOSE_CMD="docker compose -f ${PROJECT_DIR}/docker-compose.base.yml -f ${PROJECT_DIR}/docker-compose.staging.yml"
ENV_FILE="${PROJECT_DIR}/.env.staging"
NETWORK_NAME="dorami-internal"
AUTO_FIX=false

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

pass()   { echo -e "  ${GREEN}[PASS]${RESET} $*"; }
fail()   { echo -e "  ${RED}[FAIL]${RESET} $*"; }
warn()   { echo -e "  ${YELLOW}[WARN]${RESET} $*"; }
info()   { echo -e "  ${CYAN}[INFO]${RESET} $*"; }
header() { echo -e "\n${BOLD}${CYAN}=== $* ===${RESET}"; }

ERRORS=0
WARNINGS=0

record_fail() { ERRORS=$((ERRORS + 1)); }
record_warn() { WARNINGS=$((WARNINGS + 1)); }

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --fix) AUTO_FIX=true; shift ;;
    --help|-h)
      grep '^#' "$0" | grep -v '^#!/' | sed 's/^# //' | sed 's/^#//'
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# 1. Environment File
# ---------------------------------------------------------------------------
header "1. Environment File"

if [[ -f "$ENV_FILE" ]]; then
  pass ".env.staging exists"
else
  fail ".env.staging not found at $ENV_FILE"
  record_fail
  echo "Cannot continue without environment file."
  exit 1
fi

# Check critical env vars
for var in POSTGRES_PASSWORD REDIS_PASSWORD JWT_SECRET KAKAO_CLIENT_ID KAKAO_CLIENT_SECRET KAKAO_CALLBACK_URL; do
  val=$(grep "^${var}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-)
  if [[ -z "$val" ]]; then
    fail "Missing: $var"
    record_fail
  elif [[ "$val" == *"CHANGE_ME"* ]] || [[ "$val" == *"your_"* ]]; then
    warn "Placeholder value: $var"
    record_warn
  else
    pass "$var is set"
  fi
done

# Check ENABLE_DEV_AUTH
dev_auth=$(grep "^ENABLE_DEV_AUTH=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-)
if [[ "$dev_auth" == "true" ]]; then
  pass "ENABLE_DEV_AUTH=true (dev login enabled)"
else
  warn "ENABLE_DEV_AUTH=$dev_auth (dev login may be disabled)"
  record_warn
fi

# ---------------------------------------------------------------------------
# 2. Docker Daemon
# ---------------------------------------------------------------------------
header "2. Docker Daemon"

if docker info > /dev/null 2>&1; then
  pass "Docker daemon is running"
else
  fail "Docker daemon is not running"
  record_fail
  exit 1
fi

# ---------------------------------------------------------------------------
# 3. Docker Network
# ---------------------------------------------------------------------------
header "3. Docker Network ($NETWORK_NAME)"

if docker network inspect "$NETWORK_NAME" > /dev/null 2>&1; then
  pass "Network $NETWORK_NAME exists"

  # Check connected containers
  CONNECTED=$(docker network inspect "$NETWORK_NAME" --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null || echo "")
  if [[ -n "$CONNECTED" ]]; then
    info "Connected containers: $CONNECTED"
  else
    warn "No containers connected to $NETWORK_NAME"
    record_warn
  fi

  # Check network driver
  DRIVER=$(docker network inspect "$NETWORK_NAME" --format '{{.Driver}}' 2>/dev/null || echo "unknown")
  if [[ "$DRIVER" == "bridge" ]]; then
    pass "Network driver: bridge"
  else
    warn "Network driver: $DRIVER (expected bridge)"
    record_warn
  fi

  # Check DNS resolution inside network
  info "Testing DNS resolution inside Docker network..."
  for svc in postgres redis backend frontend srs; do
    DNS_RESULT=$(docker run --rm --network "$NETWORK_NAME" busybox:latest nslookup "$svc" 2>&1 || echo "FAIL")
    if echo "$DNS_RESULT" | grep -q "Address" && ! echo "$DNS_RESULT" | grep -q "NXDOMAIN"; then
      pass "DNS resolves: $svc"
    else
      fail "DNS fails for: $svc"
      record_fail
    fi
  done
else
  fail "Network $NETWORK_NAME does not exist"
  record_fail

  if [[ "$AUTO_FIX" == true ]]; then
    info "Creating network $NETWORK_NAME..."
    docker network create --driver bridge "$NETWORK_NAME"
    pass "Network created"
  fi
fi

# ---------------------------------------------------------------------------
# 4. Container Status
# ---------------------------------------------------------------------------
header "4. Container Status"

SERVICES="postgres redis backend frontend nginx srs"

for svc in $SERVICES; do
  # Find container by compose service name
  CONTAINER=$(docker compose -f "${PROJECT_DIR}/docker-compose.base.yml" -f "${PROJECT_DIR}/docker-compose.staging.yml" ps -q "$svc" 2>/dev/null || echo "")

  if [[ -z "$CONTAINER" ]]; then
    fail "$svc: not running (no container found)"
    record_fail
    continue
  fi

  STATUS=$(docker inspect --format '{{.State.Status}}' "$CONTAINER" 2>/dev/null || echo "unknown")
  HEALTH=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$CONTAINER" 2>/dev/null || echo "unknown")
  RESTARTS=$(docker inspect --format '{{.RestartCount}}' "$CONTAINER" 2>/dev/null || echo "?")

  if [[ "$STATUS" == "running" ]]; then
    if [[ "$HEALTH" == "healthy" ]]; then
      pass "$svc: running, healthy (restarts: $RESTARTS)"
    elif [[ "$HEALTH" == "unhealthy" ]]; then
      fail "$svc: running but UNHEALTHY (restarts: $RESTARTS)"
      record_fail
      # Show last health check log
      info "Last health check output:"
      docker inspect --format '{{range .State.Health.Log}}{{.Output}}{{end}}' "$CONTAINER" 2>/dev/null | tail -3
    elif [[ "$HEALTH" == "starting" ]]; then
      warn "$svc: running, health check starting (restarts: $RESTARTS)"
      record_warn
    else
      pass "$svc: running (no healthcheck, restarts: $RESTARTS)"
    fi
  elif [[ "$STATUS" == "restarting" ]]; then
    fail "$svc: restarting loop (restarts: $RESTARTS)"
    record_fail
    info "Last 10 log lines:"
    docker logs --tail=10 "$CONTAINER" 2>&1 | head -10
  elif [[ "$STATUS" == "created" ]]; then
    warn "$svc: created but not started"
    record_warn
  else
    fail "$svc: status=$STATUS (restarts: $RESTARTS)"
    record_fail
  fi
done

# ---------------------------------------------------------------------------
# 5. Port Connectivity
# ---------------------------------------------------------------------------
header "5. Port Connectivity"

check_port() {
  local name="$1" host="$2" port="$3"
  if timeout 3 bash -c "echo > /dev/tcp/$host/$port" 2>/dev/null; then
    pass "$name ($host:$port) is reachable"
  else
    fail "$name ($host:$port) is NOT reachable"
    record_fail
  fi
}

check_port "PostgreSQL" "127.0.0.1" 5432
check_port "Redis"      "127.0.0.1" 6379
check_port "Backend"    "127.0.0.1" 3001
check_port "Frontend"   "127.0.0.1" 3000
check_port "RTMP (SRS)" "0.0.0.0"  1935

# Nginx is on 80/443 which may not be bound to 127.0.0.1
check_port "Nginx HTTP" "0.0.0.0" 80

# ---------------------------------------------------------------------------
# 6. Service Connectivity (Internal Docker Network)
# ---------------------------------------------------------------------------
header "6. Internal Service Connectivity"

# Test Redis connectivity from backend perspective
info "Testing Redis connectivity from within Docker network..."
REDIS_PASS=$(grep "^REDIS_PASSWORD=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-)
REDIS_TEST=$(docker run --rm --network "$NETWORK_NAME" redis:7-alpine redis-cli -h redis -a "$REDIS_PASS" ping 2>&1 || echo "FAIL")
if echo "$REDIS_TEST" | grep -q "PONG"; then
  pass "Redis PING from Docker network: PONG"
else
  fail "Redis PING failed: $REDIS_TEST"
  record_fail

  if [[ "$AUTO_FIX" == true ]]; then
    info "Attempting to restart Redis..."
    cd "$PROJECT_DIR" && $COMPOSE_CMD --env-file "$ENV_FILE" restart redis
    sleep 5
    REDIS_RETRY=$(docker run --rm --network "$NETWORK_NAME" redis:7-alpine redis-cli -h redis -a "$REDIS_PASS" ping 2>&1 || echo "FAIL")
    if echo "$REDIS_RETRY" | grep -q "PONG"; then
      pass "Redis PING after restart: PONG"
    else
      fail "Redis still unreachable after restart"
    fi
  fi
fi

# Test PostgreSQL connectivity
info "Testing PostgreSQL connectivity from within Docker network..."
PG_USER=$(grep "^POSTGRES_USER=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-)
PG_PASS=$(grep "^POSTGRES_PASSWORD=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-)
PG_DB=$(grep "^POSTGRES_DB=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-)
PG_TEST=$(docker run --rm --network "$NETWORK_NAME" -e PGPASSWORD="$PG_PASS" postgres:16-alpine psql -h postgres -U "${PG_USER:-dorami}" -d "${PG_DB:-live_commerce}" -c "SELECT 1;" 2>&1 || echo "FAIL")
if echo "$PG_TEST" | grep -q "1"; then
  pass "PostgreSQL connection from Docker network: OK"
else
  fail "PostgreSQL connection failed: $PG_TEST"
  record_fail
fi

# ---------------------------------------------------------------------------
# 7. Backend Health Endpoints
# ---------------------------------------------------------------------------
header "7. Backend Health Endpoints"

LIVE_STATUS=$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/api/health/live 2>/dev/null || echo "000")
if [[ "$LIVE_STATUS" == "200" ]]; then
  pass "GET /api/health/live -> $LIVE_STATUS"
else
  fail "GET /api/health/live -> $LIVE_STATUS"
  record_fail
fi

READY_STATUS=$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/api/health/ready 2>/dev/null || echo "000")
if [[ "$READY_STATUS" == "200" ]]; then
  pass "GET /api/health/ready -> $READY_STATUS"
else
  fail "GET /api/health/ready -> $READY_STATUS (DB or Redis may be down)"
  record_fail
fi

# ---------------------------------------------------------------------------
# 8. Dev Login Endpoint
# ---------------------------------------------------------------------------
header "8. Dev Login (ENABLE_DEV_AUTH)"

if [[ "$LIVE_STATUS" == "200" ]]; then
  DEV_LOGIN=$(curl -sf -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:3001/api/auth/dev-login \
    -H "Content-Type: application/json" \
    -d '{"email":"diagnose@test.local","name":"Diagnostics"}' 2>/dev/null || echo "000")

  if [[ "$DEV_LOGIN" == "200" ]] || [[ "$DEV_LOGIN" == "201" ]]; then
    pass "POST /api/auth/dev-login -> $DEV_LOGIN (dev auth works)"
  elif [[ "$DEV_LOGIN" == "403" ]]; then
    fail "POST /api/auth/dev-login -> 403 (ENABLE_DEV_AUTH is not true)"
    record_fail
    info "Set ENABLE_DEV_AUTH=true in .env.staging and restart backend"
  else
    fail "POST /api/auth/dev-login -> $DEV_LOGIN"
    record_fail
  fi
else
  warn "Skipping dev-login test (backend not healthy)"
  record_warn
fi

# ---------------------------------------------------------------------------
# 9. SRS Streaming
# ---------------------------------------------------------------------------
header "9. SRS Streaming"

# SRS API (internal, port 1985 not exposed -- test via Docker network)
SRS_VERSION=$(docker run --rm --network "$NETWORK_NAME" curlimages/curl:latest \
  curl -sf "http://srs:1985/api/v1/versions" 2>/dev/null || echo "FAIL")
if echo "$SRS_VERSION" | grep -q "major"; then
  pass "SRS API (http://srs:1985) is responding"
else
  warn "SRS API not responding (may need active stream)"
  record_warn
fi

# RTMP port test
RTMP_TEST=$(docker run --rm --network "$NETWORK_NAME" --entrypoint nc busybox:latest -zw3 srs 1935 2>&1 && echo "OK" || echo "FAIL")
if [[ "$RTMP_TEST" == *"OK"* ]]; then
  pass "RTMP port 1935 reachable via Docker network"
else
  fail "RTMP port 1935 not reachable"
  record_fail
fi

# ---------------------------------------------------------------------------
# 10. Nginx -> Backend/Frontend routing
# ---------------------------------------------------------------------------
header "10. Nginx Routing"

NGINX_HEALTH=$(curl -sf -o /dev/null -w '%{http_code}' http://localhost/health 2>/dev/null || echo "000")
if [[ "$NGINX_HEALTH" == "200" ]]; then
  pass "Nginx health endpoint: $NGINX_HEALTH"
else
  fail "Nginx health endpoint: $NGINX_HEALTH"
  record_fail
fi

NGINX_API=$(curl -sf -o /dev/null -w '%{http_code}' http://localhost/api/health/live 2>/dev/null || echo "000")
if [[ "$NGINX_API" == "200" ]]; then
  pass "Nginx -> Backend proxy: $NGINX_API"
else
  fail "Nginx -> Backend proxy: $NGINX_API"
  record_fail
fi

NGINX_FRONTEND=$(curl -sf -o /dev/null -w '%{http_code}' http://localhost/ 2>/dev/null || echo "000")
if [[ "$NGINX_FRONTEND" == "200" ]]; then
  pass "Nginx -> Frontend proxy: $NGINX_FRONTEND"
else
  fail "Nginx -> Frontend proxy: $NGINX_FRONTEND"
  record_fail
fi

# ---------------------------------------------------------------------------
# 11. Auto-fix: Network recreation
# ---------------------------------------------------------------------------
if [[ "$AUTO_FIX" == true ]] && [[ $ERRORS -gt 0 ]]; then
  header "Auto-Fix: Attempting Recovery"

  info "Stopping all services..."
  cd "$PROJECT_DIR" && $COMPOSE_CMD --env-file "$ENV_FILE" down --remove-orphans 2>/dev/null || true

  info "Removing and recreating Docker network..."
  docker network rm "$NETWORK_NAME" 2>/dev/null || true
  sleep 2

  info "Starting services..."
  cd "$PROJECT_DIR" && $COMPOSE_CMD --env-file "$ENV_FILE" up -d

  info "Waiting 30s for services to stabilize..."
  sleep 30

  info "Re-checking backend health..."
  for i in 1 2 3 4 5 6; do
    STATUS=$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/api/health/live 2>/dev/null || echo "000")
    if [[ "$STATUS" == "200" ]]; then
      pass "Backend healthy after fix"
      break
    fi
    if [[ "$i" == "6" ]]; then
      fail "Backend still unhealthy after fix"
    fi
    sleep 10
  done
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
header "Summary"
echo ""
if [[ $ERRORS -eq 0 ]] && [[ $WARNINGS -eq 0 ]]; then
  echo -e "  ${GREEN}${BOLD}ALL CHECKS PASSED${RESET}"
elif [[ $ERRORS -eq 0 ]]; then
  echo -e "  ${YELLOW}${BOLD}PASSED with $WARNINGS warning(s)${RESET}"
else
  echo -e "  ${RED}${BOLD}$ERRORS FAILURE(S), $WARNINGS WARNING(S)${RESET}"
  echo ""
  echo -e "  Common fixes:"
  echo -e "    1. Recreate network:  docker network rm dorami-internal && docker compose ... up -d"
  echo -e "    2. Restart backend:   docker compose ... restart backend"
  echo -e "    3. Check Redis DNS:   docker run --rm --network dorami-internal busybox nslookup redis"
  echo -e "    4. Full restart:      bash scripts/staging-diagnose.sh --fix"
fi
echo ""
exit $ERRORS
