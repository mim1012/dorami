#!/usr/bin/env node

/**
 * Streaming parity check between two environments (staging/prod).
 *
 * Usage:
 *   node scripts/streaming-parity-check.mjs \
 *     --staging-url https://staging.example.com \
 *     --production-url https://www.example.com \
 *     --stream-key smoke-check
 *
 * 목표:
 * - 스테이징에서 통과한 검사 항목을 본서버에서도 동일하게 재현되는지 점수화한다.
 * - 100점 기준 90점 이상을 통과 기준으로 권장한다.
 */

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((arg, i, arr) => ({ arg, i }))
    .filter(({ arg }) => arg.startsWith('--'))
    .map(({ arg, i, arr }) => {
      const key = arg.replace(/^--/, '');
      const value = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true';
      return [key, value];
    }),
);

const stagingBase = args['staging-url'];
const productionBase = args['production-url'];
const streamKey = args['stream-key'] ?? 'smoke-check';
const timeoutMs = Number(args.timeout ?? 8000);
const maxLatencyMs = Number(args['max-latency-ms'] ?? 2500);

if (!stagingBase || !productionBase) {
  console.error('사용법: node scripts/streaming-parity-check.mjs --staging-url <URL> --production-url <URL> [--stream-key <키>]');
  process.exit(1);
}

const checks = [
  {
    key: 'health_html',
    name: 'Nginx Health',
    path: '/health',
    expectStatuses: new Set([200]),
    requires: true,
    weight: 14,
    comparePolicy: 'status',
    maxLatencyMs,
  },
  {
    key: 'api_health',
    name: 'API Health Live',
    path: '/api/health/live',
    expectStatuses: new Set([200]),
    requires: true,
    weight: 14,
    comparePolicy: 'status',
    maxLatencyMs,
  },
  {
    key: 'public_live_page',
    name: 'Live Page',
    path: '/live',
    expectStatuses: new Set([200, 301, 302, 307, 308]),
    requires: true,
    weight: 12,
    comparePolicy: 'status',
    maxLatencyMs,
  },
  {
    key: 'stream_flv_route',
    name: 'HTTP-FLV Route',
    path: `/live/live/${streamKey}.flv`,
    expectStatuses: new Set([200, 206, 302, 303, 307, 308, 404, 405]),
    forbiddenStatuses: new Set([500, 502, 503, 504]),
    requires: true,
    weight: 18,
    comparePolicy: 'not_forbidden',
    maxLatencyMs,
  },
  {
    key: 'stream_hls_route',
    name: 'HLS Route',
    path: `/hls/${streamKey}.m3u8`,
    expectStatuses: new Set([200, 404, 302, 307, 308, 405]),
    forbiddenStatuses: new Set([500, 502, 503, 504]),
    requires: true,
    weight: 18,
    comparePolicy: 'not_forbidden',
    maxLatencyMs,
  },
  {
    key: 'socket_io_probe',
    name: 'Socket.IO Polling Probe',
    path: '/socket.io/?EIO=4&transport=polling',
    expectStatuses: new Set([200, 400, 403]),
    requires: false,
    weight: 12,
    comparePolicy: 'status',
    maxLatencyMs,
  },
  {
    key: 'frontend_api_route',
    name: 'Frontend API Proxy',
    path: '/api/products',
    expectStatuses: new Set([200, 401, 403]),
    requires: false,
    weight: 12,
    comparePolicy: 'status',
    maxLatencyMs,
  },
];

function normalizeUrl(base, path) {
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
}

async function requestWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const started = Date.now();

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json, text/plain, */*',
      },
    });
    const elapsedMs = Date.now() - started;
    return {
      status: res.status,
      elapsedMs,
      headers: {
        'cache-control': res.headers.get('cache-control') || '',
        'content-type': res.headers.get('content-type') || '',
        'x-cache': res.headers.get('x-cache') || '',
      },
      ok: true,
    };
  } catch (error) {
    return {
      status: 0,
      elapsedMs: Date.now() - started,
      headers: {},
      ok: false,
      error: error?.name === 'AbortError' ? `TIMEOUT ${timeout}ms` : String(error?.message || error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function isStatusAllowed(result, check) {
  if (check.forbiddenStatuses && check.forbiddenStatuses.has(result.status)) return false;
  return check.expectStatuses.has(result.status);
}

async function runSuite(label, baseUrl) {
  const rows = [];
  for (const check of checks) {
    const url = normalizeUrl(baseUrl, check.path);
    const result = await requestWithTimeout(url, timeoutMs);
    const pass = result.ok && isStatusAllowed(result, check) && result.elapsedMs <= check.maxLatencyMs;
    rows.push({
      key: check.key,
      name: check.name,
      url,
      pass,
      status: result.status,
      elapsedMs: result.elapsedMs,
      headers: result.headers,
      requires: check.requires,
      error: result.error,
      weight: check.weight,
    });
  }
  return rows;
}

function calcScore(stagingRows, productionRows) {
  let weightedSum = 0;
  let weightedPass = 0;
  let requiresPassed = true;

  const details = checks.map((check, idx) => {
    const s = stagingRows[idx];
    const p = productionRows[idx];
    const stagingPass = !!s.pass;
    const productionPass = !!p.pass;
    const parityRawPass =
      stagingPass === productionPass &&
      s.status === p.status &&
      (s.elapsedMs <= maxLatencyMs && p.elapsedMs <= maxLatencyMs) &&
      Math.abs(s.elapsedMs - p.elapsedMs) <= Math.max(200, maxLatencyMs * 0.4);

    const effectivePass = parityRawPass && stagingPass;
    if (check.requires && !effectivePass) {
      requiresPassed = false;
    }

    weightedSum += check.weight;
    if (effectivePass) weightedPass += check.weight;

    return {
      key: check.key,
      name: check.name,
      checkType: 'parity',
      weight: check.weight,
      pass: effectivePass,
      stagingStatus: s.status,
      productionStatus: p.status,
      stagingLatency: s.elapsedMs,
      productionLatency: p.elapsedMs,
      stagingHeaderCache: s.headers['cache-control'] || '-',
      productionHeaderCache: p.headers['cache-control'] || '-',
      stagingError: s.error || null,
      productionError: p.error || null,
    };
  });

  const score = weightedSum === 0 ? 0 : Math.round((weightedPass / weightedSum) * 100);
  return { score, requiresPassed, details };
}

function padRight(value, width) {
  const text = String(value);
  return text.padEnd(width, ' ');
}

async function main() {
  const staging = await runSuite('staging', stagingBase);
  const production = await runSuite('production', productionBase);
  const summary = calcScore(staging, production);

  console.log('\n=== Streaming Parity Check ===');
  console.log(`Staging:     ${stagingBase}`);
  console.log(`Production:  ${productionBase}`);
  console.log(`Stream key:  ${streamKey}`);
  console.log(`Timeout:     ${timeoutMs}ms`);
  console.log(`Threshold:   ${maxLatencyMs}ms`);
  console.log(`총점: ${summary.score} / 100`);
  console.log(`핵심필수항목: ${summary.requiresPassed ? 'PASS' : 'FAIL'}`);
  console.log('상태 코드 (스테이징 / 본서버):');
  console.table(summary.details.map((row) => ({
    항목: row.name,
    가중치: row.weight,
    통과: row.pass ? 'PASS' : 'FAIL',
    스테이징: `${row.stagingStatus} ${row.stagingLatency}ms`,
    본서버: `${row.productionStatus} ${row.productionLatency}ms`,
    캐시헤더_스테이징: row.stagingHeaderCache,
    캐시헤더_본서버: row.productionHeaderCache,
    스테이징오류: row.stagingError || '',
    본서버오류: row.productionError || '',
  })));

  const pass = summary.score >= 90 && summary.requiresPassed;
  if (pass) {
    console.log('\nRESULT: PASS (재현성 목표 90% 이상 충족)');
    process.exit(0);
  }

  console.log('\nRESULT: FAIL (재현성 미달)');
  process.exit(1);
}

main().catch((error) => {
  console.error('Parity check failed:', error);
  process.exit(1);
});

