# Dorami Live Commerce Platform - Comprehensive Audit Report

**Date**: 2026-02-28
**Scope**: Full-stack infrastructure, testing, database, real-time streaming, deployment, monitoring
**Platform**: Dorami Live Commerce MVP (NestJS + Next.js + PostgreSQL + Redis + SRS)

---

## 1. Executive Summary

Dorami is a well-structured monorepo live commerce platform with solid fundamentals: a clean NestJS backend, Next.js App Router frontend, proper CI/CD pipelines, and a comprehensive observability stack. However, critical gaps exist in **database backup automation**, **real-time streaming test coverage**, and **staging-production environment parity verification**. This report provides actionable recommendations prioritized by risk and effort.

### Overall Scores

| Area                            | Score  | Grade |
| ------------------------------- | ------ | ----- |
| **Live Real-time Testing**      | 55/100 | C     |
| **DB Backup Strategy**          | 25/100 | F     |
| **Staging/Production Parity**   | 78/100 | B-    |
| **CI/CD Pipeline**              | 82/100 | B     |
| **Monitoring & Observability**  | 72/100 | B-    |
| **Security Posture**            | 75/100 | B-    |
| **Code Quality & Architecture** | 85/100 | A-    |
| **Overall Platform Health**     | 67/100 | C+    |

---

## 2. Detailed Analysis by Area

### 2.1 Live Real-time Testing (55/100)

**Current State:**

- **Unit Tests (22 spec files):** Good coverage for core business logic (orders, cart, products, points, streaming, settlement, reservation, auth, admin, notifications). All services have corresponding `.spec.ts` files.
- **E2E Tests (14 e2e-spec files):** Cover auth, cart, orders, products, admin operations (users, orders, dashboard, payment confirmation, settlement). Separated into `user` and `admin` Playwright projects.
- **Playwright Config:** Well-configured with parallel execution, retries on CI, trace/screenshot/video on failure.

**Critical Gaps:**

- No WebSocket/Socket.IO integration tests exist. The entire chat (`/chat` namespace), streaming viewer count (`/streaming` namespace), and real-time product broadcast (`/` namespace) are untested at the integration level.
- No RTMP ingest simulation tests. The `authenticateStream()` and `handleStreamDone()` callbacks from SRS are only tested at unit level, not end-to-end with actual stream lifecycle.
- No load testing or stress testing for concurrent viewers, chat message throughput (rate limit: 20 msgs/10s), or WebSocket connection scaling.
- The `streaming.service.spec.ts` exists but does not test the grace period timer logic (`pendingStreamDoneTimers`) or OBS reconnection scenarios.
- No frontend-to-backend streaming integration test (e.g., VideoPlayer -> HTTP-FLV -> SRS -> backend webhook flow).
- Backend E2E tests use `continue-on-error: true` in CI, meaning failures are silently ignored.

**Strengths:**

- `useLiveLayoutMachine` FSM hook has exported `deriveSnapshot` and `computeLayout` functions explicitly designed for unit testing.
- Backend test infrastructure (Jest + Prisma + PostgreSQL service container in CI) is solid.
- Playwright setup with global auth setup and separate user/admin projects is well-designed.

---

### 2.2 Database Backup Strategy (25/100)

**Current State:**

- **No automated backup mechanism exists.** No `pg_dump` scripts, no cron jobs, no AWS RDS snapshot configuration, no backup-related environment variables or docker volumes.
- PostgreSQL data persists via Docker named volumes (`postgres_data` for dev, `postgres_data_prod` for production), but volumes are NOT backed up.
- Redis uses AOF persistence (`appendonly yes`) with a 256MB memory limit and `allkeys-lru` eviction policy. Redis data is ephemeral by design (caches, viewer counts, chat history with 24h TTL).
- Production Redis requires a password (`REDIS_PASSWORD`), which is good.
- No Point-in-Time Recovery (PITR) capability.
- No backup testing/restoration procedures documented.

**Risk Assessment: CRITICAL**

A single `docker volume rm` or host disk failure would result in **complete data loss** for all users, orders, products, settlements, and audit logs. This is the highest-priority finding in this audit.

**What Needs Backup:**

| Data                            | Storage                      | Criticality | Current Backup  |
| ------------------------------- | ---------------------------- | ----------- | --------------- |
| User accounts, orders, products | PostgreSQL                   | Critical    | None            |
| Audit logs, settlements         | PostgreSQL                   | Critical    | None            |
| Uploaded files (product images) | Docker volume `uploads_data` | High        | None            |
| Chat history                    | Redis (24h TTL)              | Low         | N/A (ephemeral) |
| Viewer counts, stream metadata  | Redis (session)              | Low         | N/A (ephemeral) |

---

### 2.3 Staging/Production Parity (78/100)

**Current State:**

**Strengths:**

- Both environments use the same Docker images (`ghcr.io/...dorami-backend:${IMAGE_TAG}` and `ghcr.io/...dorami-frontend:${IMAGE_TAG}`).
- Identical nginx routing configuration shared via `streaming-routing.conf` include file, preventing route drift between environments.
- Production deployment pipeline includes a **Parity Gate** step (`streaming-parity-check.mjs`) that validates staging vs. production alignment before deploying, comparing compose files, nginx config, and streaming endpoints.
- Same SRS v6 config file (`srs.conf`) used across all environments.
- Blue/Green deployment strategy with soak testing (900s duration, 30s intervals, 300 simulated users).

**Gaps:**

- Environment variable validation differs: production uses strict `${VAR:?required}` validation, but staging and dev do not, creating potential for misconfiguration.
- No shared `.env.example` or `.env.template` that documents ALL required variables across environments. Developers must discover them from multiple docker-compose files.
- Redis configuration differs: dev uses inline `redis-server --appendonly yes --maxmemory 256mb`, while production uses `REDIS_PASSWORD` and `REDIS_MAXMEMORY: 512mb`. No shared Redis config file.
- PostgreSQL connection pooling differs: production uses `connection_limit=20&pool_timeout=30`, dev uses defaults.
- Dev compose exposes ports to host (`5432:5432`, `6379:6379`), production binds to `127.0.0.1` only -- this is correct but means local testing cannot simulate production network topology.
- No infrastructure-as-code for the production host itself (server provisioning, OS updates, firewall rules).
- Frontend env vars: `NEXT_PUBLIC_WS_URL` vs `WS_URL` naming inconsistency between compose files.

---

### 2.4 CI/CD Pipeline (82/100)

**Current State:**

**Strengths:**

- Path-based change detection (backend, frontend, infra) avoids unnecessary CI runs.
- Backend CI runs lint + type-check in parallel, with real PostgreSQL 16 + Redis 7 service containers.
- Docker build test with BuildKit cache (`type=gha`).
- Trivy security scanning for both backend and frontend.
- Production auto-deploy pipeline: CI -> Build Images -> Parity Gate -> Blue/Green Deploy + Soak -> Observability Stack -> Health Check.
- Concurrency control: CI uses `cancel-in-progress: true`, production deploy uses `cancel-in-progress: false`.
- Image tag validation ensures `sha-<40hex>` format.

**Gaps:**

- E2E tests have `continue-on-error: true` -- failures do not block merges.
- Frontend CI uses `npm install` instead of `npm ci` (no lockfile enforcement).
- No Playwright E2E tests run in CI pipeline (only backend E2E).
- No database migration rollback testing.
- Trivy scanner uses `exit-code: '0'` -- vulnerabilities are reported but never block the pipeline.
- No dependency audit step (`npm audit`).
- `ci-success` job checks results but doesn't enforce security scan results.
- No smoke test against the deployed staging environment after staging deploys.

---

### 2.5 Monitoring & Observability (72/100)

**Current State:**

**Strengths:**

- Full Prometheus + Grafana observability stack via `docker-compose.observability.yml`.
- Exporters configured: Node Exporter, cAdvisor, Redis Exporter, PostgreSQL Exporter, Nginx Exporter.
- Backend and frontend metrics endpoints (`/metrics`) scraped by Prometheus.
- Blue/Green slot awareness in Prometheus config (scrapes both `backend_blue`/`backend_green` targets).
- Sentry integration prepared (config exists, DSN is optional env var).
- Frontend Sentry + stream metrics analytics exist (`client-app/src/lib/monitoring/sentry.ts`, `client-app/src/lib/analytics/stream-metrics.ts`).
- Performance interceptor exists (`backend/src/common/monitoring/performance.interceptor.ts`).
- Health endpoints: liveness (`/health/live`), readiness (`/health/ready` -- checks DB + Redis).
- Nginx exposes `stub_status` for Prometheus scraping.

**Gaps:**

- No alerting rules configured. `prometheus.yml` references `rule_files: /etc/prometheus/rules/*.yml` but no alert rules were found in the repository.
- Sentry is not actually initialized -- the config file exists with instructions ("Install: npm install @sentry/nestjs") but `@sentry/nestjs` is not in `package.json` dependencies.
- No structured logging (e.g., JSON log format for log aggregation). Backend uses NestJS default Logger (text format).
- No log aggregation stack (no ELK, Loki, or CloudWatch Logs integration).
- Docker logging uses `json-file` driver with size limits, but logs are not shipped anywhere.
- No WebSocket connection monitoring or chat/streaming-specific metrics.
- Grafana provisioning directories exist but no dashboard JSON files were found for pre-built dashboards.
- No uptime monitoring or external health checks (e.g., UptimeRobot, Pingdom).

---

### 2.6 Security Posture (75/100)

**Current State:**

**Strengths:**

- CSRF protection (Double Submit Cookie pattern) with toggle (`CSRF_ENABLED`).
- Helmet middleware for security headers.
- AES-256-GCM encryption for shipping addresses (`EncryptionService` + `PROFILE_ENCRYPTION_KEY`).
- JWT authentication with HttpOnly cookies, 15-min access token, 7-day refresh.
- Rate limiting on nginx: API (30r/s), Auth (5r/s), connection limits (20/IP).
- Production ports bound to `127.0.0.1` (not exposed to host network).
- TLS 1.2/1.3 only with modern cipher suite.
- HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy headers.
- `server_tokens off` hides nginx version.
- Dev auth endpoint (`ENABLE_DEV_AUTH: 'false'` in production) properly disabled.
- WebSocket connections require JWT authentication via `authenticateSocket()` middleware.

**Gaps:**

- Streaming CORS is `Access-Control-Allow-Origin: *` for HTTP-FLV and HLS endpoints -- should be restricted to known origins in production.
- No WAF (Web Application Firewall) or DDoS protection beyond nginx rate limiting.
- No secrets rotation policy or procedure.
- `PROFILE_ENCRYPTION_KEY` is a static 64-char hex key with no rotation mechanism.
- Admin role assignment via `ADMIN_EMAILS` env var -- no multi-factor authentication for admin access.
- No Content Security Policy (CSP) header configured.
- Trivy scan results are informational only (exit-code: 0).

---

### 2.7 Code Quality & Architecture (85/100)

**Current State:**

**Strengths:**

- Clean monorepo structure with shared types package.
- Well-designed NestJS module architecture following domain separation.
- Custom business exception hierarchy with named error codes.
- Consistent response envelope (`{data, success, timestamp}`) via `TransformInterceptor`.
- Prisma schema is well-indexed with composite indexes for common query patterns.
- Proper use of event-driven architecture (`EventEmitter2`) for cross-module communication.
- Frontend uses proper state management separation (Zustand for client, TanStack Query for server).
- Socket.IO reconnection handling with grace period timer for OBS disconnects (configurable `STREAM_DONE_GRACE_MS`, default 45s).
- Decimal-safe money handling via Prisma Decimal type and shared helper functions.
- Denormalized fields where appropriate (order items store product name/price at time of purchase).

**Gaps:**

- WebSocket implementation is non-standard (manually bootstrapped in `main.ts` instead of NestJS gateway DI wiring), making it harder to test and maintain.
- `any` type usage in several places (e.g., `streaming.service.ts:491` `const where: any = {}`).
- No API versioning strategy (all routes under `/api` with no version prefix).
- Missing database transactions for critical multi-step operations (e.g., order creation should be atomic with stock deduction).

---

## 3. Strengths Summary

1. **Solid CI/CD Foundation**: Path-based detection, parallel lint/type-check, real service containers in CI, blue/green production deployment with soak testing.
2. **Comprehensive Observability Stack**: Prometheus + Grafana + 5 exporters covering all infrastructure layers.
3. **Well-Designed Security**: CSRF, Helmet, encrypted PII, JWT with HttpOnly cookies, rate limiting, TLS 1.2+.
4. **Clean Architecture**: Domain-driven NestJS modules, shared types package, event-driven cross-module communication.
5. **Streaming Resilience**: OBS reconnection handling with configurable grace period, expiry extension on reconnect.
6. **Deployment Parity Gate**: Automated staging vs. production comparison before production deploys.
7. **Health Checks**: Proper liveness and readiness probes checking DB and Redis connectivity.

---

## 4. Risk Register

| ID  | Risk                                               | Severity | Likelihood | Impact       | Current Mitigation        |
| --- | -------------------------------------------------- | -------- | ---------- | ------------ | ------------------------- |
| R1  | Complete data loss (no DB backup)                  | Critical | Medium     | Catastrophic | None                      |
| R2  | Undetected streaming failures (no WebSocket tests) | High     | High       | Major        | Unit tests only           |
| R3  | Silent CI failures (E2E continue-on-error)         | High     | High       | Moderate     | Manual review             |
| R4  | No alerting on infrastructure issues               | High     | Medium     | Major        | Manual Grafana monitoring |
| R5  | Sentry not actually operational                    | Medium   | Certain    | Moderate     | Console logging only      |
| R6  | Wildcard CORS on streaming endpoints               | Medium   | Low        | Major        | Nginx-level only          |
| R7  | No log aggregation for forensics                   | Medium   | Medium     | Moderate     | Docker json-file logs     |
| R8  | Upload files not backed up                         | Medium   | Medium     | Moderate     | None                      |

---

## 5. Priority Action Plan

### 5.1 Immediate (Week 1) - Critical Risk Mitigation

#### A1: Implement PostgreSQL Automated Backup [R1]

**Priority**: P0 - Critical
**Effort**: 4-8 hours

- Create a `scripts/backup-postgres.sh` script using `pg_dump` with `--format=custom` for efficient compressed backups.
- Add a cron job on the production host: daily full backup at 03:00 KST, retain 30 days.
- Store backups in a separate volume or S3 bucket (recommended: S3 with lifecycle policy).
- Add backup verification: weekly `pg_restore --list` check to validate backup integrity.
- Document restoration procedure in `docs/disaster-recovery.md`.

#### A2: Remove `continue-on-error` from E2E Tests [R3]

**Priority**: P0 - Critical
**Effort**: 1-2 hours

- Remove `continue-on-error: true` from the backend E2E test step in `ci.yml`.
- Fix any currently-failing E2E tests that are being silently ignored.
- Add E2E test results to the `ci-success` gate.

#### A3: Enforce Trivy Security Scan [R6]

**Priority**: P1 - High
**Effort**: 1 hour

- Change Trivy `exit-code` from `'0'` to `'1'` to block merges with CRITICAL/HIGH vulnerabilities.
- Add exception file (`.trivyignore`) for known acceptable vulnerabilities.

#### A4: Restrict Streaming CORS [R6]

**Priority**: P1 - High
**Effort**: 2 hours

- Replace `Access-Control-Allow-Origin *` in `streaming-routing.conf` with environment-specific allowed origins.
- Use nginx `map` directive to dynamically set CORS based on `$http_origin`.

### 5.2 Short-term (Month 1) - Stability & Reliability

#### A5: Add WebSocket Integration Tests [R2]

**Priority**: P1 - High
**Effort**: 2-3 days

- Create `backend/test/websocket/` directory with integration tests for all three Socket.IO namespaces.
- Test: chat message send/receive, rate limiting (20 msgs/10s), message deletion, room join/leave.
- Test: viewer count increment/decrement, peak viewer tracking.
- Test: product broadcast events (featured product, stock updates).
- Use `socket.io-client` in Jest with real Redis + PostgreSQL service containers.

#### A6: Configure Prometheus Alerting Rules [R4]

**Priority**: P1 - High
**Effort**: 1 day

- Create `monitoring/prometheus/rules/alerts.yml` with rules for:
  - Node: CPU > 80% for 5min, Memory > 85%, Disk > 90%
  - PostgreSQL: connection pool exhaustion, replication lag (if applicable), slow queries
  - Redis: memory usage > 80%, eviction rate spike
  - Application: HTTP 5xx rate > 5%, health check failures, response time p99 > 3s
  - Streaming: SRS process down, active stream count anomaly
- Set up Alertmanager with Discord/Slack/Telegram webhook for notifications.

#### A7: Install and Initialize Sentry [R5]

**Priority**: P2 - Medium
**Effort**: 4 hours

- Install `@sentry/nestjs` in backend, `@sentry/nextjs` in frontend.
- Call `initSentry()` in `main.ts` (code already prepared).
- Configure `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` environment variables.
- Set up Sentry project with proper source maps upload during build.

#### A8: Add Upload Files Backup [R8]

**Priority**: P2 - Medium
**Effort**: 2 hours

- Add `uploads_data` volume backup to the PostgreSQL backup cron job.
- Alternatively, migrate uploads to S3-compatible storage (recommended for production).

#### A9: Create Environment Variable Template

**Priority**: P2 - Medium
**Effort**: 2 hours

- Create `.env.example` in the project root documenting ALL environment variables across all docker-compose files.
- Group by: Required, Optional, Security, Monitoring.
- Add validation script that checks current `.env.*` files against the template.

### 5.3 Medium-term (Quarter 1) - Production Hardening

#### A10: Implement Structured Logging & Log Aggregation [R7]

**Priority**: P2 - Medium
**Effort**: 1 week

- Switch NestJS Logger to structured JSON format (e.g., `nestjs-pino` or `winston` with JSON transport).
- Deploy Grafana Loki or similar lightweight log aggregation.
- Ship Docker container logs to the aggregation system.
- Create log-based dashboards and alerts in Grafana.

#### A11: Add Streaming E2E Tests

**Priority**: P2 - Medium
**Effort**: 1 week

- Create a test harness that simulates the full streaming lifecycle:
  1. Generate stream key via API
  2. Simulate RTMP publish callback (SRS webhook)
  3. Verify stream status changes (PENDING -> LIVE)
  4. Simulate viewer connections via Socket.IO
  5. Verify viewer count and peak tracking
  6. Simulate OBS disconnect + reconnect within grace period
  7. Simulate stream end (SRS on_unpublish callback)
  8. Verify cleanup (Redis keys removed, DB status OFFLINE)

#### A12: Add Load Testing

**Priority**: P2 - Medium
**Effort**: 1 week

- Implement k6 or Artillery load testing scripts for:
  - API endpoints under concurrent load
  - WebSocket connections (target: 1000+ simultaneous connections)
  - Chat message throughput (verify rate limiting under load)
  - Concurrent order creation (verify stock consistency)
- Integrate into CI as a scheduled job (weekly).

#### A13: Add Content Security Policy

**Priority**: P2 - Medium
**Effort**: 4 hours

- Configure CSP header in nginx with appropriate directives for:
  - Script sources (self + CDN)
  - Style sources (self + inline for Tailwind)
  - Media sources (SRS server, CDN)
  - WebSocket connections (`wss:` to backend)

#### A14: Implement Database Migration Rollback Testing

**Priority**: P3 - Low
**Effort**: 1 day

- Add CI step that tests `prisma migrate deploy` followed by a rollback scenario.
- Document manual rollback procedure for production.

#### A15: Add External Uptime Monitoring

**Priority**: P3 - Low
**Effort**: 2 hours

- Set up UptimeRobot or similar service monitoring:
  - `https://www.doremi-live.com/api/health/live` (liveness)
  - `https://www.doremi-live.com/api/health/ready` (readiness)
  - `https://www.doremi-live.com` (frontend)
- Configure alerts via email/Discord/Telegram.

---

## 6. Architecture Recommendations

### 6.1 WebSocket Refactoring (Long-term)

The current inline Socket.IO bootstrapping in `main.ts` should be refactored to use NestJS's standard `@WebSocketGateway` decorators for better testability and maintainability. This is a significant refactor but would:

- Enable proper dependency injection for WebSocket handlers
- Allow standard NestJS guards/pipes/interceptors on WebSocket events
- Simplify unit and integration testing

### 6.2 Database Migration to Managed Service

Consider migrating from self-hosted PostgreSQL (Docker volume) to AWS RDS or similar managed database:

- Automated backups with PITR
- Multi-AZ for high availability
- Automated patching and maintenance
- Read replicas for scaling (if needed)

### 6.3 Object Storage for Uploads

Migrate from Docker volume-based file uploads to S3-compatible object storage:

- Automatic durability (99.999999999%)
- CloudFront CDN integration
- No volume backup needed
- Presigned URLs for secure direct uploads

---

## 7. Testing Coverage Map

| Module                        | Unit Test | E2E Test               | Integration Test | Load Test   |
| ----------------------------- | --------- | ---------------------- | ---------------- | ----------- |
| Auth (Kakao OAuth)            | Yes       | Yes                    | -                | No          |
| Users                         | Yes       | Yes (profile, address) | -                | No          |
| Products                      | Yes       | Yes (store)            | -                | No          |
| Cart                          | Yes       | Yes                    | -                | No          |
| Orders                        | Yes       | Yes                    | -                | No          |
| Reservation                   | Yes       | -                      | -                | No          |
| Points                        | Yes       | -                      | -                | No          |
| Settlement                    | Yes       | Yes (admin)            | -                | No          |
| Streaming                     | Yes       | -                      | **Missing**      | **Missing** |
| Chat (WebSocket)              | -         | -                      | **Missing**      | **Missing** |
| Viewer Count (WebSocket)      | -         | -                      | **Missing**      | **Missing** |
| Product Broadcast (WebSocket) | -         | -                      | **Missing**      | **Missing** |
| Notifications (Push)          | Yes       | -                      | -                | No          |
| Admin (Dashboard/Audit)       | Yes       | Yes                    | -                | No          |
| Restream (FFmpeg)             | Yes       | -                      | -                | No          |
| Health Check                  | -         | -                      | -                | No          |
| CSRF Guard                    | Yes       | -                      | -                | No          |
| Encryption Service            | Yes       | -                      | -                | No          |

---

## 8. Compliance Checklist

| Requirement                | Status  | Notes                                                 |
| -------------------------- | ------- | ----------------------------------------------------- |
| Data encryption at rest    | Partial | Shipping addresses encrypted; DB volume not encrypted |
| Data encryption in transit | Yes     | TLS 1.2+ enforced                                     |
| Access control             | Yes     | JWT + Role-based (USER/ADMIN)                         |
| Audit logging              | Yes     | AuditLog model tracks admin actions                   |
| Input validation           | Yes     | ValidationPipe with whitelist + transform             |
| Error handling             | Yes     | BusinessException hierarchy with named codes          |
| Health monitoring          | Partial | Liveness + readiness probes; no alerting              |
| Backup & recovery          | **No**  | **Critical gap**                                      |
| Secrets management         | Partial | Env vars; no rotation; no vault                       |
| Dependency scanning        | Partial | Trivy runs but does not block                         |

---

## 9. Conclusion

Dorami has a strong foundation with well-structured code, a thoughtful deployment pipeline, and good security defaults. The most critical gap is the **complete absence of database backup automation** (R1), which represents an existential risk to the platform. Addressing this, along with enforcing CI test gates (A2, A3) and adding WebSocket test coverage (A5), should be the immediate focus.

The platform is well-positioned for production growth with its blue/green deployment strategy, observability stack, and streaming parity gate. The recommended action plan follows a risk-based prioritization that addresses critical vulnerabilities first while building toward comprehensive production hardening over the next quarter.

---

_Report generated by Dorami Platform Audit Team - 2026-02-28_
