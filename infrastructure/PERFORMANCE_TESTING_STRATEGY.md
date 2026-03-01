# Dorami Live Commerce - Performance Testing Strategy

> **Version:** 1.0
> **Date:** 2026-02-28
> **Target:** Production readiness verification for 500 CCU live streaming

---

## Executive Summary

Dorami is a single-seller live commerce platform where one broadcaster streams product demos to hundreds of concurrent viewers. Performance verification must prove the system can sustain **500 concurrent viewers** watching a single live stream while simultaneously interacting via chat, adding items to carts, and receiving real-time stock updates -- all without degrading video playback quality.

This document defines quantified KPI targets, four load test scenarios, a monitoring architecture, pass/fail criteria, and a timeline for executing performance verification on staging infrastructure that mirrors production.

### Critical Path Components

```
OBS → RTMP(1935) → SRS v6 → HTTP-FLV / HLS(8080) → Nginx Proxy → Viewer
                      ↕ webhooks                        ↕ /socket.io
              NestJS Backend(3001) ←→ Redis(6379) ←→ PostgreSQL(5432)
```

The bottleneck candidates in priority order:
1. **SRS media server** -- single container serving all FLV/HLS connections
2. **Nginx proxy** -- connection limits, buffer settings, worker_connections (2048)
3. **NestJS + Socket.IO** -- WebSocket connection pool, Redis pub/sub fan-out
4. **Redis** -- chat history, viewer counting, Socket.IO adapter
5. **PostgreSQL** -- order/cart writes under concurrent load

---

## 1. KPI Targets

### 1.1 Streaming Latency

| Metric | Target | Rationale |
|--------|--------|-----------|
| HTTP-FLV glass-to-glass | ≤ 3s | FLV is the primary low-latency path; SRS `gop_cache: on` + `mw_latency: 0` + `tcp_nodelay: on` should deliver 1-3s |
| HLS glass-to-glass | ≤ 8s | `hls_fragment: 1s` + `hls_window: 4` = 4s buffer minimum; add network/player buffer |
| HLS segment generation | ≤ 2s | SRS must produce `.ts` segments within 2s of keyframe arrival |
| First-frame time (new viewer join) | ≤ 3s (FLV), ≤ 6s (HLS) | Includes TCP handshake, GOP cache delivery, and player decode |

### 1.2 Playback Quality

| Metric | Target | Measurement |
|--------|--------|-------------|
| Rebuffer rate | < 1% | `(total_rebuffer_events / total_play_duration_seconds) * 100`; measured via hls.js `FRAG_BUFFERED` / `ERROR` events |
| Rebuffer ratio | < 0.5% | `(total_rebuffer_duration / total_session_duration) * 100` |
| Stream start success rate | > 99% | `successful_first_frame / total_play_attempts * 100` |
| Frame drop rate | < 0.1% | Measured from SRS stats API or mpegts.js statistics |

### 1.3 System Resources

| Metric | Target | Justification |
|--------|--------|---------------|
| CPU utilization (all containers) | < 75% @ 500 CCU | Leave 25% headroom for traffic spikes; production ECS scales at 70% |
| Memory utilization | < 80% total, 0 bytes swap | Memory leak detection; SRS + Node.js are the primary consumers |
| SRS memory | < 2 GB @ 500 CCU | ~4 MB per FLV connection baseline |
| NestJS heap | < 512 MB @ 500 CCU | Node.js default heap is 1.7 GB; staying under 512 MB indicates no leaks |
| Redis memory | < 200 MB | maxmemory is 256 MB with allkeys-lru eviction |
| Network I/O (SRS egress) | Monitored, no target | Depends on bitrate; at 3 Mbps * 500 = ~1.5 Gbps theoretical max (CDN absorbs most in prod) |

### 1.4 Concurrent Capacity

| Metric | Target |
|--------|--------|
| Concurrent viewers (CCU) | 500 sustained for 30 min (ramp), 6 hours (soak) |
| WebSocket connections | 500 on `/streaming` + 500 on `/chat` + 500 on `/` = 1,500 total Socket.IO connections |
| Chat messages/sec throughput | 50 msg/s sustained (rate limit: 20 msg/10s per user) |
| API success rate | > 99% (HTTP 2xx / total requests) |
| API p95 latency | < 500 ms for reads, < 1000 ms for writes |
| API p99 latency | < 1000 ms for reads, < 2000 ms for writes |

### 1.5 Recovery & Resilience

| Metric | Target |
|--------|--------|
| Viewer reconnection after network failure | < 5s automatic reconnect |
| Stream recovery after OBS disconnect/reconnect | < 10s to resume playback for existing viewers |
| WebSocket reconnection | < 3s (Socket.IO default reconnect with jitter) |

---

## 2. Load Testing Approach

### 2.1 Tool Selection: k6

**Why k6 over alternatives:**

| Criterion | k6 | Locust | Artillery |
|-----------|-----|--------|-----------|
| HTTP streaming (chunked/FLV) | Native via `http.get` with streaming response | Requires custom code | Limited |
| WebSocket support | Built-in `k6/ws` module | Plugin-based | Built-in but less mature |
| HLS manifest parsing | Scriptable in JS (fetch .m3u8, parse, fetch .ts) | Python scripting | YAML-only, limited |
| Resource efficiency | Go-based, low overhead per VU | Python, higher per-VU cost | Node.js, moderate |
| Metrics export | Built-in JSON, CSV, InfluxDB, Prometheus | Custom | Limited |
| CI integration | CLI-first, exit codes | Web UI focused | CLI available |
| Scripting | JavaScript ES6 | Python | YAML + JS |

**k6 is the best fit** because it can simulate both HTTP-FLV long-polling connections and HLS segment fetching in JavaScript, while maintaining thousands of virtual users with low resource overhead. Its WebSocket module can simultaneously simulate Socket.IO connections for chat and viewer counting.

### 2.2 Test Scenarios

#### Scenario 1: Ramp Test (Capacity Validation)

```
Purpose: Validate system handles 500 CCU with gradual ramp-up
Duration: 35 minutes total
Profile:
  0:00 - 5:00   → Ramp 0 → 500 VUs (linear)
  5:00 - 30:00  → Hold 500 VUs steady (25 min sustained)
  30:00 - 35:00 → Ramp 500 → 0 VUs (graceful drain)

Each VU simulates:
  1. Connect to Socket.IO / namespace (authenticate with JWT)
  2. Connect to /streaming namespace (join stream room)
  3. Connect to /chat namespace
  4. Start HLS or HTTP-FLV playback (70% HLS, 30% FLV to mirror real traffic)
  5. Send 1 chat message every 30s (randomized)
  6. Fetch product list every 60s
  7. 5% of VUs add item to cart during hold phase

Pass criteria:
  - All KPI targets met during hold phase
  - No connection failures during ramp-up
  - Clean drain with no orphaned connections
```

#### Scenario 2: Spike Test (Burst Handling)

```
Purpose: Validate system handles sudden viewer influx (e.g., social media share)
Duration: 15 minutes total
Profile:
  0:00 - 2:00   → Hold at 50 VUs (baseline)
  2:00 - 2:30   → Spike to 500 VUs (30-second burst)
  2:30 - 10:00  → Hold 500 VUs (7.5 min)
  10:00 - 10:30 → Drop to 50 VUs (mass departure)
  10:30 - 15:00 → Hold 50 VUs (recovery observation)

Pass criteria:
  - No 5xx errors during spike
  - First-frame time < 5s for viewers joining during spike
  - System recovers to baseline resource usage within 2 min of drop
  - No memory leaks visible after spike (heap should return to pre-spike levels)
```

#### Scenario 3: Soak Test (Stability / Leak Detection)

```
Purpose: Detect memory leaks, connection leaks, file descriptor exhaustion
Duration: 6 hours
Profile:
  0:00 - 0:10   → Ramp 0 → 300 VUs
  0:10 - 5:50   → Hold 300 VUs steady (5h 40min)
  5:50 - 6:00   → Ramp 300 → 0 VUs

Each VU simulates realistic viewer behavior:
  1. Watch stream (HLS segment fetch loop)
  2. Send chat message every 2 minutes
  3. Browse products every 5 minutes
  4. 2% chance per hour of adding to cart and placing order

Monitoring focus:
  - Memory trend (should be flat, not monotonically increasing)
  - File descriptor count (should stabilize)
  - Redis connection pool size
  - PostgreSQL connection pool usage
  - Socket.IO room membership counts vs actual VU count

Pass criteria:
  - Memory growth < 10% over 6 hours (per container)
  - Zero swap usage throughout
  - CPU average < 75% throughout
  - No connection pool exhaustion
  - < 1% rebuffer rate maintained for entire duration
```

#### Scenario 4: Network Failure / Recovery Test

```
Purpose: Validate resilience to network interruptions
Duration: 20 minutes
Profile:
  0:00 - 5:00   → Ramp to 300 VUs, stabilize
  5:00 - 5:10   → Simulate 10-second network partition (iptables drop or tc netem)
  5:10 - 10:00  → Observe reconnection behavior
  10:00 - 10:05 → Simulate OBS disconnect (stop RTMP ingest for 5s)
  10:05 - 10:10 → OBS reconnects (resume RTMP ingest)
  10:10 - 15:00 → Observe stream recovery
  15:00 - 15:05 → Kill SRS container, observe auto-restart
  15:05 - 20:00 → Observe full recovery

Pass criteria:
  - > 95% of viewers reconnect within 5s after network partition
  - Stream resumes playback within 10s after OBS reconnect
  - SRS container restarts within 30s (docker restart policy)
  - WebSocket rooms re-populated within 15s of recovery
  - stream:ended event fires correctly on OBS disconnect
  - State transitions: LIVE → OFFLINE (on disconnect), OFFLINE → LIVE (on reconnect via srs-auth webhook)
```

---

## 3. Monitoring Architecture

### 3.1 Metrics Collection Stack

```
┌──────────────────────────────────────────────────────────┐
│                    Metrics Sources                        │
├──────────┬──────────┬─────────┬──────────┬───────────────┤
│ Docker   │ Nginx    │ SRS     │ NestJS   │ k6            │
│ stats    │ access   │ logs +  │ Socket.IO│ metrics       │
│ (JSON)   │ logs     │ API     │ events   │ (JSON/CSV)    │
└────┬─────┴────┬─────┴────┬────┴────┬─────┴───────┬───────┘
     │          │          │         │             │
     ▼          ▼          ▼         ▼             ▼
┌──────────────────────────────────────────────────────────┐
│              Collector Script (metrics-collector.sh)      │
│              Runs every 5s, writes to JSON lines file     │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│              HTML Dashboard (auto-refresh every 5s)       │
│              Reads JSON lines, renders charts             │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Docker Container Metrics

**Collection method:** `docker stats --no-stream --format '{{json .}}'`

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| CPU % | `docker stats` `.CPUPerc` | > 75% for 60s |
| Memory usage | `docker stats` `.MemUsage` | > 80% of limit |
| Memory % | `docker stats` `.MemPerc` | > 80% |
| Network I/O | `docker stats` `.NetIO` | Monitor only |
| Block I/O | `docker stats` `.BlockIO` | Monitor only |
| PIDs | `docker stats` `.PIDs` | > 500 |

**Containers monitored:** `live-commerce-srs`, `live-commerce-postgres`, `live-commerce-redis`, backend (NestJS), frontend (Next.js), nginx-proxy

### 3.3 Nginx Metrics

**Collection method:** Parse access log with timing fields

The production nginx config already includes timing fields:
```
rt=$request_time uct="$upstream_connect_time" uht="$upstream_header_time" urt="$upstream_response_time"
```

| Metric | Derivation | Alert Threshold |
|--------|-----------|-----------------|
| Request rate (req/s) | Count lines per interval | Monitor only |
| Response time p50/p95/p99 | Parse `rt=` field, compute percentiles | p95 > 1s, p99 > 2s |
| Error rate (4xx) | Count `" 4xx ` status codes | > 5% of total |
| Error rate (5xx) | Count `" 5xx ` status codes | > 1% of total |
| 499 (client closed) | Count `" 499 ` | > 5% (indicates timeout) |
| 502 (bad gateway) | Count `" 502 ` | > 0 (SRS or backend down) |
| 504 (gateway timeout) | Count `" 504 ` | > 0 (backend/SRS overloaded) |
| Active connections | `nginx -s status` or stub_status module | > 1500 |
| Upstream connect time | Parse `uct=` field | p95 > 100ms |
| Upstream response time | Parse `urt=` field | p95 > 500ms |

### 3.4 SRS Media Server Metrics

**Collection method:** SRS HTTP API (`http://localhost:1985/api/v1/`) + console log parsing

| Metric | API Endpoint / Log Pattern | Alert Threshold |
|--------|---------------------------|-----------------|
| Connected clients | `/api/v1/clients` `.clients` count | > 600 |
| Active streams | `/api/v1/streams` `.streams` count | 1 (single-seller) |
| Stream bitrate (kbps) | `/api/v1/streams` `.stream.kbps.recv_30s` | < 500 or > 6000 |
| Publisher uptime | `/api/v1/streams` `.stream.publish.active` | false = alert |
| SRS CPU usage | Docker stats for `live-commerce-srs` | > 70% |
| Frame drops | Log pattern `drop frame` | > 0/min |
| Client disconnects | Log pattern `disconnect peer` | > 10/min |
| GOP cache size | SRS config: `gop_cache_max_frames: 30` | Monitor only |

**SRS API endpoints used:**
- `GET /api/v1/summaries` -- overall server state
- `GET /api/v1/streams` -- active stream details (bitrate, codec, resolution)
- `GET /api/v1/clients` -- connected client count and details

### 3.5 Backend / Socket.IO Metrics

**Collection method:** Custom NestJS middleware + Redis counters

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| WebSocket connections (/) | `io.engine.clientsCount` | > 600 |
| WebSocket connections (/chat) | `/chat` namespace `.sockets.size` | > 600 |
| WebSocket connections (/streaming) | `/streaming` namespace `.sockets.size` | > 600 |
| Chat messages/sec | Redis counter `chat:rate` | > 100/s |
| Viewer count accuracy | Compare Redis `stream:{key}:viewers` SET size with Socket.IO room size | Delta > 5% |
| API response time | NestJS interceptor timing | p95 > 500ms |
| Health endpoint | `GET /api/health/ready` | != 200 |
| Event loop lag | `process.hrtime()` delta | > 100ms |
| Heap used | `process.memoryUsage().heapUsed` | > 512 MB |
| External memory | `process.memoryUsage().external` | > 256 MB |

### 3.6 Redis Metrics

**Collection method:** `redis-cli INFO` parsed output

| Metric | INFO Field | Alert Threshold |
|--------|-----------|-----------------|
| Connected clients | `connected_clients` | > 200 |
| Used memory | `used_memory_human` | > 200 MB |
| Memory fragmentation ratio | `mem_fragmentation_ratio` | > 1.5 |
| Ops/sec | `instantaneous_ops_per_sec` | > 10,000 |
| Keyspace hits/misses | `keyspace_hits` / `keyspace_misses` | Hit rate < 90% |
| Pub/Sub channels | `pubsub_channels` | Monitor only |
| Evicted keys | `evicted_keys` | > 0 per interval |

### 3.7 PostgreSQL Metrics

**Collection method:** SQL queries via `psql`

| Metric | Query | Alert Threshold |
|--------|-------|-----------------|
| Active connections | `SELECT count(*) FROM pg_stat_activity WHERE state = 'active'` | > 80% of max_connections |
| Waiting queries | `SELECT count(*) FROM pg_stat_activity WHERE wait_event IS NOT NULL` | > 10 |
| Transaction rate | `SELECT xact_commit + xact_rollback FROM pg_stat_database` | Monitor only |
| Cache hit ratio | `SELECT sum(blks_hit) / sum(blks_hit + blks_read) FROM pg_stat_database` | < 95% |
| Deadlocks | `SELECT deadlocks FROM pg_stat_database` | > 0 |
| Slow queries | `pg_stat_statements` with mean_time > 1000ms | > 0 |

### 3.8 Real-time HTML Dashboard

A self-contained HTML file served on port 9090 that auto-refreshes every 5 seconds, showing:

1. **System Overview**: CPU/Memory gauges for each container
2. **Streaming Health**: Viewer count, stream bitrate, rebuffer events
3. **API Performance**: Request rate, error rate, latency percentiles
4. **WebSocket Status**: Connection counts per namespace
5. **Resource Trends**: 5-minute rolling charts for CPU, memory, connections
6. **Alert Log**: Real-time list of threshold violations

---

## 4. Test Environment Requirements

### 4.1 Staging ≈ Production Parity Checklist

| Component | Production | Staging (must match) | Validation |
|-----------|-----------|---------------------|------------|
| SRS version | v6 (ossrs/srs:6) | v6 (ossrs/srs:6) | `docker images` |
| SRS config | `srs.conf` (4 threads, gop_cache on, hls_fragment 1s) | Identical config | Diff check |
| SRS max_connections | 5000 | 5000 | Config check |
| Nginx worker_connections | 2048 | 2048 | Config check |
| Nginx rate limiting | api: 30r/s, auth: 5r/s | Identical | Config check |
| PostgreSQL | 16-alpine | 16-alpine | `docker images` |
| Redis | 7-alpine, 256MB maxmemory | 7-alpine, 256MB | Config check |
| NestJS Node.js version | Match Dockerfile | Match Dockerfile | `node -v` |
| Network (Docker) | bridge (live-commerce-network) | Same network name | `docker network ls` |
| ECS Fargate (prod) | 2 vCPU / 4 GB RAM | Staging: match or document delta | CDK config |

### 4.2 Production ECS Specs (for reference)

From `streaming-stack.ts`:
- **CPU:** 2048 (2 vCPU)
- **Memory:** 4096 MB (4 GB)
- **Auto-scaling:** min 1, max 4 tasks; scale at 70% CPU
- **CloudFront cache:** .m3u8 TTL 2-10s, .ts TTL 30-3600s

### 4.3 Load Generator Requirements

| Resource | Requirement |
|----------|-------------|
| Machine | Separate from staging (avoid resource contention) |
| CPU | 4+ cores (k6 is CPU-efficient but 500 VUs need headroom) |
| Memory | 4+ GB |
| Network | Same datacenter/region as staging (minimize network variance) |
| OS | Linux (k6 performs best on Linux; macOS has socket limits) |
| k6 version | v0.50+ (for improved WebSocket support) |
| ulimit | `nofile` ≥ 8192 (each VU opens multiple connections) |

### 4.4 OBS / RTMP Source

A real or simulated RTMP stream must be publishing during all tests:
- **Option A:** OBS Studio with a test loop video (recommended for realism)
- **Option B:** FFmpeg test source: `ffmpeg -re -f lavfi -i testsrc=size=1920x1080:rate=30 -f lavfi -i sine -c:v libx264 -preset veryfast -b:v 2500k -maxrate 2500k -bufsize 5000k -g 30 -keyint_min 30 -c:a aac -b:a 128k -f flv rtmp://localhost:1935/live/{streamKey}`
- **Bitrate:** 2500 kbps video + 128 kbps audio = ~2.6 Mbps (typical for 1080p live)
- **Keyframe interval:** 1s (to match `hls_fragment: 1`)

---

## 5. Pass/Fail Criteria (Production Readiness Gate)

### 5.1 Mandatory (all must pass)

| # | Criterion | Test | Evidence |
|---|-----------|------|----------|
| 1 | 500 CCU sustained 30 min without viewer drop-out | Ramp test | k6 metrics: 0 connection errors during hold phase |
| 2 | CPU never exceeds 75% during ramp test | Ramp test | Docker stats time series; no container exceeds 75% |
| 3 | Memory stable over 6 hours (no leaks) | Soak test | Memory delta < 10%; swap = 0 throughout |
| 4 | Rebuffer rate < 1% | All tests | k6 custom metric: rebuffer_events / total_segments |
| 5 | New viewer join success rate > 99% | Spike test | k6 metric: successful_first_frame / play_attempts |
| 6 | HLS latency 5-8s average | Ramp test | Measured: playlist fetch time + segment duration |
| 7 | HTTP-FLV latency < 3s | Ramp test | First byte time from k6 HTTP stream |
| 8 | Auto-reconnection within 5s of network failure | Recovery test | k6 WebSocket reconnect timing metric |
| 9 | API error rate < 1% (5xx) | All tests | Nginx access log analysis |
| 10 | API p95 latency < 500ms | Ramp test | k6 http_req_duration p(95) |

### 5.2 Advisory (should pass, investigate if not)

| # | Criterion | Test |
|---|-----------|------|
| A1 | Redis evicted_keys = 0 during ramp test | Ramp test |
| A2 | PostgreSQL cache hit ratio > 95% | Soak test |
| A3 | SRS frame drops = 0 during steady state | All tests |
| A4 | WebSocket room count matches VU count (±5%) | All tests |
| A5 | Chat message delivery latency < 200ms | Ramp test |
| A6 | Stream recovery after OBS disconnect < 10s | Recovery test |
| A7 | No PostgreSQL deadlocks | Soak test |

### 5.3 Breaking Point Discovery

After passing mandatory criteria, run an **escalation test** to find the actual breaking point:

```
Profile: Ramp 0 → 100 → 300 → 500 → 700 → 1000 (step 200, hold 5 min each step)
Goal: Find the CCU where any mandatory criterion first fails
Document: "System breaks at X CCU due to Y"
```

This establishes the safety margin: if the system breaks at 800 CCU, the 500 CCU target has a 60% headroom.

---

## 6. Timeline and Resource Requirements

### 6.1 Execution Timeline

| Phase | Duration | Activities |
|-------|----------|------------|
| **Phase 1: Setup** | 1 day | Deploy staging env, verify parity checklist, install k6, configure RTMP source |
| **Phase 2: Baseline** | 0.5 day | Single viewer test (1 CCU), measure all KPIs, establish baseline |
| **Phase 3: Ramp Test** | 0.5 day | Scenario 1 execution, analyze results, identify bottlenecks |
| **Phase 4: Spike Test** | 0.5 day | Scenario 2 execution, analyze burst behavior |
| **Phase 5: Soak Test** | 1 day | Scenario 3 execution (6 hours), overnight analysis |
| **Phase 6: Recovery Test** | 0.5 day | Scenario 4 execution, document failure modes |
| **Phase 7: Breaking Point** | 0.5 day | Escalation test, find ceiling |
| **Phase 8: Report** | 0.5 day | Compile results, generate production readiness report |

**Total: ~5 working days** (can be compressed to 3 days by running soak test overnight)

### 6.2 Resource Requirements

| Resource | Specification |
|----------|--------------|
| Staging server | Matches production specs (2 vCPU, 4 GB RAM per service) |
| Load generator | Separate machine, 4 vCPU, 4 GB RAM, Linux |
| RTMP source | OBS Studio or FFmpeg on dedicated machine |
| Engineer time | 1 engineer, 5 days |
| Monitoring storage | ~500 MB for 6-hour soak test metrics |

### 6.3 Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Staging differs from prod | Invalid results | Parity checklist (Section 4.1) |
| Load generator becomes bottleneck | False failures | Monitor load generator resources; use distributed k6 if needed |
| Single RTMP stream limitation | Can't test multi-stream | Acceptable for MVP (single-seller model) |
| Network variance | Inconsistent latency measurements | Run tests from same datacenter; use statistical significance (3 runs minimum) |
| SRS max_connections hit | Connection refused | SRS configured for 5000; 500 CCU = ~500 connections (well under limit) |
| Redis maxmemory hit | Chat history eviction | Monitor `evicted_keys`; reduce `hls_window` or chat history TTL if needed |

---

## Appendix A: k6 Test Script Structure

```
k6-scripts/
├── scenarios/
│   ├── ramp-test.js          # Scenario 1: 0→500→0 over 35min
│   ├── spike-test.js         # Scenario 2: 50→500→50 over 15min
│   ├── soak-test.js          # Scenario 3: 300 CCU for 6 hours
│   └── recovery-test.js      # Scenario 4: Network failure simulation
├── lib/
│   ├── hls-player.js         # HLS manifest fetch + segment download loop
│   ├── flv-player.js         # HTTP-FLV chunked response consumer
│   ├── socketio-client.js    # Socket.IO connection + event handlers
│   ├── chat-simulator.js     # Chat message send/receive
│   └── api-actions.js        # Product browsing, cart operations
├── config.js                 # Environment variables, URLs, thresholds
└── thresholds.js             # k6 threshold definitions matching KPIs
```

## Appendix B: Metrics Collection Script

The `metrics-collector.sh` script runs every 5 seconds and outputs JSON lines:

```json
{
  "timestamp": "2026-02-28T10:00:00Z",
  "docker": {
    "srs": {"cpu_pct": 45.2, "mem_mb": 1024, "mem_pct": 25.0, "net_rx_mb": 150, "net_tx_mb": 4500, "pids": 12},
    "backend": {"cpu_pct": 30.1, "mem_mb": 384, "mem_pct": 9.4, "net_rx_mb": 80, "net_tx_mb": 200, "pids": 25},
    "redis": {"cpu_pct": 5.3, "mem_mb": 120, "mem_pct": 46.9, "net_rx_mb": 50, "net_tx_mb": 50, "pids": 5},
    "postgres": {"cpu_pct": 8.7, "mem_mb": 256, "mem_pct": 6.3, "net_rx_mb": 20, "net_tx_mb": 30, "pids": 15}
  },
  "srs": {
    "clients": 487,
    "streams": 1,
    "recv_kbps": 2650,
    "send_kbps": 1290000
  },
  "nginx": {
    "req_per_sec": 150,
    "error_4xx": 2,
    "error_5xx": 0,
    "rt_p50_ms": 12,
    "rt_p95_ms": 89,
    "rt_p99_ms": 245
  },
  "redis": {
    "connected_clients": 35,
    "used_memory_mb": 118,
    "ops_per_sec": 2400,
    "evicted_keys": 0
  },
  "websocket": {
    "root_connections": 490,
    "chat_connections": 488,
    "streaming_connections": 491,
    "chat_msg_per_sec": 16
  }
}
```

## Appendix C: SRS Configuration Relevance

Key SRS settings that directly impact performance testing:

| Setting | Value | Impact |
|---------|-------|--------|
| `max_connections` | 5000 | Hard cap on concurrent connections; 500 CCU is 10% utilization |
| `threads` | 4 | Multi-core utilization; matches 2 vCPU production (hyper-threading) |
| `gop_cache` | on | Enables instant playback for new viewers (at cost of ~GOP memory per stream) |
| `gop_cache_max_frames` | 30 | ~1s of frames cached (at 30fps) |
| `queue_length` | 1 | Minimal play queue reduces latency |
| `mw_latency` | 0 | No merge-write delay, lowest possible send latency |
| `hls_fragment` | 1s | Short segments for lower HLS latency |
| `hls_window` | 4 | 4 segments in playlist = 4s window |
| `tcp_nodelay` | on | Disable Nagle's algorithm for lower latency |
| `firstpkt_timeout` | 10000ms | Reject publishers that don't send data within 10s |
| `normal_timeout` | 30000ms | Disconnect publishers silent for 30s |
