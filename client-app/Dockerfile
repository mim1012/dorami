FROM node:20-alpine AS builder

WORKDIR /app

# shared-types 빌드
COPY packages/shared-types ./packages/shared-types
RUN cd packages/shared-types && npm install && npm run build

# client-app 의존성 설치
COPY client-app/package*.json ./client-app/
RUN cd client-app && npm install --legacy-peer-deps

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
COPY --from=builder /app/client-app/.next/static ./.next/static
COPY --from=builder /app/client-app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
