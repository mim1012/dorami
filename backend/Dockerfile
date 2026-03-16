# syntax=docker/dockerfile:1

# Build trigger: Fix workspace-nested module merge via COPY in runner stage

# ============================================
# Stage 1: 의존성 설치 (deps)
# ============================================
FROM node:20-alpine AS deps

WORKDIR /app

# 의존성 파일만 먼저 복사 (캐시 레이어 최적화)
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY backend/package.json ./backend/
COPY client-app/package.json ./client-app/

# BuildKit 캐시 마운트로 npm 캐시 영속화
# 1단계: 프로덕션 의존성만 설치 후 루트·workspace node_modules를 별도 보존
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts && \
    cp -R node_modules prod_node_modules && \
    [ -d backend/node_modules ] && cp -R backend/node_modules prod_backend_node_modules || true

# 2단계: 빌드를 위해 전체 의존성 설치 (devDependencies 포함, builder stage와 공유)
# 주의: 이 단계 후 node_modules는 devDeps 포함 — runner는 prod_node_modules 사용
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# ============================================
# Stage 2: 소스 빌드 (builder)
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# 의존성 파일 복사 (캐시 레이어 최적화)
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY backend/package.json ./backend/
COPY client-app/package.json ./client-app/

# devDependencies 포함 전체 의존성 설치 (nest CLI, prisma 등 빌드 도구 포함)
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# 소스 코드 복사
COPY packages/shared-types ./packages/shared-types
COPY backend ./backend

# shared-types 빌드
RUN npm run build:shared

# Prisma Client 생성 및 Backend 빌드
RUN cd backend && npx prisma generate && npx nest build

# ============================================
# Stage 3: 프로덕션 이미지 (runner)
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# 필수 시스템 패키지 설치 + 비-루트 유저 설정 (단일 RUN으로 레이어 최소화)
RUN apk add --no-cache ffmpeg openssl wget && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs && \
    mkdir -p /app/uploads && chown nestjs:nodejs /app/uploads

# 프로덕션 의존성 복사 (루트 prod_node_modules — devDeps 제외)
COPY --from=deps --chown=nestjs:nodejs /app/prod_node_modules ./node_modules

# workspace-nested 모듈 병합 (ioredis 등 backend/node_modules에만 있는 패키지)
# find로 각 패키지를 개별 복사 — BusyBox cp "dir/." 이슈 우회, 심볼릭 링크 안전
COPY --from=deps /app/prod_backend_node_modules /tmp/ws_nm
RUN find /tmp/ws_nm -maxdepth 1 -mindepth 1 -exec cp -R {} ./node_modules/ \; && \
    chown -R nestjs:nodejs ./node_modules && \
    rm -rf /tmp/ws_nm

# Prisma 생성 클라이언트 복사 (builder에서 prisma generate로 생성됨)
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# shared-types 빌드 결과물 복사 (workspace symlink 대상: node_modules/@live-commerce/shared-types → ../../packages/shared-types)
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared-types ./packages/shared-types

# 빌드 결과물 복사
COPY --from=builder --chown=nestjs:nodejs /app/backend/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/backend/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/backend/package.json ./

USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "dist/src/main.js"]
