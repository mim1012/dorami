# Implementation Patterns

This document defines 19 mandatory implementation patterns that ALL code in this project must follow. These patterns prevent inconsistencies, reduce bugs, and ensure AI agents work harmoniously.

**Last Updated:** 2026-01-25

---

## 1. Naming Conventions (6 patterns)

### Pattern 1: Database Naming (Prisma + PostgreSQL)

**Rule:** Prisma uses PascalCase models and camelCase fields. Database uses snake_case tables and columns.

**Enforcement:**
- Prisma models: PascalCase (User, Order, Product)
- Prisma fields: camelCase (userId, createdAt)
- DB tables: snake_case plural with @@map("users")
- DB columns: snake_case with @map("user_id")

### Pattern 2: API Endpoint Naming

**Rule:** Use kebab-case, plural nouns, and standard HTTP methods.

**Examples:**
- GET /api/users
- GET /api/users/:id
- POST /api/users
- PATCH /api/users/:id
- DELETE /api/users/:id
- GET /api/order-items?orderId=123

### Pattern 3: Code Naming (TypeScript)

**Rule:** Components/Classes PascalCase, functions/variables camelCase, constants UPPER_SNAKE_CASE.

**Examples:**
- Classes: UserService, ProductController
- Functions: getUserData, createOrder
- Constants: MAX_RETRY_COUNT, API_BASE_URL
- Interfaces: UserProfile, OrderResponse

### Pattern 4: Event Naming

**Backend Domain Events:** Use dot notation domain.action.target

**Examples:**
- eventEmitter.emit('order.created', event)
- eventEmitter.emit('product.stock.updated', event)
- @OnEvent('order.created')

**WebSocket Events:** Use colon notation domain:action:target

**Examples:**
- socket.emit('live:chat:message', data)
- socket.emit('product:stock:update', data)

### Pattern 5: File Naming

**Rule:**
- Components: PascalCase (UserCard.tsx)
- Utilities: kebab-case (format-date.ts)
- Tests: Same as source + .test or .spec (user.service.spec.ts)

### Pattern 6: Environment Variables

**Rule:** UPPER_SNAKE_CASE for all environment variables.

**Examples:**
- DATABASE_URL
- JWT_SECRET
- NEXT_PUBLIC_API_URL

---

## 2. Structure Conventions (4 patterns)

### Pattern 7: Co-located Tests

**Rule:** Test files must be co-located with source files, NOT in separate __tests__/ directory.

### Pattern 8: Feature-based Organization

**Rule:** Organize by feature/domain, NOT by file type. No Atomic Design.

**Structure:**
- src/modules/users/ (contains controller, service, module, dto)
- src/modules/orders/ (contains controller, service, module, dto)
- NOT: src/controllers/, src/services/, src/models/

### Pattern 9: Utility Organization

**Rule:** Use /lib for shared utilities. Never use /utils, /helpers, or /shared.

### Pattern 10: Config File Location

**Rule:** Config files at project root. Runtime configs in /src/config.

---

## 3. Format Conventions (4 patterns)

### Pattern 11: API Response Format

**Rule:** Wrap all successful responses in {data}. Errors use standard format.

**Success:**
{
  "data": { "id": 123, "name": "Product" }
}

**Error:**
{
  "statusCode": 404,
  "errorCode": "PRODUCT_NOT_FOUND",
  "message": "Product not found",
  "timestamp": "2025-01-24T10:30:00Z",
  "path": "/api/products/123"
}

### Pattern 12: JSON Field Naming

**Rule:** ALL JSON keys must be camelCase (API, WebSocket, storage).

### Pattern 13: Date/Time Format

**Rule:** Use ISO 8601 strings in API/JSON. Store as DateTime in Prisma.

**Example:** "2025-01-24T10:30:00Z"

### Pattern 14: Boolean & Null Handling

**Rule:** Use true/false for booleans. Use null for missing values. Never use 1/0.

---

## 4. Communication Conventions (3 patterns)

### Pattern 15: WebSocket Event Structure

**Rule:** Server → Client events must include {type, data}. Client → Server sends data only.

### Pattern 16: State Management (Zustand)

**Rule:** Use selective subscription pattern. Never subscribe to entire store.

**Example:**
const user = useAuthStore((state) => state.user);

### Pattern 17: React Query Patterns

**Rule:** Use hierarchical cache keys. Define queryKeys object. Set explicit staleTime.

---

## 5. Process Conventions (4 patterns)

### Pattern 18: Error Handling

**Rule:** Backend uses BusinessException with errorCode. Frontend uses ErrorBoundary.

### Pattern 19: Loading State Naming

**Rule:** Use isLoading for initial load, isPending for mutations, isFetching for background refetch.

### Pattern 20: Logging

**Rule:** Use LoggerService wrapper. NEVER use console.log in production code.

### Pattern 21: Domain Events

**Rule:** Use EventEmitter2 for decoupling. Events use class-based payloads.

**Example:**
export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

this.eventEmitter.emit('order.created', new OrderCreatedEvent(id, userId));

@OnEvent('order.created')
async handleOrderCreated(event: OrderCreatedEvent) {
  // Handle event
}

---

## Enforcement

**Automated Checks:**
- ESLint rules for naming conventions
- Prettier for code formatting
- TypeScript strict mode for type safety
- Pre-commit hooks to prevent violations

**Code Review Checklist:**
Before approving any PR, verify:
1. [ ] All naming conventions followed
2. [ ] Tests co-located with source
3. [ ] No forbidden directories (utils, helpers, __tests__)
4. [ ] API responses use {data} wrapper
5. [ ] Dates in ISO 8601 format
6. [ ] Events use correct naming (dot for domain, colon for WebSocket)
7. [ ] No console.log in services
8. [ ] Errors use BusinessException with errorCode
9. [ ] Loading states use isLoading/isPending/isFetching
10. [ ] React Query has explicit staleTime

**Violation Consequences:**
- PR rejected until fixed
- Documentation updated if pattern unclear
- Pattern added if new case discovered

---

_This document is the single source of truth for all implementation patterns. When in doubt, refer here first._
