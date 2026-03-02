# 🔍 Night QA — Data Binding Verification Checklist

**Document Version:** 1.0
**Created:** 2026-03-02
**Status:** CRITICAL — Required for ALL deployments
**Purpose:** Verify that all customer and admin UI functions properly bind to database data

---

## 📋 Quick Summary

**Deployment cannot proceed** if ANY data binding is broken.

| Category          | Item Count | Must Pass    | Risk Level   |
| ----------------- | ---------- | ------------ | ------------ |
| Customer Features | 8          | ✅ ALL       | CRITICAL     |
| Admin Features    | 6          | ✅ ALL       | CRITICAL     |
| Real-time Updates | 5          | ✅ ALL       | CRITICAL     |
| **TOTAL**         | **19**     | **✅ 19/19** | **BLOCKING** |

---

## 🎯 Testing Strategy

### Automated (GitHub Actions)

- Type checking: `npm run type-check:all`
- Schema validation: TypeScript interfaces match API responses
- DTO verification: Backend serialization tests

### Manual (Staging Environment)

- Live browser testing with Playwright
- Real database with test data
- Full application stack running
- WebSocket connections active

### Pass Criteria

```
✅ ALL customer features display correct DB data
✅ ALL admin features show accurate database records
✅ Real-time updates synchronize < 2 seconds
✅ No orphaned UI elements (missing backend data)
✅ No stale data in any component
✅ Decimal precision maintained (prices, points)
```

---

## 👥 Customer Features (8 items)

### Feature 1: Product List & Details

**Data Points to Verify:**

```typescript
// Backend returns:
{
  id: uuid,
  name: string,
  description: string,
  price: Decimal,          // ← Must not be floating point error
  stock: number,           // ← Must match inventory
  images: string[],        // ← All images load
  category: string,
  isSoldOut: boolean,      // ← Derived from stock > 0
  createdAt: ISO8601,
  updatedAt: ISO8601
}

// UI must display:
- ✅ Product name (exact match from DB)
- ✅ Description (full text, not truncated)
- ✅ Price (formatted correctly, no rounding errors)
- ✅ Stock level indicator (AVAILABLE / LOW / SOLD_OUT)
- ✅ Product images (all visible, correct order)
- ✅ Category badge (matches DB enum)
- ✅ "Updated" timestamp (if admin edited)
```

**Test Case:**

```
1. Create product via admin: name="테스트상품", price=9.99, stock=5
2. View product list → Verify name, price, stock display correctly
3. Click product → Verify detail page shows exact DB values
4. Edit product price to 10.99
5. List should immediately show 10.99 (not cached)
```

---

### Feature 2: Shopping Cart Add/Remove

**Data Points to Verify:**

```typescript
{
  id: uuid,
  userId: uuid,
  status: "ACTIVE" | "EXPIRED" | "CONVERTED",
  expiresAt: ISO8601,      // ← Must be 10 min from now
  items: [
    {
      productId: uuid,
      quantity: number,      // ← Must match what user selected
      price: Decimal,        // ← Snapshot price at add time
      product: { ... }       // ← Full product data
    }
  ],
  total: Decimal             // ← Calculated: sum(item.price * item.quantity)
}
```

**Test Case:**

```
1. Add product to cart: name="Product1", qty=2, price=10.00
2. Cart displays: "2 × Product1 = $20.00" ✅
3. Add another: name="Product2", qty=1, price=5.00
4. Total should update: $20.00 + $5.00 = $25.00 ✅
5. Increase qty of Product1 to 3
6. Subtotal updates: 3 × $10.00 = $30.00, Total = $35.00 ✅
7. Remove Product2
8. Total updates: $30.00 ✅
```

---

### Feature 3: Cart Timer (TTL 10 minutes)

**Data Points to Verify:**

```
- ✅ Timer shows exact minutes remaining (9:59, 9:58, ...)
- ✅ Timer accuracy (±1 sec) — counts down at 1 sec/sec
- ✅ At 0:00 — cart auto-expires and clears
- ✅ Visual indicator changes at <1 minute (turns red)
- ✅ Backend expiresAt timestamp matches countdown
```

**Test Case:**

```
1. Create cart (expiresAt = now + 10 minutes)
2. UI shows "10:00" countdown
3. Wait 30 seconds → UI shows "09:30" ✅
4. Wait until 00:30 → UI shows timer in red ⏰
5. Wait 30 more seconds (auto-expires)
6. Cart disappears, backend confirms status="EXPIRED" ✅
```

---

### Feature 4: Purchase Checkout Flow

**Data Points to Verify:**

```typescript
{
  step: 1 | 2 | 3,  // ← UI state synchronized with backend

  // Step 1: Review Cart
  cartItems: [...]   // ← Shows exact items from DB

  // Step 2: Shipping Address
  address: {
    street: string,
    city: string,
    country: string,
    phone: string     // ← Encrypted in DB, decrypted on display
  }

  // Step 3: Payment
  order: {
    orderId: string,  // ← Format: ORD-YYYYMMDD-XXXXX
    total: Decimal,   // ← Matches cart total exactly
    paymentStatus: "PENDING" | "CONFIRMED" | "FAILED"
  }
}
```

**Test Case:**

```
1. Cart has: 2 × Product1 ($20) + 1 × Product2 ($5) = $25
2. Step 1 review: Displays all items correctly ✅
3. Step 2 address: Prefills with user profile data ✅
4. Step 3 summary: Shows total=$25.00 ✅
5. Complete payment → Order created in DB ✅
6. Order ID format verified: ORD-20260302-12345 ✅
7. Payment status confirmed: "CONFIRMED" ✅
```

---

### Feature 5: Purchase History

**Data Points to Verify:**

```typescript
{
  orders: [
    {
      orderId: string,
      createdAt: ISO8601,
      status: OrderStatus, // ← PENDING_PAYMENT | PAYMENT_CONFIRMED | SHIPPED | DELIVERED
      total: Decimal,
      items: [
        {
          productName: string,
          quantity: number,
          price: Decimal,
        },
      ],
    },
  ];
}
```

**Test Case:**

```
1. User has 3 orders in DB with different statuses
2. History page loads and displays all 3 orders ✅
3. Verify each order shows:
   - Exact order date (not timezone shifted)
   - Current status (PAYMENT_CONFIRMED, SHIPPED, DELIVERED)
   - Correct item list and prices
   - Accurate total amount
4. Click order → Detail page shows all items ✅
```

---

### Feature 6: Live Stream Viewer

**Data Points to Verify:**

```typescript
{
  stream: {
    streamKey: string,
    status: "PENDING" | "LIVE" | "OFFLINE",
    viewers: number,           // ← Real-time count from Redis
    products: [                // ← Admin selected products
      { id, name, price, image }
    ]
  },

  chat: {
    messages: [
      {
        userId: uuid,
        userName: string,      // ← Display name from DB
        message: string,
        createdAt: ISO8601
      }
    ]
  }
}
```

**Test Case:**

```
1. Stream status changes from PENDING → LIVE
2. UI updates status immediately ✅
3. Viewer count increases as users join → UI updates in real-time ✅
4. Admin adds product to stream
5. Product appears in recommendation section < 2 seconds ✅
6. User sends chat message → Appears in all viewers' chats ✅
```

---

### Feature 7: Product Stock Real-time Updates

**Data Points to Verify:**

```
- ✅ Stock level updates within 2 seconds
- ✅ "SOLD OUT" badge appears when stock = 0
- ✅ "LOW STOCK" warning appears when stock < 5
- ✅ Purchase decrements stock immediately
- ✅ Cancel order increases stock immediately
```

**Test Case:**

```
1. Product has stock=1, UI shows "1 available"
2. Admin sells item or decrements stock
3. UI updates: "SOLD OUT" appears within 2 seconds ✅
4. Another user refreshes → Still shows SOLD OUT ✅
5. Admin restocks: stock=10
6. UI updates within 2 seconds ✅
```

---

### Feature 8: Account Profile Data

**Data Points to Verify:**

```typescript
{
  user: {
    nickname: string,           // ← Display name
    email: string,
    phone: string,              // ← Encrypted in DB
    profileImage: string,
    createdAt: ISO8601,
    pointBalance: number        // ← From points_balances table
  }
}
```

**Test Case:**

```
1. User edits profile: nickname="NewName", phone="010-1234-5678"
2. Save changes
3. Refresh page → Profile shows exact updated values ✅
4. Point balance updates after purchase ✅
5. Phone displays correctly (decrypted) ✅
```

---

## 🔧 Admin Features (6 items)

### Feature 1: Product Management CRUD

**Data Points to Verify:**

```
CREATE:
- ✅ New product appears in list immediately (no cache delay)
- ✅ All fields saved: name, description, price, stock, images
- ✅ Product ID (UUID) generated correctly
- ✅ Timestamps (createdAt) set correctly

READ:
- ✅ Product list loads all products from DB
- ✅ Edit modal shows exact current values
- ✅ No data truncation or rounding

UPDATE:
- ✅ Price changes visible immediately in list and detail
- ✅ Stock updates reflected instantly
- ✅ updatedAt timestamp refreshed
- ✅ Images can be replaced and load correctly

DELETE:
- ✅ Product disappears from list (soft delete)
- ✅ Can still view if needed (DB record exists)
- ✅ Customers cannot see deleted products
```

**Test Case:**

```
1. Create product: name="새상품", price=19.99, stock=10, image upload
2. List shows new product immediately ✅
3. Edit: price→29.99, stock→5
4. List updates without page refresh ✅
5. Delete product
6. Removed from list, but data preserved in DB ✅
```

---

### Feature 2: Live Stream Control

**Data Points to Verify:**

```typescript
{
  stream: {
    streamKey: string,
    status: "PENDING" | "LIVE" | "OFFLINE",
    startTime: ISO8601,
    endTime: ISO8601 | null,
    selectedProducts: uuid[],  // ← Products linked to this stream
    thumbnailUrl: string
  }
}
```

**Test Case:**

```
1. Create stream with selectedProducts=[prod1, prod2, prod3]
2. UI shows selected products in stream ✅
3. Go LIVE: status changes to "LIVE" immediately ✅
4. Viewer count updates in real-time ✅
5. Add new product to stream → Appears in viewers < 2 sec ✅
6. End stream: status→"OFFLINE", endTime set ✅
```

---

### Feature 3: Inventory Management

**Data Points to Verify:**

```
- ✅ Current stock displayed from DB inventory table
- ✅ Stock adjustment saved immediately
- ✅ History of changes recorded (if available)
- ✅ Low stock alerts trigger correctly
- ✅ Sold out status computed accurately (stock = 0)
```

**Test Case:**

```
1. Product stock=50, display shows 50 ✅
2. Admin sells 10 units → stock→40, display updates ✅
3. Admin restocks: +25 → stock→65 ✅
4. Real-time updates: buyer purchases → -1, display updates ✅
```

---

### Feature 4: Order Management

**Data Points to Verify:**

```typescript
{
  orders: [
    {
      orderId: string,
      userId: uuid,
      userName: string,        // ← From users table
      email: string,
      status: OrderStatus,
      total: Decimal,
      shippingAddress: { ... },
      items: [ { productName, quantity, price } ],
      createdAt: ISO8601,
      updatedAt: ISO8601
    }
  ]
}
```

**Test Case:**

```
1. Customer completes purchase → Order appears in admin list ✅
2. Verify all customer details displayed correctly
3. Order status shows "PAYMENT_CONFIRMED" ✅
4. Admin updates status→"SHIPPED"
5. Customer sees update immediately ✅
6. Tracking number added → Displays for both admin and customer ✅
```

---

### Feature 5: Settlement & Revenue Reports

**Data Points to Verify:**

```
- ✅ Total revenue = SUM(confirmed_orders.total)
- ✅ Settlement calculations accurate
- ✅ CSV export has correct values
- ✅ Date filters work correctly
- ✅ No duplicate counting or missing orders
```

**Test Case:**

```
1. Filter orders by date range
2. Calculate: $100 + $50 + $25 = $175 total
3. Report shows $175 ✅
4. CSV export matches report ✅
5. Individual order totals match line items ✅
```

---

### Feature 6: User Management

**Data Points to Verify:**

```
- ✅ User list shows all registered users
- ✅ Role display: CUSTOMER | ADMIN
- ✅ Admin can promote users to ADMIN
- ✅ User activity history displayed
- ✅ Can disable/enable accounts
- ✅ Point balance shown per user
```

**Test Case:**

```
1. Admin views user list → All 139 users displayed ✅
2. Click user → Profile shows all data (name, email, role, points) ✅
3. Promote user to ADMIN → Role updates immediately ✅
4. Disable user → Account marked inactive ✅
```

---

## ⚡ Real-time Updates (5 items)

### Feature 1: Chat Messages

**Data Points to Verify:**

```
- ✅ Message persists in DB chat_messages table
- ✅ Message appears for all connected users < 1 second
- ✅ Message history loads from Redis cache (max 100, 24h TTL)
- ✅ User name displays correctly (from users table)
- ✅ Timestamp formatted in user's timezone
```

**Test Case:**

```
1. User A sends chat message in live stream
2. Appears in User B's chat immediately (< 1 sec) ✅
3. Refresh page → Message history loads correctly ✅
4. Verify message was saved to DB ✅
```

---

### Feature 2: Viewer Count Updates

**Data Points to Verify:**

```
- ✅ Count updates within 2 seconds of user join/leave
- ✅ Count accurate at scale (200 concurrent users)
- ✅ No duplicate counting
- ✅ Persists in Redis stream:{streamKey}:viewers counter
```

**Test Case:**

```
1. 50 users watching stream, UI shows 50 ✅
2. 10 more join → Updates to 60 within 2 seconds ✅
3. 5 leave → Updates to 55 ✅
4. Server under load (load test) → Count still accurate ✅
```

---

### Feature 3: Product Stock Changes

**Data Points to Verify:**

```
- ✅ Stock update from purchase broadcast via WebSocket
- ✅ UI updates within 2 seconds
- ✅ All users see consistent stock level
- ✅ SOLD_OUT badge appears when stock=0
```

**Test Case:**

```
1. Product stock=1, multiple users viewing
2. User A purchases → Stock→0
3. All users see SOLD_OUT within 2 seconds ✅
4. User B cannot add to cart ✅
```

---

### Feature 4: Stream Status Synchronization

**Data Points to Verify:**

```
- ✅ When admin goes LIVE → All viewers see LIVE status < 1 sec
- ✅ When admin ends stream → Status→OFFLINE for all
- ✅ Viewers can watch stream (HTTP-FLV or HLS) when LIVE
- ✅ Cannot watch when OFFLINE (shows offline message)
```

**Test Case:**

```
1. Admin starts stream → Status PENDING
2. Click "Go LIVE" → Status updates to LIVE for all viewers < 1 sec ✅
3. Viewers see video stream (HTTP-FLV or HLS) ✅
4. Admin clicks "End Stream" → Status→OFFLINE ✅
5. Video stops, message: "Stream is offline" ✅
```

---

### Feature 5: Notification Badges & Alerts

**Data Points to Verify:**

```
- ✅ New order notification appears without refresh
- ✅ Stock low/out-of-stock alerts
- ✅ Payment confirmation updates
- ✅ Settlement report ready notifications
```

**Test Case:**

```
1. Customer purchases → Admin sees notification immediately ✅
2. Stock drops below threshold → Alert appears ✅
3. New comment on product → Notification badge increments ✅
```

---

## ✅ Verification Process

### Automated Checks (Run in GitHub Actions)

```bash
# 1. Type Checking — Ensure DTO/type safety
npm run type-check:all

# 2. Build Check — Ensure no compilation errors
npm run build:all

# 3. Backend Tests — DTO serialization and validation
npm run test:backend --testPathPattern='(dto|serialization)'
```

### Manual Testing (Run on Staging)

```bash
# 1. Start full stack
npm run dev:all

# 2. Populate test data
npm run prisma:db seed

# 3. Run Playwright tests
cd client-app && npx playwright test --project=user
cd client-app && npx playwright test --project=admin

# 4. Load test with real data
npm run load-test:staging
```

---

## 🛑 Failure Handling

If ANY data binding check fails:

```
1. ❌ Test FAILS
2. 🔍 Root cause analysis
   - Is API returning wrong data?
   - Is UI not displaying returned data?
   - Is state not updating?
   - Is cache stale?
3. 🔧 Auto-fix applies (e.g., refresh, clear cache, update component)
4. 🔁 Re-run test immediately
5. If PASS → Continue to next check
6. If FAIL → Log and escalate to developer (max 3 attempts)
```

---

## 📊 Pass/Fail Matrix

```
Deployment Status Decision:

✅ ALL 19 items PASS
  → Status: SAFE ✅
  → Action: Deploy immediately
  → Confidence: 95%+

⚠️ Some items CONDITIONAL (> 50% pass rate)
  → Status: CONDITIONAL
  → Action: Fix and re-test
  → Confidence: 60-80%

❌ Critical items FAIL (< 50% pass rate)
  → Status: BLOCKED 🛑
  → Action: Halt deployment
  → Confidence: 0%
```

---

## 📝 Sign-off

**Last Verified:** [Auto-filled by Night QA]
**Verification Method:** Playwright E2E + Load Test
**Data Volume:** Full staging DB (139 users, production-like data)
**Approved By:** Architect
**Timestamp:** [Auto-filled by system]

---

**End of Data Binding Verification Checklist**
