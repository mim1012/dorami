# Dorami — Current Monitoring Audit

**Audited:** 2026-02-28
**Scope:** All monitoring, logging, and observability mechanisms present in the codebase today
**Auditor:** executor-monitoring agent

---

## 1. Existing Metrics Inventory

### 1.1 Backend — NestJS Application

#### Winston Logger (`backend/src/common/logger/logger.service.ts`)
- **What:** Structured JSON logging via `winston` at configurable `LOG_LEVEL`
- **Format:** `YYYY-MM-DD HH:mm:ss [level] [context] message {metadata}`
- **Transports:** Console only — **file logging is explicitly disabled** (`logs/error.log`, `logs/combined.log` commented out to prevent startup hang)
- **Coverage:** All NestJS module lifecycle events, auth events, WebSocket connection/leave events, CORS blocks
- **Gap:** No persistent log files; logs exist only in container stdout

#### PerformanceInterceptor (`backend/src/common/monitoring/performance.interceptor.ts`)
- **What:** HTTP request timing interceptor applied globally
- **Collects:**
  - Request duration (ms) per endpoint
  - Status code per request
  - User agent and user ID
  - Slow request warnings: >1000ms (`warn`), >3000ms (`error`)
- **Storage:** In-memory ring buffer capped at **1000 entries** — data is lost on restart
- **Exposes:** `getPerformanceStats()` function (avg duration, slow request count, error rate, top 10 endpoints by count)
- **Gap:** `getPerformanceStats()` is **never called from any HTTP endpoint** — metrics are collected but never served or exported

#### Health Endpoints (`backend/src/modules/health/health.controller.ts`)
- `GET /api/health/live` → liveness (always 200 if process is running)
- `GET /api/health` + `GET /api/health/ready` → readiness (checks PostgreSQL via Prisma ping + Redis ping)
- **Both are `@Public()`** — no auth required, suitable for probes
- **Gap:** No response-time or throughput data exposed; binary up/down only

#### Sentry Config (`backend/src/common/monitoring/sentry.config.ts`)
- **What:** Error tracking via `@sentry/nestjs` — conditionally initialized if `SENTRY_DSN` env var is set
- **Status: NOT ACTIVE** — `@sentry/nestjs` package is not installed; `initSentry()` is defined but **never called in `main.ts`**
- **Gap:** Error tracking is entirely absent in production unless `SENTRY_DSN` is set and package installed

#### Audit Log (`backend/src/modules/admin/`)
- **What:** `AuditLog` Prisma model — admin actions are written to the database
- **Coverage:** Admin-initiated actions (product updates, order management, etc.)
- **Gap:** Not a real-time metric source; no query interface for performance analysis

#### main.ts Bootstrap Logging
- Verbose `Logger('Bootstrap')` output on startup covering: env validation, middleware registration, Socket.IO namespace creation, Redis adapter connection, CORS config
- Socket.IO `/chat` namespace logs: room join/leave per user (`📥 User X joined room Y`)
- **Gap:** No periodic Socket.IO connection count logging; no message throughput counter

---

### 1.2 Nginx

#### Access Log (`infrastructure/docker/nginx-proxy/nginx.prod.conf`)
- **Format:** Standard combined log: `$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"`
- **Location:** `/var/log/nginx/access.log` (inside container)
- **Note:** `$request_time` and `$upstream_response_time` are **NOT included** in the current log format — latency analysis is not possible without log format change
- **Health endpoint:** `access_log off` for `/health` — correct
- `/live/live/` and `/hls/` streaming paths: access_log enabled (good for HLS segment request tracking)
- **Gap:** No `stub_status` module exposed — cannot get active connections count via HTTP

#### Error Log
- `error_log /var/log/nginx/error.log warn` — captures 4xx/5xx at warn level
- **Gap:** Error log is inside the container and not shipped anywhere

---

### 1.3 SRS Streaming Server

#### Docker Stats (via soak collector)
- `docker stats --no-stream --format json {containerName}` — CPU%, memory%, net I/O, block I/O, PIDs
- **Collected by:** `scripts/soak/collectors/srs.js` during `streaming-soak-check.mjs` runs
- **Gap:** Only collected during explicit soak test runs, not continuously

#### SRS HTTP API
- SRS v6 exposes a built-in API at `http://srs:1985/api/v1/`
- Available endpoints: `/api/v1/summaries`, `/api/v1/streams`, `/api/v1/clients`, `/api/v1/vhosts`
- **Gap:** This API is **not polled anywhere** in the codebase — no integration with any monitoring script

---

### 1.4 Redis

#### Via soak collector (`scripts/soak/collectors/redis.js`)
- Runs `redis-cli INFO memory` → `used_memory`, `used_memory_peak`
- Runs `redis-cli INFO stats` → `connected_clients`, `total_commands_processed`
- Runs `redis-cli CONFIG GET maxclients`
- **Only collected during explicit soak test runs**

#### Redis Data Used by Application
- `chat:{liveId}:history` — chat message history (max 100, 24h TTL)
- `stream:{streamKey}:viewers` — viewer count counter
- Socket.IO pub/sub channels (via Redis adapter)
- **Gap:** No Redis keyspace metrics, eviction rate, or latency histogram collected

---

### 1.5 PostgreSQL

#### Via soak collector (`scripts/soak/collectors/postgres.js`)
- Queries `pg_stat_activity` for active connection count vs `max_connections`
- **Only collected during explicit soak test runs**
- **Gap:** No slow query log, no `pg_stat_statements`, no index usage stats

---

### 1.6 HLS / Streaming

#### Via soak collector (`scripts/soak/collectors/hls.js`)
- Fetches `{url}/hls/{streamKey}.m3u8` and parses:
  - HTTP status code
  - Segment count
  - `#EXT-X-PROGRAM-DATE-TIME` drift (ms from wall clock)
  - Response body size
  - ETag for change detection
- **Only collected during explicit soak test runs**

---

### 1.7 WebSocket (Socket.IO)

#### Via soak collector (`scripts/soak/collectors/websocket.js`)
- Probes WebSocket connection handshake against `/socket.io/` endpoint
- Measures: connection open latency (ms), success/failure rates, reconnect rate, p95 open latency
- Batch probes in chunks of 20 connections
- **Only collected during explicit soak test runs**

---

### 1.8 Existing Soak / Load Test Scripts

| Script | Purpose | Output |
|--------|---------|--------|
| `scripts/streaming-soak-check.mjs` | Orchestrates all collectors above for soak tests | Console + evaluator report |
| `scripts/load-test-combined.sh` | Combined HLS + WebSocket + API load test | Log files in `/tmp/load-test-{ts}/` |
| `scripts/load-test-hls.mjs` | HLS-specific concurrent load | Console |
| `scripts/load-test-websocket.mjs` | WebSocket concurrent load | Console |
| `scripts/soak/analyzer.js` | Evaluates snapshots against thresholds | Issues array |
| `scripts/soak/reporter.js` | Prints results | Console |
| `scripts/monitor/live-monitor-*.log` | Ad-hoc monitor log (one sample found: 2026-02-26) | Flat text: `WEB FAIL / API FAIL / consecutive_failures` |

---

## 2. Observability Gaps vs 8-Point KPI Checklist

The KPIs assumed for this platform (based on task briefings and CLAUDE.md):

| # | KPI | Currently Measurable? | Gap |
|---|-----|-----------------------|-----|
| 1 | HLS segment delivery latency (p50/p95/p99) | **Partial** — drift measured in soak collector, not continuously | No continuous measurement; nginx log lacks `$request_time` |
| 2 | WebSocket connection success rate | **Partial** — probed in soak collector only | Not measured during actual live events |
| 3 | Socket.IO concurrent connection count | **No** | Never logged or exported; only join/leave events in log |
| 4 | HTTP API response time (p95) | **Partial** — PerformanceInterceptor collects data | In-memory only, never served via endpoint, lost on restart |
| 5 | HTTP 5xx error rate | **No** | nginx error log inside container; no aggregation |
| 6 | SRS CPU / memory during stream | **Partial** — via docker stats in soak tests only | Not polled during normal operation |
| 7 | Redis memory growth rate | **Partial** — soak test only | Not continuously monitored |
| 8 | PostgreSQL active connections | **Partial** — soak test only | Not continuously monitored |

### Additional Gaps Not Covered by the 8 KPIs

- **No Prometheus metrics endpoint** — `getPerformanceStats()` is collected but never exported
- **No alerting** — no threshold alerts for any metric in normal operation
- **No persistent metric storage** — all metrics are ephemeral (in-memory or container stdout)
- **No SRS API integration** — SRS v6 exposes rich stream/client data at `:1985/api/v1/` that is completely unused
- **No log aggregation** — nginx, SRS, and backend logs live in separate containers with no shipping to a central store
- **No dashboard** — no real-time visibility into system state without manual `docker stats` or `docker logs`
- **Nginx log format missing `$request_time`** — cannot measure latency from nginx logs without a format change
- **Sentry not initialized** — error tracking exists in code but is never activated
- **File logging disabled** — comment in `logger.service.ts` says "to prevent startup hang" — no error persistence

---

## 3. Low-Effort, High-Value Improvement Recommendations

Ranked by effort (low → high) and impact.

### Priority 1 — Zero Code Changes Required

#### A. Add `$request_time` to nginx log format
**Effort:** 1 line change in `nginx.prod.conf`
**Impact:** Enables p50/p95/p99 latency analysis from nginx logs immediately

```nginx
# Change in nginx.prod.conf log_format main:
log_format main '$remote_addr - $remote_user [$time_local] "$request" '
               '$status $body_bytes_sent "$http_referer" '
               '"$http_user_agent" $request_time $upstream_response_time';
```

#### B. Enable nginx `stub_status`
**Effort:** 3 lines in nginx config
**Impact:** Exposes active connections, accepts, requests — sufficient for load monitoring

```nginx
location /nginx_status {
    stub_status on;
    allow 127.0.0.1;
    deny all;
}
```

---

### Priority 2 — Minimal Code Changes (< 1 hour each)

#### C. Expose `/api/metrics` endpoint for PerformanceInterceptor
**Effort:** Add one `@Get('metrics')` route to `AppController` calling `getPerformanceStats()`
**Impact:** Makes the already-collected in-memory HTTP timing data queryable
**File:** `backend/src/app.controller.ts`

#### D. Poll SRS HTTP API for stream stats
**Effort:** Add one `fetch('http://srs:1985/api/v1/summaries')` call to existing soak collector or health check
**Impact:** Gets live stream count, client count, send/recv kbps, frame drop rate from SRS's built-in API
**File:** `scripts/soak/collectors/srs.js` — extend existing collector

#### E. Log Socket.IO connection count periodically
**Effort:** Add a `setInterval` in `main.ts` after Socket.IO setup
**Impact:** Makes concurrent connection count visible in logs without any external tooling

```typescript
// In main.ts, after io is created:
setInterval(() => {
  const sockets = await io.fetchSockets();
  logger.log(`Socket.IO: ${sockets.length} connected clients`);
}, 30_000);
```

#### F. Re-enable file logging in `logger.service.ts`
**Effort:** Uncomment 2 lines; investigate and fix the startup hang (likely a path issue)
**Impact:** Error and combined logs persist across restarts; enables post-mortem analysis

---

### Priority 3 — Medium Effort (2–4 hours)

#### G. Add continuous `docker stats` collection alongside running app
**Effort:** Run `metrics-collector.sh` as a sidecar process in `docker-compose.yml`
**Impact:** Continuous CPU/memory/network per container with no code changes to the app

```yaml
# Add to docker-compose.yml:
  metrics-sidecar:
    image: bash:latest
    volumes:
      - ./infrastructure/monitoring:/monitoring
      - /var/run/docker.sock:/var/run/docker.sock
    command: bash /monitoring/metrics-collector.sh --duration 86400 --output /metrics/
```

#### H. Add `prom-client` to NestJS and expose `/api/metrics` in Prometheus format
**Effort:** `npm install prom-client` + register default metrics + expose endpoint
**Impact:** Enables Prometheus + Grafana stack with zero additional scrape configuration needed
**Unlocks:** All Prometheus alert rules in `infrastructure/monitoring/prometheus-config.yml`

#### I. Activate Sentry error tracking
**Effort:** `npm install @sentry/nestjs` + call `initSentry()` in `main.ts` + set `SENTRY_DSN`
**Impact:** Automatic error capture with stack traces, request context, and user ID in production

---

## 4. Current Logging Coverage Summary

| Layer | Logging | Format | Persistent | Continuous |
|-------|---------|--------|-----------|-----------|
| NestJS backend | Winston JSON | Structured | **No** (stdout only) | Yes |
| HTTP request timing | PerformanceInterceptor | In-memory | **No** | Yes (but unexported) |
| Socket.IO events | `Logger('Bootstrap')` | Text | **No** | Per-event only |
| Nginx access | Combined log | Text | In container | Yes |
| Nginx errors | Error log | Text | In container | Yes |
| SRS | Docker stdout | SRS native format | **No** | Yes |
| Redis | soak collector only | Key-value | **No** | **No** — on-demand |
| PostgreSQL | soak collector only | pg_stat_activity | **No** | **No** — on-demand |
| HLS segments | soak collector only | HTTP fetch | **No** | **No** — on-demand |
| WebSocket probes | soak collector only | JS metrics | **No** | **No** — on-demand |
| Error tracking (Sentry) | Config exists | N/A | N/A | **Not activated** |

---

## 5. Quick Win Summary

Implementing items A + B + C + D + E requires **< 2 hours total** and delivers:

1. **nginx latency data** — p50/p95/p99 per URL from access logs
2. **nginx connection count** — via `stub_status`
3. **HTTP timing endpoint** — query current backend performance stats
4. **SRS stream data** — live client count, bandwidth, frame drops
5. **Socket.IO connection count** — logged every 30s

These five changes would close **5 of the 8 KPI gaps** identified above with no new infrastructure dependencies.
