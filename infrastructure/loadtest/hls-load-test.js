import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

/**
 * k6 Load Test for HLS Streaming
 *
 * Simulates 500 concurrent viewers requesting HLS segments
 * Tests spike loading, sustained load, and recovery
 *
 * Usage:
 *   k6 run --vus 500 --duration 30m infrastructure/loadtest/hls-load-test.js
 *
 * With Docker Compose stack:
 *   docker-compose -f infrastructure/docker/docker-compose.yml up -d
 *   k6 run --vus 500 --duration 30m infrastructure/loadtest/hls-load-test.js
 */

// Configuration
const CONFIG = {
  BASE_URL: __ENV.BASE_URL || 'http://localhost:8080',
  STREAM_KEY: __ENV.STREAM_KEY || 'test-stream-1',
  TEST_DURATION: __ENV.DURATION || '30m',
  SPIKE_STAGES: [
    { duration: '2m', target: 50 },    // Ramp-up to 50 users
    { duration: '5m', target: 250 },   // Ramp-up to 250 users
    { duration: '2m', target: 500 },   // Spike to 500 users
    { duration: '15m', target: 500 },  // Sustained load for 15 min
    { duration: '3m', target: 100 },   // Ramp-down to 100 users
    { duration: '2m', target: 0 },     // Final ramp-down to 0
  ],
};

// Custom metrics
const hlsPlaylistFetchTime = new Trend('hls_playlist_fetch_time_ms');
const hlsSegmentFetchTime = new Trend('hls_segment_fetch_time_ms');
const hlsPlaylistErrors = new Counter('hls_playlist_errors');
const hlsSegmentErrors = new Counter('hls_segment_errors');
const hlsPlaylistRefreshRate = new Gauge('hls_playlist_refresh_interval_ms');
const playlistFreshness = new Gauge('hls_playlist_freshness_ms');
const segmentDeliveryLatency = new Gauge('hls_segment_delivery_latency_ms');
const rebufferCount = new Counter('hls_rebuffer_events');
const playlistParseErrors = new Counter('hls_playlist_parse_errors');

// Test configuration
export const options = {
  stages: CONFIG.SPIKE_STAGES,
  thresholds: {
    'http_req_duration': ['p(95)<5000', 'p(99)<10000'],  // 95th percentile < 5s, 99th < 10s
    'hls_playlist_fetch_time_ms': ['p(95)<1000'],        // Playlist fetch < 1s
    'hls_segment_fetch_time_ms': ['p(95)<2000'],         // Segment fetch < 2s
    'hls_playlist_errors': ['count<100'],                // Less than 100 playlist errors
    'hls_segment_errors': ['count<500'],                 // Less than 500 segment errors
    'http_req_failed': ['rate<0.01'],                    // Error rate < 1%
  },
  ext: {
    loadimpact: {
      projectID: 0, // Set this to your project ID if using Load Impact cloud
      name: 'HLS Streaming Load Test',
    },
  },
};

// Global state per VU
const VU_STATE = {};

/**
 * Parse HLS playlist and extract segment URLs
 */
function parsePlaylist(body) {
  const lines = body.split('\n');
  const segments = [];
  let targetDuration = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      targetDuration = parseInt(line.split(':')[1], 10);
    }

    if (!line.startsWith('#') && line.length > 0) {
      segments.push(line);
    }
  }

  return {
    segments,
    targetDuration,
    timestamp: new Date().getTime(),
  };
}

/**
 * Fetch HLS playlist and validate structure
 */
function fetchPlaylist(streamKey) {
  const playlistUrl = `${CONFIG.BASE_URL}/live/${streamKey}.m3u8`;

  const startTime = new Date().getTime();
  const res = http.get(playlistUrl);
  const fetchTime = new Date().getTime() - startTime;

  hlsPlaylistFetchTime.add(fetchTime);

  const success = check(res, {
    'playlist status is 200': (r) => r.status === 200,
    'playlist content-type is m3u8': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('m3u8'),
    'playlist size > 100 bytes': (r) => r.body.length > 100,
  });

  if (!success) {
    hlsPlaylistErrors.add(1);
    return null;
  }

  // Parse playlist
  let playlistData;
  try {
    playlistData = parsePlaylist(res.body);
  } catch (e) {
    playlistParseErrors.add(1);
    return null;
  }

  // Track playlist freshness (time since playlist was generated)
  playlistFreshness.set(new Date().getTime() - playlistData.timestamp);

  // Track refresh interval
  if (VU_STATE.lastPlaylistTime) {
    const refreshInterval = playlistData.timestamp - VU_STATE.lastPlaylistTime;
    hlsPlaylistRefreshRate.set(refreshInterval);
  }
  VU_STATE.lastPlaylistTime = playlistData.timestamp;

  return playlistData;
}

/**
 * Fetch a single HLS segment
 */
function fetchSegment(segmentUrl) {
  const startTime = new Date().getTime();
  const res = http.get(segmentUrl);
  const fetchTime = new Date().getTime() - startTime;

  hlsSegmentFetchTime.add(fetchTime);

  const success = check(res, {
    'segment status is 200': (r) => r.status === 200,
    'segment content-type is ts': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('video/mp2t'),
    'segment size > 10KB': (r) => r.body.length > 10240,
  });

  if (!success) {
    hlsSegmentErrors.add(1);
  }

  return success;
}

/**
 * Main test function simulating a viewer watching a live stream
 */
export default function () {
  // Initialize VU state
  if (!VU_STATE.streamKey) {
    VU_STATE.streamKey = CONFIG.STREAM_KEY;
    VU_STATE.segmentIndex = 0;
    VU_STATE.lastSegmentTime = 0;
    VU_STATE.rebuffers = 0;
  }

  group('Fetch HLS Playlist', () => {
    const playlistData = fetchPlaylist(VU_STATE.streamKey);

    if (playlistData && playlistData.segments.length > 0) {
      group('Fetch HLS Segments (Sequential)', () => {
        // Simulate viewer watching last 3 segments (sliding window)
        const segmentsToFetch = playlistData.segments.slice(-3);

        for (const segmentPath of segmentsToFetch) {
          const segmentUrl = `${CONFIG.BASE_URL}/live/${segmentPath}`;

          const startTime = new Date().getTime();
          const success = fetchSegment(segmentUrl);
          const deliveryLatency = new Date().getTime() - startTime;

          // Track segment delivery latency
          segmentDeliveryLatency.set(deliveryLatency);

          if (!success) {
            rebufferCount.add(1);
            VU_STATE.rebuffers++;
          }

          // Simulate playback delay (1s per segment)
          sleep(1);
        }
      });

      // Validate segment sequencing
      group('Validate Segment Sequencing', () => {
        const lastSegment = playlistData.segments[playlistData.segments.length - 1];
        const lastSegmentIndex = parseInt(lastSegment.match(/\d+/g).pop(), 10);

        check(lastSegmentIndex, {
          'segment index is sequential': (idx) => idx > VU_STATE.segmentIndex || idx === 0,
        });

        VU_STATE.segmentIndex = lastSegmentIndex;
      });
    }
  });

  // Simulate realistic playback interval (refresh playlist every 2-3 segments)
  sleep(Math.random() * 2 + 1);
}

/**
 * Teardown function to print summary statistics
 */
export function teardown(data) {
  console.log(`\n=== HLS Load Test Summary ===`);
  console.log(`Test completed with configuration:`);
  console.log(`  Base URL: ${CONFIG.BASE_URL}`);
  console.log(`  Stream Key: ${CONFIG.STREAM_KEY}`);
  console.log(`  Duration: ${CONFIG.TEST_DURATION}`);
  console.log(`\nTest stages:`);
  CONFIG.SPIKE_STAGES.forEach((stage, idx) => {
    console.log(`  Stage ${idx + 1}: ${stage.duration} → ${stage.target} VUs`);
  });
}
