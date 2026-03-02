#!/bin/bash
# nginx-analyzer.sh
# Parse nginx access logs after load test
# Extracts: response times per URL, error rates, latency histogram, throughput
#
# Usage:
#   ./nginx-analyzer.sh [--log FILE] [--output DIR] [--container NAME]
#
# Example:
#   ./nginx-analyzer.sh --container dorami-nginx --output results/
#   ./nginx-analyzer.sh --log /var/log/nginx/access.log --output results/

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================
LOG_FILE=""
CONTAINER_NAME="dorami-nginx"
OUTPUT_DIR="$(pwd)/monitoring"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTPUT_FILE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --log)       LOG_FILE="$2"; shift 2 ;;
    --container) CONTAINER_NAME="$2"; shift 2 ;;
    --output)    OUTPUT_DIR="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

OUTPUT_FILE="${OUTPUT_DIR}/nginx-analysis-${TIMESTAMP}.json"
mkdir -p "$OUTPUT_DIR"

log() { echo "[nginx-analyzer] $(date '+%H:%M:%S') $*" >&2; }

# ============================================================================
# Fetch log data
# ============================================================================
get_log_data() {
  if [[ -n "$LOG_FILE" && -f "$LOG_FILE" ]]; then
    cat "$LOG_FILE"
  else
    # Try to fetch from Docker container
    docker logs "$CONTAINER_NAME" 2>/dev/null || {
      log "Warning: Cannot read logs from container '$CONTAINER_NAME'. Using empty dataset."
      echo ""
    }
  fi
}

# ============================================================================
# Analysis using awk
# Nginx log format expected:
#   $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent
#   "$http_referer" "$http_user_agent" $request_time $upstream_response_time
# ============================================================================
analyze_logs() {
  local log_data="$1"

  if [[ -z "$log_data" ]]; then
    echo '{"error":"no_log_data","message":"No nginx log data available"}'
    return
  fi

  # Write log data to temp file for multiple passes
  local tmpfile
  tmpfile=$(mktemp /tmp/nginx-analysis-XXXXXX.log)
  echo "$log_data" > "$tmpfile"

  # ---- Pass 1: Per-URL stats (response time, status codes) ----
  local url_stats
  url_stats=$(awk '
  {
    # Parse standard nginx combined log + request_time appended
    # Extract: status, url, response_time
    match($0, /"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) ([^ ]+) HTTP/, arr)
    method = arr[1]
    url = arr[2]
    # Remove query string for grouping
    n = split(url, parts, "?")
    url = parts[1]

    # Status code is field 9 in combined log
    status = $9
    # Request time is the last field if numeric
    rt = $NF
    if (rt ~ /^[0-9]+\.[0-9]+$/) {
      rt_ms = rt * 1000
    } else {
      rt_ms = 0
    }

    if (url != "" && status ~ /^[0-9]+$/) {
      count[url]++
      status_count[url][status]++
      total_time[url] += rt_ms
      if (rt_ms > max_time[url]) max_time[url] = rt_ms
      if (min_time[url] == 0 || rt_ms < min_time[url]) min_time[url] = rt_ms

      # Store for percentile calculation (up to 10000 per url)
      if (sample_count[url] < 10000) {
        samples[url][sample_count[url]++] = rt_ms
      }
    }
  }
  END {
    first = 1
    printf "["
    for (url in count) {
      if (!first) printf ","
      first = 0
      avg = (count[url] > 0) ? total_time[url] / count[url] : 0

      # Sort samples for percentiles (simple bubble sort for small arrays)
      n = sample_count[url]
      for (i = 0; i < n - 1; i++) {
        for (j = 0; j < n - i - 1; j++) {
          if (samples[url][j] > samples[url][j+1]) {
            tmp = samples[url][j]
            samples[url][j] = samples[url][j+1]
            samples[url][j+1] = tmp
          }
        }
      }
      p50 = (n > 0) ? samples[url][int(n * 0.50)] : 0
      p95 = (n > 0) ? samples[url][int(n * 0.95)] : 0
      p99 = (n > 0) ? samples[url][int(n * 0.99)] : 0

      # Build status codes object
      status_str = "{"
      sfirst = 1
      for (s in status_count[url]) {
        if (!sfirst) status_str = status_str ","
        sfirst = 0
        status_str = status_str "\"" s "\":" status_count[url][s]
      }
      status_str = status_str "}"

      printf "{\"url\":\"%s\",\"count\":%d,\"avg_ms\":%.1f,\"min_ms\":%.1f,\"max_ms\":%.1f,\"p50_ms\":%.1f,\"p95_ms\":%.1f,\"p99_ms\":%.1f,\"status_codes\":%s}",
        url, count[url], avg, min_time[url], max_time[url], p50, p95, p99, status_str
    }
    printf "]"
  }
  ' "$tmpfile")

  # ---- Pass 2: Error rates by status code ----
  local error_stats
  error_stats=$(awk '
  {
    status = $9
    if (status ~ /^[0-9]+$/) {
      total++
      status_total[status]++
      if (status ~ /^[45]/) errors++
      if (status == "499") c499++
      if (status == "502") c502++
      if (status == "503") c503++
      if (status == "504") c504++
    }
  }
  END {
    error_rate = (total > 0) ? (errors * 100.0 / total) : 0
    printf "{\"total_requests\":%d,\"total_errors\":%d,\"error_rate_pct\":%.2f,\"499\":%d,\"502\":%d,\"503\":%d,\"504\":%d}",
      total, errors, error_rate, c499+0, c502+0, c503+0, c504+0
  }
  ' "$tmpfile")

  # ---- Pass 3: Throughput (req/sec over time) ----
  local throughput_stats
  throughput_stats=$(awk '
  {
    # Extract timestamp from nginx log: [day/month/year:hour:min:sec +tz]
    match($0, /\[([0-9]+\/[A-Za-z]+\/[0-9]+):([0-9]+):([0-9]+):([0-9]+)/, arr)
    if (arr[0] != "") {
      # Use minute-level bucketing for throughput trend
      bucket = arr[1] ":" arr[2] ":" arr[3]
      minute_count[bucket]++
      total++

      # Track first and last timestamp
      if (first_ts == "") first_ts = bucket
      last_ts = bucket
    }
  }
  END {
    first = 1
    printf "{\"total\":%d,\"by_minute\":[", total
    for (b in minute_count) {
      if (!first) printf ","
      first = 0
      printf "{\"minute\":\"%s\",\"requests\":%d}", b, minute_count[b]
    }
    printf "],\"first_minute\":\"%s\",\"last_minute\":\"%s\"}", first_ts, last_ts
  }
  ' "$tmpfile")

  # ---- Pass 4: Latency histogram (buckets in ms) ----
  local latency_hist
  latency_hist=$(awk '
  BEGIN {
    # Histogram buckets in ms
    buckets[0] = 10; buckets[1] = 50; buckets[2] = 100
    buckets[3] = 200; buckets[4] = 500; buckets[5] = 1000
    buckets[6] = 2000; buckets[7] = 5000; buckets[8] = 999999
    nbuckets = 9
    for (i = 0; i < nbuckets; i++) counts[i] = 0
  }
  {
    rt = $NF
    if (rt ~ /^[0-9]+\.[0-9]+$/) {
      rt_ms = rt * 1000
      for (i = 0; i < nbuckets; i++) {
        if (rt_ms <= buckets[i]) { counts[i]++; break }
      }
      total++
    }
  }
  END {
    labels[0]="<10ms"; labels[1]="10-50ms"; labels[2]="50-100ms"
    labels[3]="100-200ms"; labels[4]="200-500ms"; labels[5]="500ms-1s"
    labels[6]="1s-2s"; labels[7]="2s-5s"; labels[8]=">5s"
    printf "["
    for (i = 0; i < nbuckets; i++) {
      if (i > 0) printf ","
      pct = (total > 0) ? (counts[i] * 100.0 / total) : 0
      printf "{\"bucket\":\"%s\",\"count\":%d,\"pct\":%.1f}", labels[i], counts[i], pct
    }
    printf "]"
  }
  ' "$tmpfile")

  rm -f "$tmpfile"

  # Assemble final JSON
  cat << EOF
{
  "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "source": "${LOG_FILE:-docker:${CONTAINER_NAME}}",
  "url_stats": ${url_stats},
  "error_summary": ${error_stats},
  "throughput": ${throughput_stats},
  "latency_histogram": ${latency_hist}
}
EOF
}

# ============================================================================
# Main
# ============================================================================
log "Fetching nginx logs..."
LOG_DATA=$(get_log_data)

log "Analyzing $(echo "$LOG_DATA" | wc -l) log lines..."
RESULT=$(analyze_logs "$LOG_DATA")

echo "$RESULT" > "$OUTPUT_FILE"
log "Analysis saved to: $OUTPUT_FILE"

# Print summary to stdout
echo "$RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
err = data.get('error_summary', {})
print()
print('=== NGINX ANALYSIS SUMMARY ===')
print(f'Total Requests : {err.get(\"total_requests\", 0):,}')
print(f'Total Errors   : {err.get(\"total_errors\", 0):,}')
print(f'Error Rate     : {err.get(\"error_rate_pct\", 0):.2f}%')
print(f'499 (Timeout)  : {err.get(\"499\", 0):,}')
print(f'502 (Bad GW)   : {err.get(\"502\", 0):,}')
print(f'504 (GW TO)    : {err.get(\"504\", 0):,}')
print()
urls = data.get('url_stats', [])
if urls:
    print('Top URLs by request count:')
    for u in sorted(urls, key=lambda x: -x.get('count', 0))[:10]:
        print(f'  {u[\"count\"]:6d}  p95={u[\"p95_ms\"]:6.0f}ms  {u[\"url\"]}')
print()
print(f'Output: $(readlink -f "$OUTPUT_FILE" 2>/dev/null || echo "$OUTPUT_FILE")')
" 2>/dev/null || echo "Output: $OUTPUT_FILE"
