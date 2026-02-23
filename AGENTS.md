# AGENTS.md — Dorami Live Commerce Platform

## Project Overview

Dorami is a **live commerce MVP** — a one-seller livestreaming e-commerce platform for the Korean market. A seller broadcasts product demos and sells directly to viewers in real-time.

**Monorepo** (npm workspaces): `backend/`, `client-app/`, `packages/shared-types/`

## Tech Stack

| Layer     | Technology                                                    |
| --------- | ------------------------------------------------------------- |
| Backend   | NestJS 11, Prisma ORM, PostgreSQL 16, Redis 7                 |
| Frontend  | Next.js 16 (App Router), Zustand, TanStack Query v5           |
| Real-time | Socket.IO (chat, cart updates, notifications)                 |
| Streaming | Nginx RTMP (1935), HLS (8080)                                 |
| Auth      | Kakao OAuth → JWT (access 15min / refresh 7d)                 |
| Shared    | `@live-commerce/shared-types` — TypeScript enums & interfaces |
| Infra     | Docker Compose (local), AWS (production)                      |

## Directory Structure

```
dorami/
├── backend/src/
│   ├── main.ts                  # App bootstrap, global middleware
│   ├── app.module.ts            # Root module
│   ├── common/                  # Shared infrastructure
│   │   ├── decorators/          # @AdminOnly, @Public, @CurrentUser
│   │   ├── exceptions/          # BusinessException + subclasses
│   │   ├── filters/             # BusinessExceptionFilter
│   │   ├── guards/              # JWT, Role, CSRF guards
│   │   ├── interceptors/        # TransformInterceptor (response wrapper)
│   │   ├── prisma/              # PrismaService
│   │   ├── redis/               # Redis adapter
│   │   └── config/              # Environment config
│   └── modules/                 # Feature modules (NestJS pattern)
│       ├── auth/                # Kakao OAuth, JWT, dev-login
│       ├── users/               # User CRUD, roles
│       ├── products/            # Product management
│       ├── streaming/           # LiveStream CRUD, status
│       ├── cart/                # Cart with 10-min TTL expiration
│       ├── orders/              # Orders (ORD-YYYYMMDD-XXXXX format)
│       ├── reservation/         # Waiting list → cart promotion
│       ├── chat/                # WebSocket chat
│       ├── notifications/       # Web Push (VAPID)
│       ├── points/              # Point balance & transactions
│       ├── settlement/          # Seller settlement
│       ├── restream/            # FFmpeg multi-target restream
│       ├── admin/               # Admin panel + audit logs
│       ├── store/               # Store info management
│       ├── notices/             # Notice/announcement system
│       ├── upload/              # File upload handling
│       ├── health/              # Health check endpoint
│       └── websocket/           # Socket.IO gateway
├── client-app/src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── (auth)/              # Auth routes (login, callback)
│   │   ├── admin/               # Admin dashboard pages
│   │   ├── shop/                # Shop/product listing
│   │   ├── live/                # Live stream viewer
│   │   ├── cart/                # Cart page
│   │   ├── checkout/            # Checkout flow
│   │   ├── orders/              # Order history
│   │   ├── products/            # Product detail pages
│   │   ├── store/               # Store page
│   │   ├── my-page/             # User profile/settings
│   │   └── profile/             # Profile management
│   ├── components/              # React components by feature
│   │   ├── admin/               # Admin UI components
│   │   ├── home/                # Homepage (hero, live cards)
│   │   ├── live/                # Live stream components
│   │   ├── product/             # Product cards, detail
│   │   ├── cart/                # Cart UI
│   │   ├── chat/                # Chat overlay
│   │   ├── layout/              # Header, footer, navigation
│   │   ├── common/              # Shared UI components
│   │   └── notifications/       # Push notification UI
│   ├── lib/
│   │   ├── api/                 # API client + endpoint functions
│   │   ├── hooks/               # Custom hooks (queries, mutations)
│   │   ├── store/               # Zustand stores (auth state)
│   │   ├── socket/              # Socket.IO client setup
│   │   ├── utils/               # Utility functions
│   │   ├── constants/           # App constants
│   │   ├── theme/               # Theme configuration
│   │   └── providers/           # React context providers
│   └── types/                   # Frontend-specific types
└── packages/shared-types/src/
    ├── index.ts                 # Enums: Role, UserStatus, StreamStatus, OrderStatus, PaymentMethod...
    └── events.ts                # Socket.IO event interfaces
```

## Key Patterns

### Backend Request Flow

```
Controller → Service → Prisma ORM → PostgreSQL
```

### Global Middleware Stack (order matters)

```
cookieParser → helmet → compression → ValidationPipe → BusinessExceptionFilter → TransformInterceptor → CsrfGuard
```

### API Convention

- Prefix: `/api/v1/...`
- Response envelope: `{ data, success, timestamp }`
- Frontend proxy: Next.js rewrites `/api/:path*` → backend (port 3001)

### Authentication Flow

```
Kakao OAuth → JWT → HttpOnly cookies
Access token: 15 min | Refresh token: 7 days
Dev login: available for E2E tests
```

### Custom Decorators

- `@AdminOnly()` — JWT + Role guard combined
- `@Public()` — skip auth
- `@CurrentUser()` — extract user from JWT

### Error Handling

- `BusinessException` with named error codes
- Subclasses: `InsufficientStockException`, `CartExpiredException`, `OrderNotFoundException`, etc.

### Frontend State

- Client state: **Zustand** (`lib/store/auth.ts`)
- Server state: **TanStack Query v5** (`lib/hooks/`)
- Real-time: **Socket.IO** client

## Commands

```bash
# Dev
npm run dev:all              # Backend + Frontend
npm run dev:backend          # NestJS only (port 3001)
npm run dev:client           # Next.js only (port 3000)

# Infrastructure
npm run docker:up            # PostgreSQL + Redis + Nginx RTMP
npm run docker:down

# Database
npm run prisma:generate      # After schema changes
npm run prisma:migrate       # Create + apply migration

# Test
npm run test:backend         # Jest unit tests
cd client-app && npx playwright test   # E2E tests

# Quality
npm run lint:all             # ESLint
npm run type-check:all       # tsc --noEmit
npm run format               # Prettier
```

## Database

- Schema: `backend/prisma/schema.prisma`
- Order ID format: `ORD-YYYYMMDD-XXXXX` (not UUID)
- Shipping addresses: encrypted (AES-256-GCM)
- Cart TTL: 10 minutes (timer-based expiration)

## Important Conventions

- Language: Korean market — UI text, product data in Korean
- All API responses wrapped in `{ data, success, timestamp }` envelope
- Feature modules follow NestJS pattern: `module.ts`, `controller.ts`, `service.ts`, `dto/`, `entities/`
- Frontend uses App Router conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`
- Shared enums/types must go in `packages/shared-types`, not duplicated
- Pre-commit: Husky + lint-staged (ESLint + Prettier)
