# Hardcoded Data Analysis Report - Dorami Codebase

**Generated:** 2026-03-02
**Project:** Dorami (Live Commerce MVP)
**Scope:** backend/src, client-app/src, packages/shared-types

---

## Executive Summary

Comprehensive scan of the dorami codebase identified **38 hardcoded data patterns** that should be externalized to environment variables or configuration:

- **🔴 CRITICAL:** 3 findings (production security risk)
- **🟠 HIGH:** 8 findings (should fix before production)
- **🟡 MEDIUM:** 15 findings (should fix next sprint)
- **🟢 LOW:** 12 findings (technical debt)

**Full JSON report:** `/d/Project/dorami/HARDCODED_DATA_REPORT.json`

---

## Critical Issues (Immediate Action Required)

### 1. **AlimTalk API Endpoint Hardcoded**

- **File:** `backend/src/modules/admin/alimtalk.service.ts:59`
- **Issue:** External API endpoint is hardcoded: `https://api.solapi.com/messages/v4/send-many`
- **Risk:** Cannot switch to different provider or test endpoint without modifying source code
- **Fix:** Move to `ALIMTALK_API_URL` environment variable
- **Severity:** CRITICAL

### 2. **CORS Origins Default Allows Localhost in Production**

- **Files:**
  - `backend/src/main.ts:157`
  - `backend/src/common/adapters/redis-io.adapter.ts:104-105`
  - `backend/src/common/config/config.validation.ts:48`
- **Issue:** Fallback to `http://localhost:3000` if `CORS_ORIGINS` env var not provided
- **Risk:** Production could accept connections from localhost (security vulnerability)
- **Fix:** Remove fallback defaults; require `CORS_ORIGINS` in all environments
- **Severity:** CRITICAL

### 3. **Redis Connection URLs Have Localhost Fallbacks**

- **Files:**
  - `backend/src/main.ts:200` → `redis://localhost:6379`
  - `backend/src/common/adapters/redis-io.adapter.ts:21` → `redis://localhost:6379/1`
  - `backend/src/common/config/config.validation.ts:23-24` → defaults to `localhost:6379`
- **Issue:** Application falls back to localhost Redis if `REDIS_URL` not provided
- **Risk:** Production deployment without proper env config will fail silently or use wrong instance
- **Fix:** Make `REDIS_URL` mandatory; require `REDIS_HOST` + `REDIS_PORT` in production
- **Severity:** CRITICAL

---

## High Priority Issues

### Frontend URLs (Multiple Files)

- **Severity:** HIGH
- **Pattern:** Hardcoded `http://localhost:3001` as fallback WebSocket URL
- **Affected Files:**
  - `client-app/src/hooks/useChatConnection.ts:29`
  - `client-app/src/hooks/useProductStock.ts:62`
  - `client-app/src/app/live/[streamKey]/page.tsx:304`
  - `client-app/src/components/stream/VideoPlayer.tsx:552`
  - `client-app/src/components/my-page/LoginRequiredModal.tsx:24`
  - `client-app/src/lib/hooks/use-chat.ts:52`
  - `client-app/src/components/product/ProductList.tsx:40`
  - `client-app/src/lib/socket/socket-client.ts:6`
- **Fix:** Make `NEXT_PUBLIC_WS_URL` required in production builds
- **Recommendation:** Centralize in single constant/config file

### Streaming URLs

- **Files:**
  - `backend/src/common/config/config.validation.ts:71-72`
  - `backend/src/modules/streaming/streaming.service.ts:957-959`
- **Defaults:**
  - `RTMP_INTERNAL_URL` → `rtmp://srs:1935/live`
  - `SRS_API_URL` → `http://localhost:1985`
  - `RTMP_SERVER_URL` → `rtmp://localhost:1935/live`
  - `HLS_SERVER_URL` → `http://localhost:8080/hls`
- **Fix:** Require explicit URL configuration in production

### GitHub Actions Hardcoding

- **File:** `.github/workflows/deploy-staging.yml` (lines 229, 243, 315, 321, 327, 335, 354, 360, 364)
- **Issue:** Multiple hardcoded `http://localhost:*` URLs in health checks
- **Fix:** Use GitHub Actions secrets and env vars for staging URLs

### Admin Controller SRS Fallback

- **File:** `backend/src/modules/admin/admin.controller.ts:445`
- **Issue:** Falls back to `http://localhost:1985` if `SRS_API_URL` not set
- **Fix:** Require `SRS_API_URL` in production

---

## Medium Priority Issues

### Magic Numbers (Timeouts, Limits, Rates)

| Item                      | File                        | Value            | Type                     |
| ------------------------- | --------------------------- | ---------------- | ------------------------ |
| Cart Expiration           | `config.validation.ts:65`   | 10 minutes       | CART_TIMER_MINUTES       |
| Order Expiration          | `config.validation.ts:66`   | 10 minutes       | ORDER_EXPIRATION_MINUTES |
| Redis Connection Timeout  | `redis-io.adapter.ts:7`     | 10 seconds       | CONNECTION_TIMEOUT       |
| Socket.IO Ping Timeout    | `redis-io.adapter.ts:109`   | 60 seconds       | pingTimeout              |
| Socket.IO Ping Interval   | `redis-io.adapter.ts:110`   | 25 seconds       | pingInterval             |
| Socket.IO Connect Timeout | `redis-io.adapter.ts:111`   | 45 seconds       | connectTimeout           |
| Rate Limit (burst)        | `throttler.config.ts:16-17` | 10-30 req/s      | Varies by env            |
| Rate Limit (normal)       | `throttler.config.ts:21-22` | 20-200 req/10s   | Varies by env            |
| Rate Limit (extended)     | `throttler.config.ts:26-27` | 100-1000 req/min | Varies by env            |
| Auth Rate Limit           | `throttler.config.ts:36-37` | 5 attempts/min   | authThrottlerConfig      |
| CSRF Token Max Age        | `csrf.guard.ts:121`         | 24 hours         | maxAge                   |
| Admin Export Max Rows     | `admin.service.ts:642`      | 10000            | MAX_EXPORT_ROWS          |

**Recommendation:** Extract all to env vars with sensible defaults

### Hardcoded Korean Strings (Localization Issue)

| Location                     | String                                                  | Impact                                   |
| ---------------------------- | ------------------------------------------------------- | ---------------------------------------- |
| `settlement.service.ts:132+` | Settlement export headers (`주문 내역`, `주문일`, etc.) | Cannot easily change or localize         |
| `chat.gateway.ts:192`        | Rate limit error message (`메시지를 너무 빠르게...`)    | Error messages not translatable          |
| `products.service.ts:393`    | Copy suffix (`(복사)`)                                  | Cannot change duplication naming pattern |
| `alimtalk.service.ts:151`    | Button label (`라이브 보러가기`)                        | Cannot localize button text              |

**Recommendation:** Implement i18n/translations system

### Port Numbers

| Port | File                       | Context                      |
| ---- | -------------------------- | ---------------------------- |
| 1935 | `streaming.service.ts:958` | RTMP port hardcoded in regex |
| 1935 | `streaming.service.ts:963` | RTMP port fallback           |
| 8080 | `streaming.service.ts:959` | HLS server port (in URL)     |
| 1985 | `config.validation.ts:72`  | SRS API port                 |

**Recommendation:** Extract to `RTMP_PORT`, `HLS_PORT`, `SRS_API_PORT` env vars

---

## Low Priority Issues

### Pagination Defaults

- **File:** `backend/src/common/utils/pagination.util.ts:16`
- **Values:** `defaultLimit: 24`, `maxLimit: 100`
- **Fix:** Extract to `PAGINATION_DEFAULT_LIMIT` and `PAGINATION_MAX_LIMIT`

### Monitoring Thresholds

- **File:** `backend/src/common/monitoring/performance.interceptor.ts`
- **Values:** `SLOW_REQUEST_THRESHOLD_MS = 1000`, `VERY_SLOW_REQUEST_THRESHOLD_MS = 3000`
- **Fix:** Make configurable via env vars

### Prisma Transaction Timeout

- **File:** `backend/src/common/prisma/prisma.service.ts:31`
- **Value:** `timeout: 10000` (10 seconds)
- **Fix:** Extract to `PRISMA_TRANSACTION_TIMEOUT_MS`

### Metrics Store Size

- **File:** `backend/src/common/monitoring/performance.interceptor.ts:18`
- **Value:** `MAX_METRICS = 1000`
- **Fix:** Extract to `METRICS_STORE_MAX_SIZE`

### Test Data (Non-Critical)

- **Files:** `encryption.service.spec.ts`, `auth.service.spec.ts`
- **Issue:** Mock data with realistic phone/email values
- **Recommendation:** Use faker/factory libraries for test data

---

## Environment Variables Needed

### Required (No Defaults)

```bash
# Production only - no defaults
CORS_ORIGINS=https://doremi-live.com,https://www.doremi-live.com
FRONTEND_URL=https://www.doremi-live.com
REDIS_URL=redis://redis-prod:6379
RTMP_SERVER_URL=rtmp://www.doremi-live.com:1935/live
HLS_SERVER_URL=https://www.doremi-live.com/hls
SRS_API_URL=http://srs-prod:1985
ALIMTALK_API_URL=https://api.solapi.com/messages/v4/send-many
REDIS_HOST=redis-prod
REDIS_PORT=6379
```

### Configurable with Defaults

```bash
# Can use defaults but should be configurable
CART_EXPIRATION_MINUTES=10
ORDER_EXPIRATION_MINUTES=10
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SLOW_QUERY_THRESHOLD_MS=100
REDIS_CONNECTION_TIMEOUT_MS=10000
WS_PING_TIMEOUT_MS=60000
WS_PING_INTERVAL_MS=25000
WS_CONNECT_TIMEOUT_MS=45000
AUTH_THROTTLE_WINDOW_MS=60000
AUTH_THROTTLE_LIMIT=5
PAGINATION_DEFAULT_LIMIT=24
PAGINATION_MAX_LIMIT=100
CSRF_MAX_AGE_MS=86400000
ADMIN_MAX_EXPORT_ROWS=10000
RTMP_PORT=1935
```

---

## Remediation Plan

### Phase 1: Immediate (Next Deploy)

**Timeline:** Before next production deployment
**Effort:** 2-3 hours

1. ✅ Remove `CORS_ORIGINS` fallback from `config.validation.ts` and `redis-io.adapter.ts`
2. ✅ Remove `REDIS_URL` fallback from `main.ts` and `redis-io.adapter.ts`
3. ✅ Add `ALIMTALK_API_URL` environment variable
4. ✅ Add `APP_ENV` check to only use localhost defaults in development mode

**Files to modify:**

- `backend/src/common/config/config.validation.ts`
- `backend/src/main.ts`
- `backend/src/common/adapters/redis-io.adapter.ts`
- `backend/src/modules/admin/alimtalk.service.ts`

### Phase 2: Next Sprint

**Timeline:** Next 1-2 weeks
**Effort:** 4-6 hours

1. Extract all magic numbers to env vars (timeouts, rates, limits)
2. Centralize WebSocket URL configuration in frontend
3. Add i18n/translation system for Korean strings
4. Update GitHub Actions workflows to use secrets/env vars

**Files to modify:**

- `backend/src/common/throttler/throttler.config.ts`
- `backend/src/common/adapters/redis-io.adapter.ts`
- `client-app/src/lib/socket/socket-client.ts` (create config)
- `.github/workflows/deploy-staging.yml`

### Phase 3: Technical Debt

**Timeline:** Future maintenance
**Effort:** 6-8 hours

1. Implement comprehensive config service with validation
2. Add feature flag system for configuration
3. Migrate to external config management (AWS Parameter Store, Consul)
4. Use faker libraries for test data generation

---

## Key Metrics

| Category          | Count  | Files Affected |
| ----------------- | ------ | -------------- |
| Hardcoded URLs    | 14     | 12             |
| Magic Numbers     | 12     | 9              |
| Hardcoded Strings | 4      | 4              |
| Port Numbers      | 2      | 2              |
| Test Data         | 2      | 2              |
| CI/CD             | 1      | 1              |
| **TOTAL**         | **38** | **30**         |

---

## Risk Assessment

### Security Risks

- **CORS localhost fallback** → Unintended local connections in production
- **Redis localhost fallback** → May connect to wrong instance
- **AlimTalk endpoint hardcoded** → Cannot switch providers without code change

### Operational Risks

- **Streaming URLs hardcoded** → Difficult infrastructure migration
- **Port numbers hardcoded** → Cannot use non-standard ports
- **GitHub Actions hardcoding** → Staging deployment breaks with different hostnames

### Code Quality Risks

- **Duplicated WebSocket URLs** → 7+ locations with same fallback logic
- **Magic numbers scattered** → Difficult to maintain consistent behavior
- **No i18n** → Localization impossible without code refactoring

---

## Compliance & Best Practices

### 12-Factor App Compliance

- ❌ **Config:** Hardcoded values violate factor 3 (store config in environment)
- ❌ **Dev/Prod Parity:** Localhost defaults reduce dev/prod parity

### Infrastructure as Code

- ❌ **Missing:** Cannot reproduce production config purely from code + env vars
- ❌ **Auditability:** Cannot track config changes through version control

### Security Best Practices

- ❌ **Least Privilege:** CORS/Redis defaults are too permissive
- ❌ **Defense in Depth:** No separation of dev/prod config in code

---

## Next Steps

1. **Review this report** with your team
2. **Prioritize Phase 1 fixes** for immediate production safety
3. **Schedule Phase 2** for next sprint planning
4. **Create tickets** for each remediation item
5. **Update deployment runbooks** once env vars are externalized
6. **Document** all new environment variables in `.env.example` files

---

## Attachments

- **Full JSON Report:** `/d/Project/dorami/HARDCODED_DATA_REPORT.json` (693 lines, machine-readable)
- **This Summary:** `/d/Project/dorami/HARDCODED_DATA_SUMMARY.md`

---

**Report Generated:** 2026-03-02
**Scan Tool:** claude-code Explorer Agent
**Classification:** Internal Development
