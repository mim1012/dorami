#!/usr/bin/env bash
# Preflight Check Script — Task #23
# Verifies deployment readiness before any production deployment
# Usage: bash scripts/preflight-check.sh
# Exit code: 0 = ready, 1 = blocked

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

passed=0
warned=0
failed=0

check_pass() { echo -e "  ${GREEN}[PASS]${NC} $1"; ((passed++)); }
check_warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; ((warned++)); }
check_fail() { echo -e "  ${RED}[FAIL]${NC} $1"; ((failed++)); }

echo -e "${CYAN}=== Preflight Deployment Check ===${NC}"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 1. Docker daemon
echo "--- Infrastructure ---"
if docker info &>/dev/null; then
  check_pass "Docker daemon running"
else
  check_fail "Docker daemon not running"
fi

# 2. Required containers
for container in postgres redis; do
  if docker ps --format '{{.Names}}' | grep -qi "doremi.*${container}"; then
    check_pass "${container} container running"
  else
    check_warn "${container} container not found (may be external)"
  fi
done

# 3. Disk space (>1GB free)
echo ""
echo "--- Resources ---"
free_kb=$(df -k . 2>/dev/null | tail -1 | awk '{print $4}' || echo "0")
free_gb=$(( free_kb / 1024 / 1024 ))
if [[ $free_gb -ge 1 ]]; then
  check_pass "Disk space: ${free_gb}GB free"
else
  check_fail "Low disk space: ${free_gb}GB free (need >= 1GB)"
fi

# 4. Memory check
if command -v free &>/dev/null; then
  free_mem_mb=$(free -m 2>/dev/null | awk '/Mem:/{print $7}' || echo "0")
  if [[ $free_mem_mb -ge 512 ]]; then
    check_pass "Available memory: ${free_mem_mb}MB"
  else
    check_warn "Low memory: ${free_mem_mb}MB available"
  fi
fi

# 5. Git state
echo ""
echo "--- Source Code ---"
if command -v git &>/dev/null && git rev-parse --is-inside-work-tree &>/dev/null; then
  branch=$(git branch --show-current 2>/dev/null || echo "detached")
  check_pass "Git branch: ${branch}"

  uncommitted=$(git status --porcelain 2>/dev/null | wc -l)
  if [[ $uncommitted -eq 0 ]]; then
    check_pass "Working tree clean"
  else
    check_warn "${uncommitted} uncommitted changes"
  fi

  latest_commit=$(git log -1 --format='%h %s' 2>/dev/null || echo "unknown")
  check_pass "Latest commit: ${latest_commit}"
fi

# 6. Environment variables
echo ""
echo "--- Environment ---"
if [[ -n "${IMAGE_TAG:-}" ]]; then
  check_pass "IMAGE_TAG set: ${IMAGE_TAG}"
else
  check_warn "IMAGE_TAG not set (will need to be provided)"
fi

if [[ -f ".env.production" ]] || [[ -f "backend/.env.production" ]]; then
  check_pass "Production env file exists"
else
  check_warn "No .env.production found"
fi

# 7. Health endpoints (if services are running)
echo ""
echo "--- Current Services ---"
HEALTH_URL="${HEALTH_URL:-http://localhost:3001}"
if curl -sf "${HEALTH_URL}/api/health/live" >/dev/null 2>&1; then
  check_pass "Backend liveness: OK"
else
  check_warn "Backend not reachable at ${HEALTH_URL} (may not be running yet)"
fi

if curl -sf "${HEALTH_URL}/api/health/ready" >/dev/null 2>&1; then
  check_pass "Backend readiness: OK (DB + Redis connected)"
else
  check_warn "Backend readiness check failed"
fi

# Summary
echo ""
echo -e "${CYAN}=== Summary ===${NC}"
echo -e "  Passed:  ${GREEN}${passed}${NC}"
echo -e "  Warnings: ${YELLOW}${warned}${NC}"
echo -e "  Failed:  ${RED}${failed}${NC}"

if [[ $failed -gt 0 ]]; then
  echo ""
  echo -e "${RED}PREFLIGHT BLOCKED: ${failed} critical issue(s). Fix before deploying.${NC}"
  exit 1
else
  echo ""
  echo -e "${GREEN}PREFLIGHT PASSED: Ready to deploy.${NC}"
  exit 0
fi

