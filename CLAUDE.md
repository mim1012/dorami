# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dorami is a **live commerce platform** (실시간 라이브 커머스) — a monorepo with a Next.js frontend, NestJS backend, and shared TypeScript types. Viewers watch live streams, chat in real-time, and purchase products with timer-based cart reservations.

## Common Commands

### Development

```bash
npm install                  # Install all workspaces (auto-builds shared-types via postinstall)
npm run dev:all              # Run client (3000) + backend (3001) concurrently
npm run dev:client           # Client only (http://localhost:3000)
npm run dev:backend          # Backend only (http://localhost:3001)
npm run docker:up            # Start PostgreSQL (5432) + Redis (6379) + nginx-rtmp (1935/8080)
```

### Build & Type Check

```bash
npm run build:all            # Build shared-types → client → backend (order matters)
npm run build:shared         # Must run before other builds if shared-types changed
npm run type-check:all       # Type check all workspaces
```

### Testing

```bash
npm run test:backend         # Jest unit tests (backend/src/**/*.spec.ts)
npm run test:e2e             # Jest + Supertest E2E (backend/test/**/*.e2e-spec.ts)
# Single test:
cd backend && npx jest --testPathPattern=<pattern>
cd backend && npx jest path/to/file.spec.ts
```

### Lint & Format

```bash
npm run lint:all             # ESLint for client + backend
npm run format               # Prettier for all files
npm run format:check         # Prettier check without writing
```

### Prisma (Database)

```bash
npm run prisma:generate      # Generate Prisma Client after schema changes
npm run prisma:migrate       # Run migrations (dev mode)
npm run prisma:studio        # Open Prisma Studio (port 5555)
# Direct prisma commands:
cd backend && npx prisma migrate dev --name <migration_name>
cd backend && npx prisma db seed
```

## Architecture

### Monorepo Structure

```
├── packages/shared-types/   # Shared TypeScript types, enums, DTOs, helper functions
├── client-app/              # Next.js 16 (App Router) — port 3000
├── backend/                 # NestJS 11 API — port 3001
└── docker-compose.yml       # PostgreSQL 16, Redis 7, nginx-rtmp
```

`shared-types` is the **single source of truth** for types crossing the HTTP boundary — enums (Role, StreamStatus, OrderStatus, etc.), entity interfaces, request/response DTOs, and utility functions like `generateOrderId()` and `calculateCartTotal()`. It is built automatically on `npm install` and must be rebuilt (`npm run build:shared`) when modified.

### Backend (NestJS)

**Entry**: `backend/src/main.ts` → `backend/src/app.module.ts`

19 feature modules in `backend/src/modules/`:

- **auth** — Kakao OAuth 2.0 → JWT (15m access + 7d refresh in HTTP-only cookies). Token blacklisting via Redis. Admin role determined by `ADMIN_EMAILS` env whitelist.
- **streaming** — Live stream lifecycle (PENDING → LIVE → OFFLINE), RTMP/HLS integration
- **products** — Product CRUD with color/size options, timer-based cart reservation (10 min default)
- **cart** — Cart items with expiration timers, cron job for auto-expiration
- **orders** — Order ID format `ORD-YYYYMMDD-XXXXX`, bank transfer payment flow
- **reservation** — Waitlist queue for sold-out products, sequential promotion with 10-min timer
- **chat** — WebSocket gateway (`/chat` namespace), room-based messaging
- **websocket** — Main WebSocket gateway (default `/`), broadcasts product/cart/stream events
- **settlement** — Seller commission calculation, Excel export
- **admin**, **users**, **notifications**, **points**, **notices**, **upload**, **store**, **health**

**Key patterns:**

- Global `@Public()` decorator opts routes out of JWT guard
- `@Roles(['ADMIN'])` decorator + RolesGuard for admin routes
- CSRF double-submit cookie pattern (toggle via `CSRF_ENABLED` env)
- All responses wrapped by TransformInterceptor: `{ data, success, timestamp }`
- All errors handled by BusinessExceptionFilter: `{ success: false, errorCode, message }`
- EventEmitter2 decouples business logic from WebSocket broadcasting

**Prisma schema**: `backend/prisma/schema.prisma`

- Models use PascalCase, fields use camelCase, DB tables/columns use snake_case with `@@map()`/`@map()`
- Key models: User, LiveStream, Product, Cart, Order, Reservation, PointBalance

**WebSocket**: Socket.IO with Redis adapter for horizontal scaling. Two gateways:

- Default namespace `/` — stream room events (`stream:{streamKey}`)
- Chat namespace `/chat` — chat room events (`live:{liveId}`)

### Frontend (Next.js App Router)

**Path alias**: `@/*` → `client-app/src/*`

**Route structure**:

- `/` — Homepage (upcoming streams, featured products)
- `/live/[streamKey]` — Live stream viewer with real-time chat
- `/shop` — Product catalog
- `/cart`, `/checkout`, `/orders` — Purchase flow
- `/my-page` — User dashboard (profile, points, reservations)
- `/admin/*` — Admin dashboard (protected by ADMIN role) with sidebar layout

**State management strategy:**

- **Server state**: TanStack Query v5 with query key factories in `lib/hooks/queries/`
- **Global client state**: Zustand (`lib/store/auth.ts`) — auth only, persisted to localStorage
- **Form state**: React Hook Form + Zod validation

**API client** (`lib/api/client.ts`): Fetch-based, auto-injects CSRF token from cookies, auto-unwraps `{ data }` responses, sends credentials.

**Socket client** (`lib/socket/socket-client.ts`): Singleton pattern, JWT auth via handshake, WebSocket-first with polling fallback, max 5 reconnection attempts.

**Next.js rewrites**: `/api/*` requests are proxied to the backend URL (`NEXT_PUBLIC_API_URL`), allowing same-origin API calls in development.

### Design System

- **Theme**: Hot Pink (`#FF007A`) on dark background (`#121212`)
- **Font**: Pretendard (CDN)
- **Icons**: Heroicons + Lucide React
- **Charts**: Recharts (admin dashboard)
- **Styling**: Tailwind CSS 4.0

## Git & Deployment Rules

### Branch Policy (STRICT)

- Use **`main` only**. Optionally `dev` for experiments (`dev → main` merge then deploy).
- **NEVER** create branches named `staging`, `prod`, `local`, or `dev` as environment branches.
- Environments (local/staging/production) differ only by env vars and infra config, not by branch.

### Commit Messages

```
feat: 기능 추가          fix: 버그 수정
refactor: 구조 개선      docs: 문서 수정
style: 코드 포맷팅       test: 테스트 추가/수정
chore: 설정/빌드/기타
```

Scope is optional: `feat(cart): 타이머 만료 처리`

### CI/CD

- CI runs automatically on `main` push (lint → test → build)
- CD to staging: **manual trigger only** (`workflow_dispatch`)
- CD to production: **manual trigger + approval**, must deploy the same commit SHA verified on staging
- Never propose automatic staging deploys or production deploys on push

### Staging Errors

Always fix in local on `main`, push, redeploy to staging. Never modify staging directly or create staging-specific branches.

## Coding Conventions

- TypeScript strict mode in both frontend and backend
- Utilities go in `/lib` (not `/utils`)
- Components: PascalCase. Functions/variables: camelCase. Constants: UPPER_SNAKE_CASE.
- Pre-commit hooks (Husky + lint-staged): ESLint + Prettier on backend `.ts`, Prettier on client `.ts/.tsx`
- Prettier config: single quotes, semicolons, trailing commas, 100 char width, 2-space indent
