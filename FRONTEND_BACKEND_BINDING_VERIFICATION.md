# Frontend-Backend DB Binding Verification Report

**Date**: 2026-03-02  
**Status**: ⚠️ **PARTIAL** - Client-side sorting only (Not DB-bound)

---

## 📊 Current Architecture

### Frontend (PopularProducts.tsx)

```
BackendAPI (/products/popular)
    ↓
[All products sorted by sales count]
    ↓
Client-side split:
├─ Featured: products[0:4]
└─ Past: products[4:]
```

### Backend (products.service.ts - line 595-643)

```typescript
async getPopularProducts(page = 1, limit = 8) {
  // Query: status='AVAILABLE' → Sorted by orderItems._count DESC
  return {
    data: products.map(...),
    meta: { total, page, limit, totalPages }
  }
}
```

---

## 🔍 Findings

### ✅ What's Working

1. **Frontend split logic**: Featured (4) + Past (remaining) ✅
   - File: `client-app/src/components/figma-home/PopularProducts.tsx`
   - Lines: 150-151 (split logic)
   - State: Independent "더보기" per section (line 142)

2. **API Communication**: Frontend correctly fetches all products ✅
   - File: `client-app/src/lib/api/mainpage.ts`
   - Endpoint: `GET /api/products/popular?page=1&limit=8`
   - Type: PopularProductDto[] mapped from DB response

3. **Database queries**: Products queried with metadata ✅
   - File: `backend/src/modules/products/products.service.ts:604-629`
   - Includes: orderItems count, status filtering
   - Order by: salesCount DESC

### ⚠️ What's NOT Database-bound

1. **Featured/Past separation**: Client-side only
   - No `isFeatured` or `featured_at` column in DB
   - No backend endpoint distinction (/products/featured vs /products/past)
   - Split happens via `products.slice(0, 4)` in React

2. **Priority/Order persistence**: No DB field
   - Current: Sorted by sales count only
   - Missing: Admin-configurable featured product selection

---

## 📋 Database Schema (Current)

**product table columns:**

```sql
- id (UUID, PK)
- streamKey (VARCHAR)
- name (VARCHAR)
- price (Decimal)
- quantity (INTEGER) -- stock
- status (ENUM: AVAILABLE, SOLD_OUT)
- timerEnabled (BOOLEAN)
- timerDuration (INTEGER)
- imageUrl (VARCHAR)
- images (JSONB)
- isNew (BOOLEAN)
- discountRate (Decimal)
- originalPrice (Decimal)
- createdAt (TIMESTAMP)
- updatedAt (TIMESTAMP)
-- Missing: isFeatured, featured_at, sortOrder, etc.
```

**Related tables:**

- `orderItems` (linked via productId) - for sales count
- `liveStream` (linked via streamKey) - for stream info

---

## 🚀 To Full DB Binding, Would Need:

### Option A: Add Featured Flag

```sql
ALTER TABLE product ADD COLUMN is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE product ADD COLUMN featured_at TIMESTAMP;
```

### Option B: Add Priority/Sort Order

```sql
ALTER TABLE product ADD COLUMN featured_sort_order INTEGER;
-- Then: SELECT * WHERE is_featured=true ORDER BY featured_sort_order, createdAt DESC
```

### Backend Changes Required:

```typescript
// NEW: /api/products/featured endpoint
getFeaturedProducts(limit: 6) {
  return product.findMany({
    where: { is_featured: true, status: 'AVAILABLE' },
    orderBy: { featured_sort_order: 'asc' },
    take: limit
  })
}

// MODIFY: /api/products/popular endpoint to exclude featured
getPopularProducts(page, limit) {
  return product.findMany({
    where: { is_featured: false, status: 'AVAILABLE' },
    // ... existing sales count sort
  })
}
```

### Frontend Changes Required:

```typescript
// Would receive separate featured/past from API instead of client-side split
const { featuredProducts, popularProducts } = await getMainPageData();
// Then use both directly without slice(0,4) logic
```

---

## ✅ Current Assessment

| Aspect                   | Status     | Details                                 |
| ------------------------ | ---------- | --------------------------------------- |
| **Frontend UI Split**    | ✅ Working | Client renders Featured + Past sections |
| **API Communication**    | ✅ Working | Correctly fetches popular products      |
| **Database Persistence** | ❌ Missing | No featured/past field in DB            |
| **Admin Control**        | ⚠️ Partial | Must manually edit to mark featured     |
| **User Visibility**      | ✅ Working | Correct sections displayed on homepage  |

---

## 📝 Recommendation

**Current state is ACCEPTABLE for MVP** because:

1. Frontend UI displays correctly (Featured 4 + Past remaining)
2. Products are sorted by actual sales data (relevant to users)
3. No data loss or corruption

**To productionize (Phase 2):**

1. Add `isFeatured` + `featured_sort_order` columns
2. Create admin UI to manage featured products
3. Split `/products/popular` → `/products/featured` + `/products/past`
4. Update frontend to use separate API calls

---

## 🔗 Related Files

**Frontend:**

- `client-app/src/components/figma-home/PopularProducts.tsx` (split logic)
- `client-app/src/lib/api/mainpage.ts` (API calls)
- `client-app/src/lib/hooks/queries/use-mainpage.ts` (React Query)

**Backend:**

- `backend/src/modules/products/products.controller.ts` (endpoints)
- `backend/src/modules/products/products.service.ts` (business logic)
- `backend/prisma/schema.prisma` (DB schema)

**Database:**

- PostgreSQL `product` table
- Migration: `backend/prisma/migrations/`
