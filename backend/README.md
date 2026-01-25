# Live Commerce Backend API

라이브 커머스 플랫폼의 백엔드 시스템입니다.

## Tech Stack

- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL 16
- **ORM**: Prisma 6.x
- **Cache/Messaging**: Redis 7
- **WebSocket**: Socket.IO 4.x
- **Streaming**: Nginx RTMP
- **Authentication**: JWT + Kakao OAuth

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Start Docker services (PostgreSQL, Redis, Nginx RTMP):
```bash
docker-compose up -d
```

4. Run Prisma migrations:
```bash
npm run prisma:migrate
```

5. Generate Prisma Client:
```bash
npm run prisma:generate
```

### Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

The API will be available at `http://localhost:3000/api`

### Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Project Structure

```
backend/
├── src/
│   ├── modules/           # Domain modules
│   │   ├── auth/          # Authentication & Authorization
│   │   ├── users/         # User management
│   │   ├── products/      # Product management
│   │   ├── orders/        # Order & Cart management
│   │   ├── websocket/     # Real-time communication
│   │   ├── notifications/ # Push notifications
│   │   ├── streaming/     # Live streaming
│   │   ├── settlement/    # Settlement & Reporting
│   │   ├── store/         # Store management
│   │   └── config-system/ # System configuration
│   ├── common/            # Shared utilities
│   │   ├── filters/       # Exception filters
│   │   ├── interceptors/  # Response interceptors
│   │   ├── guards/        # Auth guards
│   │   └── logger/        # Logging service
│   ├── app.module.ts
│   └── main.ts
├── prisma/
│   └── schema.prisma      # Database schema
├── test/                  # E2E tests
├── docker-compose.yml     # Docker services
└── package.json
```

## API Documentation

### Health Check
- GET `/api/health` - Server health status

### Authentication
- POST `/api/auth/kakao` - Kakao OAuth login
- POST `/api/auth/refresh` - Refresh JWT token

### Products
- GET `/api/products` - List products
- GET `/api/products/:id` - Get product details
- POST `/api/products` - Create product (seller only)
- PATCH `/api/products/:id` - Update product
- DELETE `/api/products/:id` - Delete product

### Orders
- POST `/api/orders` - Create order
- GET `/api/orders/:id` - Get order details
- PATCH `/api/orders/:id/cancel` - Cancel order

### WebSocket Events
- `message:send` - Send chat message
- `product:updated` - Product update notification
- `stock:changed` - Stock change notification
- `order:created` - New order notification

## Environment Variables

See `.env.example` for all available configuration options.

## License

MIT
