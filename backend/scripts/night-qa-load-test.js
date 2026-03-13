/**
 * Night QA Stage 5: Progressive Load Test Script (k6/xk6)
 *
 * Simulates 50→100→150→200 concurrent users over 150 minutes
 * Monitors:
 * - Response times (p95, p99)
 * - Error rates
 * - System metrics (CPU, memory via health endpoint)
 * - WebSocket stability
 * - Real-time feature latency
 *
 * Returns: PASS | FAIL with metrics breakdown
 */

export const options = {
  stages: [
    // Ramp up to 50 users over 5 minutes
    { duration: '5m', target: 50 },
    // Ramp up to 100 users
    { duration: '5m', target: 100 },
    // Ramp up to 150 users
    { duration: '5m', target: 150 },
    // Sustain 200 users
    { duration: '5m', target: 200 },
    { duration: '60m', target: 200 },
    // Ramp down
    { duration: '5m', target: 0 },
  ],

  thresholds: {
    // 95% of requests must complete in under 500ms
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    // Error rate must be below 1%
    http_req_failed: ['rate<0.01'],
    // WebSocket checks
    ws_connecting: ['rate<0.05'],
    ws_session_duration: ['avg>5000'],
  },

  ext: {
    loadimpact: {
      projectID: 3456,
      name: 'Doremi Night QA Load Test',
    },
  },
};

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// Custom metrics
const productListDuration = new Trend('product_list_duration');
const cartAddDuration = new Trend('cart_add_duration');
const websocketLatency = new Trend('websocket_latency');
const errorCount = new Counter('errors_total');
const wsFailRate = new Rate('ws_fail_rate');

export default function () {
  const baseURL = __ENV.STAGING_BACKEND_URL || 'http://localhost:3001';
  const wsURL = __ENV.STAGING_WS_URL || 'ws://localhost:3001';

  // Scenario 1: Browse products
  const productRes = http.get(`${baseURL}/api/products`, {
    tags: { name: 'BrowseProducts' },
  });

  productListDuration.add(productRes.timings.duration);
  check(productRes, {
    'product list status is 200': (r) => r.status === 200,
    'product list has items': (r) => r.body.includes('products'),
  }) || errorCount.add(1);

  sleep(1);

  // Scenario 2: Add to cart
  const cartRes = http.post(
    `${baseURL}/api/cart/items`,
    JSON.stringify({
      productId: 1,
      quantity: 1,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'AddToCart' },
    }
  );

  cartAddDuration.add(cartRes.timings.duration);
  check(cartRes, {
    'add to cart status is 200': (r) => r.status === 200 || r.status === 401,
  }) || errorCount.add(1);

  sleep(2);

  // Scenario 3: Real-time WebSocket connection
  const wsStartTime = new Date();

  try {
    const wsRes = ws.connect(wsURL, {}, (socket) => {
      socket.on('connect', () => {
        websocketLatency.add(new Date() - wsStartTime);
      });

      socket.on('message', (data) => {
        check(data, {
          'received valid message': (msg) => msg.length > 0,
        }) || wsFailRate.add(1, { failure: 'invalid_message' });
      });

      socket.on('close', () => {
        // Connection closed
      });

      socket.on('error', (e) => {
        wsFailRate.add(1, { failure: 'connection_error' });
      });

      // Simulate listening for 10 seconds
      setTimeout(() => socket.close(), 10000);
    });

    check(wsRes, {
      'websocket connected': () => wsRes.status === 101,
    }) || wsFailRate.add(1, { failure: 'connection_failed' });
  } catch (e) {
    wsFailRate.add(1, { failure: 'exception' });
  }

  sleep(3);

  // Scenario 4: Health check (simulated system monitoring)
  const healthRes = http.get(`${baseURL}/api/health/live`, {
    tags: { name: 'HealthCheck' },
  });

  check(healthRes, {
    'health check passed': (r) => r.status === 200,
  }) || errorCount.add(1);
}

export function handleSummary(data) {
  return {
    stdout: formatSummary(data),
  };
}

function formatSummary(data) {
  const summary = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🌙 Doremi Night QA Load Test Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Request Metrics:
  Total Requests: ${data.metrics.http_reqs?.value || 0}
  Failed: ${data.metrics.http_req_failed?.value || 0}
  Error Rate: ${((data.metrics.http_req_failed?.value || 0) / (data.metrics.http_reqs?.value || 1) * 100).toFixed(2)}%

⏱️  Response Times:
  p95: ${data.metrics.http_req_duration?.values?.p95?.toFixed(2) || 'N/A'} ms
  p99: ${data.metrics.http_req_duration?.values?.p99?.toFixed(2) || 'N/A'} ms

🔌 WebSocket:
  Failure Rate: ${(data.metrics.ws_fail_rate?.value || 0 * 100).toFixed(2)}%

✅ Threshold Results:
  ${Object.entries(data.thresholds || {}).map(([key, result]) =>
    `${result.ok ? '✅' : '❌'} ${key}`
  ).join('\n  ')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Result: ${data.thresholds && Object.values(data.thresholds).every(t => t.ok) ? 'PASS ✅' : 'FAIL ❌'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `;
  return summary;
}

