import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

/**
 * k6 Combined Staging Load Test — API + HLS + Auth
 *
 * Simulates realistic user behavior on the staging environment:
 *   - Browse products, view live streams, add to cart
 *   - Authenticate via dev-login
 *   - Fetch HLS playlist and segments
 *
 * Usage:
 *   k6 run --env BASE_URL=http://staging.doremi-live.com infrastructure/loadtest/staging-load-test.js
 *   k6 run --env BASE_URL=http://staging.doremi-live.com --env MAX_VUS=200 infrastructure/loadtest/staging-load-test.js
 *
 * Requirements:
 *   - k6: https://k6.io/docs/getting-started/installation/
 *   - Staging backend + frontend running
 *   - ENABLE_DEV_AUTH=true
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost';
const BACKEND_URL = __ENV.BACKEND_URL || `${BASE_URL}`;
const STREAM_KEY = __ENV.STREAM_KEY || 'test-stream-1';
const MAX_VUS = parseInt(__ENV.MAX_VUS || '100', 10);
const SCENARIO = __ENV.SCENARIO || 'ramp';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const apiLatency = new Trend('api_latency_ms', { unit: 'ms' });
const authLatency = new Trend('auth_latency_ms', { unit: 'ms' });
const hlsLatency = new Trend('hls_latency_ms', { unit: 'ms' });
const apiErrors = new Counter('api_errors');
const authErrors = new Counter('auth_errors');
const hlsErrors = new Counter('hls_errors');
const apiSuccessRate = new Rate('api_success_rate');

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
const SCENARIOS = {
  // Quick smoke test
  smoke: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 0 },
  ],
  // Standard ramp test (100 VUs default)
  ramp: [
    { duration: '2m', target: Math.floor(MAX_VUS * 0.2) },
    { duration: '3m', target: Math.floor(MAX_VUS * 0.5) },
    { duration: '2m', target: MAX_VUS },
    { duration: '5m', target: MAX_VUS },
    { duration: '2m', target: 0 },
  ],
  // Spike test (sudden burst)
  spike: [
    { duration: '1m', target: 10 },
    { duration: '30s', target: MAX_VUS },
    { duration: '3m', target: MAX_VUS },
    { duration: '1m', target: 10 },
    { duration: '1m', target: 0 },
  ],
  // Sustained load (30 min)
  sustained: [
    { duration: '5m', target: MAX_VUS },
    { duration: '20m', target: MAX_VUS },
    { duration: '5m', target: 0 },
  ],
};

export const options = {
  stages: SCENARIOS[SCENARIO] || SCENARIOS.ramp,
  thresholds: {
    'api_latency_ms': ['p95 < 2000', 'p99 < 5000'],
    'auth_latency_ms': ['p95 < 3000'],
    'hls_latency_ms': ['p95 < 3000'],
    'api_success_rate': ['rate > 0.95'],
    'http_req_failed': ['rate < 0.05'],
    'api_errors': ['count < 100'],
  },
};

// ---------------------------------------------------------------------------
// API Test Functions
// ---------------------------------------------------------------------------

function testHealthEndpoints() {
  group('Health Endpoints', () => {
    const t0 = Date.now();
    const liveRes = http.get(`${BACKEND_URL}/api/health/live`);
    apiLatency.add(Date.now() - t0);

    const ok = check(liveRes, {
      'health/live returns 200': (r) => r.status === 200,
    });
    apiSuccessRate.add(ok ? 1 : 0);
    if (!ok) apiErrors.add(1);

    const t1 = Date.now();
    const readyRes = http.get(`${BACKEND_URL}/api/health/ready`);
    apiLatency.add(Date.now() - t1);

    const readyOk = check(readyRes, {
      'health/ready returns 200': (r) => r.status === 200,
    });
    apiSuccessRate.add(readyOk ? 1 : 0);
    if (!readyOk) apiErrors.add(1);
  });
}

function testPublicAPIs() {
  group('Public API Endpoints', () => {
    const endpoints = [
      { path: '/api/streaming/active', name: 'active streams' },
      { path: '/api/streaming/upcoming?limit=4', name: 'upcoming streams' },
      { path: '/api/products/popular?limit=8', name: 'popular products' },
      { path: '/api/products/live-deals', name: 'live deals' },
    ];

    for (const ep of endpoints) {
      const t0 = Date.now();
      const res = http.get(`${BACKEND_URL}${ep.path}`);
      apiLatency.add(Date.now() - t0);

      const ok = check(res, {
        [`${ep.name} returns 200`]: (r) => r.status === 200,
      });
      apiSuccessRate.add(ok ? 1 : 0);
      if (!ok) apiErrors.add(1);
    }
  });
}

function testAuthentication(vuId) {
  let token = null;

  group('Authentication', () => {
    const t0 = Date.now();
    const loginRes = http.post(
      `${BACKEND_URL}/api/auth/dev-login`,
      JSON.stringify({
        email: `loadtest-${vuId}@doremi.test`,
        name: `LoadTest User ${vuId}`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    authLatency.add(Date.now() - t0);

    const ok = check(loginRes, {
      'dev-login returns 200/201': (r) => r.status === 200 || r.status === 201,
    });

    if (!ok) {
      authErrors.add(1);
      return;
    }

    // Extract token from response
    try {
      const body = JSON.parse(loginRes.body);
      if (body.data && body.data.accessToken) {
        token = body.data.accessToken;
      }
    } catch (_) {
      // Token in cookies
    }

    if (!token && loginRes.cookies && loginRes.cookies['access_token']) {
      token = loginRes.cookies['access_token'][0].value;
    }
  });

  return token;
}

function testAuthenticatedAPIs(token) {
  if (!token) return;

  group('Authenticated API Endpoints', () => {
    const headers = {
      Cookie: `access_token=${token}`,
    };

    // Get user profile
    const t0 = Date.now();
    const profileRes = http.get(`${BACKEND_URL}/api/users/me`, { headers });
    apiLatency.add(Date.now() - t0);

    check(profileRes, {
      'user profile returns 200': (r) => r.status === 200,
    });

    // Get cart
    const t1 = Date.now();
    const cartRes = http.get(`${BACKEND_URL}/api/cart`, { headers });
    apiLatency.add(Date.now() - t1);

    check(cartRes, {
      'cart returns 200': (r) => r.status === 200,
    });

    // Get orders
    const t2 = Date.now();
    const ordersRes = http.get(`${BACKEND_URL}/api/orders?page=1&limit=5`, { headers });
    apiLatency.add(Date.now() - t2);

    check(ordersRes, {
      'orders returns 200': (r) => r.status === 200,
    });
  });
}

function testHLSStreaming() {
  group('HLS Streaming', () => {
    // Fetch HLS playlist
    const playlistUrl = `${BACKEND_URL}/hls/${STREAM_KEY}.m3u8`;
    const t0 = Date.now();
    const playlistRes = http.get(playlistUrl);
    hlsLatency.add(Date.now() - t0);

    const playlistOk = check(playlistRes, {
      'HLS playlist accessible (200 or 404 if no stream)': (r) =>
        r.status === 200 || r.status === 404,
    });

    if (!playlistOk) {
      hlsErrors.add(1);
      return;
    }

    // If playlist is available, fetch a segment
    if (playlistRes.status === 200 && playlistRes.body) {
      const lines = playlistRes.body.split('\n');
      const tsLines = lines.filter((l) => l.trim().endsWith('.ts'));

      if (tsLines.length > 0) {
        const lastSegment = tsLines[tsLines.length - 1].trim();
        const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1);
        const segmentUrl = lastSegment.startsWith('http') ? lastSegment : baseUrl + lastSegment;

        const t1 = Date.now();
        const segmentRes = http.get(segmentUrl);
        hlsLatency.add(Date.now() - t1);

        const segOk = check(segmentRes, {
          'HLS segment returns 200': (r) => r.status === 200,
          'HLS segment has content': (r) => r.body && r.body.length > 0,
        });

        if (!segOk) hlsErrors.add(1);
      }
    }

    // Also test HTTP-FLV route accessibility
    const flvUrl = `${BACKEND_URL}/live/live/${STREAM_KEY}.flv`;
    const flvRes = http.get(flvUrl, { timeout: '3s' });
    check(flvRes, {
      'HTTP-FLV route accessible (not 502)': (r) => r.status !== 502,
    });
  });
}

function testFrontendPages() {
  group('Frontend Pages', () => {
    const pages = [
      { path: '/', name: 'home' },
      { path: `/live/${STREAM_KEY}`, name: 'live page' },
    ];

    for (const page of pages) {
      const t0 = Date.now();
      const res = http.get(`${BACKEND_URL}${page.path}`);
      apiLatency.add(Date.now() - t0);

      check(res, {
        [`${page.name} returns 200/307`]: (r) => r.status === 200 || r.status === 307,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Main test function
// ---------------------------------------------------------------------------
export default function () {
  const vuId = __VU;

  // Every VU runs health + public APIs
  testHealthEndpoints();
  sleep(0.5);

  testPublicAPIs();
  sleep(0.5);

  // 70% of VUs also test authenticated flows
  if (vuId % 10 < 7) {
    const token = testAuthentication(vuId);
    sleep(0.5);

    testAuthenticatedAPIs(token);
    sleep(0.5);
  }

  // 50% of VUs test HLS streaming
  if (vuId % 2 === 0) {
    testHLSStreaming();
    sleep(0.5);
  }

  // 30% of VUs test frontend pages
  if (vuId % 10 < 3) {
    testFrontendPages();
    sleep(0.5);
  }

  // Simulate realistic think time
  sleep(Math.random() * 2 + 1);
}

// ---------------------------------------------------------------------------
// Setup and Teardown
// ---------------------------------------------------------------------------
export function setup() {
  // Verify staging is reachable before running load test
  const healthRes = http.get(`${BACKEND_URL}/api/health/live`);
  const ok = check(healthRes, {
    'staging backend is reachable': (r) => r.status === 200,
  });

  if (!ok) {
    console.error(`ERROR: Backend at ${BACKEND_URL} is not reachable. Aborting load test.`);
    // Return empty data to signal abort
    return { abort: true };
  }

  console.log(`Staging load test starting against ${BACKEND_URL}`);
  console.log(`  Scenario: ${SCENARIO}`);
  console.log(`  Max VUs: ${MAX_VUS}`);
  console.log(`  Stream Key: ${STREAM_KEY}`);

  return { abort: false };
}

export function teardown(data) {
  console.log('\n=== Staging Load Test Summary ===');
  console.log(`  Base URL: ${BACKEND_URL}`);
  console.log(`  Scenario: ${SCENARIO}`);
  console.log(`  Max VUs: ${MAX_VUS}`);
  console.log(`  Stream Key: ${STREAM_KEY}`);

  if (data && data.abort) {
    console.log('  STATUS: ABORTED (backend unreachable)');
  }
}

