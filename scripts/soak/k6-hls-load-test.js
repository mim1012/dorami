/**
 * k6 HLS Load Test — 200 CCU internal validation
 *
 * This script tests HLS streaming performance under load.
 * Target: validate that 200 concurrent users can stream without excessive buffering or failures.
 *
 * Usage:
 *   k6 run --env HLS_URL=https://staging.doremi-live.com/live/smoke-check.m3u8 scripts/soak/k6-hls-load-test.js
 *
 * Requirements:
 *   - k6 installed: https://k6.io/docs/getting-started/installation/
 *   - ffmpeg running on staging (test stream at rtmp://staging:1935/live/smoke-check)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

/**
 * Custom metrics
 */
const segmentLatency = new Trend('hls_segment_latency_ms', { unit: 'ms' });
const playlistLatency = new Trend('hls_playlist_latency_ms', { unit: 'ms' });
const bufferEvents = new Counter('buffer_events');
const segmentErrors = new Counter('hls_segment_errors');

/**
 * Load profile: ramp up to 200 CCU over 30 min, hold for 15 min, ramp down 5 min
 */
export const options = {
  stages: [
    { duration: '5m', target: 50 },      // Ramp-up phase 1 (0→50 users)
    { duration: '10m', target: 100 },    // Ramp-up phase 2 (50→100 users)
    { duration: '10m', target: 150 },    // Ramp-up phase 3 (100→150 users)
    { duration: '5m', target: 200 },     // Ramp-up phase 4 (150→200 users)
    { duration: '15m', target: 200 },    // Steady state (hold 200 CCU)
    { duration: '5m', target: 0 },       // Ramp-down (200→0 users)
  ],
  thresholds: {
    // Segment fetch latency: p95 < 3 seconds
    'hls_segment_latency_ms': ['p95 < 3000', 'p99 < 5000'],
    // Playlist fetch latency: p95 < 1 second
    'hls_playlist_latency_ms': ['p95 < 1000', 'p99 < 2000'],
    // Overall HTTP failure rate < 2%
    'http_req_failed': ['rate < 0.02'],
    // Drop-out events should be minimal (< 5% of requests)
    'buffer_events': ['rate < 0.05'],
  },
};

/**
 * HLS_URL is required; pass via --env HLS_URL=...
 */
const HLS_URL = __ENV.HLS_URL;
if (!HLS_URL) {
  throw new Error(
    'HLS_URL environment variable is required. ' +
    'Example: k6 run --env HLS_URL=https://staging.doremi-live.com/live/smoke-check.m3u8 ...'
  );
}

/**
 * VU iteration: simulates a single user streaming video
 *
 * - Fetch playlist (m3u8)
 * - Extract the latest segment URL
 * - Fetch the segment (*.ts)
 * - Repeat with playback-like timing (2-3 sec between requests)
 */
export default function () {
  // Step 1: Fetch playlist
  const t0 = Date.now();
  const playlistRes = http.get(HLS_URL, {
    tags: { name: 'playlist' },
  });
  const playlistTime = Date.now() - t0;

  const playlistOk = check(playlistRes, {
    'playlist status 200': (r) => r.status === 200,
    'playlist content-type m3u8': (r) =>
      r.headers['Content-Type']?.includes('application/vnd.apple.mpegurl') ||
      r.headers['Content-Type']?.includes('text/plain'),
  });

  if (!playlistOk) {
    // If playlist fetch fails, user buffers → increment buffer event
    bufferEvents.add(1);
    sleep(2);
    return;
  }

  playlistLatency.add(playlistTime);

  // Step 2: Parse playlist and extract the latest segment
  const lines = playlistRes.body.split('\n');
  const tsLines = lines.filter((line) => line.trim().endsWith('.ts'));
  const tsLine = tsLines[tsLines.length - 1]; // Last segment (most recent in live stream)

  if (!tsLine || !tsLine.trim()) {
    // No segments available (stream may not have started yet) → buffer event
    bufferEvents.add(1);
    sleep(2);
    return;
  }

  // Step 3: Resolve segment URL (handle relative paths)
  const baseUrl = HLS_URL.substring(0, HLS_URL.lastIndexOf('/') + 1);
  const tsUrl = tsLine.trim().startsWith('http') ? tsLine.trim() : baseUrl + tsLine.trim();

  // Step 4: Fetch segment
  const t1 = Date.now();
  const tsRes = http.get(tsUrl, {
    tags: { name: 'segment' },
  });
  const segmentTime = Date.now() - t1;

  const segmentOk = check(tsRes, {
    'segment status 200': (r) => r.status === 200,
    'segment size > 0': (r) => r.body.length > 0,
  });

  if (segmentOk) {
    segmentLatency.add(segmentTime);
  } else {
    segmentErrors.add(1);
  }

  // Step 5: Simulate playback delay (2-3 seconds between segment fetches in live streaming)
  sleep(2.5);
}
