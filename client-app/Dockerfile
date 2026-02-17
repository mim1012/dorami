FROM node:20-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

# 루트 package.json + workspaces 구조 복사
COPY package.json ./
COPY packages/shared-types ./packages/shared-types
COPY client-app/package.json ./client-app/

# workspace 기반으로 의존성 설치 (shared-types + client-app)
RUN npm install --legacy-peer-deps --ignore-scripts

# shared-types 빌드
RUN npm run build:shared

# client-app 소스 복사 (CACHEBUST로 캐시 무효화)
ARG CACHEBUST=1
COPY client-app ./client-app

# DEBUG: Verify source file content before build
RUN echo "=== SOURCE VERIFICATION ===" && \
    grep -c 'discountRate' client-app/src/app/products/\[id\]/page.tsx && \
    grep -c 'Intl.NumberFormat' client-app/src/app/products/\[id\]/page.tsx || true && \
    echo "=== END VERIFICATION ==="

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

RUN cd client-app && npm run build

# DEBUG: Verify build output
RUN echo "=== BUILD OUTPUT VERIFICATION ===" && \
    find client-app/.next/static/chunks -name "*.js" | head -20 && \
    grep -rl 'discountRate' client-app/.next/static/chunks/ | head -5 || echo "NO discountRate IN CHUNKS" && \
    grep -rl 'Intl.NumberFormat' client-app/.next/static/chunks/ | head -5 || echo "NO Intl.NumberFormat IN CHUNKS" && \
    echo "=== END BUILD OUTPUT ==="

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/client-app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/client-app/.next/static ./client-app/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/client-app/public ./client-app/public

COPY client-app/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "client-app/server.js"]
