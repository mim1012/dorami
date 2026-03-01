#!/bin/bash
# run-monitoring-suite.sh
# Master script to start all metrics collection during load tests
#
# Usage:
#   ./run-monitoring-suite.sh [OPTIONS]
#
# Options:
#   --duration SECONDS    Total collection duration (default: 21600 = 6h)
#   --output DIR          Output directory (default: results/)
#   --interval SECONDS    Metrics collection interval (default: 5)
#   --backend-container   Backend container name (default: dorami-backend)
#   --nginx-container     Nginx container name (default: dorami-nginx)
#   --srs-container       SRS container name (default: dorami-srs)
#   --skip-nginx          Skip nginx log analysis
#   --skip-srs            Skip SRS metrics collection
#   --skip-backend        Skip backend metrics collection
#   --help                Show this help
#
# Example:
#   ./run-monitoring-suite.sh --duration 21600 --output results/
#   ./run-monitoring-suite.sh --duration 3600 --interval 1 --output /tmp/perf-test/

set -euo pipefail

# ============================================================================
# Defaults
# ============================================================================
DURATION=21600   # 6 hours
OUTPUT_DIR="$(pwd)/results/monitoring-$(date +%Y%m%d-%H%M%S)"
INTERVAL=5
BACKEND_CONTAINER="dorami-backend"
NGINX_CONTAINER="dorami-nginx"
SRS_CONTAINER="dorami-srs"
SKIP_NGINX=false
SKIP_SRS=false
SKIP_BACKEND=false
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# PIDs for cleanup
METRICS_PID=""
BACKEND_PID=""
HEARTBEAT_PID=""

# ============================================================================
# Parse arguments
# ============================================================================
while [[ $# -gt 0 ]]; do
  case $1 in
    --duration)           DURATION="$2"; shift 2 ;;
    --output)             OUTPUT_DIR="$2"; shift 2 ;;
    --interval)           INTERVAL="$2"; shift 2 ;;
    --backend-container)  BACKEND_CONTAINER="$2"; shift 2 ;;
    --nginx-container)    NGINX_CONTAINER="$2"; shift 2 ;;
    --srs-container)      SRS_CONTAINER="$2"; shift 2 ;;
    --skip-nginx)         SKIP_NGINX=true; shift ;;
    --skip-srs)           SKIP_SRS=true; shift ;;
    --skip-backend)       SKIP_BACKEND=true; shift ;;
    --help)
      sed -n '2,30p' "$0" | grep '^#' | sed 's/^# \?//'
      exit 0
      ;;
    *) echo "Unknown argument: $1. Use --help for usage."; exit 1 ;;
  esac
done

# ============================================================================
# Setup
# ============================================================================
mkdir -p "$OUTPUT_DIR"
LOG="$OUTPUT_DIR/suite.log"

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg" | tee -a "$LOG"
}

log_section() {
  local line="══════════════════════════════════════════════════════════"
  echo "$line" | tee -a "$LOG"
  log "$*"
  echo "$line" | tee -a "$LOG"
}

# ============================================================================
# Cleanup handler
# ============================================================================
cleanup() {
  log "Stopping all monitoring processes..."
  [[ -n "$METRICS_PID" ]] && kill "$METRICS_PID" 2>/dev/null || true
  [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "$HEARTBEAT_PID" ]] && kill "$HEARTBEAT_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  log "All processes stopped."
}
trap cleanup EXIT INT TERM

# ============================================================================
# Pre-flight checks
# ============================================================================
preflight_check() {
  log_section "PRE-FLIGHT CHECKS"
  local failed=false

  # Check required tools
  for tool in docker jq awk python3; do
    if command -v "$tool" &>/dev/null; then
      log "  [OK] $tool found"
    else
      log "  [WARN] $tool not found — some features may be limited"
    fi
  done

  # Check Docker is running
  if docker info &>/dev/null; then
    log "  [OK] Docker is running"
    # List running containers
    log "  Running containers:"
    docker ps --format "    - {{.Names}} ({{.Status}})" 2>/dev/null | tee -a "$LOG" || true
  else
    log "  [WARN] Docker not accessible — container metrics will be empty"
  fi

  # Check script files exist
  for script in metrics-collector.sh srs-metrics.sh backend-metrics.sh nginx-analyzer.sh; do
    if [[ -f "$SCRIPT_DIR/$script" ]]; then
      log "  [OK] $script found"
      chmod +x "$SCRIPT_DIR/$script"
    else
      log "  [WARN] $script not found at $SCRIPT_DIR/$script"
    fi
  done

  echo "" | tee -a "$LOG"
}

# ============================================================================
# Start continuous metrics collection (runs for DURATION seconds)
# ============================================================================
start_metrics_collector() {
  log "Starting continuous metrics collector (interval: ${INTERVAL}s)..."

  bash "$SCRIPT_DIR/metrics-collector.sh" \
    --duration "$DURATION" \
    --output "$OUTPUT_DIR" \
    --interval "$INTERVAL" \
    >> "$OUTPUT_DIR/metrics-collector.log" 2>&1 &
  METRICS_PID=$!

  log "  Metrics collector PID: $METRICS_PID"
}

# ============================================================================
# Heartbeat — periodic snapshot every 60s printed to suite log
# ============================================================================
start_heartbeat() {
  log "Starting heartbeat reporter (every 60s)..."

  (
    local elapsed=0
    while [[ $elapsed -lt $DURATION ]]; do
      sleep 60
      elapsed=$((elapsed + 60))

      # Quick docker stats snapshot
      local stats
      stats=$(docker stats --no-stream --format "{{.Name}}: CPU={{.CPUPerc}} MEM={{.MemPerc}}" 2>/dev/null | \
        tr '\n' ' ' || echo "docker unavailable")
      echo "[HEARTBEAT t+${elapsed}s] $stats" | tee -a "$LOG"
    done
  ) &
  HEARTBEAT_PID=$!
}

# ============================================================================
# Run post-test analysis scripts
# ============================================================================
run_post_analysis() {
  log_section "POST-TEST ANALYSIS"
  local since_duration="${DURATION}s"

  # SRS metrics
  if [[ "$SKIP_SRS" == "false" ]]; then
    log "Running SRS metrics analysis..."
    bash "$SCRIPT_DIR/srs-metrics.sh" \
      --container "$SRS_CONTAINER" \
      --output "$OUTPUT_DIR" \
      --since "$since_duration" \
      2>>"$LOG" || log "  [WARN] SRS metrics collection failed (container may not be running)"
  fi

  # Backend metrics
  if [[ "$SKIP_BACKEND" == "false" ]]; then
    log "Running backend metrics analysis..."
    bash "$SCRIPT_DIR/backend-metrics.sh" \
      --container "$BACKEND_CONTAINER" \
      --output "$OUTPUT_DIR" \
      --since "$since_duration" \
      2>>"$LOG" || log "  [WARN] Backend metrics collection failed"
  fi

  # Nginx log analysis
  if [[ "$SKIP_NGINX" == "false" ]]; then
    log "Running nginx log analysis..."
    bash "$SCRIPT_DIR/nginx-analyzer.sh" \
      --container "$NGINX_CONTAINER" \
      --output "$OUTPUT_DIR" \
      2>>"$LOG" || log "  [WARN] Nginx analysis failed (container may not be running)"
  fi
}

# ============================================================================
# Generate final summary report
# ============================================================================
generate_summary_report() {
  log_section "GENERATING SUMMARY REPORT"
  local report_file="$OUTPUT_DIR/SUMMARY_REPORT.md"
  local metrics_file
  metrics_file=$(ls "$OUTPUT_DIR"/metrics-*.json 2>/dev/null | head -1 || echo "")

  {
    echo "# Dorami Monitoring Suite — Summary Report"
    echo ""
    echo "**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    echo "**Duration:** ${DURATION}s ($(echo "scale=1; $DURATION / 3600" | bc)h)"
    echo "**Output directory:** $OUTPUT_DIR"
    echo ""

    echo "## Files Generated"
    echo ""
    ls -lh "$OUTPUT_DIR"/*.json "$OUTPUT_DIR"/*.log 2>/dev/null | \
      awk '{printf "- `%s` (%s)\n", $NF, $5}' || echo "- No files found"
    echo ""

    echo "## System Metrics Summary"
    echo ""
    if [[ -n "$metrics_file" ]] && command -v python3 &>/dev/null; then
      python3 - << PYEOF
import json, sys

with open("$metrics_file") as f:
    records = json.load(f)

if not isinstance(records, list):
    records = [records]

if records:
    cpu_vals = [r.get("system", {}).get("cpu_used_pct", 0) for r in records if r.get("system")]
    mem_vals = [r.get("system", {}).get("mem_used_pct", 0) for r in records if r.get("system")]

    def pct_stats(vals):
        if not vals:
            return "N/A"
        return f"avg={sum(vals)/len(vals):.1f}% min={min(vals):.1f}% max={max(vals):.1f}%"

    print(f"| Metric | Stats |")
    print(f"|--------|-------|")
    print(f"| CPU Usage | {pct_stats(cpu_vals)} |")
    print(f"| Memory Usage | {pct_stats(mem_vals)} |")
    print(f"| Data points | {len(records)} |")
PYEOF
    else
      echo "- No metrics data available or Python3 not installed"
    fi
    echo ""

    echo "## Analysis Files"
    echo ""
    for f in "$OUTPUT_DIR"/nginx-analysis-*.json "$OUTPUT_DIR"/srs-metrics-*.json "$OUTPUT_DIR"/backend-metrics-*.json; do
      [[ -f "$f" ]] || continue
      echo "### $(basename "$f")"
      if command -v python3 &>/dev/null; then
        python3 -c "
import json
with open('$f') as fp:
    d = json.load(fp)
# Print top-level keys and their values if scalar
for k,v in d.items():
    if isinstance(v, (int, float, str)):
        print(f'- **{k}**: {v}')
" 2>/dev/null || echo "- Could not parse"
      fi
      echo ""
    done

    echo "## Success Criteria"
    echo ""
    echo "| KPI | Target | Result |"
    echo "|-----|--------|--------|"
    echo "| HLS 5xx error rate | < 0.1% | Check nginx-analysis JSON |"
    echo "| WebSocket success rate | > 95% | Check backend-metrics JSON |"
    echo "| API response time p95 | < 2000ms | Check nginx-analysis JSON |"
    echo "| Peak CPU | < 80% | Check metrics JSON |"
    echo "| Peak Memory | < 85% | Check metrics JSON |"
    echo "| SRS frame drops | < 100 | Check srs-metrics JSON |"
    echo ""

    echo "## Dashboard"
    echo ""
    echo "Open \`health-check-dashboard.html\` in a browser and load any \`metrics-*.json\` file."
    echo ""

    echo "## Raw Data Commands"
    echo ""
    echo "\`\`\`bash"
    echo "# View metrics data"
    echo "cat $OUTPUT_DIR/metrics-*.json | python3 -m json.tool | head -100"
    echo ""
    echo "# Check nginx error rate"
    echo "cat $OUTPUT_DIR/nginx-analysis-*.json | python3 -c \"import json,sys; d=json.load(sys.stdin); print(d.get('error_summary', {}))\""
    echo ""
    echo "# Check SRS issues"
    echo "cat $OUTPUT_DIR/srs-metrics-*.json | python3 -c \"import json,sys; d=json.load(sys.stdin); print(d.get('issues', {}))\""
    echo "\`\`\`"

  } > "$report_file"

  log "Summary report written to: $report_file"
}

# ============================================================================
# Main
# ============================================================================
log_section "DORAMI MONITORING SUITE"
log "Duration  : ${DURATION}s"
log "Interval  : ${INTERVAL}s"
log "Output    : $OUTPUT_DIR"
log "Timestamp : $TIMESTAMP"
log ""

preflight_check
start_metrics_collector
start_heartbeat

log_section "MONITORING ACTIVE"
log "Metrics collector running (PID: $METRICS_PID)"
log "Output directory: $OUTPUT_DIR"
log ""
log "Press Ctrl+C to stop early, or wait ${DURATION}s for completion."
log ""

# Wait for metrics collector to finish (or be killed)
wait "$METRICS_PID" 2>/dev/null || true

log_section "COLLECTION COMPLETE"
run_post_analysis
generate_summary_report

log_section "MONITORING SUITE DONE"
log "All outputs in: $OUTPUT_DIR"
log ""
log "Next steps:"
log "  1. Open health-check-dashboard.html and load metrics-*.json"
log "  2. Review SUMMARY_REPORT.md for quick analysis"
log "  3. Run: cat $OUTPUT_DIR/nginx-analysis-*.json | python3 -m json.tool"
