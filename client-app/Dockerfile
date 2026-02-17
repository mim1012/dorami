# syntax=docker/dockerfile:1

# ============================================
# Stage 1: 의존성 설치 (deps)
# ============================================
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

# 의존성 파일만 먼저 복사 (캐시 레이어 최적화)
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY client-app/package.json ./client-app/

# BuildKit 캐시 마운트로 npm 캐시 영속화
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
COPY client-app ./client-app

# 환경변수 플레이스홀더 (런타임에 docker-entrypoint.sh로 치환)
ARG NEXT_PUBLIC_ENABLE_DEV_AUTH=false
ARG NEXT_PUBLIC_PREVIEW_ENABLED=false
ARG NEXT_PUBLIC_APP_ENV=production

ENV NEXT_PUBLIC_API_URL=__NEXT_PUBLIC_API_URL__
ENV NEXT_PUBLIC_WS_URL=__NEXT_PUBLIC_WS_URL__
ENV NEXT_PUBLIC_CDN_URL=__NEXT_PUBLIC_CDN_URL__
ENV NEXT_PUBLIC_ENABLE_DEV_AUTH=${NEXT_PUBLIC_ENABLE_DEV_AUTH}
ENV NEXT_PUBLIC_PREVIEW_ENABLED=${NEXT_PUBLIC_PREVIEW_ENABLED}
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=__NEXT_PUBLIC_VAPID_PUBLIC_KEY__
ENV NEXT_PUBLIC_KAKAO_JS_KEY=__NEXT_PUBLIC_KAKAO_JS_KEY__
ENV NEXT_PUBLIC_SENTRY_DSN=__NEXT_PUBLIC_SENTRY_DSN__
ENV NEXT_PUBLIC_APP_VERSION=__NEXT_PUBLIC_APP_VERSION__
ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV}

# 텔레메트리 비활성화
ENV NEXT_TELEMETRY_DISABLED=1

# shared-types 빌드 후 Next.js 빌드
RUN npm run build:shared && cd client-app && npm run build

# ============================================
# Stage 3: 프로덕션 이미지 (runner)
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# standalone 빌드 결과물만 복사 (node_modules 불필요)
COPY --from=builder --chown=nextjs:nodejs /app/client-app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/client-app/.next/static ./client-app/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/client-app/public ./client-app/public

# 런타임 환경변수 치환 스크립트
COPY --chown=nextjs:nodejs client-app/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "client-app/server.js"]
