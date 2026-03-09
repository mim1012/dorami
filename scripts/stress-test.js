#!/usr/bin/env node
/**
 * Doremi Stress Test Script
 *
 * 점진적 부하 증가로 서버 한계점을 측정합니다.
 * 단계: 100 → 200 → 500 → 1000 사용자
 * 각 단계: 5분(300초)
 * 총 시간: 약 20분
 *
 * Usage:
 *   node scripts/stress-test.js [target_url]
 *
 * Example:
 *   node scripts/stress-test.js https://www.doremi-live.com
 *   node scripts/stress-test.js http://localhost:3001
 */

'use strict';

const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TARGET_URL = process.argv[2] || 'https://www.doremi-live.com';
const STAGE_DURATION_MS = 300_000; // 5 minutes per stage
const SAMPLE_INTERVAL_MS = 5_000;  // collect metrics every 5s
const REQUEST_TIMEOUT_MS = 10_000;
const OUTPUT_FILE = path.join(process.cwd(), 'stress-test-results.json');

const STAGES = [100, 200, 500, 1000]; // concurrent users per stage

// Thresholds for status classification
const WARN_AVG_MS = 2000;      // avg response > 2s = WARNING
const CRIT_AVG_MS = 5000;      // avg response > 5s = CRITICAL
const WARN_SUCCESS_RATE = 0.95; // <95% success = WARNING
const CRIT_SUCCESS_RATE = 0.80; // <80% success = CRITICAL

// Endpoints to hammer (public, read-only)
const ENDPOINTS = [
  '/api/health/live',
  '/api/health/ready',
  '/api/products?limit=10',
  '/api/streaming/active',
];

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/**
 * Single HTTP GET with timeout, returns { ok, status, durationMs }.
 */
function httpGet(urlStr) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;

    const req = lib.get(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        headers: { 'User-Agent': 'doremi-stress-test/1.0', Accept: 'application/json' },
        timeout: REQUEST_TIMEOUT_MS,
        // Reuse connections
        agent: url.protocol === 'https:'
          ? new https.Agent({ keepAlive: true, maxSockets: 200 })
          : new http.Agent({ keepAlive: true, maxSockets: 200 }),
      },
      (res) => {
        // Drain the body so the socket is released
        res.resume();
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 500,
            status: res.statusCode,
            durationMs: performance.now() - t0,
          });
        });
        res.on('error', () => {
          resolve({ ok: false, status: 0, durationMs: performance.now() - t0 });
        });
      },
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, durationMs: REQUEST_TIMEOUT_MS });
    });

    req.on('error', () => {
      resolve({ ok: false, status: 0, durationMs: performance.now() - t0 });
    });
  });
}

// ---------------------------------------------------------------------------
// Metrics accumulator
// ---------------------------------------------------------------------------

function createAccumulator() {
  return { total: 0, success: 0, sumMs: 0, maxMs: 0, samples: [] };
}

function recordResult(acc, result) {
  acc.total++;
  if (result.ok) acc.success++;
  acc.sumMs += result.durationMs;
  if (result.durationMs > acc.maxMs) acc.maxMs = result.durationMs;
}

function snapshotMetrics(acc) {
  const successRate = acc.total === 0 ? 1 : acc.success / acc.total;
  const avgMs = acc.total === 0 ? 0 : acc.sumMs / acc.total;
  return { successRate, avgMs, maxMs: acc.maxMs, total: acc.total };
}

// ---------------------------------------------------------------------------
// Stage runner
// ---------------------------------------------------------------------------

/**
 * Runs one stage: `concurrentUsers` virtual users each continuously
 * making requests for `durationMs` ms.
 *
 * Each VU picks a random endpoint, fires a request, waits for it to
 * complete, then immediately fires another — no think time — so this
 * represents maximum sustained pressure.
 *
 * Returns stage result object.
 */
async function runStage(stageIndex, concurrentUsers, durationMs) {
  const label = `Stage ${stageIndex + 1}/${STAGES.length} — ${concurrentUsers} users`;
  console.log(`\n[${new Date().toISOString()}] ${label} starting (${durationMs / 1000}s)...`);

  const acc = createAccumulator();
  const stageStart = Date.now();
  const stageEnd = stageStart + durationMs;

  // Per-interval snapshots for trend analysis
  const intervalSnapshots = [];
  let lastSnapshotAt = stageStart;
  let lastTotal = 0;

  // Abort flag
  let running = true;

  // Snapshot collector (fires every SAMPLE_INTERVAL_MS)
  const snapshotTimer = setInterval(() => {
    const now = Date.now();
    const snap = snapshotMetrics(acc);
    const rps = ((acc.total - lastTotal) / ((now - lastSnapshotAt) / 1000)).toFixed(1);
    lastTotal = acc.total;
    lastSnapshotAt = now;

    intervalSnapshots.push({
      elapsedS: Math.round((now - stageStart) / 1000),
      successRate: +snap.successRate.toFixed(4),
      avgMs: +snap.avgMs.toFixed(1),
      rps: +rps,
    });

    const pct = Math.min(100, Math.round(((now - stageStart) / durationMs) * 100));
    process.stdout.write(
      `\r  [${pct.toString().padStart(3)}%] req=${acc.total} ok=${acc.success} avg=${snap.avgMs.toFixed(0)}ms rps=${rps}   `,
    );
  }, SAMPLE_INTERVAL_MS);

  // Virtual user coroutines
  const vuWorkers = Array.from({ length: concurrentUsers }, async (_, vuId) => {
    // Stagger startup to avoid thundering herd
    await delay(Math.random() * 2000);

    while (running && Date.now() < stageEnd) {
      const endpoint = ENDPOINTS[vuId % ENDPOINTS.length];
      const result = await httpGet(TARGET_URL + endpoint);
      recordResult(acc, result);
    }
  });

  // Wait for stage duration
  await delay(durationMs);
  running = false;

  clearInterval(snapshotTimer);

  // Allow in-flight requests to finish (max 10s)
  await Promise.race([Promise.all(vuWorkers), delay(10_000)]);

  process.stdout.write('\n');

  const final = snapshotMetrics(acc);
  const status = classifyStatus(final.successRate, final.avgMs);

  console.log(
    `  -> successRate=${(final.successRate * 100).toFixed(2)}%  avgResponseTime=${final.avgMs.toFixed(0)}ms  maxResponseTime=${final.maxMs.toFixed(0)}ms  status=${status}`,
  );

  return {
    users: concurrentUsers,
    totalRequests: acc.total,
    successRequests: acc.success,
    successRate: `${(final.successRate * 100).toFixed(2)}%`,
    successRateNum: final.successRate,
    avgResponseTime: `${final.avgMs.toFixed(0)}ms`,
    avgResponseTimeMs: final.avgMs,
    maxResponseTime: `${final.maxMs.toFixed(0)}ms`,
    maxResponseTimeMs: final.maxMs,
    status,
    intervalSnapshots,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyStatus(successRate, avgMs) {
  if (successRate < CRIT_SUCCESS_RATE || avgMs > CRIT_AVG_MS) return 'CRITICAL';
  if (successRate < WARN_SUCCESS_RATE || avgMs > WARN_AVG_MS) return 'WARNING';
  return 'OK';
}

/**
 * Estimates max safe concurrent users from stage results.
 * The last stage that passed with OK status is the baseline;
 * if none passed OK, uses the best WARNING stage.
 */
function estimateMaxSafeUsers(stages) {
  const okStages = stages.filter((s) => s.status === 'OK');
  const warnStages = stages.filter((s) => s.status === 'WARNING');

  if (okStages.length > 0) {
    const best = okStages[okStages.length - 1];
    // Conservative: 80% of the last OK stage
    return Math.round(best.users * 0.8);
  }
  if (warnStages.length > 0) {
    const best = warnStages[warnStages.length - 1];
    return Math.round(best.users * 0.5);
  }
  // All stages critical — recommend under first stage level
  return Math.round(STAGES[0] * 0.3);
}

function computeSafetyMargin(stages, estimatedMax) {
  // Find the stage where things started degrading
  const critStage = stages.find((s) => s.status === 'CRITICAL');
  if (!critStage) {
    // Never hit critical — margin is vs last stage tested
    const lastStage = stages[stages.length - 1];
    const margin = ((lastStage.users - estimatedMax) / lastStage.users) * 100;
    return `${margin.toFixed(0)}% below last tested load`;
  }
  const margin = ((critStage.users - estimatedMax) / critStage.users) * 100;
  return `${margin.toFixed(0)}% below first CRITICAL stage (${critStage.users} users)`;
}

// ---------------------------------------------------------------------------
// Memory snapshot helper (process.memoryUsage if running locally)
// ---------------------------------------------------------------------------

function getMemoryMB() {
  const mem = process.memoryUsage();
  return {
    rss: +(mem.rss / 1_048_576).toFixed(1),
    heapUsed: +(mem.heapUsed / 1_048_576).toFixed(1),
    heapTotal: +(mem.heapTotal / 1_048_576).toFixed(1),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('='.repeat(60));
  console.log('  Doremi Stress Test');
  console.log('='.repeat(60));
  console.log(`  Target   : ${TARGET_URL}`);
  console.log(`  Stages   : ${STAGES.join(' -> ')} users`);
  console.log(`  Per stage: ${STAGE_DURATION_MS / 1000}s`);
  console.log(`  Endpoints: ${ENDPOINTS.join(', ')}`);
  console.log(`  Output   : ${OUTPUT_FILE}`);
  console.log('='.repeat(60));
  console.log('\nWARNING: This test sends sustained high load to the target server.');
  console.log('Only run against systems you have permission to test.\n');
  console.log('Starting in 5 seconds... (Ctrl+C to abort)\n');

  await delay(5_000);

  const runStart = new Date().toISOString();
  const stageResults = [];
  const memoryAtStageStart = [];

  for (let i = 0; i < STAGES.length; i++) {
    const users = STAGES[i];

    memoryAtStageStart.push({ stage: users, scriptMemoryMB: getMemoryMB() });

    const result = await runStage(i, users, STAGE_DURATION_MS);
    stageResults.push(result);

    // If CRITICAL, we can optionally continue to next stage to observe further
    // The spec requires all 4 stages so we always proceed.
    if (result.status === 'CRITICAL') {
      console.log(`  [!] Stage ${i + 1} is CRITICAL — continuing to next stage to map degradation curve.`);
    }

    // Brief cooldown between stages to let server recover
    if (i < STAGES.length - 1) {
      console.log('\n  Cooling down 10s before next stage...');
      await delay(10_000);
    }
  }

  const runEnd = new Date().toISOString();
  const estimatedMaxSafeUsers = estimateMaxSafeUsers(stageResults);
  const safetyMargin = computeSafetyMargin(stageResults, estimatedMaxSafeUsers);

  // Build output
  const output = {
    timestamp: runStart,
    completedAt: runEnd,
    targetUrl: TARGET_URL,
    stageDurationSeconds: STAGE_DURATION_MS / 1000,
    stages: stageResults.map((s) => ({
      users: s.users,
      totalRequests: s.totalRequests,
      successRequests: s.successRequests,
      successRate: s.successRate,
      avgResponseTime: s.avgResponseTime,
      maxResponseTime: s.maxResponseTime,
      status: s.status,
    })),
    estimatedMaxSafeUsers,
    safetyMargin,
    details: {
      thresholds: {
        warnAvgResponseMs: WARN_AVG_MS,
        critAvgResponseMs: CRIT_AVG_MS,
        warnSuccessRate: `${(WARN_SUCCESS_RATE * 100).toFixed(0)}%`,
        critSuccessRate: `${(CRIT_SUCCESS_RATE * 100).toFixed(0)}%`,
      },
      perStageSnapshots: stageResults.map((s) => ({
        users: s.users,
        intervalSnapshots: s.intervalSnapshots,
      })),
      scriptMemoryMB: memoryAtStageStart,
    },
  };

  // Write JSON
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('  STRESS TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`  ${'Users'.padEnd(8)} ${'Success'.padEnd(10)} ${'Avg RT'.padEnd(12)} ${'Max RT'.padEnd(12)} Status`);
  console.log('  ' + '-'.repeat(54));
  for (const s of stageResults) {
    const indicator = s.status === 'OK' ? '[OK]' : s.status === 'WARNING' ? '[WARN]' : '[CRIT]';
    console.log(
      `  ${String(s.users).padEnd(8)} ${s.successRate.padEnd(10)} ${s.avgResponseTime.padEnd(12)} ${s.maxResponseTime.padEnd(12)} ${indicator}`,
    );
  }
  console.log('  ' + '-'.repeat(54));
  console.log(`  Estimated max safe users : ${estimatedMaxSafeUsers}`);
  console.log(`  Safety margin            : ${safetyMargin}`);
  console.log(`  Results saved to         : ${OUTPUT_FILE}`);
  console.log('='.repeat(60) + '\n');
}

main().catch((err) => {
  console.error('Stress test failed:', err);
  process.exit(1);
});


