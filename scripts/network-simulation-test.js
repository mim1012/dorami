#!/usr/bin/env node
/**
 * Network Simulation Test — Task #30
 *
 * Simulates degraded network conditions and measures impact on API responses:
 *   - 3G (1 Mbps throughput simulation via request delays)
 *   - High Latency (500ms added delay)
 *   - Packet Loss (5% simulated request failures)
 *   - Variable conditions (random jitter)
 *
 * Usage: node scripts/network-simulation-test.js [--url http://localhost:3001]
 *
 * No code changes — purely measures existing API behavior under degraded conditions.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const args = process.argv.slice(2);
const urlFlag = args.indexOf('--url');
const BASE_URL = urlFlag !== -1 ? args[urlFlag + 1] : (process.env.BASE_URL || 'http://localhost:3001');
const OUTPUT_DIR = path.join(__dirname, '..', 'reports');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'network-simulation-results.json');

// Endpoints to test
const ENDPOINTS = [
  { method: 'GET', path: '/api/health/live', name: 'Health (Liveness)' },
  { method: 'GET', path: '/api/health/ready', name: 'Health (Readiness)' },
  { method: 'GET', path: '/api/products', name: 'Product List' },
  { method: 'GET', path: '/api/streaming/active', name: 'Active Streams' },
];

// Network conditions
const CONDITIONS = [
  {
    name: 'Normal',
    description: 'No degradation',
    delayMs: 0,
    packetLossRate: 0,
    jitterMs: 0,
  },
  {
    name: '3G (1Mbps)',
    description: 'Simulated 3G with ~200ms latency per request',
    delayMs: 200,
    packetLossRate: 0,
    jitterMs: 50,
  },
  {
    name: 'High Latency (500ms)',
    description: '500ms added latency per request',
    delayMs: 500,
    packetLossRate: 0,
    jitterMs: 100,
  },
  {
    name: 'Packet Loss (5%)',
    description: '5% of requests simulated as dropped',
    delayMs: 50,
    packetLossRate: 0.05,
    jitterMs: 20,
  },
  {
    name: 'Variable (Jitter)',
    description: 'Random delay 0-800ms simulating unstable connection',
    delayMs: 200,
    packetLossRate: 0.02,
    jitterMs: 400,
  },
];

const REQUESTS_PER_CONDITION = 10;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addJitter(baseDelay, jitter) {
  return baseDelay + Math.floor(Math.random() * jitter * 2) - jitter;
}

function makeRequest(urlStr, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const parsedUrl = new URL(urlStr);
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const req = lib.get(urlStr, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          durationMs: Date.now() - start,
          success: res.statusCode >= 200 && res.statusCode < 400,
          bodyLength: body.length,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 0,
        durationMs: Date.now() - start,
        success: false,
        error: err.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        statusCode: 0,
        durationMs: Date.now() - start,
        success: false,
        error: 'timeout',
      });
    });
  });
}

function computeStats(durations) {
  if (durations.length === 0) return { avg: 0, min: 0, max: 0, p95: 0, p99: 0 };
  const sorted = [...durations].sort((a, b) => a - b);
  const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
  return {
    avg,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
    p99: sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1],
  };
}

async function runCondition(condition) {
  console.log(`\n--- ${condition.name}: ${condition.description} ---`);
  const results = [];

  for (const endpoint of ENDPOINTS) {
    const measurements = [];

    for (let i = 0; i < REQUESTS_PER_CONDITION; i++) {
      // Simulate packet loss
      if (Math.random() < condition.packetLossRate) {
        measurements.push({
          statusCode: 0,
          durationMs: 0,
          success: false,
          error: 'simulated_packet_loss',
        });
        continue;
      }

      // Simulate latency
      const delay = Math.max(0, addJitter(condition.delayMs, condition.jitterMs));
      if (delay > 0) await sleep(delay);

      const result = await makeRequest(`${BASE_URL}${endpoint.path}`);
      measurements.push(result);
    }

    const successCount = measurements.filter((m) => m.success).length;
    const durations = measurements.filter((m) => m.success).map((m) => m.durationMs);
    const stats = computeStats(durations);

    const endpointResult = {
      endpoint: endpoint.name,
      path: endpoint.path,
      successRate: `${Math.round((successCount / REQUESTS_PER_CONDITION) * 100)}%`,
      successCount,
      totalRequests: REQUESTS_PER_CONDITION,
      responseTime: stats,
    };

    results.push(endpointResult);
    console.log(
      `  ${endpoint.name}: ${endpointResult.successRate} success, ` +
      `avg=${stats.avg}ms, p95=${stats.p95}ms, max=${stats.max}ms`
    );
  }

  return {
    condition: condition.name,
    description: condition.description,
    results,
  };
}

async function main() {
  console.log('=== Network Simulation Test ===');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Requests per condition per endpoint: ${REQUESTS_PER_CONDITION}`);
  console.log(`Conditions: ${CONDITIONS.map((c) => c.name).join(', ')}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Verify server is reachable
  const healthCheck = await makeRequest(`${BASE_URL}/api/health/live`, 5000);
  if (!healthCheck.success) {
    console.error(`\nERROR: Server not reachable at ${BASE_URL}`);
    console.error('Start the backend first: npm run dev:backend');
    process.exit(1);
  }

  const allResults = [];
  for (const condition of CONDITIONS) {
    const result = await runCondition(condition);
    allResults.push(result);
  }

  // Impact analysis
  console.log('\n=== Impact Analysis ===');
  const normalResults = allResults.find((r) => r.condition === 'Normal');
  for (const condResult of allResults) {
    if (condResult.condition === 'Normal') continue;
    console.log(`\n${condResult.condition} vs Normal:`);
    for (const ep of condResult.results) {
      const normalEp = normalResults?.results.find((r) => r.path === ep.path);
      if (!normalEp || normalEp.responseTime.avg === 0) continue;
      const overhead = ep.responseTime.avg - normalEp.responseTime.avg;
      const factor = (ep.responseTime.avg / normalEp.responseTime.avg).toFixed(1);
      console.log(
        `  ${ep.endpoint}: +${overhead}ms (${factor}x), success: ${ep.successRate}`
      );
    }
  }

  // Save results
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    requestsPerCondition: REQUESTS_PER_CONDITION,
    conditions: allResults,
  };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
  console.log(`\nResults saved: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error('Network simulation failed:', err);
  process.exit(1);
});
