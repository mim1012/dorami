# HLS Streaming Load Test

k6-based load test for validating Dorami streaming infrastructure at 500 concurrent users (CCU).

## Quick Start

### Prerequisites

- k6 installed: https://k6.io/docs/getting-started/installation/
- Docker Compose stack running:
  ```bash
  npm run docker:up
  npm run dev:all  # Start backend + frontend
  ```

### Run Default Test (500 CCU, 30 minutes)

```bash
./infrastructure/loadtest/run-hls-load-test.sh
```

### Run Custom Configuration

```bash
# Custom VUs and duration
./infrastructure/loadtest/run-hls-load-test.sh \
  --vus 100 \
  --duration 15m \
  --stream-key my-stream-key

# Custom output location
./infrastructure/loadtest/run-hls-load-test.sh --output /tmp/results.json
```

## Test Scenarios

### Default Spike Load Test (31 minutes total)

```
Stage 1: Ramp-up 0→50 VUs (2 minutes)
Stage 2: Ramp-up 50→250 VUs (5 minutes)
Stage 3: Spike to 500 VUs (2 minutes)
Stage 4: Sustained 500 VUs (15 minutes) ← CRITICAL VALIDATION
Stage 5: Ramp-down 500→100 VUs (3 minutes)
Stage 6: Ramp-down 100→0 VUs (2 minutes)
```

## Metrics Collected

### HLS Playlist Metrics

| Metric | Type | Target | Description |
|--------|------|--------|-------------|
| `hls_playlist_fetch_time_ms` | Trend | p95 < 1000ms | Time to fetch m3u8 playlist |
| `hls_playlist_errors` | Counter | < 100 total | Failed playlist requests |
| `hls_playlist_freshness_ms` | Gauge | Track only | Age of playlist at request |
| `hls_playlist_refresh_interval_ms` | Gauge | Track only | Time between playlist updates |
| `hls_playlist_parse_errors` | Counter | 0 | Playlist parsing failures |

### HLS Segment Metrics

| Metric | Type | Target | Description |
|--------|------|--------|-------------|
| `hls_segment_fetch_time_ms` | Trend | p95 < 2000ms | Time to fetch .ts segment |
| `hls_segment_errors` | Counter | < 500 total | Failed segment requests |
| `hls_segment_delivery_latency_ms` | Gauge | < 2000ms | End-to-end segment delivery |
| `hls_rebuffer_events` | Counter | Track only | Playback stalls (failed segments) |

### HTTP Request Metrics

| Metric | Type | Target | Description |
|--------|------|--------|-------------|
| `http_req_duration` | Trend | p95 < 5s, p99 < 10s | Total HTTP request time |
| `http_req_failed` | Rate | < 1% | Requests with 4xx/5xx status |

## Understanding Results

### Sample Results File

```json
{
  "metrics": {
    "hls_playlist_fetch_time_ms": {
      "type": "Trend",
      "contains": "time",
      "tainted": false,
      "thresholds": ["p(95)<1000"],
      "values": {
        "avg": 850,
        "max": 2100,
        "med": 820,
        "min": 150,
        "p(95)": 950,
        "p(99)": 1250
      }
    },
    "http_req_failed": {
      "type": "Rate",
      "contains": "default",
      "values": {
        "passes": 2150,
        "fails": 5,
        "value": 0.0023
      }
    }
  }
}
```

### Interpretation

**Success Indicators:**
- ✅ `hls_playlist_fetch_time_ms` p95 < 1000ms
- ✅ `hls_segment_fetch_time_ms` p95 < 2000ms
- ✅ `http_req_failed` rate < 1%
- ✅ `hls_playlist_errors` < 100
- ✅ `hls_segment_errors` < 500
- ✅ No memory leaks or increasing latency during sustained load

**Warning Signs:**
- ⚠️ Increasing error rate over time (suggests resource exhaustion)
- ⚠️ p95 latencies > 2000ms (degraded user experience)
- ⚠️ Rebuffer count > 50 per 500 CCU (excessive retransmissions)
- ⚠️ CPU/memory usage > 80% on backend/SRS (underprovisioned)

## Detailed Test Logic

The test script performs the following per virtual user (VU):

1. **Fetch HLS Playlist** (`/live/{streamKey}.m3u8`)
   - Validates HTTP 200 status
   - Checks Content-Type is `application/vnd.apple.mpegurl`
   - Validates playlist size > 100 bytes
   - Parses segment list

2. **Fetch HLS Segments** (last 3 segments in sliding window)
   - Simulates real viewer behavior (watches last 3 segments)
   - Validates HTTP 200 status
   - Checks Content-Type is `video/mp2t`
   - Validates segment size > 10KB
   - Measures delivery latency per segment

3. **Validate Segment Sequencing**
   - Ensures segments are in order
   - Detects missing or out-of-sequence segments

4. **Sleep 1-3 seconds**
   - Simulates playback interval
   - Refreshes playlist every 2-3 segments (realistic viewer pattern)

## Advanced Usage

### Custom Thresholds

Edit `hls-load-test.js` to modify success criteria:

```javascript
thresholds: {
  'http_req_duration': ['p(95)<3000'],  // More lenient
  'hls_playlist_fetch_time_ms': ['p(95)<500'],  // More strict
}
```

### Integration with Load Impact Cloud

Set project ID in script:

```javascript
ext: {
  loadimpact: {
    projectID: 12345,  // Your k6 cloud project ID
  }
}
```

Then run:
```bash
k6 cloud infrastructure/loadtest/hls-load-test.js
```

### Real Browser Testing (Playwright)

For validating actual player behavior (FLV fallback, error handling):

```bash
cd client-app
npx playwright test e2e/streaming-performance.spec.ts --project=chromium
```

## Troubleshooting

### "Connection refused" error

Ensure SRS is running:
```bash
npm run docker:logs srs
```

### Playlist parse errors

Check that SRS is generating valid m3u8:
```bash
curl http://localhost:8080/live/test-stream-1.m3u8
```

### High error rates

Check backend logs:
```bash
npm run docker:logs backend
```

Check SRS logs:
```bash
npm run docker:logs srs
```

## Performance Optimization Tips

1. **Increase SRS worker threads** if CPU > 70%:
   ```
   # Edit infrastructure/docker/srs/srs.conf
   threads 8;
   ```

2. **Increase PostgreSQL connection pool** if DB queries queue:
   ```
   # Edit backend/.env
   DATABASE_URL="...&connection_limit=50"
   ```

3. **Enable HTTP/2** in Nginx for connection multiplexing:
   ```nginx
   listen 443 ssl http2;
   ```

4. **Use CDN** for HLS delivery in production (CloudFront, Cloudflare)

## Next Steps

1. Run baseline test with current infrastructure
2. Review metrics against production KPI targets
3. Implement Priority 1 optimizations from INFRASTRUCTURE_ANALYSIS.md
4. Run regression test to validate improvements
5. Deploy to staging for real-world validation

---

See `infrastructure/analysis/INFRASTRUCTURE_ANALYSIS.md` for detailed infrastructure bottleneck analysis.
