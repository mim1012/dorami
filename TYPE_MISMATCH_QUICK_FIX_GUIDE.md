# Type Mismatch Quick Fix Guide
## 3 Critical Issues to Fix Today

---

## Issue #1: Financial Data Precision Loss 🔴 CRITICAL

**Problem:** Prices returned as `number` instead of `string`, losing decimal precision

**Files to Fix:**
```
backend/src/modules/orders/dto/order.dto.ts
backend/src/modules/cart/dto/cart.dto.ts
```

**Before:**
```typescript
export class OrderResponseDto {
  subtotal!: number;      // WRONG: loses precision
  shippingFee!: number;   // WRONG: loses precision
  total!: number;         // WRONG: loses precision
}
```

**After:**
```typescript
export class OrderResponseDto {
  subtotal!: string;      // ✓ Preserve precision
  shippingFee!: string;   // ✓ Preserve precision
  total!: string;         // ✓ Preserve precision
}
```

**Also Update:** CartItemResponseDto, all price/fee fields

---

## Issue #2: Invalid Enum Values 🔴 CRITICAL

**Problem:** UserRole enum has BUYER/SELLER but database only supports USER/ADMIN

**File to Fix:**
```
backend/src/modules/users/dto/user.dto.ts
```

**Before:**
```typescript
export enum UserRole {
  BUYER = 'BUYER',      // ❌ doesn't exist in DB
  SELLER = 'SELLER',    // ❌ doesn't exist in DB
  ADMIN = 'ADMIN',      // ✓ exists
}
```

**After:**
```typescript
// Remove UserRole enum completely
// Import from shared-types instead:
import { Role } from '@live-commerce/shared-types';

export class UserResponseDto {
  @ApiProperty({ enum: Role })
  role!: Role;  // ✓ Now matches database
}
```

**Also Update:** profile.dto.ts (same fix)

---

## Issue #3: Date Serialization Format Mismatch 🟠 HIGH

**Problem:** Prisma returns Date objects but frontend expects ISO 8601 strings

**Example:**
```typescript
// Current (WRONG):
createdAt: 2024-01-15T10:30:00.000Z  // JavaScript Date object
updatedAt: 2024-01-15T10:30:00.000Z

// Should be (CORRECT):
createdAt: "2024-01-15T10:30:00.000Z"  // ISO 8601 string
updatedAt: "2024-01-15T10:30:00.000Z"
```

**Quick Fix:** Add this interceptor to `backend/src/main.ts`:

```typescript
// Add this AFTER validation pipe and BEFORE transformInterceptor
app.use((req: any, res: any, next: any) => {
  const originalJson = res.json;
  res.json = function(data: any) {
    const serialize = (obj: any): any => {
      if (obj instanceof Date) {
        return obj.toISOString();
      }
      if (Array.isArray(obj)) {
        return obj.map(serialize);
      }
      if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
          acc[key] = serialize(obj[key]);
          return acc;
        }, {} as any);
      }
      return obj;
    };
    return originalJson.call(this, serialize(data));
  };
  next();
});
```

**Better Fix:** Update all response DTOs to use `string` for Date fields:

```typescript
export class OrderResponseDto {
  // Before:
  createdAt!: Date;

  // After:
  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt!: string;
}
```

---

## Issue #4: Missing Fields in Shared-Types 🟡 MEDIUM

**File to Update:**
```
packages/shared-types/src/index.ts
```

**Add These Fields to User Interface:**
```typescript
export interface User {
  // ... existing fields
  suspensionReason?: string;  // NEW
}
```

**Add These Fields to Product Interface:**
```typescript
export interface Product {
  // ... existing fields
  peakViewers?: number;  // NEW
  sortOrder?: number;     // NEW
}
```

**Add These Fields to LiveStream Interface:**
```typescript
export interface LiveStream {
  // ... existing fields
  title?: string;              // NEW
  description?: string;        // NEW
  peakViewers?: number;        // NEW
  freeShippingEnabled?: boolean; // NEW
  totalDuration?: number;      // NEW
}
```

**Add These Fields to Order Interface:**
```typescript
export interface Order {
  // ... existing fields
  trackingNumber?: string;  // NEW
}
```

---

## Verification Checklist

After making changes, run:

```bash
# 1. Type check all modules
npm run type-check:all

# 2. Build backend
npm run build:backend

# 3. Run unit tests (if available)
npm run test:backend

# 4. Run E2E tests
cd client-app
npx playwright test --project=admin

# 5. Manual test via Postman/curl:
curl http://localhost:3001/api/orders/ORD-20240101-00001
# Verify:
# - subtotal is "29000.99" (string)
# - shippingFee is "3000.00" (string)
# - createdAt is "2024-01-15T10:30:00.000Z" (ISO string)
```

---

## Time Estimate

| Issue | Time | Priority |
|-------|------|----------|
| Financial Data (Issue #1) | 30 min | CRITICAL |
| Enum Values (Issue #2) | 15 min | CRITICAL |
| Date Serialization (Issue #3) | 30 min | HIGH |
| Missing Fields (Issue #4) | 20 min | MEDIUM |
| **Total** | **~1.5 hours** | |

---

## Implementation Order

1. **Fix Issue #2 First** (15 min) - Simplest, unblocks other work
2. **Fix Issue #1 Second** (30 min) - Most critical for data integrity
3. **Fix Issue #3 Third** (30 min) - Affects all timestamps
4. **Fix Issue #4 Last** (20 min) - Backward compatible, no risk

---

## Git Commit Message Template

```
fix: Resolve type mismatches in Prisma, DTO, and shared-types layers

- Remove invalid UserRole enum (BUYER/SELLER) from user.dto.ts
- Change Order financial fields from number to string for precision
- Standardize Date serialization to ISO 8601 strings
- Add missing entity fields to shared-types interface

BREAKING CHANGE: Order/Cart response prices now strings (was number)
Fix: #XXX (link to issue if available)
```

---

## Quick Test Script

Create `test-types.sh` to verify fixes:

```bash
#!/bin/bash

echo "1. Type checking..."
npm run type-check:all || exit 1

echo "2. Testing Order API..."
curl -s http://localhost:3001/api/orders | jq '.data[0] | {subtotal, shippingFee, createdAt}'

echo "3. Testing User API..."
curl -s http://localhost:3001/api/users/me | jq '.data | {role, email}'

echo "4. All checks passed! ✓"
```

---

## Common Mistakes to Avoid

❌ **Don't:** Keep Date fields in DTOs
✓ **Do:** Convert to ISO string in DTO or interceptor

❌ **Don't:** Use generic `string` for enum fields
✓ **Do:** Import proper enum types from shared-types

❌ **Don't:** Return `number` for price fields
✓ **Do:** Return `string` for decimal-safe handling

❌ **Don't:** Skip type-check after changes
✓ **Do:** Run `npm run type-check:all` immediately

---

## Questions?

See detailed report: `/TYPE_MISMATCH_DETAILED_REPORT.md`
See field-by-field analysis: `/TYPE_MISMATCH_ANALYSIS.csv`
