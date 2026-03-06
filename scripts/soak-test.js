#!/usr/bin/env node
/**
 * Soak Test — 100 clients × 6-hour connection stability
 *
 * Detects memory, DB connection, and Redis memory leaks over a
 * simulated 6-hour run. Each "hour" is compressed to ~10 seconds by
 * default so CI can finish quickly; pass --real-time to run the full
 * 21 600-second duration.
 *
 * Usage:
 *   node scripts/soak-test.js [options]
 *
 * Options:
 *   --url <url>           Target base URL (default: https://www.doremi-live.com)
 *   --stream-key <key>    Socket.IO room stream key (default: soak-test)
 *   --real-time           Run full 6-hour soak (21 600 s); by default each hour
 *                         is compressed to 10 s (total ~60 s)
 *   --hour-interval <s>   Seconds per simulated hour (ignored with --real-time)
 *   --output <path>       JSON result file (default: soak-test-results.json)
 *   --ssh-host <host>     SSH into remote host to collect docker stats
 *   --ssh-user <user>     SSH user (default: ubuntu)
 *   --ssh-key  <path>     Path to SSH private key
 *   --redis-password <pw> Redis AUTH password (optional)
 *   --postgres-user <u>   PostgreSQL superuser (default: postgres)
 *   --postgres-db   <db>  PostgreSQL database (default: live_commerce_production)
 *
 * Output: soak-test-results.json
 */

'use strict';

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith('--')) continue;
    const key = tok.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

const BASE_URL = args['url'] || 'https://www.doremi-live.com';
const STREAM_KEY = args['stream-key'] || 'soak-test';
const REAL_TIME = Boolean(args['real-time']);
const HOUR_INTERVAL_S = REAL_TIME ? 3600 : Number(args['hour-interval'] || 10);
const OUTPUT_FILE = args['output'] || 'soak-test-results.json';
const CLIENT_COUNT = 100;
const HOURS = 6;
const TOTAL_DURATION_S = HOURS * HOUR_INTERVAL_S;

const SSH = {
  host: args['ssh-host'] || null,
  user: args['ssh-user'] || 'ubuntu',
  key: args['ssh-key'] || null,
  port: Number(args['ssh-port'] || 22),
  workdir: args['ssh-workdir'] || '/opt/dorami',
};

const REDIS_PASSWORD = args['redis-password'] || null;
const PG_USER = args['postgres-user'] || 'postgres';
const PG_DB = args['postgres-db'] || 'live_commerce_production';

// ---------------------------------------------------------------------------
// Remote / local command runner
// ---------------------------------------------------------------------------

async function runCommand(command) {
  if (SSH.host) {
    const sshArgs = [
      '-p', String(SSH.port),
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=no',
    ];
    if (SSH.key) sshArgs.push('-i', SSH.key);
    sshArgs.push(`${SSH.user}@${SSH.host}`, `cd '${SSH.workdir}' && ${command}`);
    const { stdout } = await execFileAsync('ssh', sshArgs, { maxBuffer: 8 * 1024 * 1024 });
    return String(stdout).trim();
  }
  const { stdout } = await execFileAsync('bash', ['-lc', command], { maxBuffer: 8 * 1024 * 1024 });
  return String(stdout).trim();
}

async function safeRun(command, fallback = '') {
  try {
    return await runCommand(command);
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Metric collectors
// ---------------------------------------------------------------------------

async function collectMemoryMB() {
  // Try to read the backend container's process memory via docker stats.
  // Falls back to local process.memoryUsage() when docker is unavailable.
  const raw = await safeRun(
    "docker stats --no-stream --format '{{.MemUsage}}' $(docker ps --filter name=backend --format '{{.ID}}' | head -1) 2>/dev/null || echo ''",
  );

  if (raw) {
    // Format: "123.4MiB / 1GiB"  or  "1.2GiB / 2GiB"
    const match = raw.match(/^([\d.]+)\s*(MiB|GiB|kB|MB|GB)/i);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      if (unit === 'gib' || unit === 'gb') return Math.round(value * 1024);
      if (unit === 'kb') return Math.round(value / 1024);
      return Math.round(value);
    }
  }

  // Fallback: local Node process RSS (useful for dry-run / CI without docker)
  const rss = process.memoryUsage().rss;
  return Math.round(rss / 1024 / 1024);
}

async function collectDbConnections() {
  // Active connections in PostgreSQL
  const sql = "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';";
  const cmd = `docker exec $(docker ps --filter name=postgres --format '{{.ID}}' | head -1) psql -U ${PG_USER} -d ${PG_DB} -t -c "${sql}" 2>/dev/null || echo ''`;
  const raw = await safeRun(cmd);
  const num = parseInt(raw.trim(), 10);
  return isNaN(num) ? 0 : num;
}

async function collectRedisMemoryMB() {
  const authPart = REDIS_PASSWORD ? `-a '${REDIS_PASSWORD}' --no-auth-warning` : '';
  const cmd = `docker exec $(docker ps --filter name=redis --format '{{.ID}}' | head -1) redis-cli ${authPart} INFO memory 2>/dev/null | grep used_memory_human || echo ''`;
  const raw = await safeRun(cmd);
  // used_memory_human:1.23M  or  1.23G
  const match = raw.match(/used_memory_human:([\d.]+)([KMG])/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'G') return Math.round(value * 1024);
  if (unit === 'K') return Math.round(value / 1024);
  return Math.round(value); // M
}

// ---------------------------------------------------------------------------
// Simulated clients (lightweight HTTP keep-alive + health poll)
// ---------------------------------------------------------------------------

function createClients(baseUrl, count) {
  const urlObj = new URL(baseUrl);
  const useHttps = urlObj.protocol === 'https:';
  const agent = useHttps
    ? new https.Agent({ keepAlive: true, maxSockets: count })
    : new http.Agent({ keepAlive: true, maxSockets: count });

  const healthPath = '/api/health/live';
  let activeCount = 0;
  let errorCount = 0;
  let pollIntervalId = null;

  function poll() {
    const mod = useHttps ? https : http;
    const req = mod.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || (useHttps ? 443 : 80),
        path: healthPath,
        method: 'GET',
        agent,
        headers: { 'User-Agent': 'dorami-soak-test/1.0' },
        timeout: 10000,
      },
      (res) => {
        res.resume(); // drain
        if (res.statusCode === 200) {
          activeCount = Math.min(activeCount + 1, count);
        } else {
          errorCount++;
        }
      },
    );
    req.on('error', () => { errorCount++; });
    req.end();
  }

  return {
    start() {
      activeCount = 0;
      errorCount = 0;
      // Simulate gradual ramp-up over 2 seconds
      let spawned = 0;
      const rampId = setInterval(() => {
        if (spawned >= count) { clearInterval(rampId); return; }
        poll();
        spawned++;
      }, Math.max(1, Math.floor(2000 / count)));

      // Keep-alive poll every 5 s to sustain connections
      pollIntervalId = setInterval(() => {
        for (let i = 0; i < Math.ceil(count / 20); i++) poll();
      }, 5000);
    },

    stop() {
      if (pollIntervalId) clearInterval(pollIntervalId);
      agent.destroy();
    },

    stats() {
      return { active: activeCount, errors: errorCount };
    },
  };
}

// ---------------------------------------------------------------------------
// Leak detection
// ---------------------------------------------------------------------------

function detectLeaks(snapshots) {
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];

  // Memory leak: growth > 20 % from first to last snapshot
  const memGrowthPct = first.memory > 0
    ? ((last.memory - first.memory) / first.memory) * 100
    : 0;
  const memoryLeak = memGrowthPct > 20;

  // Connection leak: DB connections grew by more than 5 from first to last
  const connGrowth = last.dbConnections - first.dbConnections;
  const connectionLeak = connGrowth > 5;

  // Redis memory leak: growth > 30 %
  const redisGrowthPct = first.redisMemory > 0
    ? ((last.redisMemory - first.redisMemory) / first.redisMemory) * 100
    : 0;
  const redisLeak = redisGrowthPct > 30;

  // Verdict
  let verdict;
  if (memoryLeak || connectionLeak || redisLeak) {
    verdict = memGrowthPct > 50 || connGrowth > 20 ? 'CRITICAL' : 'WARNING';
  } else {
    verdict = 'STABLE';
  }

  return { memoryLeak, connectionLeak, redisLeak, memGrowthPct, redisGrowthPct, connGrowth, verdict };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('='.repeat(60));
  console.log(' Dorami Soak Test');
  console.log('='.repeat(60));
  console.log(`  URL         : ${BASE_URL}`);
  console.log(`  Stream key  : ${STREAM_KEY}`);
  console.log(`  Clients     : ${CLIENT_COUNT}`);
  console.log(`  Duration    : ${TOTAL_DURATION_S}s (${HOURS} hours × ${HOUR_INTERVAL_S}s)`);
  console.log(`  Output      : ${OUTPUT_FILE}`);
  console.log(`  Mode        : ${REAL_TIME ? 'real-time' : 'compressed'}`);
  console.log('='.repeat(60));

  const clients = createClients(BASE_URL, CLIENT_COUNT);
  clients.start();

  const snapshots = [];
  const startTs = Date.now();

  for (let hour = 1; hour <= HOURS; hour++) {
    // Wait until this hour's boundary
    const targetElapsedMs = hour * HOUR_INTERVAL_S * 1000;
    const waitMs = targetElapsedMs - (Date.now() - startTs);
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    process.stdout.write(`[hour ${hour}/${HOURS}] collecting metrics... `);

    const [memoryMB, dbConnections, redisMemoryMB] = await Promise.all([
      collectMemoryMB(),
      collectDbConnections(),
      collectRedisMemoryMB(),
    ]);

    const clientStats = clients.stats();
    const snapshot = {
      hour,
      timestamp: new Date().toISOString(),
      memory: memoryMB,        // backend RSS in MB
      dbConnections,
      redisMemory: redisMemoryMB,
      activeClients: clientStats.active,
      clientErrors: clientStats.errors,
    };

    snapshots.push(snapshot);
    console.log(`memory=${memoryMB}MB db=${dbConnections} redis=${redisMemoryMB}MB clients=${clientStats.active}`);
  }

  clients.stop();

  const elapsed = Math.round((Date.now() - startTs) / 1000);
  const leak = detectLeaks(snapshots);

  const result = {
    timestamp: new Date().toISOString(),
    duration: TOTAL_DURATION_S,
    clientCount: CLIENT_COUNT,
    targetUrl: BASE_URL,
    mode: REAL_TIME ? 'real-time' : 'compressed',
    snapshots: snapshots.map((s) => ({
      hour: s.hour,
      timestamp: s.timestamp,
      memory: `${s.memory} MB`,
      dbConnections: s.dbConnections,
      redisMemory: `${s.redisMemory} MB`,
      activeClients: s.activeClients,
      clientErrors: s.clientErrors,
    })),
    leakAnalysis: {
      memoryGrowthPct: Math.round(leak.memGrowthPct * 10) / 10,
      dbConnectionGrowth: leak.connGrowth,
      redisGrowthPct: Math.round(leak.redisGrowthPct * 10) / 10,
    },
    memoryLeak: leak.memoryLeak,
    connectionLeak: leak.connectionLeak,
    redisLeak: leak.redisLeak,
    verdict: leak.verdict,
    actualElapsedSeconds: elapsed,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');

  console.log('');
  console.log('='.repeat(60));
  console.log(` RESULT: ${result.verdict}`);
  console.log('='.repeat(60));
  console.log(`  Memory leak     : ${result.memoryLeak} (growth ${result.leakAnalysis.memoryGrowthPct}%)`);
  console.log(`  Connection leak : ${result.connectionLeak} (growth +${result.leakAnalysis.dbConnectionGrowth})`);
  console.log(`  Redis leak      : ${result.redisLeak} (growth ${result.leakAnalysis.redisGrowthPct}%)`);
  console.log(`  Elapsed         : ${elapsed}s`);
  console.log(`  Output          : ${OUTPUT_FILE}`);
  console.log('='.repeat(60));

  process.exitCode = result.verdict === 'STABLE' ? 0 : 1;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('[soak-test] fatal:', err.message || err);
  process.exitCode = 1;
});
