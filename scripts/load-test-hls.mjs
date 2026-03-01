#!/usr/bin/env node
/**
 * Phase 1: HLS Bandwidth Load Test
 * 동시 HLS 시청자 증가 테스트 (100 → 200 → 300)
 *
 * Usage:
 *   node scripts/load-test-hls.mjs [staging_url] [stream_key] [duration_per_phase]
 *
 * Example:
 *   node scripts/load-test-hls.mjs https://staging.doremi-live.com stream-key 60
 */

import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STAGING_URL = process.argv[2] || 'https://staging.doremi-live.com';
const STREAM_KEY = process.argv[3] || 'smoke-check';
const DURATION_PER_PHASE = parseInt(process.argv[4] || '60', 10);

const PHASES = [
  { concurrency: 50, label: '50 viewers' },
  { concurrency: 100, label: '100 viewers' },
  { concurrency: 150, label: '150 viewers' },
  { concurrency: 200, label: '200 viewers' },
  { concurrency: 250, label: '250 viewers' },
  { concurrency: 300, label: '300 viewers' },
];

const HLS_URL = `${STAGING_URL}/hls/${STREAM_KEY}.m3u8`;
const HTTP_FLV_URL = `${STAGING_URL}/live/live/${STREAM_KEY}.flv`;

console.log(`
╔════════════════════════════════════════════════════════╗
║           HLS Bandwidth Load Test (Phase 1)            ║
╚════════════════════════════════════════════════════════╝

📊 Test Configuration:
  URL: ${STAGING_URL}
  Stream Key: ${STREAM_KEY}
  Duration per phase: ${DURATION_PER_PHASE}s

🎯 Phases:
${PHASES.map((p) => `  ${p.concurrency.toString().padStart(3)} concurrent viewers`).join('\n')}

📈 Metrics to Monitor:
  1. HTTP response time (p95, p99)
  2. 5xx error rate
  3. Network bandwidth (docker stats srs)
  4. Nginx connection count
  5. HLS segment fetch time
`);

async function runAbTest(concurrency, phase, totalPhases) {
  return new Promise((resolve) => {
    console.log(`\n[${phase}/${totalPhases}] Starting Phase: ${concurrency} concurrent users...`);

    const logFile = createWriteStream(`/tmp/ab-phase-${concurrency}.log`, { flags: 'a' });
    const startTime = Date.now();

    const ab = spawn('ab', [
      '-c', concurrency.toString(),
      '-t', DURATION_PER_PHASE.toString(),
      '-r', // Don't exit on socket receive errors
      '-n', (concurrency * 10).toString(), // Total requests
      HLS_URL,
    ]);

    let output = '';
    ab.stdout.on('data', (data) => {
      output += data.toString();
      logFile.write(data);
    });

    ab.stderr.on('data', (data) => {
      console.error(`[ab error] ${data}`);
    });

    ab.on('close', (code) => {
      const duration = (Date.now() - startTime) / 1000;
      logFile.end();

      // Parse results
      const results = parseAbOutput(output);

      console.log(`\n✅ Phase ${concurrency} Complete (${duration.toFixed(1)}s)`);
      console.log(`   Requests: ${results.requests}`);
      console.log(`   Failed: ${results.failed}`);
      console.log(`   Request/sec: ${results.rps.toFixed(1)}`);
      console.log(`   Mean time: ${results.meanTime.toFixed(1)}ms`);
      console.log(`   p95 time: ${results.p95Time.toFixed(1)}ms (estimated)`);
      console.log(`   Error rate: ${(results.failed / (results.requests + results.failed) * 100).toFixed(2)}%`);

      resolve(results);
    });
  });
}

function parseAbOutput(output) {
  const requests = parseInt(output.match(/^Requests per second:\s*([\d.]+)/m)?.[1] || '0', 10);
  const meanTime = parseFloat(output.match(/^Time per request:\s*([\d.]+)/m)?.[1] || '0');
  const failed = parseInt(output.match(/^Failed requests:\s*(\d+)/m)?.[1] || '0');
  const total = parseInt(output.match(/^This is ApacheBench/);

  return {
    requests,
    failed,
    rps: requests,
    meanTime,
    p95Time: meanTime * 1.5, // Rough estimate
  };
}

async function runMonitoring() {
  console.log(`
\n📡 MONITORING (run in another terminal):

  # Docker stats
  docker stats srs --no-stream

  # Nginx error log
  docker compose -f docker-compose.base.yml -f docker-compose.staging.yml logs -f nginx | grep -E "5[0-9]{2}|upstream"

  # Backend metrics
  docker compose -f docker-compose.base.yml -f docker-compose.staging.yml stats backend

  # Redis memory
  docker compose -f docker-compose.base.yml -f docker-compose.staging.yml exec redis redis-cli INFO memory
`);
}

async function main() {
  await runMonitoring();

  console.log(`\n⏱️  Starting in 5 seconds...`);
  await new Promise((r) => setTimeout(r, 5000));

  const results = [];

  for (let i = 0; i < PHASES.length; i++) {
    const phase = PHASES[i];
    const result = await runAbTest(phase.concurrency, i + 1, PHASES.length);
    results.push({ concurrency: phase.concurrency, ...result });

    // Wait 10 seconds before next phase
    if (i < PHASES.length - 1) {
      console.log(`\n⏳ Cooling down (10s)...`);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }

  // Summary
  console.log(`
╔════════════════════════════════════════════════════════╗
║                    TEST SUMMARY                        ║
╚════════════════════════════════════════════════════════╝
`);

  console.table(results.map((r) => ({
    'Concurrency': r.concurrency,
    'Requests': r.requests,
    'Failed': r.failed,
    'Error %': `${(r.failed / (r.requests + r.failed) * 100).toFixed(2)}%`,
    'RPS': r.rps.toFixed(1),
    'Mean (ms)': r.meanTime.toFixed(1),
    'p95 (ms)': r.p95Time.toFixed(1),
  })));

  // Find breaking point
  const breaking = results.find((r) => r.failed > r.requests * 0.01);
  if (breaking) {
    console.log(`\n⚠️  Breaking Point: ${breaking.concurrency} concurrent users (${(breaking.failed / (breaking.requests + breaking.failed) * 100).toFixed(2)}% failure rate)`);
  } else {
    console.log(`\n✅ All phases passed with < 1% failure rate`);
  }

  console.log(`\n📊 Logs saved to: /tmp/ab-phase-*.log`);
}

main().catch(console.error);
