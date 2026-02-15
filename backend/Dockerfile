FROM node:20-alpine AS builder

WORKDIR /app

# 루트 package.json + workspaces 구조 복사
COPY package.json ./
COPY packages/shared-types ./packages/shared-types
COPY backend/package.json ./backend/

# workspace 기반으로 의존성 설치 (shared-types + backend)
RUN npm install --legacy-peer-deps --ignore-scripts

# shared-types 빌드
RUN npm run build:shared

# backend 소스 복사
COPY backend ./backend

# Prisma generate + backend 빌드
RUN cd backend && npx prisma generate
RUN cd backend && npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache ffmpeg
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/backend/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared-types ./packages/shared-types
COPY --from=builder --chown=nestjs:nodejs /app/backend/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/backend/prisma ./prisma

EXPOSE 3001

USER nestjs

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
