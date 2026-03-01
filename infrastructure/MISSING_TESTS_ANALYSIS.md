# Streaming Performance Testing — Gap Analysis

**Generated:** 2026-02-28
**Scope:** `backend/`, `client-app/e2e/`, `infrastructure/monitoring/`, `infrastructure/loadtest/`

---

## 1. What Exists Today

### 1.1 Backend Unit Tests (Jest)

| File | What it covers |
|---|---|
| `streaming.service.spec.ts` | startStream, goLive, stopStream, authenticateStream, handleStreamDone, updateStream, cancelStream, getStreamStatus, getActiveStreams, getFeaturedProduct — all business-logic paths with mocked Prisma + Redis |
| `restream.service.spec.ts` | FFmpeg spawn, ACTIVE detection from stderr, SIGTERM on stop, auto-restart on abnormal exit, CRUD for restream targets |
| `restream.listener.spec.ts` | EventEmitter2 → startRestreaming / stopRestreaming wiring |

**Verdict:** Streaming business logic has solid unit coverage. All happy paths and most error branches are tested. No gaps in the service layer.

### 1.2 E2E Tests (Playwright)

| File | What it covers |
|---|---|
| `live-page.spec.ts` | Page renders, empty state, LIVE badge visible |
| `chat.spec.ts` | Chat UI elements, character counter, emoji picker, send-button state, connection indicator |
| `verification-live-status.spec.ts` | `/api/streaming/active` and `/upcoming` response shapes; streamKey not null; no `/live/undefined` navigation |
| `admin-live-product-card.spec.ts` | Admin featured-product card UI |
| `admin-live-product-realtime.spec.ts` | Real-time product card updates via WebSocket (admin side) |
| `admin-restream.spec.ts` | Restream target CRUD UI |
| `live-cart-pickup.spec.ts` | Cart pickup from live stream |
| `live-featured-product-purchase.spec.ts` | Full purchase flow from live page |
| `live-ui-bugs.spec.ts` | Regression checks for known live-page UI bugs |

**Verdict:** Functional correctness and UI rendering are covered. Tests gracefully skip when no live stream is publishing, which is correct for CI — but means the actual streaming path (video delivery) is never exercised by automated tests.

### 1.3 Monitoring Infrastructure

| Component | What exists |
|---|---|
| `monitoring/prometheus/rules/streaming_alerts.yml` | Alerts: SRS CPU >85%, Redis memory >80%, Postgres connections >85%, Nginx 5xx >1%, WebSocket error >2% |
| `monitoring/prometheus.yml` | Prometheus scrape config (exists, not read in detail) |
| `monitoring/grafana/provisioning/` | Grafana datasource + dashboard provisioning |
| `backend/src/common/monitoring/performance.interceptor.ts` | In-memory per-request latency tracking (avg, p95 proxy via slow-request flags at 1s/3s thresholds); warns on slow requests |
| `backend/src/common/monitoring/sentry.config.ts` | Sentry error tracking setup |
| `client-app/src/lib/monitoring/sentry.ts` | Frontend Sentry |
| `infrastructure/monitoring/srs-metrics.sh` | Parses SRS docker logs: frame drops, publisher timeouts, client disconnects, bandwidth kbps, peak clients |
| `infrastructure/monitoring/backend-metrics.sh` | (exists, not read — assumed similar shell-based log parsing) |
| `infrastructure/monitoring/nginx-analyzer.sh` | (exists, not read — assumed Nginx access log analysis) |
| `infrastructure/monitoring/metrics-collector.sh` | (exists — assumed orchestrates the above) |

**Verdict:** Reactive monitoring (alerts, log scraping) exists. Proactive load testing does not.

### 1.4 Load Test Infrastructure

Files in `infrastructure/loadtest/` were created during this session (the k6 script, run script, README, sample results). **These are new — nothing existed before this session.**

---

## 2. Gap Analysis Against the 8-Point Checklist

The 8-point checklist for streaming performance verification is:

| # | Checklist Item | Current Status | Gap |
|---|---|---|---|
| 1 | **HLS segment delivery latency (TTFS)** | Not measured anywhere | No test measures time from playlist request to first `.ts` byte received |
| 2 | **Concurrent viewer capacity** | Redis tracks `stream:{key}:viewers` counter; Prometheus alert fires at CPU >85% | No test validates SRS behavior at 100, 300, 500 concurrent viewers |
| 3 | **Segment continuity / rebuffer rate** | Not measured | No test checks for gaps in segment sequence numbers or missing segments |
| 4 | **WebSocket connection stability under load** | Alert: WS error rate >2% for 10 min | No test exercises WebSocket with concurrent connections; no reconnect-storm test |
| 5 | **HTTP-FLV vs HLS fallback behavior** | VideoPlayer has fallback logic in code; `live-ui-bugs.spec.ts` has regression checks | No automated test triggers the FLV→HLS fallback path and verifies the switch |
| 6 | **Stream start-to-live latency (publish → viewer sees video)** | Not measured | No test measures end-to-end latency from OBS connect to first frame |
| 7 | **Error rate under spike conditions** | Prometheus alert: Nginx 5xx >1% | No synthetic spike test; alert is reactive only |
| 8 | **Recovery after network disruption** | Not tested | No test validates reconnection after SRS restart or network drop |

---

## 3. Metrics Not Currently Collected

### Streaming-specific (missing entirely)

| Metric | Why it matters |
|---|---|
| **HLS segment fetch latency p50/p95/p99** | The core viewer experience metric — not in Prometheus, not in the performance interceptor |
| **Segment sequence gap count** | Detects encoder/SRS issues where segment numbers skip |
| **Time-to-first-segment (TTFS)** | Startup experience; high TTFS causes immediate viewer drop-off |
| **Playlist staleness** | Time between playlist generation and client receipt; indicates HLS window drift |
| **Active HLS client count** (from SRS API) | SRS exposes `/api/v1/clients` — not currently polled into Prometheus |
| **SRS publish/play event rate** | SRS exposes this via `/api/v1/streams` — not scraped |
| **FFmpeg restream bitrate / frame rate** | `restream.service` captures stderr but doesn't emit metrics |

### Backend API (partially missing)

| Metric | Current state | Gap |
|---|---|---|
| `http_req_duration` p95/p99 by endpoint | `PerformanceInterceptor` stores in-memory ring buffer (max 1000); only warns at 1s/3s thresholds | No histogram export to Prometheus; no p95/p99 queryable externally |
| Cart timer precision | Not measured | Cart 10-min expiry is business-critical; no test validates edge cases under load |
| Redis command latency | Not measured | Redis is on the critical path for viewer count, featured product, chat history |

### WebSocket (missing entirely)

| Metric | Gap |
|---|---|
| Socket.IO connection count per namespace | Not exported |
| Chat message delivery latency | Not measured |
| Viewer join/leave rate | Not measured |
| Room size at peak | Not measured |

---

## 4. Minimal Viable Test Suite — Prioritised

These are ordered by **risk × effort**, highest priority first.

### Priority 1 — Add Now (high risk, low effort)

**P1-A: Viewer count stress test (integration)**
- What: Hit `/api/streaming/active` and WebSocket join simultaneously with 50+ simulated connections
- Why: Redis viewer counter uses `incr`/`decr`; no test verifies it stays consistent under concurrent joins/leaves
- How: Jest integration test using `supertest` + multiple Socket.IO client instances
- Effort: 1–2 days
- File: `backend/src/modules/streaming/streaming.concurrent.spec.ts`

**P1-B: SRS API scraping into Prometheus**
- What: Add a Prometheus exporter that polls `http://localhost:1985/api/v1/streams` every 15s
- Why: SRS exposes active client count, bitrate, frame rate — none of this reaches Prometheus today
- How: Add a lightweight exporter service or use `prometheus-community/json-exporter`
- Effort: 0.5 days config change
- File: `monitoring/prometheus.yml` (add job), `docker-compose.observability.yml` (add exporter)

**P1-C: PerformanceInterceptor → Prometheus histogram**
- What: Replace the in-memory ring buffer with `prom-client` histogram buckets
- Why: p95/p99 latency by endpoint is currently unqueryable; Grafana dashboard has no API latency panels
- How: Add `prom-client` to backend, emit `http_request_duration_seconds` histogram with `path` + `method` labels
- Effort: 1 day
- File: `backend/src/common/monitoring/performance.interceptor.ts`

---

### Priority 2 — Add Within Sprint (medium risk, medium effort)

**P2-A: HLS segment delivery E2E test**
- What: Playwright test that navigates to `/live/{streamKey}`, waits for `<video>` to have `currentTime > 0`, then measures time elapsed
- Why: The live-page E2E tests check UI elements but never verify that video actually plays
- Prerequisite: Requires a live publisher; skip gracefully if none
- Effort: 1–2 days
- File: `client-app/e2e/live-hls-playback.spec.ts`

**P2-B: HTTP-FLV → HLS fallback test**
- What: Playwright test that intercepts the FLV request and returns 404, then verifies HLS fallback is triggered (checks `hls.js` loads)
- Why: The fallback code exists but is completely untested
- Effort: 1 day
- File: `client-app/e2e/live-fallback.spec.ts`

**P2-C: WebSocket reconnection test**
- What: Jest integration test that connects a Socket.IO client, drops the connection, and verifies it reconnects and rejoins the room
- Why: No test covers reconnection; this is a production risk during SRS restarts
- Effort: 1–2 days
- File: `backend/src/modules/streaming/streaming.websocket.spec.ts`

---

### Priority 3 — Add Before Launch (lower risk or higher effort)

**P3-A: k6 ramp scenario (100 VU baseline)**
- What: Run `k6 run --env SCENARIO=ramp hls-load-test.js` with 100 VUs (not 500) as a CI smoke test
- Why: Establishes a performance baseline before production; 500 VU full test is too slow for CI
- Prerequisite: k6 in CI environment, live stream publisher
- Effort: 0.5 days CI config
- File: `.github/workflows/ci.yml` (add optional perf job)

**P3-B: Redis viewer counter consistency test**
- What: Concurrent Jest test: 100 fake viewers join, 100 leave; assert final counter is 0
- Why: `incr`/`decr` without atomic guards can leak; no existing test covers this
- Effort: 0.5 days
- File: `backend/src/modules/streaming/streaming.service.spec.ts` (new describe block)

**P3-C: Chat rate-limit test**
- What: Send 25 messages in 10 seconds from one client (above the 20-msg/10s limit); assert the 21st is rejected
- Why: Rate limiting is implemented in `main.ts` but has no test
- Effort: 0.5 days
- File: `backend/src/modules/chat/chat.rate-limit.spec.ts`

---

## 5. Summary Table

| Area | Has tests | Missing tests | Priority |
|---|---|---|---|
| StreamingService business logic | Yes (full coverage) | None | — |
| ReStreamService + FFmpeg | Yes (full coverage) | None | — |
| Live page UI rendering | Yes (E2E) | Actual video playback | P2-A |
| HLS segment delivery latency | No | TTFS metric, segment latency histogram | P1-C, P2-A |
| FLV→HLS fallback | No | Fallback trigger test | P2-B |
| Concurrent viewer load | No | 50–500 VU stress test | P1-A, P3-A |
| WebSocket reconnection | No | Reconnect after drop | P2-C |
| Redis viewer counter consistency | No | Concurrent incr/decr correctness | P3-B |
| Chat rate limiting | No | 21st-message rejection | P3-C |
| SRS metrics in Prometheus | No | SRS API scraper | P1-B |
| API latency histograms | No (in-memory only) | prom-client histogram export | P1-C |
| Stream start-to-live latency | No | End-to-end latency measurement | P2-A (proxy) |
| Network disruption recovery | No | Drop + reconnect scenario | P2-C |
