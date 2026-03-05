#!/usr/bin/env node

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3011';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 12000);

const checks = [
  {
    name: 'backend_health',
    url: `${BACKEND_URL}/api/health`,
    method: 'GET',
    validate: async (res, body) => {
      if (!res.ok) return 'response is not 2xx';
      if (!body || body.status !== 'ok') return 'unexpected health payload';
      return null;
    },
  },
  {
    name: 'backend_products_list',
    url: `${BACKEND_URL}/api/products?limit=1`,
    method: 'GET',
    validate: async (res) => {
      if (!res.ok) return `response status ${res.status}`;
      return null;
    },
  },
  {
    name: 'backend_payment_config',
    url: `${BACKEND_URL}/api/config/payment`,
    method: 'GET',
    validate: async (res, body) => {
      if (!res.ok) return `response status ${res.status}`;
      if (!body || typeof body !== 'object') return 'invalid payment config payload';
      return null;
    },
  },
  {
    name: 'frontend_home',
    url: `${CLIENT_URL}/`,
    method: 'GET',
    validate: async (res, text) => {
      if (res.status < 200 || res.status >= 400) return `response status ${res.status}`;
      if (!text || !text.includes('<html')) return 'missing html response';
      return null;
    },
  },
  {
    name: 'frontend_live_page',
    url: `${CLIENT_URL}/live`,
    method: 'GET',
    validate: async (res, text) => {
      if (res.status < 200 || res.status >= 400) return `response status ${res.status}`;
      if (!text || !text.includes('<html')) return 'missing html response';
      return null;
    },
  },
  {
    name: 'frontend_csrf',
    url: `${CLIENT_URL}/api/csrf`,
    method: 'GET',
    validate: async (res, body) => {
      if (!res.ok) return `response status ${res.status}`;
      if (!body || typeof body !== 'object' || typeof body.token !== 'string') {
        return 'invalid csrf payload';
      }
      return null;
    },
  },
  {
    name: 'backend_streaming_active',
    url: `${BACKEND_URL}/api/streaming/active`,
    method: 'GET',
    validate: async (res, body) => {
      if (!res.ok) return `response status ${res.status}`;
      if (!Array.isArray(body)) return 'streaming active payload should be array';
      return null;
    },
  },
  {
    name: 'backend_live_deals',
    url: `${BACKEND_URL}/api/products/live-deals`,
    method: 'GET',
    validate: async (res, body) => {
      if (!res.ok) return `response status ${res.status}`;
      if (body === null || typeof body === 'object') return null;
      return 'unexpected live-deals payload';
    },
  },
  {
    name: 'frontend_admin_route',
    url: `${CLIENT_URL}/admin`,
    method: 'GET',
    validate: async (res, text) => {
      // In a secured app this may redirect to login page for unauthenticated users.
      if (res.status === 302 || res.status === 307 || res.status === 308) return null;
      if (res.status < 200 || res.status >= 400) return `response status ${res.status}`;
      if (!text || text.length < 50) return 'admin route returned empty response';
      return null;
    },
  },
];

const requestWithTimeout = async (url, method, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: { accept: 'application/json,text/html,*/*' },
      redirect: 'manual',
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
};

const run = async () => {
  let failed = false;
  const now = new Date().toISOString();
  console.log(`smoke-check started: ${now}`);
  console.log(`backend: ${BACKEND_URL}`);
  console.log(`client : ${CLIENT_URL}`);

  for (const check of checks) {
    try {
      const res = await requestWithTimeout(check.url, check.method, TIMEOUT_MS);
      const isJson =
        (res.headers.get('content-type') || '').includes('application/json') &&
        res.headers.get('content-type') !== '';
      const body = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => '');

      const message = await check.validate(res, body, isJson);
      if (message) {
        failed = true;
        console.log(`[FAIL] ${check.name}: ${message}`);
      } else {
        console.log(`[PASS] ${check.name}: ${res.status}`);
      }
    } catch (err) {
      failed = true;
      console.log(`[FAIL] ${check.name}: ${err?.message || err}`);
    }
  }

  const finish = new Date().toISOString();
  if (failed) {
    console.log(`smoke-check failed: ${finish}`);
    process.exit(1);
  }

  console.log(`smoke-check passed: ${finish}`);
  process.exit(0);
};

run();
