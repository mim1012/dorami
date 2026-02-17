# syntax=docker/dockerfile:1

# ============================================
# Stage 1: 의존성 설치 (deps)
# ============================================
FROM node:20-alpine AS deps

WORKDIR /app

# 의존성 파일만 먼저 복사 (캐시 레이어 최적화)
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY backend/package.json ./backend/

# BuildKit 캐시 마운트로 npm 캐시 영속화
# 프로덕션 의존성만 먼저 설치하여 별도 보관
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts && \
    cp -R node_modules prod_node_modules

# 빌드를 위해 전체 의존성 설치 (devDependencies 포함)
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# ============================================
# Stage 2: 소스 빌드 (builder)
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# 의존성 복사 (npm workspaces는 루트 node_modules에 호이스팅)
COPY --from=deps /app/node_modules ./node_modules

# 소스 코드 복사
COPY package.json ./
COPY packages/shared-types ./packages/shared-types
COPY backend ./backend

# shared-types 빌드
RUN npm run build:shared

# Prisma Client 생성 및 Backend 빌드
RUN cd backend && npx prisma generate && npm run build

# ============================================
# Stage 3: 프로덕션 이미지 (runner)
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# 필수 시스템 패키지 설치 + 비-루트 유저 설정 (단일 RUN으로 레이어 최소화)
RUN apk add --no-cache ffmpeg openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs && \
    mkdir -p /app/uploads && chown nestjs:nodejs /app/uploads

# 프로덕션 의존성만 복사 (devDependencies 제외)
COPY --from=deps --chown=nestjs:nodejs /app/prod_node_modules ./node_modules

# 빌드 결과물 복사
COPY --from=builder --chown=nestjs:nodejs /app/backend/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/backend/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/backend/package.json ./

USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
