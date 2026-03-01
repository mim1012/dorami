# Dorami Monitoring Suite

Infrastructure monitoring and metrics collection for Dorami Live Commerce load tests.

## Scripts

| Script | Purpose |
|--------|---------|
| `run-monitoring-suite.sh` | Master orchestrator — start everything |
| `metrics-collector.sh` | Continuous Docker + system metrics (JSON, 1s granularity) |
| `nginx-analyzer.sh` | Post-test nginx log analysis (response times, error rates) |
| `srs-metrics.sh` | SRS streaming server log analysis (drops, disconnects, BW) |
| `backend-metrics.sh` | NestJS/Socket.IO log analysis (connections, throughput) |
| `health-check-dashboard.html` | Real-time browser dashboard |
| `prometheus-config.yml` | Prometheus scrape configuration |
| `alert-rules.yml` | Prometheus alerting rules |

## Quick Start

### Run alongside a load test

```bash
# Terminal 1 — start monitoring (6 hours)
cd infrastructure/monitoring
chmod +x *.sh
./run-monitoring-suite.sh --duration 21600 --output ../../results/

# Terminal 2 — run your load test
cd ../..
bash scripts/load-test-combined.sh https://staging.doremi-live.com my-stream-key
```

### Run a short test (1 hour, 5s interval)

```bash
./run-monitoring-suite.sh --duration 3600 --interval 5 --output /tmp/perf-results/
```

### Collect metrics only (no post-analysis)

```bash
./metrics-collector.sh --duration 600 --output ./results/ --interval 1
```

### Analyze after a test run

```bash
# Nginx logs
./nginx-analyzer.sh --container dorami-nginx --output ./results/

# SRS logs
./srs-metrics.sh --container dorami-srs --output ./results/ --since 2h

# Backend logs
./backend-metrics.sh --container dorami-backend --output ./results/ --since 2h
```

## Dashboard

1. Open `health-check-dashboard.html` in your browser (file://)
2. Click **Load metrics JSON**
3. Select any `metrics-{timestamp}.json` file from your output directory
4. Dashboard auto-parses and renders all metrics with sparklines and color-coded thresholds

**Thresholds:**
- Green: < 50%
- Yellow: 50–75%
- Red: > 75%

**Auto-refresh:** Every 5 seconds (set `METRICS_URL` in the HTML to enable automatic fetch from a server)

## Output Files

All outputs land in the configured `--output` directory:

```
results/
  metrics-20260301-120000.json       # System + Docker stats (NDJSON array)
  nginx-analysis-20260301-120000.json
  srs-metrics-20260301-120000.json
  backend-metrics-20260301-120000.json
  metrics-collector.log              # Collector stderr
  suite.log                          # Master orchestrator log
  SUMMARY_REPORT.md                  # Human-readable summary
```

### metrics-*.json schema

```json
[
  {
    "timestamp": "2026-03-01T12:00:00Z",
    "elapsed_sec": 0,
    "system": {
      "cpu_used_pct": 12.4,
      "load1": 0.5,
      "load5": 0.4,
      "load15": 0.3,
      "mem_total_kb": 16384000,
      "mem_used_kb": 4096000,
      "mem_free_kb": 12288000,
      "mem_used_pct": 25.0
    },
    "containers": [
      {
        "name": "dorami-backend",
        "cpu_pct": 5.2,
        "mem_usage": "256MiB",
        "mem_limit": "4GiB",
        "mem_pct": 6.3,
        "net_in": "1.5MB",
        "net_out": "2.1MB",
        "pids": 24
      }
    ]
  }
]
```

## Prometheus Setup (Optional)

For long-term metrics retention, add to `docker-compose.yml`:

```yaml
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./infrastructure/monitoring/prometheus-config.yml:/etc/prometheus/prometheus.yml
      - ./infrastructure/monitoring/alert-rules.yml:/etc/prometheus/alert-rules.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=7d'

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    ports:
      - "8081:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
```

Then access Prometheus at `http://localhost:9090`.

## Integration with load-test-combined.sh

The master suite is designed to run in parallel with load tests:

```bash
# Start monitoring in background
./infrastructure/monitoring/run-monitoring-suite.sh \
  --duration 1800 \
  --output ./results/ &
MONITOR_PID=$!

# Run load test
bash scripts/load-test-combined.sh https://staging.doremi-live.com smoke-test

# Monitoring auto-stops after duration, or kill manually
kill $MONITOR_PID 2>/dev/null || true
```

## Success Criteria (KPIs)

| KPI | Target | Source |
|-----|--------|--------|
| HLS 5xx error rate | < 0.1% | nginx-analysis JSON |
| WebSocket success rate | > 95% | backend-metrics JSON |
| API response time p95 | < 2000ms | nginx-analysis JSON |
| Peak CPU | < 80% | metrics JSON |
| Peak Memory | < 85% | metrics JSON |
| SRS frame drops | < 100 | srs-metrics JSON |
| SRS publisher timeouts | 0 | srs-metrics JSON |
| Socket.IO error rate | < 1% | backend-metrics JSON |
