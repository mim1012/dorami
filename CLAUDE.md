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

# Infrastructure (PostgreSQL 16, Redis 7, SRS v6)
npm run docker:up            # docker-compose up -d
npm run docker:down
npm run docker:logs          # Follow docker-compose logs

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

**API prefix:** All routes under `/api` with URI versioning (`/api/v1/...`). Swagger at `/api/docs` when `APP_ENV !== 'production'`.

**Authentication:** Kakao OAuth → JWT. Access token 15min (HttpOnly cookie), refresh token 7 days. Dev login endpoint exists for E2E tests (`POST /api/v1/auth/dev-login`).

**Key custom decorators:**

- `@AdminOnly()` — combines JWT + Role guard for admin routes
- `@Public()` — marks route as auth-exempt
- `@CurrentUser()` — extracts user from JWT context

**Error handling:** `BusinessException` with named error codes (`business.exception.ts`). Predefined subclasses: `InsufficientStockException`, `CartExpiredException`, `OrderNotFoundException`, etc.

**Key modules:** `auth`, `users`, `products`, `streaming`, `cart` (10-min expiration timer), `orders`, `reservation` (waiting list → promoted to cart), `chat` (WebSocket), `notifications` (Web Push VAPID), `points`, `settlement`, `restream` (FFmpeg multi-target), `admin` (audit logs), `notices`, `upload`, `health` (liveness/readiness probes)

**Health endpoints:** `GET /api/v1/health/live` (liveness), `GET /api/v1/health/ready` (readiness — checks DB + Redis)

### WebSocket Architecture (Non-standard)

Socket.IO is **manually bootstrapped in `main.ts`**, not via NestJS's standard gateway DI wiring. A single `Server` instance is created, attached with the Redis adapter, and **all three namespaces' event handlers are implemented inline in `main.ts`**:

- `/` — general stream room join/leave; exposes `broadcastProduct*` methods monkey-patched directly onto the `io` object for use by services
- `/chat` — chat with Redis-backed history (`chat:{liveId}:history`, max 100 msgs, 24h TTL); rate-limited at 20 msgs/10s
- `/streaming` — viewer count tracking via Redis counters (`stream:{streamKey}:viewers`)

**`SocketIoProvider`** (`modules/websocket/socket-io.provider.ts`) is a NestJS injectable singleton that holds the `Server` instance. It is set in `main.ts` after the server is created (`socketIoProvider.setServer(io)`) and can be injected into services that need to broadcast.

**`stream:ended` event flow:** `StreamingController` → NestJS `EventEmitter2` (`stream:ended`) → `StreamingGateway.handleStreamEnded()` → broadcasts `stream:ended` to WebSocket room.

All socket connections require JWT authentication via `authenticateSocket()` middleware.

### Frontend (Next.js App Router)

**State management:**

- Client state: Zustand (`lib/store/auth.ts` — user, isAuthenticated)
- Server state: TanStack Query v5 (`lib/hooks/queries/`)
- Real-time: Socket.IO client connecting to `NEXT_PUBLIC_WS_URL` (default `http://localhost:3001`)

**API client** (`lib/api/client.ts`): Custom fetch wrapper with automatic CSRF token injection, 401 → token refresh (coalesced) → retry, response unwrapping from `{data}` envelope. All API functions in `lib/api/`. `ApiError` carries `statusCode`, `errorCode`, and `details`.

**Proxy** (`next.config.ts`):

- `/api/:path*` → `${BACKEND_URL}/api/v1/:path*` (default `http://127.0.0.1:3001`)
- `/live/live/:path*` and `/hls/:path*` → `${MEDIA_SERVER_URL}` (default `http://127.0.0.1:8080`) via fallback rewrites (only when no Next.js page matches)

**Key custom hooks** (`client-app/src/hooks/`):

- `useChatConnection` — manages `/chat` Socket.IO namespace, exposes `sendMessage`, `deleteMessage`
- `useChatMessages` — accumulates messages from `chat:message` events
- `useCartActivity` — listens for cart add events, shown as system messages in chat overlay
- `useProductStock` — real-time stock updates via WebSocket
- `useNotifications` — Web Push subscription management

**Live page** (`app/live/[streamKey]/page.tsx`): Three-column desktop layout (product list | video | chat); single-column mobile with overlay chat + featured product inline card. `VideoPlayer` accepts `onStreamError` callback to toggle the LIVE badge and controls when the HLS/FLV stream has an error.

**Playwright E2E:** Two projects — `user` (ignores `admin-*.spec.ts`) and `admin` (matches `admin-*.spec.ts`). Global setup pre-authenticates via dev login. Auth state stored in `e2e/.auth/`.

### Shared Types (`packages/shared-types`)

TypeScript-only package exporting enums and event interfaces. Built with `tsc`, consumed by both backend and frontend.

Key enum values to be aware of:

- `ProductStatus`: `AVAILABLE` | `SOLD_OUT` (not `ON_SALE`)
- `StreamStatus`: `PENDING` | `LIVE` | `OFFLINE`
- `OrderStatus`: `PENDING_PAYMENT` | `PAYMENT_CONFIRMED` | `SHIPPED` | `DELIVERED` | `CANCELLED`

### Database (Prisma + PostgreSQL)

Schema at `backend/prisma/schema.prisma`. Key models: `User`, `LiveStream`, `Product`, `Cart` (TTL-based), `Order`/`OrderItem`, `Reservation`, `PointBalance`/`PointTransaction`, `Settlement`, `ReStreamTarget`, `NotificationSubscription`, `AuditLog`, `SystemConfig`.

Order IDs use `ORD-YYYYMMDD-XXXXX` format (not UUID). Shipping addresses are encrypted (AES-256-GCM via `EncryptionService`, requires `PROFILE_ENCRYPTION_KEY`).

### Streaming Infrastructure

Local dev uses **SRS (Simple Realtime Server) v6** — replaces the earlier Nginx RTMP setup. Config at `infrastructure/docker/srs/srs.conf`.

| Port | Protocol | Purpose                 |
| ---- | -------- | ----------------------- |
| 1935 | RTMP     | OBS/encoder ingest      |
| 8080 | HTTP     | HTTP-FLV + HLS playback |

**Nginx proxy paths (staging):**

- HTTP-FLV: `/live/live/{streamKey}.flv` → `srs:8080/live/live/` (low-latency primary)
- HLS: `/hls/{streamKey}.m3u8` → `srs:8080/live/` (Safari/iOS fallback)

SRS fires webhook callbacks to the backend to update `LiveStream.status` in the database.

**Important:** The `/live/live/` nginx location is intentionally specific to avoid conflicting with the Next.js `/live` page route.

### Docker Compose (Local Dev)

`docker-compose.yml` runs PostgreSQL 16 (5432), Redis 7 (6379), SRS v6 (1935 RTMP, 8080 HTTP).

**Required environment variables** (backend fails to start without these):

- `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`

**Important optional variables:**

- `PROFILE_ENCRYPTION_KEY` — 64-char hex key for AES-256-GCM encryption of shipping addresses
- `ADMIN_EMAILS` — comma-separated emails auto-assigned `ADMIN` role on first Kakao login
- `CSRF_ENABLED=false` — disables CSRF guard (useful for API testing)
- `CORS_ORIGINS` — comma-separated allowed origins (default: `http://localhost:3000`)
- `PORT` — backend HTTP port (default: 3001)
- `APP_ENV=production` — hides Swagger docs (separate from `NODE_ENV`)

**Frontend env vars** (`.env.local`):

- `NEXT_PUBLIC_WS_URL` — Socket.IO server URL (default `http://localhost:3001`)
- `BACKEND_URL` — backend base for Next.js proxy (default `http://127.0.0.1:3001`)
- `MEDIA_SERVER_URL` — SRS media server for Next.js proxy (default `http://127.0.0.1:8080`)

## Commit Convention

```
feat:     new feature
fix:      bug fix
refactor: code change with no behavior change
test:     test additions/modifications
docs:     documentation only
style:    formatting, no logic change
chore:    build, config, dependency changes
```

## Pre-commit Hooks

Husky + lint-staged: backend `.ts` files get ESLint fix + Prettier; frontend `.ts`/`.tsx` files get Prettier; JSON/MD get Prettier.

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`): path-based change detection → parallel jobs for backend CI (lint, type-check, unit tests, build with PostgreSQL + Redis services), frontend CI (lint, type-check, build), Docker build test, Trivy security scan.
