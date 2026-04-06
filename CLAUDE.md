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

**Authentication:** Kakao OAuth → JWT. Access token 1h (HttpOnly cookie, configurable via `JWT_ACCESS_EXPIRES_IN`), refresh token 7 days. Dev login endpoint exists for E2E tests (`POST /api/auth/dev-login`, enabled via `ENABLE_DEV_AUTH=true`).

**Key custom decorators:**

- `@AdminOnly()` — combines JWT + Role guard for admin routes
- `@Public()` — marks route as auth-exempt
- `@CurrentUser()` — extracts user from JWT context
- `@AllowIncompleteProfile()` — bypasses `ProfileCompleteGuard` for routes accessible before profile setup (e.g., profile registration)

**Guards (applied globally):**

- `ProfileCompleteGuard` — after JWT auth, verifies `profileCompletedAt` is set in DB; throws `ProfileIncompleteException` if not. Skipped for `@Public()` and `@AllowIncompleteProfile()` routes; ADMIN role always bypasses.

**Error handling:** `BusinessException` with named error codes (`business.exception.ts`). Predefined subclasses: `InsufficientStockException`, `CartExpiredException`, `OrderNotFoundException`, etc. Frontend has a localization layer (`lib/errors/error-messages.ts`) mapping `errorCode` → Korean user-friendly messages with HTTP status fallbacks.

**Rate limiting:** Three-tier throttler (`short`/`medium`/`long`) configured in `backend/src/common/throttler/throttler.config.ts`. Dev mode auto-scales limits higher. `THROTTLE_DISABLED=true` bypasses all limits (for load testing). Auth endpoints have separate stricter limits. `/api/auth/refresh` is exempt from rate limiting to prevent mass logout cascades. Session-based rate limiting for in-app browsers (Instagram/Facebook/LINE/KakaoTalk).

**Key modules:** `auth`, `users`, `products`, `streaming`, `cart` (10-min expiration timer), `orders`, `reservation` (waiting list → promoted to cart), `chat` (WebSocket), `notifications` (Web Push VAPID), `points`, `settlement`, `restream` (FFmpeg multi-target), `admin` (audit logs), `notices`, `upload`, `health` (liveness/readiness probes), `store`

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
- Real-time: Socket.IO client connecting to WebSocket URL from runtime config (default `http://localhost:3001`)

**Runtime config** (`app/api/config/route.ts`): `GET /api/config` endpoint with `force-dynamic` — replaces build-time `NEXT_PUBLIC_*` env vars. Exposes `wsUrl`, `kakaoExternalOrigin`, `vapidPublicKey`, `enableDevAuth`, `previewEnabled`, `cdnUrl`, `appEnv`, `appVersion`, `kakaoChannelId`, `instagramId`. Frontend fetches this at runtime so env changes take effect without rebuild.

**API client** (`lib/api/client.ts`): Custom fetch wrapper with automatic CSRF token injection, 401 → token refresh (coalesced, deduplicated) → retry, 429 auto-retry with exponential backoff (max 3 retries), response unwrapping from `{data}` envelope. All API functions in `lib/api/`. `ApiError` carries `statusCode`, `errorCode`, and `details`.

**Error localization** (`lib/errors/error-messages.ts`): Maps `errorCode` → Korean user messages. Priority: errorCode mapping → HTTP status fallback → generic fallback. Used in live page, cart, and checkout. `getUserMessage(error)` is the single entry point.

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

**Live page** (`app/live/[streamKey]/page.tsx`): Layout is driven by `useLiveLayoutMachine`. `VideoPlayer` tries HTTP-FLV (mpegts.js) first for low latency, then falls back to HLS (hls.js) on error. Props: `onStreamError` (legacy toggle), `onStreamStateChange` (fires typed `VideoStreamEvent` — `PLAY_OK` | `STALL` | `MEDIA_ERROR` | `STREAM_ENDED`; feeds the layout FSM), `hideErrorOverlay` (suppresses the built-in `ErrorOverlay` when the parent handles error display). Dev mode shows a KPI overlay (first-frame ms, rebuffer count, stall duration, reconnect count). **Auth guard removed** — unauthenticated users can watch the stream; purchase actions redirect to login with `reason=purchase` query param.

**Preview page** (`app/live/preview/page.tsx`): Mirrors `/live/[streamKey]` layout with mock products (50 items). Enabled via `PREVIEW_ENABLED=true` env var. Useful for design/demo without a live stream.

**In-app browser handling:** Detects Instagram, Facebook, LINE, and KakaoTalk in-app browsers. Uses session-based rate limiting instead of IP-based for these browsers (they share IPs via carrier NAT).

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
- `CartStatus`: `ACTIVE` | `EXPIRED` | `COMPLETED`
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
- `PROFILE_LEGACY_ENCRYPTION_KEYS` — comma-separated old keys for rotation support
- `ADMIN_EMAILS` — comma-separated emails auto-assigned `ADMIN` role on first Kakao login
- `CSRF_ENABLED=false` — disables CSRF guard (useful for API testing)
- `CORS_ORIGINS` — comma-separated allowed origins (default: `http://localhost:3000`; production: `https://doremi-live.com,https://www.doremi-live.com`)
- `PORT` — backend HTTP port (default: 3001)
- `APP_ENV=production` — hides Swagger docs (separate from `NODE_ENV`)
- `ENABLE_DEV_AUTH=true` — enables dev login endpoint for E2E testing
- `THROTTLE_DISABLED=true` — bypasses all rate limits (for load testing only)
- `THROTTLE_SHORT_LIMIT`, `THROTTLE_MEDIUM_LIMIT`, `THROTTLE_LONG_LIMIT` — per-tier rate limit overrides
- `SRS_WEBHOOK_SECRET` — SRS webhook authentication (optional)
- `LOG_LEVEL` — logging verbosity
- `COOKIE_SECURE=true` — HTTPS-only cookies (staging/prod)

**Frontend env vars** (runtime config via `GET /api/config`, no rebuild needed):

- `WS_URL` — Socket.IO server URL (default `http://localhost:3001`)
- `BACKEND_URL` — backend base for Next.js proxy (default `http://127.0.0.1:3001`)
- `MEDIA_SERVER_URL` — SRS media server for Next.js proxy (default `http://127.0.0.1:8080`)
- `PREVIEW_ENABLED=true` — enables `/live/preview` demo page
- `CDN_URL` — CDN base URL for assets
- `KAKAO_EXTERNAL_ORIGIN` — Kakao OAuth redirect origin
- `VAPID_PUBLIC_KEY` — Web Push VAPID public key

### Production Infrastructure

**Deployment model:** Docker Compose on a single server (not Kubernetes). Compose overlays: `docker-compose.base.yml` + `docker-compose.prod.yml` (production) or `docker-compose.staging.yml` (staging).

**Production compose** (`docker-compose.prod.yml`):

- Resource limits: PostgreSQL `mem_limit: 2g, cpus: 2`; Redis `maxmemory 512mb` with `volatile-lru`
- Logging: `max-size: 50m, max-file: 5` per container
- All env vars validated with `:?` (fail-fast on missing)
- Images: GHCR with immutable SHA tags (`ghcr.io/{owner}/dorami-backend:sha-<hash>`)
- Network: `dorami-internal` (use service names for inter-container DNS, NOT container names)

**Streaming:** SRS v6 in Docker (local/staging). AWS CDK code in `infrastructure/aws-cdk/` for ECS Fargate streaming (optional).

```
OBS → RTMP (1935) → SRS → HTTP-FLV / HLS (8080) → Nginx → Client
```

**Stale stream cleanup:** 5-minute cron job checks Redis + DB + SRS consistency. DB `LIVE` streams with no SRS session are auto-set to `OFFLINE`.

### Monitoring & Load Testing

- `infrastructure/monitoring/` — Prometheus config, alert rules, health-check dashboard
- `infrastructure/loadtest/` — k6/Node.js load test scripts with baseline metrics
- `infrastructure/KPI_DEFINITIONS.json` — performance KPI baseline definitions
- `infrastructure/CURRENT_CAPACITY_ASSESSMENT.md` — capacity limits and bottlenecks

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

## CI/CD Pipeline

GitHub Actions workflows (`.github/workflows/`):

| Workflow                                           | Trigger                           | Purpose                                                                                                   |
| -------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `ci.yml`                                           | PR, push                          | Path-based detection → backend CI (lint, type-check, tests, build), frontend CI, Docker build, Trivy scan |
| `build-images.yml`                                 | Push to main                      | Build + push Docker images to GHCR                                                                        |
| `deploy-staging.yml`                               | After build-images                | Auto-deploy to staging server via SSH                                                                     |
| `deploy-production.yml`                            | Manual (workflow_dispatch)        | Deploy to production with SHA-pinned images                                                               |
| `deploy-production-frontend-auto.yml`              | Push to main (client-app changes) | Auto-deploy frontend-only changes to production                                                           |
| `load-test-ci.yml`                                 | Manual                            | k6 load tests against staging                                                                             |
| `night-qa.yml`                                     | Scheduled (nightly)               | Overnight QA smoke tests                                                                                  |
| `db-maintenance.yml`                               | Manual / scheduled                | Database vacuum, reindex                                                                                  |
| `backup-database.yml`                              | Scheduled                         | Automated DB backups                                                                                      |
| `smoke-test.yml` / `smoke-check.yml`               | Manual                            | Quick health checks                                                                                       |
| `prod-maintenance.yml` / `staging-maintenance.yml` | Manual                            | Server maintenance tasks                                                                                  |

**CI validation includes:** nginx config validation (`nginx -t`), Trivy security scanning, lint + type-check + unit tests.

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
   - Frontend needs: `WS_URL`, `BACKEND_URL` (both default to localhost)
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

- Verify `WS_URL` matches backend URL
- Check Socket.IO namespaces authenticated in `backend/src/main.ts`

**Husky hooks fail**

- Fix linting: `npm run lint:backend --fix && npm run format`
- Skip (not recommended): `git commit --no-verify`
- Reinstall: `npx husky install`

## Key Patterns to Remember

**Error handling:** All exceptions inherit from `BusinessException` (in `backend/src/common/exceptions/`). Frontend's `ApiError` extracts `errorCode` → `getUserMessage()` for Korean user messages. Never show raw error messages to users.

**Real-time:** Three Socket.IO namespaces (`/`, `/chat`, `/streaming`) managed separately. Services broadcast via `SocketIoProvider` singleton — never use `@WebSocketGateway` directly.

**State:** Client state (Zustand) separate from server state (TanStack Query). Use Query for API data; Zustand for UI flags.

**Validation:** Backend class-validator + frontend Zod. Validate at both boundaries.

**Testing:** Backend unit tests via `@nestjs/testing`; frontend E2E via Playwright. No component unit tests.

**Cookie policy:** ALL cookies (`accessToken`, `refreshToken`, `csrf-token`, `session_id`) use `sameSite: 'lax'`. Never use `strict` (breaks Safari OAuth redirect) or `none` (blocked by Safari ITP). This is the only cross-browser compatible option.

**Env var pattern:** Frontend uses runtime config (`GET /api/config`) instead of build-time `NEXT_PUBLIC_*` variables. Use `WS_URL` not `NEXT_PUBLIC_WS_URL` in Docker/env files.

**Nginx zone rule:** `limit_req_zone` declarations go in `nginx.conf` (http block) ONLY. Never duplicate in `staging.conf` or `production.conf`. Violating this crashes nginx with `zero size shared memory zone`.

**Token refresh:** nginx must have `location = /api/auth/refresh` BEFORE `location /api/auth`. Backend refresh endpoint sets BOTH `accessToken` and `refreshToken` cookies. Next.js Route Handler must extract both via `getSetCookie()`.

## Critical File Locations

| Path                                               | Purpose                                      |
| -------------------------------------------------- | -------------------------------------------- |
| `backend/src/main.ts`                              | Global middleware, Socket.IO bootstrap       |
| `backend/src/common/exceptions/`                   | Error definitions                            |
| `backend/src/common/throttler/throttler.config.ts` | Rate limiting tiers                          |
| `backend/prisma/schema.prisma`                     | Database schema                              |
| `client-app/src/app/api/config/route.ts`           | Runtime config API (replaces NEXT*PUBLIC*\*) |
| `client-app/src/lib/api/client.ts`                 | HTTP + auth retry + 429 auto-retry           |
| `client-app/src/lib/errors/error-messages.ts`      | Error code → Korean message mapping          |
| `client-app/src/lib/store/auth.ts`                 | Zustand auth store                           |
| `packages/shared-types/src/index.ts`               | Shared enums + utilities                     |
| `infrastructure/docker/nginx/`                     | Nginx configs (staging/production)           |
| `docker-compose.prod.yml`                          | Production Docker overlay                    |
| `docker-compose.staging.yml`                       | Staging Docker overlay                       |

## Lessons Learned (updated 2026-03-24)

### 1. **Code Reuse: Follow Existing Guard Patterns**

**Issue:** Initial chat WebSocket guard used `streamKey === 'undefined'` string check, deviating from similar guards elsewhere in the codebase.
**Rule:** Always analyze existing hooks/components for established patterns before creating guards. Match the style (e.g., `use-stream-viewer.ts` uses simple `!streamKey`, not string comparison).
**Action:** Remove stringly-typed defensive checks unless there's explicit evidence of that data shape.

### 2. **Early Returns: Require Explicit Cleanup**

**Issue:** Guard clause with early return didn't clean up stale socket and pending message queue refs, causing potential memory leaks and unexpected state when dependencies changed.
**Rule:** Any `useEffect` with an early `return;` statement MUST explicitly clean up resources before returning:

```typescript
if (!valid) {
  if (socketRef.current) socketRef.current.disconnect();
  otherRef.current = [];
  setState(false);
  return; // NOW it's safe to return
}
```

**Why:** Early returns skip the cleanup function (lines after the main logic). Always clean inline before returning.

### 3. **Socket.IO Dependencies: Watch for Reference Changes**

**Issue:** Hook dependency arrays including socket objects can cause cascading cleanup/reconnect if socket reference changes on every render.
**Rule:** When using Socket.IO in dependency arrays, verify:

- Is the socket reference stable across renders?
- Does the `useSocket` hook memoize the socket instance?
- If socket changes, does it trigger unintended cleanup in dependent hooks?
  **Action:** Use refs or memoization for socket objects; avoid including them in dependency arrays unless explicitly intentional.

### 4. **useParams() Hydration: Guard Against Undefined During SSR**

**Issue:** `useParams().streamKey` can be undefined initially in client components during hydration, causing hooks to be called with undefined parameters.
**Rule:** Function signatures should declare the actual type (e.g., `streamKey: string | undefined`) rather than lying with `as string` casts.
**Action:** Either guard at the call site (only render hooks when params are ready) or add guards inside hooks and handle cleanup properly (see #2).

### 5. **Cookie sameSite: Only `lax` Works Cross-Browser**

**Issue:** `sameSite: 'strict'` blocked cookies after Kakao OAuth redirect on Safari and Samsung Internet. `sameSite: 'none'` was blocked by Safari ITP as third-party. Next.js Route Handler (`auth/refresh/route.ts`) had `sameSite: isHttps ? 'strict' : 'lax'` which overwrote backend's `lax` to `strict` in production.
**Rule:** All cookies must use `sameSite: 'lax'` — hardcoded, no conditionals. Never use `isHttps ? 'strict' : 'lax'` pattern.
**Action:** Never change cookie sameSite without testing on Safari, Samsung Internet, and in-app browsers (Instagram, KakaoTalk). Check both backend AND Next.js Route Handlers.

### 6. **Nginx Rate Limit Zones: Single Declaration Only**

**Issue:** Duplicating `limit_req_zone` in both `nginx.conf` and site configs caused `zero size shared memory zone` crash.
**Rule:** Declare all `limit_req_zone` directives in `nginx.conf` (http block) only. Site configs (`staging.conf`, `production.conf`) only reference zones via `limit_req`.
**Action:** When commenting out a zone declaration, also comment out all `limit_req` directives referencing it, or leave the zone declaration active.

### 7. **Docker Inter-Container DNS: Use Service Names**

**Issue:** Using `container_name` (e.g., `dorami-backend-prod`) in nginx `proxy_pass` fails DNS resolution inside Docker networks.
**Rule:** Always use the Docker Compose service name (e.g., `backend`, `redis`, `postgres`) for inter-container communication. Container names are for external identification only.

### 8. **Environment Variable Deployment: `docker compose up -d` Required**

**Issue:** `docker restart` does NOT reload environment variables from `.env` or compose files. Only `docker compose up -d` re-reads and applies env changes.
**Rule:** After any `.env` or compose file change, always run `docker compose up -d`, never just `docker restart`.

### 9. **Cart API Returns Strings, Not Numbers**

**Issue:** Backend `mapToResponseDto` returns `price: String(price)`, `shippingFee: String(shippingFee)`, `subtotal: String(subtotal)`. Frontend `CartItem` interface declared these as `number`. JS `0 + "0"` = `"00"` (string concatenation), causing `$20 → $2,000` display bug.
**Rule:** When backend returns Prisma Decimal fields as strings, always use `Number()` or `parseFloat()` before arithmetic. Frontend interfaces must match actual API response types.
**Action:** Any `reduce((sum, i) => sum + i.price ...)` must use `Number(i.price)`. Check all cart/order/product arithmetic for string coercion.

### 10. **Next.js Route Handler → Nginx Location Required**

**Issue:** Added `app/api/config/route.ts` (Next.js Route Handler) but nginx's generic `location /api/` sent it to backend → 404. Runtime config endpoint was broken for all users.
**Rule:** When adding a Next.js Route Handler under `app/api/*/route.ts`, MUST also add `location = /api/{path}` exact match in nginx config pointing to `http://frontend`. Otherwise the generic `/api/` block proxies to backend.
**Action:** Check existing pattern: `/api/csrf`, `/api/auth/refresh` both have dedicated nginx locations for the same reason.

### 11. **Docker Bind Mount: `sed -i` Breaks Mount**

**Issue:** `sed -i` on a Docker bind-mounted file creates a new inode. The container's mount still points to the old inode → changes invisible inside container. Nginx config edit on prod required container recreate instead of just reload.
**Rule:** Never use `sed -i` on files that are Docker bind-mounted. Instead: edit with `tee` or write to a temp file and `cp` (preserves inode), OR accept that container must be recreated after edit.
**Action:** For nginx config hotfixes, edit host file → `docker compose up -d --force-recreate nginx`.

### 12. **HTML Input `type="number"` Default Step is 1**

**Issue:** `<input type="number">` without `step` attribute defaults to `step="1"` — browser rejects decimal input. Product price $12.70 was submitted as $13 (rounded by browser validation).
**Rule:** All price/currency inputs must have `step="0.01"`. Stock/quantity inputs keep `step="1"`.
**Action:** Search for `type="number"` in admin forms and verify `step` attribute on financial fields.

### 13. **Floating-Point Arithmetic: Use Cent-Based Integers**

**Issue:** `Number("12.70") * 3 = 38.100000000000004` — IEEE 754 binary floating-point errors displayed to users in cart, orders, and admin pages.
**Rule:** All price arithmetic must use cent-based integer math: `Math.round(price * 100) * qty / 100`. Never `price * qty` directly. Use `.toFixed(2)` for string output.
**Action:** `shared-types/calculateCartTotal()` already implements this pattern. Use it or follow the same pattern. Backend `orders.service.ts:471` is the reference implementation.

### 14. **Next.js Standalone: `/_next/image` Returns 404**

**Issue:** Next.js Image component uses `/_next/image?url=...` for optimization, but standalone mode doesn't serve this endpoint in Docker → all `<Image src="/logo.png">` broken.
**Rule:** For static assets in `public/`, always add `unoptimized` prop to `<Image>`. This bypasses the optimization pipeline and serves the file directly.
**Action:** Grep for `src="/logo.png"` or similar static paths and ensure `unoptimized` is present.

### 15. **Middleware Matcher Must Exclude Public Static Files**

**Issue:** `middleware.ts` matcher only excluded `_next/static`, `favicon.ico`, etc. but NOT `/logo.png`, `/icon-*.png` → middleware applied auth check → 307 redirect to `/login` → broken images on login page and unauthenticated pages.
**Rule:** Middleware matcher must exclude all public static file extensions/paths. Current pattern: `/((?!api|_next/static|_next/image|_next/data|favicon\\.ico|icon-.*\\.png|logo\\.png|badge-.*\\.png|manifest\\.json|robots\\.txt|sw\\.js|images/).*)`.
**Action:** When adding new static files to `public/`, check if middleware matcher needs updating.

### 16. **Server Files Must Never Be Modified Directly**

**Issue:** Modifying `docker-compose.staging.yml` and `nginx/staging-ssl.conf` directly on the staging server via `sed -i` caused git divergence. Subsequent `git pull` conflicted, and `docker compose up -d` used stale configs.
**Rule:** ALL changes go through git repo → push → CI/CD deploy. Never `sed -i` or Python-patch files on the server. For emergencies: edit in git → push → `ssh` server → `git pull` → `docker compose up -d`.
**Action:** CI deploy scripts must include `git pull` to sync compose/nginx files, not just Docker image replacement.

### 17. **Prod Deploy Requires Tag on Correct Commit**

**Issue:** `deploy-production.yml` checks out `ref: ${{ needs.validate.outputs.version }}` (git tag). If the tag points to an old commit, `.github/actions/setup-ssh` may not exist → deploy fails.
**Rule:** Before `gh workflow run deploy-production.yml -f version="vX.Y.Z"`, ensure the tag exists on main HEAD: `git tag vX.Y.Z main && git push origin vX.Y.Z`. Never reuse an existing tag that points to a different commit.
**Action:** If tag already exists on remote, increment patch version (e.g., `v1.3.0` → `v1.3.1`).

### 18. **Token Refresh: Lock Before Compare, Not After**

**Issue:** `auth.service.ts _doRefreshToken()` compared stored token with incoming token BEFORE acquiring Redis lock. Two concurrent requests both passed comparison → one rotated the token → other got mismatch → user kicked to login.
**Rule:** Redis lock must be acquired FIRST, then read and compare the stored token inside the critical section. Pattern: `NX lock → read stored → compare → delete → login() → cache result → release lock`.
**Action:** `auth.service.ts:184-253` implements this correctly now. Test mock must include `getClient().del()` for the finally block.

### 19. **Next.js Route Handler Cookie maxAge Must Match Backend JWT**

**Issue:** `app/api/auth/refresh/route.ts` hardcoded `maxAge: 15 * 60` (15 min) for accessToken cookie, but backend signs JWT for 1 hour. Cookie expired early → 4x more refresh calls → amplified race condition.
**Rule:** Parse `max-age` from backend's `Set-Cookie` header instead of hardcoding. Fallback: accessToken 3600s, refreshToken 604800s. Cookie `sameSite` must always be `'lax'`.

### 20. **Redis `allkeys-lru` Evicts Auth Tokens**

**Issue:** Redis with `allkeys-lru` policy evicts ANY key under memory pressure, including `refresh_token:{userId}` → silent mass logout.
**Rule:** Use `volatile-lru` (evicts only keys with TTL). All auth tokens already have explicit TTLs. Set explicit `--maxmemory` (staging: 256mb, prod: 512mb).
**Action:** `docker-compose.base.yml`, `docker-compose.staging.yml`, `docker-compose.prod.yml` all use `volatile-lru` now.

## Sentry 에러 모니터링

### 개요

Sentry 프로젝트 구성:

| 환경 | 백엔드 프로젝트 | 프론트엔드 프로젝트 |
|---|---|---|
| production | `dorami-backend-production` | `dorami-frontend-production` |
| staging | `dorami-backend-staging` | `dorami-frontend-staging` |

### Sentry 에러 현황 체크 방법

`.claude/.env` 파일에 `SENTRY_AUTH_TOKEN`과 `SENTRY_ORG`가 설정되어 있어야 합니다.

```bash
# staging 에러 현황 체크 (최근 24시간)
python3 .claude/sentry_check.py

# production 에러 체크 시 sentry_check.py 내 suffix를 "production"으로 변경 후 실행
```

### 에러 대응 워크플로우

버그 수정 또는 배포 후 반드시 아래 순서로 Sentry를 확인합니다:

1. **배포 완료 후 5분 대기** — 에러가 수집될 시간 확보
2. **`python3 .claude/sentry_check.py` 실행** — 신규 이슈 및 빈도 높은 이슈 확인
3. **신규 이슈(⚡) 발견 시** — 해당 이슈 URL로 접속하여 스택트레이스 분석
4. **이슈 해결 후** — Sentry에서 해당 이슈 Resolve 처리

### 주의사항

- `.claude/.env` 파일은 절대 커밋하지 않습니다 (`.gitignore` 확인)
- `SENTRY_AUTH_TOKEN`은 `org:read`, `project:read` 권한만 있으면 됩니다
- 토큰 만료 시 `https://bizsolution.sentry.io/settings/account/api/auth-tokens/` 에서 재발급
