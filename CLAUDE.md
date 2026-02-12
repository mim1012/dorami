# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dorami is a **live commerce MVP platform** — a one-seller livestreaming e-commerce app where a seller broadcasts product demos and sells directly to viewers in real-time. Korean-language product targeting Korean market.

**Monorepo structure** using npm workspaces:

- `backend/` — NestJS 11 API server (port 3001)
- `client-app/` — Next.js 16 frontend (port 3000, App Router)
- `packages/shared-types/` — Shared TypeScript enums/interfaces (`@live-commerce/shared-types`)

## Common Commands

```bash
# Install all workspace dependencies (also builds shared-types via postinstall)
npm install

# Development
npm run dev:all              # Start backend + frontend concurrently
npm run dev:backend          # NestJS watch mode only
npm run dev:client           # Next.js dev server only

# Infrastructure (PostgreSQL 16, Redis 7, Nginx RTMP)
npm run docker:up            # docker-compose up -d
npm run docker:down

# Database
npm run prisma:generate      # Generate Prisma Client after schema changes
npm run prisma:migrate       # Create + apply migration (interactive)
npm run prisma:studio        # Open Prisma Studio GUI

# Testing
npm run test:backend                          # Jest unit tests (backend)
cd backend && npx jest --watch                # Watch mode
cd backend && npx jest path/to/file.spec.ts   # Single test file
cd backend && npx jest --coverage             # Coverage report

# Playwright E2E (requires running app)
cd client-app && npx playwright test                    # All tests
cd client-app && npx playwright test --project=user     # User tests only
cd client-app && npx playwright test --project=admin    # Admin tests only
cd client-app && npx playwright test e2e/shop-purchase-flow.spec.ts  # Single file

# Lint & Format
npm run lint:all             # ESLint both workspaces
npm run lint:backend         # ESLint backend with --fix
npm run lint:client          # ESLint frontend
npm run format               # Prettier write all files
npm run format:check         # Prettier check only

# Type checking
npm run type-check:all       # tsc --noEmit for all workspaces

# Build
npm run build:all            # Build shared-types → client → backend
npm run build:shared         # Build shared-types package only
```

## Architecture

### Backend (NestJS)

**Request flow:** Controller → Service → Prisma ORM → PostgreSQL

**Global middleware stack** (configured in `backend/src/main.ts`):

- `cookieParser` → `helmet` → `compression` → `ValidationPipe` (whitelist + transform) → `BusinessExceptionFilter` → `TransformInterceptor` (wraps responses in `{data, success, timestamp}`) → `CsrfGuard` (Double Submit Cookie, disable with `CSRF_ENABLED=false`)

**API prefix:** All routes under `/api` with URI versioning (`/api/v1/...`). Swagger at `/api/docs` (non-production).

**Authentication:** Kakao OAuth → JWT. Access token 15min (HttpOnly cookie), refresh token 7 days. Dev login endpoint exists for E2E tests.

**Key custom decorators:**

- `@AdminOnly()` — combines JWT + Role guard for admin routes
- `@Public()` — marks route as auth-exempt
- `@CurrentUser()` — extracts user from JWT context

**Error handling:** `BusinessException` with named error codes (`business.exception.ts`). Predefined subclasses: `InsufficientStockException`, `CartExpiredException`, `OrderNotFoundException`, etc.

**Real-time:** Socket.IO with optional Redis adapter for horizontal scaling. Used for chat, cart updates, notifications.

**Key modules:** `auth`, `users`, `products`, `streaming`, `cart` (10-min expiration timer), `orders`, `reservation` (waiting list → promoted to cart), `chat` (WebSocket), `notifications` (Web Push VAPID), `points`, `settlement`, `restream` (FFmpeg multi-target), `admin` (audit logs)

### Frontend (Next.js App Router)

**State management:**

- Client state: Zustand (`lib/store/auth.ts` — user, isAuthenticated)
- Server state: TanStack Query v5 (`lib/hooks/queries/`)
- Real-time: Socket.IO client

**API client** (`lib/api/client.ts`): Custom fetch wrapper with automatic CSRF token injection, 401 → token refresh → retry, response unwrapping from `{data}` envelope. All API functions in `lib/api/`.

**Proxy:** Next.js rewrites `/api/:path*` → `BACKEND_URL` (default `http://127.0.0.1:3001`). Frontend calls `/api/...` which proxies to backend.

**Playwright E2E:** Two projects — `user` (ignores `admin-*.spec.ts`) and `admin` (matches `admin-*.spec.ts`). Global setup pre-authenticates via dev login. Auth state stored in `e2e/.auth/`.

### Shared Types (`packages/shared-types`)

TypeScript-only package exporting enums (`Role`, `UserStatus`, `StreamStatus`, `OrderStatus`, `PaymentMethod`, etc.) and event interfaces. Built with `tsc`, consumed by both backend and frontend.

### Database (Prisma + PostgreSQL)

Schema at `backend/prisma/schema.prisma`. Key models: `User`, `LiveStream`, `Product`, `Cart` (TTL-based), `Order`/`OrderItem`, `Reservation`, `PointBalance`/`PointTransaction`, `Settlement`, `ReStreamTarget`, `NotificationSubscription`, `AuditLog`, `SystemConfig`.

Order IDs use `ORD-YYYYMMDD-XXXXX` format (not UUID). Shipping addresses are encrypted (AES-256-GCM).

### Docker Compose (Local Dev)

`docker-compose.yml` runs PostgreSQL 16 (5432), Redis 7 (6379), Nginx RTMP (1935 RTMP, 8080 HLS).

## Pre-commit Hooks

Husky + lint-staged: backend `.ts` files get ESLint fix + Prettier; frontend `.ts`/`.tsx` files get Prettier; JSON/MD get Prettier.

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`): path-based change detection → parallel jobs for backend CI (lint, type-check, unit tests, build with PostgreSQL + Redis services), frontend CI (lint, type-check, build), Docker build test, Trivy security scan.
