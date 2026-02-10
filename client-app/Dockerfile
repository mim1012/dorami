FROM node:20-alpine AS builder

WORKDIR /app

# 루트 package.json + workspaces 구조 복사
COPY package.json ./
COPY packages/shared-types ./packages/shared-types
COPY client-app/package.json ./client-app/

# workspace 기반으로 의존성 설치 (shared-types + client-app)
RUN npm install --legacy-peer-deps --ignore-scripts

# shared-types 빌드
RUN npm run build:shared

# client-app 소스 복사
COPY client-app ./client-app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_KAKAO_JS_KEY
ARG NEXT_PUBLIC_PREVIEW_ENABLED
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_KAKAO_JS_KEY=$NEXT_PUBLIC_KAKAO_JS_KEY
ENV NEXT_PUBLIC_PREVIEW_ENABLED=$NEXT_PUBLIC_PREVIEW_ENABLED

RUN cd client-app && npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/client-app/.next/standalone ./
COPY --from=builder /app/client-app/.next/static ./client-app/.next/static
COPY --from=builder /app/client-app/public ./client-app/public

EXPOSE 3000

CMD ["node", "client-app/server.js"]
