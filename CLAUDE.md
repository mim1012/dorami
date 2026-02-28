# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dorami is a **live commerce MVP platform** — a one-seller livestreaming e-commerce app where a seller broadcasts product demos and sells directly to viewers in real-time. Korean-language product targeting Korean market.

**Production domain:** `https://www.doremi-live.com`

**Monorepo structure** using npm workspaces:

- `backend/` — NestJS 11 API server (port 3001)
- `client-app/` — Next.js 16 frontend (port 3000, App Router, React 19, Tailwind CSS 4.0)
- `packages/shared-types/` — Shared TypeScript enums/interfaces + helper functions (`@live-commerce/shared-types`)

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
npm run prisma:studio        # Open Prisma Studio GUI (web UI at http://localhost:5555)

# Testing
npm run test:backend                          # Jest unit tests (backend)
cd backend && npx jest --watch                # Watch mode
cd backend && npx jest path/to/file.spec.ts   # Single test file
cd backend && npx jest --coverage             # Coverage report

# Playwright E2E (requires running app at http://localhost:3000)
cd client-app && npx playwright test                                   # All tests
cd client-app && npx playwright test --project=user                    # User tests only
cd client-app && npx playwright test --project=admin                   # Admin tests only
cd client-app && npx playwright test --ui                              # Interactive UI mode
cd client-app && npx playwright test e2e/shop-purchase-flow.spec.ts    # Single file
cd client-app && npx playwright show-trace trace.zip                   # View test trace

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

# Clean
npm run clean                # Delete all node_modules and dist directories
```

## Architecture

### Backend (NestJS)

**Request flow:** Controller → Service → Prisma ORM → PostgreSQL

**Global middleware stack** (configured in `backend/src/main.ts`):

- `cookieParser` → `helmet` → `compression` → `ValidationPipe` (whitelist + transform) → `BusinessExceptionFilter` → `TransformInterceptor` (wraps responses in `{data, success, timestamp}`) → `CsrfGuard` (Double Submit Cookie, disable with `CSRF_ENABLED=false`)

**API prefix:** All routes under `/api` (no URI versioning — path policy: `/api/{resource}`). Swagger at `/api/docs` when `APP_ENV !== 'production'`.

**Authentication:** Kakao OAuth → JWT. Access token 15min (HttpOnly cookie), refresh token 7 days. Dev login endpoint exists for E2E tests (`POST /api/auth/dev-login`).

**Key custom decorators:**

- `@AdminOnly()` — combines JWT + Role guard for admin routes
- `@Public()` — marks route as auth-exempt
- `@CurrentUser()` — extracts user from JWT context

**Error handling:** `BusinessException` with named error codes (`business.exception.ts`). Predefined subclasses: `InsufficientStockException`, `CartExpiredException`, `OrderNotFoundException`, etc.

**Key modules:** `auth`, `users`, `products`, `streaming`, `cart` (10-min expiration timer), `orders`, `reservation` (waiting list → promoted to cart), `chat` (WebSocket), `notifications` (Web Push VAPID), `points`, `settlement`, `restream` (FFmpeg multi-target), `admin` (audit logs), `notices`, `upload`, `health` (liveness/readiness probes)

**Health endpoints:** `GET /api/health/live` (liveness), `GET /api/health/ready` (readiness — checks DB + Redis)

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

- `/api/:path*` → `${BACKEND_URL}/api/:path*` (default `http://127.0.0.1:3001`)
- `/live/live/:path*` and `/hls/:path*` → `${MEDIA_SERVER_URL}` (default `http://127.0.0.1:8080`) via fallback rewrites (only when no Next.js page matches)

**Hook locations:**

- Feature hooks: `client-app/src/hooks/` — real-time and UI logic
- TanStack Query hooks: `client-app/src/lib/hooks/queries/` — server state

**Key feature hooks** (`client-app/src/hooks/`):

- `useLiveLayoutMachine` — multi-FSM hook managing the live page's `connection` / `stream` / `uiMode` / `overlay` states. Dispatches typed `LiveEvent`s, derives a `LiveSnapshot` enum (`LIVE_NORMAL` | `LIVE_TYPING` | `RETRYING` | `NO_STREAM` | `ENDED`), and computes a `LiveLayout` descriptor. `deriveSnapshot` and `computeLayout` are exported for unit tests.
- `useChatConnection` — manages `/chat` Socket.IO namespace, exposes `sendMessage`, `deleteMessage`
- `useChatMessages` — accumulates messages from `chat:message` events
- `useCartActivity` — listens for cart add events, shown as system messages in chat overlay
- `useProductStock` — real-time stock updates via WebSocket
- `useNotifications` — Web Push subscription management

**Live page** (`app/live/[streamKey]/page.tsx`): Layout is driven by `useLiveLayoutMachine`. `VideoPlayer` tries HTTP-FLV (mpegts.js) first for low latency, then falls back to HLS (hls.js) on error. Props: `onStreamError` (legacy toggle), `onStreamStateChange` (fires typed `VideoStreamEvent` — `PLAY_OK` | `STALL` | `MEDIA_ERROR` | `STREAM_ENDED`; feeds the layout FSM), `hideErrorOverlay` (suppresses the built-in `ErrorOverlay` when the parent handles error display). Dev mode shows a KPI overlay (first-frame ms, rebuffer count, stall duration, reconnect count).

**UI Theme:** Dark mode with Hot Pink accent (`#FF1493` / `pink-500` range). Tailwind CSS 4.0 with component-level dark mode classes. All UI work should respect this theme.

**Playwright E2E:** Two projects — `user` (ignores `admin-*.spec.ts`) and `admin` (matches `admin-*.spec.ts`). Global setup pre-authenticates via dev login. Auth state stored in `e2e/.auth/`.

### Shared Types (`packages/shared-types`)

TypeScript-only package exporting enums, event interfaces, and utility functions. Built with `tsc`, consumed by both backend and frontend.

Key enum values to be aware of:

- `ProductStatus`: `AVAILABLE` | `SOLD_OUT` (not `ON_SALE`)
- `StreamStatus`: `PENDING` | `LIVE` | `OFFLINE`
- `OrderStatus`: `PENDING_PAYMENT` | `PAYMENT_CONFIRMED` | `SHIPPED` | `DELIVERED` | `CANCELLED`
- `PaymentStatus`: `PENDING` | `CONFIRMED` | `FAILED` | `REFUNDED`
- `ShippingStatus`: `PENDING` | `SHIPPED` | `DELIVERED`
- `CartStatus`: `ACTIVE` | `EXPIRED` | `CONVERTED`
- `ReservationStatus`: `WAITING` | `PROMOTED` | `CANCELLED`

Exported helper functions (avoid reimplementing):

- `generateOrderId(sequence)` → `"ORD-YYYYMMDD-XXXXX"`
- `calculateCartTotal(items)` → `{ subtotal, totalShippingFee, total }` (all strings, Decimal-safe)
- `isCartExpired(cart)`, `isReservationExpired(reservation)` — boolean TTL checks
- `formatDecimal(value, decimals?)`, `parseDecimal(value)` — Decimal-safe number formatting

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
- `CORS_ORIGINS` — comma-separated allowed origins (default: `http://localhost:3000`; production: `https://doremi-live.com,https://www.doremi-live.com`)
- `PORT` — backend HTTP port (default: 3001)
- `APP_ENV=production` — hides Swagger docs (separate from `NODE_ENV`)

**Frontend env vars** (`.env.local`):

- `NEXT_PUBLIC_WS_URL` — Socket.IO server URL (default `http://localhost:3001`)
- `BACKEND_URL` — backend base for Next.js proxy (default `http://127.0.0.1:3001`)
- `MEDIA_SERVER_URL` — SRS media server for Next.js proxy (default `http://127.0.0.1:8080`)

### Production Infrastructure (AWS)

AWS CDK code lives in `infrastructure/aws-cdk/`. Production streaming uses ECS Fargate (Nginx RTMP + FFmpeg) behind a Network Load Balancer for RTMP ingest and CloudFront CDN for HLS delivery.

```
OBS → NLB (1935 RTMP) → ECS Fargate → ALB (8080 HTTP) → CloudFront → HLS.js
```

Deploy with:

```bash
cd infrastructure/aws-cdk
npm run deploy:dev   # or deploy:prod
```

CDK outputs provide `RTMP_SERVER_URL` and `HLS_SERVER_URL` for backend `.env`.

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

## Local Development Setup

### Initial Setup

1. **Clone and install:**

   ```bash
   npm install
   npm run docker:up
   npm run prisma:migrate
   ```

2. **Set environment variables** — create `.env.local` in backend root, or use defaults:
   - Backend needs: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`
   - Frontend needs: `NEXT_PUBLIC_WS_URL`, `BACKEND_URL` (both default to localhost)
   - Kakao OAuth requires `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET` (use dev credentials or disable OAuth for E2E)

3. **Start development:**
   ```bash
   npm run dev:all          # Backend + frontend concurrently
   # Backend: http://localhost:3001 (API + WebSocket + Swagger)
   # Frontend: http://localhost:3000
   # SRS media: http://localhost:8080
   ```

### Testing Workflow

**Unit tests** (Jest, backend only):

```bash
npm run test:backend                    # Run all unit tests
cd backend && npx jest --watch          # Watch mode for TDD
cd backend && npx jest --coverage       # Coverage report
```

**E2E tests** (Playwright, frontend):

- **Prerequisites:** Both dev servers running (`npm run dev:all`)
- **Global setup** authenticates via `POST /api/auth/dev-login`
- **Auth state** persisted in `client-app/e2e/.auth/`

```bash
cd client-app && npx playwright test --project=user    # User workflows
cd client-app && npx playwright test --project=admin   # Admin workflows
cd client-app && npx playwright test --ui              # Interactive mode (debug)
```

### Database Management

- **Prisma Studio:** `npm run prisma:studio` → `http://localhost:5555`
- **New migration:** `npm run prisma:migrate` creates `.sql` in `backend/prisma/migrations/`
- **Reset database:** `cd backend && npx prisma migrate reset`
- **Seed data:** Add logic to `backend/prisma/seed.ts`, then `npx prisma db seed`

### Debugging

**Backend (NestJS):**

```bash
cd backend && npm run start:debug       # Inspector on port 9229
# Open chrome://inspect in Chrome DevTools
```

**WebSocket/Socket.IO:**

```bash
DEBUG=socket.io:* npm run dev:backend   # Enable debug logs
# Check browser DevTools → Network → WS tab
```

**Database queries:**

```typescript
// In code: const prisma = new PrismaClient({ log: ['query', 'warn', 'error'] });
```

## Troubleshooting

### Common Issues

**"Cannot find module '@live-commerce/shared-types'"**

- Run `npm install` (postinstall builds shared-types)
- Or: `npm run build:shared && npm run prisma:generate`

**Port 3001 or 3000 already in use**

- Kill: `lsof -i :3001` (macOS/Linux) or change `PORT=3002` for backend

**Playwright test auth fails**

- Ensure backend running at `BACKEND_URL` (default `http://127.0.0.1:3001`)
- Dev login must exist: `POST /api/auth/dev-login`
- Clear auth: `rm -rf client-app/e2e/.auth/`

**Database connection errors**

- Check Docker: `npm run docker:logs`
- Verify `DATABASE_URL=postgresql://user:password@localhost:5432/dorami`
- Reset: `npm run docker:down && npm run docker:up && npm run prisma:migrate`

**WebSocket connection fails**

- Verify `NEXT_PUBLIC_WS_URL` matches backend URL
- Check Socket.IO namespaces authenticated in `backend/src/main.ts`

**Husky hooks fail**

- Fix linting: `npm run lint:backend --fix && npm run format`
- Skip (not recommended): `git commit --no-verify`
- Reinstall: `npx husky install`

## Key Patterns to Remember

**Error handling:** All exceptions inherit from `BusinessException` (in `backend/src/common/exceptions/`). Frontend's `ApiError` extracts `errorCode` for user messages.

**Real-time:** Three Socket.IO namespaces (`/`, `/chat`, `/streaming`) managed separately. Services broadcast via `SocketIoProvider` singleton — never use `@WebSocketGateway` directly.

**State:** Client state (Zustand) separate from server state (TanStack Query). Use Query for API data; Zustand for UI flags.

**Validation:** Backend class-validator + frontend Zod. Validate at both boundaries.

**Testing:** Backend unit tests via `@nestjs/testing`; frontend E2E via Playwright. No component unit tests.

## Critical File Locations

| Path                                 | Purpose                                |
| ------------------------------------ | -------------------------------------- |
| `backend/src/main.ts`                | Global middleware, Socket.IO bootstrap |
| `backend/src/common/exceptions/`     | Error definitions                      |
| `backend/prisma/schema.prisma`       | Database schema                        |
| `client-app/lib/api/client.ts`       | HTTP + auth retry logic                |
| `client-app/lib/store/auth.ts`       | Zustand auth store                     |
| `packages/shared-types/src/index.ts` | Shared enums + utilities               |
