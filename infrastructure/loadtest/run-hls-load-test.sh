#!/bin/bash

###
# Run HLS Load Test with k6
#
# This script runs the k6 load test against the SRS HLS streaming server
# Prerequisites: k6 installed, docker-compose stack running
#
# Usage:
#   ./infrastructure/loadtest/run-hls-load-test.sh [options]
#
# Options:
#   --vus N                    Number of virtual users (default: 500)
#   --duration D               Test duration (default: 30m)
#   --base-url URL             Base URL for media server (default: http://localhost:8080)
#   --stream-key KEY           Stream key to test (default: test-stream-1)
#   --output FILE              Output JSON file (default: results-$(date +%s).json)
#   --help                     Show this help message
###

set -e

# Defaults
VUS=500
DURATION="30m"
BASE_URL="http://localhost:8080"
STREAM_KEY="test-stream-1"
OUTPUT_FILE="results-$(date +%s).json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --vus)
      VUS="$2"
      shift 2
      ;;
    --duration)
      DURATION="$2"
      shift 2
      ;;
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --stream-key)
      STREAM_KEY="$2"
      shift 2
      ;;
    --output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --help)
      head -30 "$0" | tail -25
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "=========================================="
echo "  HLS Load Test Configuration"
echo "=========================================="
echo "Virtual Users (VUs): $VUS"
echo "Duration: $DURATION"
echo "Base URL: $BASE_URL"
echo "Stream Key: $STREAM_KEY"
echo "Output: $OUTPUT_FILE"
echo "=========================================="
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
  echo "Error: k6 is not installed"
  echo "Install k6 from: https://k6.io/docs/getting-started/installation/"
  exit 1
fi

# Run k6 test
echo "Starting k6 load test..."
k6 run \
  --vus "$VUS" \
  --duration "$DURATION" \
  -o "json=$OUTPUT_FILE" \
  -e BASE_URL="$BASE_URL" \
  -e STREAM_KEY="$STREAM_KEY" \
  -e DURATION="$DURATION" \
  "$SCRIPT_DIR/hls-load-test.js"

echo ""
echo "=========================================="
echo "Test completed!"
echo "Results saved to: $OUTPUT_FILE"
echo "=========================================="

# Print summary
if command -v jq &> /dev/null; then
  echo ""
  echo "Summary:"
  echo "--------"
  jq '.metrics | with_entries(select(.value.type == "trend")) | map({
    metric: .key,
    avg: (.value.values.value | add / length | round),
    p95: (.value.values.value | sort[length * 0.95 | floor])
  })' "$OUTPUT_FILE" 2>/dev/null || echo "(Install jq for detailed summary)"
fi
