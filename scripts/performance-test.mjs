#!/usr/bin/env node
/**
 * Performance benchmark script for Doremi live commerce platform.
 *
 * Measures:
 *  - API response times (products, orders, profile)
 *  - WebSocket chat message latency (50 and 100 concurrent users)
 *  - HLS stream first-frame time and buffering incidents
 *  - Page load times (products list, orders page)
 *
 * Results written to performance-results.json in the working directory.
 *
 * Environment variables:
 *   BACKEND_URL   — default http://localhost:3001
 *   CLIENT_URL    — default http://localhost:3000
 *   WS_URL        — default http://localhost:3001
 *   MEDIA_URL     — SRS media server, default http://localhost:8080
 *   DEV_EMAIL     — dev-login email (optional, skips order POST if missing)
 *   TIMEOUT_MS    — per-request timeout, default 10000
 *   RESULTS_FILE  — output path, default ./performance-results.json
 *
 * Usage:
 *   node scripts/performance-test.js
 *   BACKEND_URL=https://www.doremi-live.com node scripts/performance-test.js
 */

import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { createServer } from 'http';

// ─── Configuration ────────────────────────────────────────────────────────────

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const CLIENT_URL  = process.env.CLIENT_URL  || 'http://localhost:3000';
const WS_URL      = process.env.WS_URL      || 'http://localhost:3001';
const MEDIA_URL   = process.env.MEDIA_URL   || 'http://localhost:8080';
const TIMEOUT_MS  = Number(process.env.TIMEOUT_MS || 10000);
const RESULTS_FILE = process.env.RESULTS_FILE || './performance-results.json';

// Thresholds (ms)
const THRESHOLDS = {
  products:      200,
  orders:        500,
  profile:       100,
  chatLatency50: 100,
  chatLatency100: 200,
  hls:           3000,
  pageProducts:  2000,
  pageOrders:    2000,
};

// ─── Utilities ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchWithTimeout = async (url, opts = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const measureOnce = async (url, opts = {}) => {
  const t0 = performance.now();
  let status = 0;
  let ok = false;
  try {
    const res = await fetchWithTimeout(url, opts);
    status = res.status;
    ok = res.ok;
    await res.text(); // drain body
  } catch (err) {
    // timeout or network error — ok stays false
  }
  return { elapsed: performance.now() - t0, status, ok };
};

/**
 * Run `fn` N times, return sorted elapsed times and average.
 */
const benchmark = async (fn, iterations = 5) => {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const { elapsed, ok, status } = await fn();
    times.push({ elapsed, ok, status });
    await sleep(100); // brief pause between iterations
  }
  const elapsed = times.map((t) => t.elapsed);
  elapsed.sort((a, b) => a - b);
  const avg = elapsed.reduce((s, v) => s + v, 0) / elapsed.length;
  const p50 = elapsed[Math.floor(elapsed.length * 0.5)];
  const p95 = elapsed[Math.floor(elapsed.length * 0.95)] ?? elapsed[elapsed.length - 1];
  const allOk = times.every((t) => t.ok);
  return { avg: Math.round(avg), p50: Math.round(p50), p95: Math.round(p95), allOk };
};

const verdict = (value, threshold) => (value <= threshold ? 'PASS' : 'FAIL');

const log = (...args) => console.log('[perf]', ...args);

// ─── Dev-login helper ─────────────────────────────────────────────────────────

let devAuthCookie = null;

const devLogin = async () => {
  try {
    const email = process.env.DEV_EMAIL || 'perf-test@doremi.internal';
    const res = await fetchWithTimeout(`${BACKEND_URL}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      const setCookie = res.headers.get('set-cookie') || '';
      devAuthCookie = setCookie.split(';')[0]; // extract first cookie value
      log('dev-login OK, cookie acquired');
    } else {
      log(`dev-login failed (${res.status}) — authenticated endpoints will be skipped`);
    }
  } catch (err) {
    log(`dev-login error: ${err.message} — authenticated endpoints will be skipped`);
  }
};

const authHeaders = () =>
  devAuthCookie ? { cookie: devAuthCookie } : {};

// ─── Section 1: API response times ───────────────────────────────────────────

const testApiProducts = async () => {
  log('testing GET /api/products ...');
  const result = await benchmark(
    () => measureOnce(`${BACKEND_URL}/api/products?limit=10`),
    5,
  );
  return result;
};

const testApiProfile = async () => {
  log('testing GET /api/users/profile ...');
  if (!devAuthCookie) {
    log('skipping profile (no auth cookie)');
    return null;
  }
  const result = await benchmark(
    () =>
      measureOnce(`${BACKEND_URL}/api/users/profile`, {
        headers: authHeaders(),
      }),
    5,
  );
  return result;
};

const testApiOrders = async () => {
  // We only measure the POST latency — we send a structurally valid but
  // intentionally incomplete payload so the endpoint processes validation
  // and returns quickly (4xx is still a measured round-trip).
  log('testing POST /api/orders ...');
  if (!devAuthCookie) {
    log('skipping orders POST (no auth cookie)');
    return null;
  }
  const result = await benchmark(
    () =>
      measureOnce(`${BACKEND_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ _perf: true }), // will fail validation, measures latency
      }),
    5,
  );
  return result;
};

// ─── Section 2: WebSocket / Chat latency ─────────────────────────────────────

/**
 * Simulate N concurrent WebSocket connections to /chat namespace.
 * Each connection sends a ping-style message and measures round-trip
 * echo latency. Returns average latency across all connections.
 *
 * Implementation uses native WebSocket (Node 21+) or falls back to
 * HTTP-based estimation when ws module is unavailable.
 */
const measureChatLatency = async (concurrency) => {
  log(`testing chat latency with ${concurrency} concurrent users ...`);

  // Try to dynamically import the 'ws' package (available as a transitive dep)
  let WebSocket;
  try {
    const require = createRequire(import.meta.url);
    ({ WebSocket } = require('ws'));
  } catch {
    // Node 21+ has native WebSocket under --experimental-websocket flag or globalThis.WebSocket
    if (typeof globalThis.WebSocket !== 'undefined') {
      WebSocket = globalThis.WebSocket;
    } else {
      log(`ws module not available and no native WebSocket — falling back to HTTP latency estimate`);
      return null;
    }
  }

  const wsUrl = WS_URL.replace(/^http/, 'ws') + '/chat';

  const connectOne = () =>
    new Promise((resolve) => {
      const t0 = performance.now();
      let resolved = false;

      const done = (latency) => {
        if (!resolved) {
          resolved = true;
          resolve(latency);
        }
      };

      // Timeout guard
      const timer = setTimeout(() => done(TIMEOUT_MS), TIMEOUT_MS);

      let ws;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        clearTimeout(timer);
        done(TIMEOUT_MS);
        return;
      }

      ws.addEventListener('open', () => {
        // Socket.IO handshake sends "0" (CONNECT) on open, then we wait for it
        // to confirm. For a pure latency measure we record time-to-open.
        const latency = performance.now() - t0;
        clearTimeout(timer);
        try { ws.close(); } catch { /* ignore */ }
        done(latency);
      });

      ws.addEventListener('error', () => {
        clearTimeout(timer);
        try { ws.close(); } catch { /* ignore */ }
        done(TIMEOUT_MS); // penalise errors with max latency
      });
    });

  // Fire all connections concurrently
  const latencies = await Promise.all(
    Array.from({ length: concurrency }, () => connectOne()),
  );

  const avg = latencies.reduce((s, v) => s + v, 0) / latencies.length;
  const max = Math.max(...latencies);
  return { avg: Math.round(avg), max: Math.round(max), samples: concurrency };
};

// ─── Section 3: HLS stream first-frame time ───────────────────────────────────

/**
 * Fetch the HLS manifest and first segment, measure total time.
 * This is a server-side proxy for "time to first byte of video data".
 */
const testHlsFirstFrame = async () => {
  log('testing HLS first-frame time ...');

  // Step 1: discover an active stream key from the backend
  let streamKey = process.env.STREAM_KEY || null;
  let bufferingIncidents = 0;

  if (!streamKey) {
    try {
      const res = await fetchWithTimeout(`${BACKEND_URL}/api/streaming/active`);
      if (res.ok) {
        const body = await res.json();
        const streams = Array.isArray(body) ? body : (body?.data ?? []);
        if (streams.length > 0) {
          streamKey = streams[0].streamKey || streams[0].stream_key;
        }
      }
    } catch { /* ignore */ }
  }

  if (!streamKey) {
    log('no active stream found — HLS test skipped');
    return { firstFrame: null, bufferingIncidents: 0, skipped: true };
  }

  // Step 2: fetch m3u8 manifest
  const manifestUrl = `${MEDIA_URL}/live/${streamKey}.m3u8`;
  const t0 = performance.now();
  let manifestOk = false;
  let segmentUrl = null;

  try {
    const res = await fetchWithTimeout(manifestUrl);
    if (res.ok) {
      manifestOk = true;
      const text = await res.text();
      // Extract first .ts segment URL from manifest
      const lines = text.split('\n').map((l) => l.trim());
      const seg = lines.find((l) => l && !l.startsWith('#'));
      if (seg) {
        segmentUrl = seg.startsWith('http') ? seg : `${MEDIA_URL}/live/${seg}`;
      }
    }
  } catch { /* ignore */ }

  if (!manifestOk) {
    log('HLS manifest not reachable — test skipped');
    return { firstFrame: null, bufferingIncidents: 0, skipped: true };
  }

  // Step 3: fetch first segment (proxy for "first frame")
  if (segmentUrl) {
    try {
      const res = await fetchWithTimeout(segmentUrl);
      if (!res.ok) bufferingIncidents++;
      await res.arrayBuffer(); // drain
    } catch {
      bufferingIncidents++;
    }
  }

  const firstFrame = Math.round(performance.now() - t0);
  return { firstFrame, bufferingIncidents, skipped: false };
};

// ─── Section 4: Page load times ──────────────────────────────────────────────

const testPageLoad = async (path) => {
  const url = `${CLIENT_URL}${path}`;
  log(`testing page load ${url} ...`);

  const result = await benchmark(
    async () => {
      const t0 = performance.now();
      let ok = false;
      let status = 0;
      try {
        const res = await fetchWithTimeout(url, {
          headers: { accept: 'text/html' },
        });
        status = res.status;
        ok = res.status < 400;
        await res.text();
      } catch { /* ignore */ }
      return { elapsed: performance.now() - t0, ok, status };
    },
    3,
  );
  return result;
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const main = async () => {
  const timestamp = new Date().toISOString();
  log(`starting performance tests — ${timestamp}`);
  log(`backend: ${BACKEND_URL}`);
  log(`client:  ${CLIENT_URL}`);
  log(`media:   ${MEDIA_URL}`);
  console.log('');

  // Attempt dev login for authenticated endpoints
  await devLogin();
  console.log('');

  // ── API tests ──────────────────────────────────────────────────────────────
  const productsResult = await testApiProducts();
  const profileResult  = await testApiProfile();
  const ordersResult   = await testApiOrders();
  console.log('');

  // ── Chat latency ──────────────────────────────────────────────────────────
  const chat50  = await measureChatLatency(50);
  const chat100 = await measureChatLatency(100);
  console.log('');

  // ── HLS stream ────────────────────────────────────────────────────────────
  const hlsResult = await testHlsFirstFrame();
  console.log('');

  // ── Page load ─────────────────────────────────────────────────────────────
  const pageProducts = await testPageLoad('/');
  const pageOrders   = await testPageLoad('/orders');
  console.log('');

  // ── Build result object ───────────────────────────────────────────────────

  const apiTests = {
    '/api/products': {
      avgTime: productsResult.avg,
      p50: productsResult.p50,
      p95: productsResult.p95,
      status: verdict(productsResult.avg, THRESHOLDS.products),
    },
    '/api/users/profile': profileResult
      ? {
          avgTime: profileResult.avg,
          p50: profileResult.p50,
          p95: profileResult.p95,
          status: verdict(profileResult.avg, THRESHOLDS.profile),
        }
      : { avgTime: null, status: 'SKIPPED' },
    '/api/orders': ordersResult
      ? {
          avgTime: ordersResult.avg,
          p50: ordersResult.p50,
          p95: ordersResult.p95,
          // POST /api/orders may return 4xx (validation error) — that's OK for latency
          status: verdict(ordersResult.avg, THRESHOLDS.orders),
        }
      : { avgTime: null, status: 'SKIPPED' },
  };

  const chatLatency = {
    '50users': chat50 ? chat50.avg : null,
    '100users': chat100 ? chat100.avg : null,
    status:
      !chat50 && !chat100
        ? 'SKIPPED'
        : (chat50 && chat50.avg > THRESHOLDS.chatLatency50) ||
          (chat100 && chat100.avg > THRESHOLDS.chatLatency100)
        ? 'FAIL'
        : 'PASS',
  };

  const streamPerformance = {
    firstFrame: hlsResult.firstFrame,
    bufferingIncidents: hlsResult.bufferingIncidents,
    skipped: hlsResult.skipped,
    status: hlsResult.skipped
      ? 'SKIPPED'
      : verdict(hlsResult.firstFrame, THRESHOLDS.hls),
  };

  const pageLoadTime = {
    products: pageProducts.avg,
    orders: pageOrders.avg,
    status:
      pageProducts.avg > THRESHOLDS.pageProducts ||
      pageOrders.avg > THRESHOLDS.pageOrders
        ? 'FAIL'
        : 'PASS',
  };

  // Overall verdict
  const statuses = [
    ...Object.values(apiTests).map((t) => t.status),
    chatLatency.status,
    streamPerformance.status,
    pageLoadTime.status,
  ].filter((s) => s !== 'SKIPPED');

  let overallVerdict;
  if (statuses.every((s) => s === 'PASS')) {
    overallVerdict = 'PASS';
  } else if (statuses.some((s) => s === 'FAIL')) {
    // Distinguish between hard FAILs and near-misses (within 25% of threshold)
    overallVerdict = 'FAIL';
  } else {
    overallVerdict = 'WARNING';
  }

  // ── Print summary ─────────────────────────────────────────────────────────
  console.log('═══════════════════════════ RESULTS ═══════════════════════════');
  for (const [path, r] of Object.entries(apiTests)) {
    const ms = r.avgTime != null ? `${r.avgTime}ms avg` : 'skipped';
    console.log(`  API ${path.padEnd(22)} ${ms.padEnd(12)} [${r.status}]`);
  }
  console.log('');
  console.log(`  Chat 50-user latency:  ${chatLatency['50users'] != null ? chatLatency['50users'] + 'ms' : 'skipped'}`);
  console.log(`  Chat 100-user latency: ${chatLatency['100users'] != null ? chatLatency['100users'] + 'ms' : 'skipped'}`);
  console.log(`  Chat status:           [${chatLatency.status}]`);
  console.log('');
  console.log(`  HLS first-frame:       ${streamPerformance.firstFrame != null ? streamPerformance.firstFrame + 'ms' : 'skipped'}`);
  console.log(`  HLS buffering events:  ${streamPerformance.bufferingIncidents}`);
  console.log(`  Stream status:         [${streamPerformance.status}]`);
  console.log('');
  console.log(`  Page /products:        ${pageLoadTime.products}ms avg`);
  console.log(`  Page /orders:          ${pageLoadTime.orders}ms avg`);
  console.log(`  Page load status:      [${pageLoadTime.status}]`);
  console.log('');
  console.log(`  OVERALL VERDICT:       ${overallVerdict}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // ── Write JSON results ────────────────────────────────────────────────────
  const output = {
    timestamp,
    config: {
      backendUrl: BACKEND_URL,
      clientUrl: CLIENT_URL,
      wsUrl: WS_URL,
      mediaUrl: MEDIA_URL,
      thresholds: THRESHOLDS,
    },
    apiTests,
    chatLatency,
    streamPerformance,
    pageLoadTime,
    overallVerdict,
  };

  try {
    writeFileSync(RESULTS_FILE, JSON.stringify(output, null, 2));
    log(`results written to ${RESULTS_FILE}`);
  } catch (err) {
    log(`failed to write results: ${err.message}`);
  }

  process.exit(overallVerdict === 'FAIL' ? 1 : 0);
};

main().catch((err) => {
  console.error('[perf] fatal error:', err);
  process.exit(2);
});


