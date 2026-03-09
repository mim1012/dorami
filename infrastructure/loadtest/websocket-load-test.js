import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import ws from 'k6/ws';

/**
 * k6 WebSocket Load Test — Socket.IO concurrent connections
 *
 * Simulates concurrent viewers connecting to the live stream via Socket.IO.
 * Tests chat messaging, viewer count tracking, and connection stability.
 *
 * Usage:
 *   k6 run --env BASE_URL=http://staging.doremi-live.com infrastructure/loadtest/websocket-load-test.js
 *
 * Requirements:
 *   - k6 installed: https://k6.io/docs/getting-started/installation/
 *   - Backend running with Socket.IO enabled
 *   - ENABLE_DEV_AUTH=true for authentication
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const WS_URL = __ENV.WS_URL || BASE_URL.replace(/^http/, 'ws');
const STREAM_KEY = __ENV.STREAM_KEY || 'test-stream-1';
const MAX_VUS = parseInt(__ENV.MAX_VUS || '100', 10);

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const wsConnectTime = new Trend('ws_connect_time_ms', { unit: 'ms' });
const wsMessageLatency = new Trend('ws_message_latency_ms', { unit: 'ms' });
const wsConnectErrors = new Counter('ws_connect_errors');
const wsChatSent = new Counter('ws_chat_messages_sent');
const wsChatReceived = new Counter('ws_chat_messages_received');
const wsConnectionSuccess = new Rate('ws_connection_success_rate');

// ---------------------------------------------------------------------------
// Load profile
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '1m', target: Math.floor(MAX_VUS * 0.2) },   // Ramp to 20%
    { duration: '2m', target: Math.floor(MAX_VUS * 0.5) },   // Ramp to 50%
    { duration: '2m', target: MAX_VUS },                       // Ramp to 100%
    { duration: '5m', target: MAX_VUS },                       // Sustained load
    { duration: '2m', target: Math.floor(MAX_VUS * 0.5) },   // Ramp down to 50%
    { duration: '1m', target: 0 },                             // Ramp down to 0
  ],
  thresholds: {
    'ws_connect_time_ms': ['p95 < 5000'],
    'ws_message_latency_ms': ['p95 < 2000'],
    'ws_connection_success_rate': ['rate > 0.90'],
    'ws_connect_errors': ['count < 50'],
    'http_req_failed': ['rate < 0.05'],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Authenticate via dev-login and return JWT access token from cookie
 */
function authenticate(vuId) {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/dev-login`,
    JSON.stringify({
      email: `loadtest-ws-${vuId}@doremi.test`,
      name: `LoadTest User ${vuId}`,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const loginOk = check(loginRes, {
    'dev-login status 200/201': (r) => r.status === 200 || r.status === 201,
  });

  if (!loginOk) {
    return null;
  }

  // Extract access_token from response body or cookies
  try {
    const body = JSON.parse(loginRes.body);
    if (body.data && body.data.accessToken) {
      return body.data.accessToken;
    }
  } catch (_) {
    // Token may be in cookies instead
  }

  // Try to extract from Set-Cookie header
  const cookies = loginRes.cookies;
  if (cookies && cookies['access_token']) {
    return cookies['access_token'][0].value;
  }

  return null;
}

/**
 * Socket.IO handshake: GET /socket.io/?EIO=4&transport=polling
 * Returns the session ID (sid) needed for WebSocket upgrade
 */
function socketIoHandshake(namespace, token) {
  const nsPath = namespace === '/' ? '' : namespace;
  const url = `${BASE_URL}/socket.io/${nsPath ? nsPath.slice(1) + '/' : ''}?EIO=4&transport=polling`;

  const headers = {};
  if (token) {
    headers['Cookie'] = `access_token=${token}`;
  }

  const res = http.get(url, { headers });

  if (res.status !== 200) {
    return null;
  }

  // Socket.IO polling response format: <length>:<payload>
  // Extract sid from the JSON payload
  try {
    const body = res.body;
    const jsonStart = body.indexOf('{');
    if (jsonStart >= 0) {
      const jsonStr = body.substring(jsonStart);
      const data = JSON.parse(jsonStr);
      return data.sid;
    }
  } catch (_) {
    // Parse error
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main test function
// ---------------------------------------------------------------------------
export default function () {
  const vuId = __VU;

  // Step 1: Authenticate
  const token = authenticate(vuId);
  if (!token) {
    wsConnectErrors.add(1);
    wsConnectionSuccess.add(0);
    sleep(2);
    return;
  }

  // Step 2: Socket.IO handshake for main namespace
  const t0 = Date.now();
  const sid = socketIoHandshake('/', token);
  const connectTime = Date.now() - t0;
  wsConnectTime.add(connectTime);

  if (!sid) {
    wsConnectErrors.add(1);
    wsConnectionSuccess.add(0);
    sleep(2);
    return;
  }

  wsConnectionSuccess.add(1);

  // Step 3: Upgrade to WebSocket
  const wsUrl = `${WS_URL}/socket.io/?EIO=4&transport=websocket&sid=${sid}`;

  const res = ws.connect(wsUrl, { headers: { Cookie: `access_token=${token}` } }, function (socket) {
    // Socket.IO protocol: send upgrade probe
    socket.send('2probe');

    socket.on('message', function (msg) {
      // Socket.IO message received
      wsChatReceived.add(1);

      // Track latency for echo/ack messages
      if (msg.includes('"latency_check"')) {
        try {
          const data = JSON.parse(msg.substring(msg.indexOf('{')));
          if (data.sentAt) {
            wsMessageLatency.add(Date.now() - data.sentAt);
          }
        } catch (_) {
          // Not a latency message
        }
      }
    });

    socket.on('open', function () {
      // Complete the upgrade
      socket.send('5');

      // Join stream room (Socket.IO event: 42["join",{streamKey}])
      socket.send(`42["join",{"streamKey":"${STREAM_KEY}"}]`);

      // Simulate viewer behavior for ~10 seconds
      for (let i = 0; i < 3; i++) {
        sleep(3);

        // Send a chat message every ~3 seconds (Socket.IO chat namespace format)
        const chatMsg = `42["chat:message",{"streamKey":"${STREAM_KEY}","content":"Load test message ${vuId}-${i}","sentAt":${Date.now()}}]`;
        socket.send(chatMsg);
        wsChatSent.add(1);
      }

      // Leave room before closing
      socket.send(`42["leave",{"streamKey":"${STREAM_KEY}"}]`);
    });

    socket.on('error', function (e) {
      wsConnectErrors.add(1);
    });

    // Close after test duration
    socket.setTimeout(function () {
      socket.close();
    }, 12000);
  });

  check(res, {
    'WebSocket status is 101': (r) => r && r.status === 101,
  });

  // Cool-down between iterations
  sleep(1);
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------
export function teardown() {
  console.log('\n=== WebSocket Load Test Summary ===');
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  WebSocket URL: ${WS_URL}`);
  console.log(`  Stream Key: ${STREAM_KEY}`);
  console.log(`  Max VUs: ${MAX_VUS}`);
}

