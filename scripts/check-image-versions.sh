#!/bin/bash
# 📦 Production vs Staging Docker Image Comparison Script
# 사용법: ./scripts/check-image-versions.sh

set -e

# SSH 설정
SSH_KEY="${1:-D:/Project/dorami/ssh/id_ed25519}"
PROD_HOST="15.165.66.23"
PROD_USER="ubuntu"
STAGING_HOST="54.180.94.30"
STAGING_USER="ubuntu"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🖼️  Production ↔ Staging Docker Image Comparison${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

# Production 이미지 조회
echo -e "${YELLOW}📍 Fetching Production images (${PROD_USER}@${PROD_HOST})...${NC}"
PROD_IMAGES=$(ssh -i "$SSH_KEY" "${PROD_USER}@${PROD_HOST}" 'docker ps --format "{{.Image}}"')
PROD_BACKEND=$(echo "$PROD_IMAGES" | grep dorami-backend | head -1)
PROD_FRONTEND=$(echo "$PROD_IMAGES" | grep dorami-frontend | head -1)

# Staging 이미지 조회
echo -e "${YELLOW}📍 Fetching Staging images (${STAGING_USER}@${STAGING_HOST})...${NC}"
STAGING_IMAGES=$(ssh -i "$SSH_KEY" "${STAGING_USER}@${STAGING_HOST}" 'docker ps --format "{{.Image}}"')
STAGING_BACKEND=$(echo "$STAGING_IMAGES" | grep dorami-backend | head -1)
STAGING_FRONTEND=$(echo "$STAGING_IMAGES" | grep dorami-frontend | head -1)

# 이미지 태그 추출
PROD_BACKEND_TAG=$(echo "$PROD_BACKEND" | cut -d: -f2)
PROD_FRONTEND_TAG=$(echo "$PROD_FRONTEND" | cut -d: -f2)
STAGING_BACKEND_TAG=$(echo "$STAGING_BACKEND" | cut -d: -f2)
STAGING_FRONTEND_TAG=$(echo "$STAGING_FRONTEND" | cut -d: -f2)

echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 Comparison Results${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

# Backend 비교
echo -e "${YELLOW}Backend:${NC}"
if [ "$PROD_BACKEND_TAG" = "$STAGING_BACKEND_TAG" ]; then
  echo -e "  ${GREEN}✅ IDENTICAL${NC}"
  echo -e "     Production: ${GREEN}${PROD_BACKEND_TAG:0:16}...${NC}"
  echo -e "     Staging:    ${GREEN}${STAGING_BACKEND_TAG:0:16}...${NC}"
else
  echo -e "  ${RED}❌ MISMATCH${NC}"
  echo -e "     Production: ${RED}${PROD_BACKEND_TAG:0:16}...${NC}"
  echo -e "     Staging:    ${RED}${STAGING_BACKEND_TAG:0:16}...${NC}"
fi

# Frontend 비교
echo -e "\n${YELLOW}Frontend:${NC}"
if [ "$PROD_FRONTEND_TAG" = "$STAGING_FRONTEND_TAG" ]; then
  echo -e "  ${GREEN}✅ IDENTICAL${NC}"
  echo -e "     Production: ${GREEN}${PROD_FRONTEND_TAG:0:16}...${NC}"
  echo -e "     Staging:    ${GREEN}${STAGING_FRONTEND_TAG:0:16}...${NC}"
else
  echo -e "  ${RED}❌ MISMATCH${NC}"
  echo -e "     Production: ${RED}${PROD_FRONTEND_TAG:0:16}...${NC}"
  echo -e "     Staging:    ${RED}${STAGING_FRONTEND_TAG:0:16}...${NC}"
fi

# 전체 일치 여부
echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
if [ "$PROD_BACKEND_TAG" = "$STAGING_BACKEND_TAG" ] && [ "$PROD_FRONTEND_TAG" = "$STAGING_FRONTEND_TAG" ]; then
  echo -e "${GREEN}✅ Complete Image Parity${NC}"
  echo -e "   양쪽 서버가 동일한 이미지 실행 중입니다.${NC}\n"
  exit 0
else
  echo -e "${RED}⚠️  Partial Image Mismatch${NC}"
  echo -e "   Production과 Staging 이미지가 다릅니다.${NC}\n"
  exit 1
fi
