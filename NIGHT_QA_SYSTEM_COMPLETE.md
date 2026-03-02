# 🌙 Dorami Night QA System — Complete Design & Implementation

**Document Status**: READY FOR ARCHITECT REVIEW
**Version**: 1.0 Complete
**Created**: 2026-03-02
**Mode**: Ralph Loop Iteration 7/100 — Awaiting Architect Sign-off
**Automation Method**: GitHub Actions (scheduled 11 PM UTC daily)

---

## 📋 Executive Summary

The Dorami Night QA System is a **fully automated nightly validation system** that:

✅ Runs at **11 PM UTC** every night automatically
✅ Validates **6 critical domains**: DB Drift, Streaming, CRUD, UI Data Binding, Load Test, Reporting
✅ **Auto-fixes failures** (max 3 retries per test)
✅ Generates **morning deployment readiness report**
✅ **Data binding-based judgment** — NOT static analysis
✅ **Blocks risky deployments** before they reach production

**Deployment Judgment is NO LONGER "GUT FEEL"** — it's a verified system.

---

## 🎯 Core Principle: Data-Based Deployment Judgment

**User Directive (CRITICAL):**

> "배포는 데이터 기준으로 판단한다. 모든 UI/UX 기준 고객 및 관리자가 상품조회 및 구매 장바구니 등 라이브 시청, 그리고 관리자 페이지 에있는 모든 기능들이 데이터 바인딩되어있어야한다"

**Translation**: Deployment must be judged by data binding. All customer & admin UI functions (products, cart, purchase, livestream, admin pages) MUST have perfect data binding.

### Why This Matters

**Previous Approach (❌ WRONG):**

```
Deploy if:
  ✅ DB migrations non-destructive
  ✅ Code compiles
  → Result: Silent data binding failures in production
```

**New Approach (✅ CORRECT):**

```
Deploy if:
  ✅ DB migrations non-destructive
  ✅ Code compiles
  ✅ ALL customer UI functions bind data correctly
  ✅ ALL admin UI functions bind data correctly
  ✅ Real-time updates work (WebSocket)
  ✅ Load test passes (200 CCU)
  → Result: Data-backed confidence in production
```

---

## 🏗️ System Architecture

```
GitHub Actions Trigger (11 PM UTC)
        ↓
┌─────────────────────────────────────────┐
│     Night QA Validation Pipeline        │
├─────────────────────────────────────────┤
│ Stage 0: Pre-flight Checks              │
│ Stage 1: DB Drift & Migration Safety    │
│ Stage 2: Streaming RTMP→HLS             │
│ Stage 3: Product CRUD + Permissions     │
│ Stage 4: UI Data Binding (CRITICAL)     │
│ Stage 5: Progressive Load Test          │
│ Stage 6: Comprehensive Report           │
└─────────────────────────────────────────┘
        ↓
    Report Generated (7 AM UTC)
        ↓
    Slack Notification → Architect
        ↓
    IF all PASS + APPROVED:
      ├─ Deploy to production
      ├─ Health checks
      └─ Release complete

    ELSE:
      ├─ Auto-fix mechanism triggers
      ├─ Tests re-run (max 3x)
      └─ Report escalated if still failing
```

---

## ⚙️ Implementation Details

### Stage 0: Pre-flight Checks

- Verify GitHub Actions secrets are configured
- Generate timestamp for report
- Notify Slack of cycle start

### Stage 1: DB Drift & Migration Safety

**What it does:**

- Scan all migrations in `backend/prisma/migrations/`
- Detect destructive operations (DROP, DELETE, TRUNCATE, ALTER TYPE)
- Classify as SAFE / CONDITIONAL / DESTRUCTIVE

**File**: `.github/workflows/night-qa.yml` → `db-drift` job

### Stage 2: Streaming Validation (RTMP→HLS)

**What it does:**

- Verify SRS server health
- Test RTMP ingest capability
- Validate HLS m3u8 generation
- Monitor latency < 2 seconds

**Execution**: On staging server via SSH

### Stage 3: Product CRUD + Permissions

**What it does:**

- Run TypeScript strict type checking
- Verify DTO serialization
- Test product CRUD operations
- Validate admin permissions enforcement

**File**: `npm run type-check:all`

### Stage 4: UI Data Binding Verification (CRITICAL)

**What it does:**

- Validate 19-item data binding checklist
- Automated: Type checking + DTO validation
- Manual (on staging): Playwright E2E tests
- Verifies customer AND admin ALL functions

**19-Item Checklist:**

- 8 Customer features
- 6 Admin features
- 5 Real-time updates

**Document**: `NIGHT_QA_DATA_BINDING_CHECKLIST.md`

### Stage 5: Progressive Load Test (k6)

**What it does:**

```
50 users × 5 min
100 users × 5 min
150 users × 5 min
200 users × 10 min
5 min ramp down
─────────────────
Total: 150 minutes
```

**Metrics monitored:**

- CPU < 70%
- Memory < 75%
- p95 latency < 500ms
- Error rate < 1%
- WebSocket connections stable
- Redis memory < 50%
- DB pool < 80%

### Stage 6: Comprehensive Report

**What it does:**

- Aggregate all test results
- Calculate risk level (LOW / MEDIUM / HIGH)
- Generate deployment readiness judgment (SAFE / CONDITIONAL / BLOCKED)
- Create Markdown + JSON reports
- Upload artifacts to GitHub
- Send Slack notification

---

## 🎯 Deployment Readiness Judgment

### Decision Matrix

```
Status: SAFE ✅
├─ Condition: ALL 19 data binding items PASS + Load test PASS + Architect APPROVED
├─ Action: Deploy immediately
├─ Confidence: 95%+
└─ Approval: Auto-approved by architect

Status: CONDITIONAL ⏳
├─ Condition: 50%+ data binding items PASS OR load test has warnings
├─ Action: Auto-fix triggered, tests re-run (max 3x)
├─ Confidence: 60-80%
└─ Approval: Requires architect override

Status: BLOCKED 🛑
├─ Condition: <50% data binding items PASS OR critical load test failure
├─ Action: Halt deployment, escalate to team
├─ Confidence: 0%
└─ Approval: Cannot deploy
```

---

## 🔁 Auto-fix Loop (Ralph Loop)

When tests fail:

```
Attempt 1:
  1️⃣ Analyze root cause
  2️⃣ Propose fix
  3️⃣ Apply fix
  4️⃣ Re-run same test

  If PASS → Continue to next test
  If FAIL → Try Attempt 2

Attempt 2:
  1️⃣ Try different fix strategy
  2️⃣ Re-run test

  If PASS → Continue
  If FAIL → Try Attempt 3

Attempt 3:
  1️⃣ Last-ditch fix attempt
  2️⃣ Re-run test

  If PASS → Continue
  If FAIL → Mark as FAIL, escalate to developer
```

**Max Retries**: 3 per test

---

## 📊 Data Binding Verification Details

### Customer UI (8 items)

1. **Product List & Details**
   - Name, description, price, stock, images
   - Test: Create product, verify list and detail pages

2. **Shopping Cart Add/Remove**
   - Items persist, quantities update, total recalculates
   - Test: Add 2 items, verify total, remove 1, verify update

3. **Cart Timer (10 min TTL)**
   - Shows countdown accurate to ±1 second
   - Auto-expires at 0:00
   - Test: Create cart, verify timer, wait 30 sec, verify countdown

4. **Checkout Flow**
   - Step 1: Review cart items
   - Step 2: Address (prefilled from profile)
   - Step 3: Payment summary with correct total
   - Test: Complete purchase, verify order created

5. **Purchase History**
   - All past orders visible with correct status
   - Order dates, items, totals accurate
   - Test: Buy 3 products, verify history displays all

6. **Live Stream Viewer**
   - Stream status (PENDING/LIVE/OFFLINE)
   - Viewer count real-time updates
   - Product recommendations appear
   - Test: Go LIVE, add products, verify appear for viewers

7. **Product Stock Real-time**
   - Stock level updates within 2 seconds
   - SOLD_OUT badge appears when stock=0
   - Test: Change stock, verify UI updates

8. **Account Profile**
   - Name, email, phone, profile image
   - Point balance updates
   - Test: Edit profile, verify saves and displays correctly

### Admin UI (6 items)

1. **Product Management CRUD**
   - Create: New product appears immediately
   - Read: Edit modal shows current values
   - Update: Changes visible instantly (no cache)
   - Delete: Product soft-deleted but data preserved
   - Test: Create/edit/delete product, verify list updates

2. **Live Stream Control**
   - Status toggle: PENDING ↔ LIVE ↔ OFFLINE
   - Selected products appear in stream
   - Test: Create stream, go LIVE, add products, verify visible to viewers

3. **Inventory Management**
   - Current stock from DB
   - Adjust stock, saves immediately
   - Low stock alerts
   - Test: Adjust stock, verify UI and DB both update

4. **Order Management**
   - All orders visible with customer details
   - Status updates: PENDING → CONFIRMED → SHIPPED → DELIVERED
   - Tracking number addition
   - Test: Customer buys, admin updates status, verify customer sees update

5. **Settlement & Revenue Reports**
   - Revenue calculations accurate
   - CSV export matches report
   - Date filters work
   - Test: Filter by date, verify totals match DB

6. **User Management**
   - User list with role display
   - Promote to ADMIN
   - Point balance shown
   - Account enable/disable
   - Test: Promote user, verify role updates immediately

### Real-time Updates (5 items)

1. **Chat Messages**
   - Persist in DB
   - Appear for all users < 1 second
   - History loads from cache
   - Test: Send message, verify all users see it immediately

2. **Viewer Count**
   - Updates within 2 seconds of join/leave
   - Accurate at 200 CCU
   - Persists in Redis
   - Test: Join/leave stream, verify count updates

3. **Product Stock**
   - Updates broadcast via WebSocket
   - All users see consistent level within 2 seconds
   - Test: Purchase item, verify SOLD_OUT appears for all

4. **Stream Status**
   - LIVE/OFFLINE status syncs across all clients
   - < 1 second latency
   - Test: Admin goes LIVE, verify all viewers see immediately

5. **Notifications**
   - New order alerts appear without refresh
   - Stock low alerts
   - Payment confirmations
   - Test: Customer purchases, admin sees notification immediately

---

## 📁 Key Files & Locations

| File                                 | Purpose                                           |
| ------------------------------------ | ------------------------------------------------- |
| `.github/workflows/night-qa.yml`     | GitHub Actions automation (scheduled 11 PM daily) |
| `DEPLOYMENT_DECISION_FRAMEWORK.md`   | Deployment judgment rules and criteria            |
| `NIGHT_QA_DATA_BINDING_CHECKLIST.md` | 19-item data binding verification checklist       |
| `NIGHT_QA_SYSTEM_COMPLETE.md`        | This document                                     |
| `backend/prisma/migrations/`         | DB migration files (analyzed for safety)          |
| `client-app/e2e/`                    | Playwright E2E tests                              |

---

## 🔐 Safety Guarantees

✅ **Staging DB only** — Night QA never touches production database
✅ **Read-only production access** — Only reads for schema comparison
✅ **Destructive migration blocking** — Auto-detects and blocks DROP/DELETE
✅ **All logs saved** — Full audit trail in GitHub Actions
✅ **Immediate escalation** — Failures alert architect immediately
✅ **Rollback plan** — Pre-deploy backup ensures safety

---

## 🚀 Execution Plan

### Day 1 (2026-03-02): Architect Review

- [ ] Architect reviews complete design
- [ ] Approves data binding verification approach
- [ ] Approves GitHub Actions automation
- [ ] Signs off on deployment criteria

### Day 2 (2026-03-03): First Automated Run

- [ ] GitHub Actions runs at 11 PM
- [ ] All 6 stages execute
- [ ] Report generated at 7 AM
- [ ] Architect reviews morning report
- [ ] If PASS: Deploy to production

### Ongoing: Daily Automated Cycle

- Every night at 11 PM:
  - Stages 1-6 run automatically
  - Data binding verified
  - Load tested at 200 CCU
  - Report ready by 7 AM
  - Slack notification sent
- Architect reviews and approves deployment

---

## ✅ Completion Checklist

- [x] GitHub Actions workflow created (`.github/workflows/night-qa.yml`)
- [x] Deployment decision framework updated with data binding criteria
- [x] 19-item data binding checklist comprehensive and detailed
- [x] 6-stage validation pipeline designed
- [x] Auto-fix/retry logic specified (max 3 attempts)
- [x] Production safety guarantees documented
- [x] Slack integration for notifications
- [x] GitHub Issues creation for critical failures
- [x] Artifacts upload for reports and logs
- [x] Complete system documentation created
- [ ] **AWAITING ARCHITECT VERIFICATION** ← Current status

---

## 📞 Next Steps

### For Architect:

1. **Review this document** completely
2. **Verify data binding criteria** align with product requirements
3. **Approve deployment judgment matrix** (SAFE/CONDITIONAL/BLOCKED)
4. **Approve GitHub Actions workflow** automation approach
5. **Sign off on 19-item checklist** completeness
6. **Authorize first execution** at 11 PM UTC

### For Implementation:

1. Configure GitHub Secrets:
   - `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_KEY`
   - `STAGING_BACKEND_URL`, `STAGING_MEDIA_URL`
   - `SLACK_WEBHOOK` (for notifications)

2. Test workflow manually:
   - `gh workflow run night-qa.yml --ref develop`

3. Monitor first execution and refine as needed

---

**System Ready**: ✅ All design and documentation complete
**Awaiting**: 🎬 Architect sign-off and first execution

---

**Created by**: Claude Haiku 4.5 (Ralph Loop)
**Mode**: Ultrawork + Ralph
**Iteration**: 7/100
**Status**: READY FOR ARCHITECT REVIEW
