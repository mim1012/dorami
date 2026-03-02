# Type Mismatch Analysis Report
## Dorami Live Commerce Platform

**Analysis Date:** 2026-03-01
**Scope:** Prisma Schema ↔ NestJS DTOs ↔ Shared-Types (Frontend)
**Total Entities Analyzed:** 23
**Total Fields Analyzed:** 180+
**Critical Issues Found:** 12
**High Severity Issues:** 8
**Medium Severity Issues:** 25+

---

## Executive Summary

This report identifies type mismatches across three critical type definition layers in the Dorami platform:

1. **Prisma Schema** (Database - source of truth for structure)
2. **NestJS DTOs** (Backend API contract)
3. **Shared-Types Package** (Frontend type definitions)

The analysis reveals **systematic inconsistencies** in:
- **Date/Timestamp serialization** (DateTime vs Date vs ISO string)
- **Decimal number handling** (Decimal vs number vs string)
- **Field presence** (Schema has fields missing from frontend types)
- **Field naming** (quantity vs stock naming inconsistency)
- **Enum values** (UserRole has invalid values in DTO)
- **Nullability** (inconsistent null handling across layers)

---

## Critical Issues (MUST FIX)

### 1. **Date Serialization Inconsistency** (Severity: HIGH)
**Affected Fields:** createdAt, updatedAt, paidAt, shippedAt, deliveredAt, profileCompletedAt, suspendedAt, lastLoginAt

**Problem:**
```
Prisma:       DateTime (JS Date object)
DTO:          Date (JS Date object - sometimes)
Shared-Types: string (ISO 8601 format)
```

**Impact:**
- Frontend expects ISO 8601 strings but receives Date objects
- JSON serialization may produce inconsistent formats
- Date comparisons fail in frontend logic

**Root Cause:** DTOs use `Date` as response type but Prisma DateTime needs to be serialized to ISO string

**Fix:**
```typescript
// In all response DTOs, change:
@ApiProperty()
createdAt!: Date;

// To:
@ApiProperty()
createdAt!: string; // ISO 8601
```

**Files to Update:**
- `backend/src/modules/*/dto/*.dto.ts` (all response DTOs with Date fields)
- Add interceptor to serialize all DateTime fields to ISO 8601 in `main.ts`

---

### 2. **Decimal Financial Data Handling** (Severity: HIGH)
**Affected Fields:**
- Order: subtotal, shippingFee, total
- Cart: price, shippingFee
- OrderItem: price, shippingFee
- Settlement: totalSales, commission, settlementAmount
- Product: price, shippingFee, discountRate, originalPrice

**Problem:**
```
Prisma:       Decimal(10,2) - high precision
DTO:          number - potential precision loss
Shared-Types: string - Decimal-safe (correct)
```

**Example:**
```typescript
// Backend returns:
{ price: 29000.99 }  // number - loses precision

// Frontend expects:
{ price: "29000.99" }  // string - preserves precision
```

**Impact:**
- Floating-point arithmetic errors in financial calculations
- Rounding errors accumulate (critical for payments)
- Frontend safe conversion functions unused

**Fix:**
1. Change DTO response types:
```typescript
// From:
@ApiProperty({ example: 29000 })
price!: number;

// To:
@ApiProperty({ example: "29000.00" })
price!: string;
```

2. Update Prisma serialization to return strings for Decimal fields

**Files to Update:**
- `backend/src/modules/orders/dto/order.dto.ts`
- `backend/src/modules/cart/dto/cart.dto.ts`
- `backend/src/modules/products/dto/product.dto.ts`
- `backend/src/modules/settlement/dto/settlement.dto.ts`

---

### 3. **Invalid Enum Values in DTO** (Severity: HIGH)
**Location:** `backend/src/modules/users/dto/user.dto.ts`

**Problem:**
```typescript
// user.dto.ts defines:
export enum UserRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  ADMIN = 'ADMIN',
}

// But Prisma schema only has:
enum Role {
  USER
  ADMIN
}

// And shared-types has:
export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}
```

**Impact:**
- API accepts invalid roles (BUYER, SELLER don't exist in DB)
- Type safety broken across layers
- Swagger docs misleading

**Fix:**
```typescript
// In user.dto.ts, remove UserRole enum and import from shared-types:
import { Role } from '@live-commerce/shared-types';

// Update DTO to use:
@ApiProperty({ enum: Role })
role!: Role;
```

**Files to Update:**
- `backend/src/modules/users/dto/user.dto.ts` (remove UserRole enum, import from shared-types)
- `backend/src/modules/users/dto/profile.dto.ts` (same fix)

---

### 4. **Field Naming Inconsistency** (Severity: HIGH)
**Entity:** Product
**Issue:** quantity (Prisma) vs stock (DTO/Frontend)

**Problem:**
```typescript
// Prisma:
quantity: Int

// DTOs:
stock: number  // Breaks direct mapping

// Shared-types:
stock: number
```

**Impact:**
- Manual field mapping required in services
- Inconsistent terminology in API responses
- DTO-to-Entity conversion error-prone

**Fix Option A (Preferred):** Update Prisma schema
```prisma
model Product {
  stock Int  // Rename from quantity
}

// Update migrations: ALTER TABLE products RENAME COLUMN quantity TO stock;
```

**Fix Option B:** Update DTOs to use quantity
```typescript
// In product.dto.ts:
@ApiProperty()
quantity!: number;  // Match Prisma field name

// Update shared-types to use quantity instead of stock
```

**Recommendation:** Use Option A (Prisma rename) for long-term consistency

---

## High Severity Issues (STRONGLY RECOMMENDED)

### 5. **Nullable Email Field**
**Entity:** User | **Field:** email

```
Prisma:       String? @unique
Shared-Types: email: string (required)
```

**Fix:**
```typescript
// shared-types/src/index.ts
export interface User {
  email?: string;  // Change from required to optional
}
```

---

### 6. **Missing Fields in Shared-Types**
**Issue:** Prisma schema contains fields not exposed in shared-types

**Missing Fields:**
| Entity | Prisma Field | Reason |
|--------|------|--------|
| User | suspensionReason | Admin feature |
| Product | peakViewers | Analytics |
| LiveStream | title, description | Stream metadata |
| LiveStream | freeShippingEnabled | Business logic |
| Order | trackingNumber | Shipping |
| Reservation | promotedAt | Queue system |

**Fix:** Add all fields to shared-types interfaces that backend exposes:
```typescript
// packages/shared-types/src/index.ts

export interface User {
  // ... existing fields
  suspensionReason?: string;  // Add this
}

export interface Product {
  // ... existing fields
  peakViewers?: number;  // Add this
}

export interface LiveStream {
  title?: string;  // Add this
  description?: string;  // Add this
  peakViewers?: number;
  freeShippingEnabled?: boolean;
}
```

---

### 7. **Missing DTO Fields for Order Response**
**Entity:** Order | **Field:** shippingAddress

**Problem:** Prisma stores encrypted shipping address (Json field) but OrderResponseDto doesn't include it

**Fix:**
```typescript
// order.dto.ts
export class OrderResponseDto {
  // ... existing fields

  @ApiProperty({
    description: '배송 주소',
    example: { fullName: '홍길동', address1: '123 Main St', ... }
  })
  shippingAddress!: ShippingAddress;  // Add this field
}
```

---

### 8. **Type Safety for JSON Fields**
**Affected:** SystemConfig (shippingMessages, homeFeaturedProducts, marketingCampaigns, paymentProviders)

**Problem:**
```typescript
// Prisma:
shippingMessages Json?

// DTO:
items: Record<string, unknown>[]  // Too permissive

// Shared-types:
undefined  // Not exposed
```

**Fix:** Define strict interfaces for JSON fields:
```typescript
// shared-types/src/index.ts

export interface ShippingMessages {
  preparing: string;
  shipped: string;
  inTransit: string;
  delivered: string;
}

export interface FeaturedProduct {
  productId: string;
  position: number;
  // ... other fields
}

export interface SystemConfig {
  // ... existing fields
  shippingMessages?: ShippingMessages;
  homeFeaturedProducts?: FeaturedProduct[];
  marketingCampaigns?: Record<string, unknown>[];
  paymentProviders?: Record<string, unknown>[];
}
```

---

## Medium Severity Issues (RECOMMENDED)

### 9. **Inconsistent Null Handling**

**Example - Product.streamKey:**
```typescript
// Prisma: streamKey String? (products can exist without stream)
// Shared-types: streamKey: string (required)
```

**Fix:** Update shared-types to match Prisma nullable fields:
```typescript
export interface Product {
  streamKey?: string;  // Change from required
  // ... other fields
}

export interface LiveStream {
  description?: string;  // Add if missing
}
```

---

### 10. **DTO Type Inconsistencies**

**Issue - User Status Field:**
```typescript
// user.dto.ts uses string instead of enum:
@ApiProperty()
role!: string;

// Should be:
@ApiProperty({ enum: UserStatus })
status!: UserStatus;
```

**Files:** All DTOs - ensure enum types are used properly

---

### 11. **Date Field in CartItemResponseDto**
**Location:** `backend/src/modules/cart/dto/cart.dto.ts`

```typescript
// Current (mixed types):
@ApiProperty()
createdAt!: string;

@ApiProperty()
updatedAt!: string;

// Inconsistent with other DTOs that use Date
```

**Fix:** Standardize all timestamps to ISO string:
```typescript
@ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
createdAt!: string;

@ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
updatedAt!: string;
```

---

## Summary of Changes Required

### Priority 1 (Critical - Fix Immediately)
| File | Change | Lines |
|------|--------|-------|
| user.dto.ts | Remove UserRole enum, import Role from shared-types | 4-8 |
| order.dto.ts | Change financial fields (subtotal, shippingFee, total) from number to string | 81-88 |
| cart.dto.ts | Change financial fields (price, shippingFee) from number to string | 54-67 |
| All response DTOs | Change Date fields to string (ISO 8601) | Many |
| shared-types/index.ts | Add missing fields (suspensionReason, title, description, etc.) | 30+ |

### Priority 2 (High - Fix This Sprint)
| File | Change |
|------|--------|
| product.dto.ts | Rename quantity → stock or vice versa (align with Prisma) |
| streaming.dto.ts | Add title field to LiveStream types |
| admin.dto.ts | Add trackingNumber field to Order response |
| shared-types/index.ts | Add all SystemConfig JSON field definitions |

### Priority 3 (Medium - Plan for Next Sprint)
| File | Change |
|------|--------|
| All DTOs | Add null-safe type definitions for nullable fields |
| Interceptors | Add DateTime → ISO string serialization layer |
| Validators | Add custom validators for Decimal vs number fields |

---

## Implementation Checklist

### Phase 1: Critical Fixes (1-2 days)
- [ ] Update user.dto.ts to use Role enum from shared-types
- [ ] Change Order/Cart DTOs to use string for financial fields
- [ ] Add shippingAddress to OrderResponseDto
- [ ] Update shared-types with missing entity fields

### Phase 2: Date Serialization (1 day)
- [ ] Update all response DTOs to use string for Date fields
- [ ] Add interceptor to serialize Prisma DateTime to ISO string
- [ ] Test date parsing on frontend

### Phase 3: Field Naming (1-2 days)
- [ ] Decide on quantity vs stock naming convention
- [ ] Update Prisma migration or DTOs
- [ ] Update shared-types to match

### Phase 4: Validation & Testing (2-3 days)
- [ ] Type check all modules: `npm run type-check:all`
- [ ] Run E2E tests with new types: `npx playwright test`
- [ ] Manual API testing with Postman/cURL

### Phase 5: Documentation (1 day)
- [ ] Update CLAUDE.md with type serialization rules
- [ ] Add comment in shared-types about Decimal-safe string fields
- [ ] Document JSON field structures in SystemConfig

---

## Type Serialization Standards (Proposed)

### Dates/Timestamps
```typescript
Prisma DateTime → DTO/Response string (ISO 8601)
Example: "2024-01-15T10:30:00.000Z"
```

### Decimal Numbers
```typescript
Prisma Decimal(10,2) → DTO/Response string
Example: "29000.99"
```

### Enums
```typescript
Always use proper enum types from shared-types
Never use generic string type for enums
```

### JSON Fields
```typescript
Prisma Json → DTO Record<string, unknown> → strict interface in shared-types
Always define explicit interfaces for JSON structures
```

### Nullable Fields
```typescript
Prisma ? → DTO ? → shared-types ?
Keep nullability consistent across all layers
```

---

## Files Modified Summary

**To Be Updated:**
1. `packages/shared-types/src/index.ts` (add ~20 fields)
2. `backend/src/modules/users/dto/user.dto.ts` (remove UserRole, import Role)
3. `backend/src/modules/users/dto/profile.dto.ts` (import Role)
4. `backend/src/modules/orders/dto/order.dto.ts` (Decimal fields to string)
5. `backend/src/modules/cart/dto/cart.dto.ts` (Decimal fields to string)
6. `backend/src/modules/products/dto/product.dto.ts` (quantity vs stock decision)
7. `backend/src/modules/streaming/dto/streaming.dto.ts` (add missing fields)
8. `backend/src/modules/admin/dto/admin.dto.ts` (add missing fields)
9. `backend/src/main.ts` (add DateTime serialization interceptor)

**Total Lines to Change:** ~150-200 lines

---

## Testing Strategy

### Unit Tests
```bash
npm run test:backend -- --testPathPattern=dto
npm run test:backend -- --testPathPattern=serializer
```

### Integration Tests
```bash
npm run type-check:all  # Verify all types match
```

### E2E Tests
```bash
cd client-app
npx playwright test --project=user
npx playwright test --project=admin
```

### Manual Testing
1. Create order with multiple items
2. Verify prices returned as strings
3. Parse prices in frontend with parseDecimal()
4. Verify all dates are ISO 8601 format

---

## Risk Assessment

**Low Risk:** Adding missing fields to shared-types (backward compatible)
**Medium Risk:** Changing DTO response types (requires frontend updates)
**High Risk:** Renaming Prisma columns (requires migration + coordination)

**Recommendation:** Start with low-risk changes, coordinate high-risk changes with frontend team.

---

## Related Documents

- See `/TYPE_MISMATCH_ANALYSIS.csv` for detailed field-by-field comparison
- CLAUDE.md Project Type Serialization Standards (to be created)
- Database schema: `backend/prisma/schema.prisma`
- Shared types: `packages/shared-types/src/index.ts`

