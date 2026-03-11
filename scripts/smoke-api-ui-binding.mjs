#!/usr/bin/env node

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 12000);

const toText = (value) => {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
};

const isJsonBody = (contentType) =>
  typeof contentType === 'string' && contentType.toLowerCase().includes('application/json');

const requestWithTimeout = async (url, options) => {
  const timeoutMs = options?.timeoutMs || TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
};

const parseBody = async (response) => {
  const raw = await response.text().catch(() => '');
  if (!raw) {
    return { raw: '', parsed: undefined };
  }

  if (isJsonBody(response.headers.get('content-type'))) {
    try {
      return { raw, parsed: JSON.parse(raw) };
    } catch {
      return { raw, parsed: undefined };
    }
  }

  return { raw, parsed: undefined };
};

const unwrap = (payload) =>
  payload && typeof payload === 'object' && 'data' in payload && 'success' in payload
    ? payload.data
    : payload;

const checks = [
  {
    name: 'GET /api/health',
    url: `${BACKEND_URL}/api/health`,
    method: 'GET',
    expectedStatus: [200],
    validate: (responseBody, isJson) => {
      if (!isJson) return 'expected application/json payload';
      const data = unwrap(responseBody);
      if (data?.status !== 'ok' || !data?.timestamp) {
        return 'health payload malformed';
      }
      return null;
    },
  },
  {
    name: 'GET /api/health/full',
    url: `${BACKEND_URL}/api/health/full`,
    method: 'GET',
    expectedStatus: [200],
    validate: (responseBody, isJson) => {
      if (!isJson) return 'expected application/json payload';
      const data = unwrap(responseBody);
      if (data?.status !== 'ok') return 'health payload malformed';
      if (!data?.details?.database || !data?.details?.redis) {
        return 'health dependencies missing';
      }
      return null;
    },
  },
  {
    name: 'GET /api/health/live',
    url: `${BACKEND_URL}/api/health/live`,
    method: 'GET',
    expectedStatus: [200],
    validate: (responseBody, isJson) => {
      if (!isJson) return 'expected application/json payload';
      const data = unwrap(responseBody);
      if (data?.status !== 'ok') return 'liveness payload malformed';
      return null;
    },
  },
  {
    name: 'GET /api/config/payment',
    url: `${BACKEND_URL}/api/config/payment`,
    method: 'GET',
    expectedStatus: [200],
    validate: (responseBody, isJson) => {
      if (!isJson) return 'expected application/json payload';
      const data = unwrap(responseBody);
      if (typeof data !== 'object' || data === null) return 'payment config payload malformed';
      return null;
    },
  },
  {
    name: 'GET /api/streaming/active',
    url: `${BACKEND_URL}/api/streaming/active`,
    method: 'GET',
    expectedStatus: [200],
    validate: (responseBody, isJson) => {
      if (!isJson) return 'expected application/json payload';
      const data = unwrap(responseBody);
      if (!Array.isArray(data)) return 'streaming active payload should be array';
      return null;
    },
  },
  {
    name: 'POST /api/auth/refresh (no session)',
    url: `${BACKEND_URL}/api/auth/refresh`,
    method: 'POST',
    expectedStatus: [401],
    body: {},
    validate: () => null,
  },
  {
    name: 'POST /api/notifications/subscribe (no auth, body binding)',
    url: `${BACKEND_URL}/api/notifications/subscribe`,
    method: 'POST',
    expectedStatus: [401],
    body: {
      endpoint: 'https://example.invalid/subscription',
      p256dh: 'p256dh-key',
      auth: 'auth-key',
    },
    validate: () => null,
  },
  {
    name: 'DELETE /api/notifications/unsubscribe (no auth, body binding)',
    url: `${BACKEND_URL}/api/notifications/unsubscribe`,
    method: 'DELETE',
    expectedStatus: [401],
    body: {
      endpoint: 'https://example.invalid/subscription',
    },
    validate: () => null,
  },
  {
    name: 'Frontend /',
    url: `${CLIENT_URL}/`,
    method: 'GET',
    expectedStatus: [200],
    validate: (responseBody) => {
      const text = toText(responseBody?.raw).toLowerCase();
      if (!text.includes('<html')) return 'frontend html 응답이 아님';
      return null;
    },
  },
];

const run = async () => {
  console.log(`[smoke] started: backend=${BACKEND_URL}, client=${CLIENT_URL}`);
  let failed = false;

  for (const check of checks) {
    try {
      const response = await requestWithTimeout(check.url, {
        method: check.method,
        headers: {
          accept: 'application/json,text/html,*/*',
          ...(check.body ? { 'content-type': 'application/json' } : {}),
        },
        body: check.body ? JSON.stringify(check.body) : undefined,
        credentials: 'include',
      });

      const isExpected = check.expectedStatus.includes(response.status);
      if (!isExpected) {
        const raw = await response.text().catch(() => '');
        console.log(
          `[FAIL] ${check.name}: HTTP ${response.status} (expected ${check.expectedStatus.join(',')}) — ${raw.slice(0, 180)}`,
        );
        failed = true;
        continue;
      }

      const { parsed, raw } = await parseBody(response);
      const contentType = response.headers.get('content-type') || '';
      const isJson = isJsonBody(contentType);

      const message = check.validate(
        isJson ? parsed : { raw },
        isJson,
        {
          status: response.status,
          url: check.url,
          raw,
        },
      );

      if (message) {
        console.log(`[FAIL] ${check.name}: ${message}`);
        failed = true;
      } else {
        console.log(`[PASS] ${check.name}: ${response.status}`);
      }
    } catch (error) {
      failed = true;
      console.log(`[FAIL] ${check.name}: ${error?.message || error}`);
    }
  }

  if (failed) {
    console.log('[smoke] failed');
    process.exit(1);
  }

  console.log('[smoke] passed');
  process.exit(0);
};

run().catch((error) => {
  console.log(`[smoke] failed: ${error?.message || error}`);
  process.exit(1);
});
