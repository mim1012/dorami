#!/usr/bin/env node

/**
 * Streaming Soak Check
 */

import { execFile, exec } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { collectRedisMetrics } = require('./soak/collectors/redis.js');
const { collectPostgresMetrics } = require('./soak/collectors/postgres.js');
const { collectSrsMetrics } = require('./soak/collectors/srs.js');
const { collectNginxMetrics } = require('./soak/collectors/nginx.js');
const { collectHlsMetrics } = require('./soak/collectors/hls.js');
const { createWebsocketCollector } = require('./soak/collectors/websocket.js');
const { evaluateSnapshots } = require('./soak/analyzer.js');
const { printResult } = require('./soak/reporter.js');

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h || args['-h']) {
  printHelp();
  process.exit(0);
}

const baseUrl = args.url;
if (!baseUrl) {
  console.error('ERROR: --url is required');
  printHelp();
  process.exit(1);
}

const config = {
  url: baseUrl,
  duration: Number(args.duration ?? 3600),
  interval: Number(args.interval ?? 30),
  ingestDuration: Number(args['ingest-duration'] ?? args.duration ?? 3600),
  streamKey: args['stream-key'] ?? 'smoke-check',
  maxUsers: Number(args['max-users'] ?? 300),
  startIngest: toBool(args['start-ingest'], true),
  skipIngest: toBool(args['skip-ingest'], false),
  ingestCommandTemplate:
    args['ingest-command']
    ?? 'ffmpeg -re -stream_loop -1 -f lavfi -i testsrc=size=640x360:rate=15 -f lavfi -i sine=frequency=440:duration=3600 -c:v libx264 -preset ultrafast -g 50 -c:a aac -tune zerolatency -f flv',
  remote: {
    host: args['ssh-host'],
    user: args['ssh-user'] ?? process.env.USER ?? 'ubuntu',
    key: args['ssh-key'],
    port: Number(args['ssh-port'] ?? 22),
    workdir: args['ssh-workdir'] ?? '/opt/dorami',
  },
  compose: {
    base: args['compose-base'] || 'docker-compose.base.yml',
    overlay: args['compose-overlay'] || 'docker-compose.staging.yml',
  },
  containers: {
    redis: args['redis-container'] || 'redis',
    postgres: args['postgres-container'] || 'postgres',
    srs: args['srs-container'] || 'srs',
    nginx: args['nginx-container'] || 'nginx',
  },
  redis: {
    password: args['redis-password'],
    host: args['redis-host'] || '127.0.0.1',
    port: Number(args['redis-port'] || 6379),
  },
  postgres: {
    user: args['postgres-user'] || 'postgres',
    password: args['postgres-password'],
    database: args['postgres-db'] || 'live_commerce',
    host: args['postgres-host'] || '127.0.0.1',
    port: Number(args['postgres-port'] || 5432),
  },
  thresholds: {
    criticalRedisGrowthRate: Number(args['critical-redis-growth-rate'] ?? 30),
    criticalSrsCpuP95: Number(args['critical-srs-cpu-p95'] ?? 90),
    criticalSrsCpuDurationSec: Number(args['critical-srs-cpu-duration-sec'] ?? 180),
    criticalSegmentGrowthSec: Number(args['critical-segment-growth-sec'] ?? 60),
    warningReconnectMultiplier: Number(args['warning-ws-reconnect-multiplier'] ?? 2),
    warningPgActiveRatio: Number(args['warning-pg-active-ratio'] ?? 0.8),
    warningLimit: Number(args['warning-limit'] ?? 3),
  },
  timeoutMs: Number(args['timeout-ms'] ?? 15000),
  pollerHeaders: { 'User-Agent': 'dorami-soak-check/1.0' },
  output: args['output'],
};

if (!Number.isFinite(config.duration) || config.duration <= 0) {
  console.error('ERROR: --duration must be positive number');
  process.exit(1);
}
if (!Number.isFinite(config.interval) || config.interval <= 0) {
  console.error('ERROR: --interval must be positive number');
  process.exit(1);
}
if (!Number.isFinite(config.ingestDuration) || config.ingestDuration <= 0) {
  console.error('ERROR: --ingest-duration must be positive number');
  process.exit(1);
}

await main();

async function main() {
  const runner = createRunner(config.remote);
  const wsCollector = createWebsocketCollector({
    baseUrl: config.url,
    streamKey: config.streamKey,
    targetUsers: config.maxUsers,
    sampleWindowMs: 8000,
  });

  let ingestProcess = null;
  if (config.startIngest && !config.skipIngest) {
    ingestProcess = await startIngestStream(config, runner);
  }

  const iterations = Math.max(1, Math.floor(config.duration / config.interval));
  const snapshots = [];

  try {
    await wsCollector.start();
    for (let i = 0; i <= iterations; i += 1) {
      const snapshot = {
        index: i,
        timestamp: new Date().toISOString(),
      };

      const start = Date.now();
      snapshot.redis = await safeCollect('redis', () => collectRedisMetrics({
        run: runner.run,
        containerName: config.containers.redis,
        password: config.redis.password,
        host: config.redis.host,
        port: config.redis.port,
      }));

      snapshot.postgres = await safeCollect('postgres', () => collectPostgresMetrics({
        run: runner.run,
        containerName: config.containers.postgres,
        user: config.postgres.user,
        password: config.postgres.password,
        database: config.postgres.database,
        host: config.postgres.host,
        port: config.postgres.port,
      }));

      snapshot.srs = await safeCollect('srs', () => collectSrsMetrics({
        run: runner.run,
        containerName: config.containers.srs,
      }));

      snapshot.nginx = await safeCollect('nginx', () => collectNginxMetrics({
        run: runner.run,
        containerName: config.containers.nginx,
      }));

      snapshot.hls = await safeCollect('hls', () => collectHlsMetrics({
        url: config.url,
        streamKey: config.streamKey,
        timeoutMs: config.timeoutMs,
        headers: config.pollerHeaders,
      }));

      snapshot.websocket = await safeCollect('websocket', () => wsCollector.sampleSnapshot());

      snapshot.elapsedSec = Math.round((Date.now() - start) / 1000);
      snapshots.push(snapshot);

      console.log(formatSnapshotSummary(snapshot));
      if (i < iterations) {
        await sleep(config.interval * 1000);
      }
    }
  } finally {
    await wsCollector.stop();
    if (ingestProcess) {
      stopProcess(ingestProcess);
    }
  }

  const result = evaluateSnapshots(snapshots, config.thresholds);
  printResult({
    config,
    snapshots,
    result,
  });

  process.exitCode = result.status === 'PASS' ? 0 : 1;
}

function createRunner({ host, user, key, port, workdir }) {
  return {
    async run(command) {
      if (!host) {
        const { stdout } = await execLocal('bash', ['-lc', command]);
        return stdout;
      }

      const safeCommand = `cd ${shellQuote(workdir)} && ${command}`;
      const args = ['-p', String(port), '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no'];
      if (key) args.push('-i', key);
      args.push(`${user}@${host}`, safeCommand);
      const { stdout } = await execLocal('ssh', args);
      return stdout;
    },
  };
}

async function safeCollect(label, handler) {
  try {
    const result = await handler();
    return result;
  } catch (error) {
    return { error: `${label}: ${error?.message || String(error)}` };
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function printHelp() {
  console.log(`Usage:
node scripts/streaming-soak-check.mjs \
  --url <url> \
  --duration 3600 \
  --interval 30 \
  --ingest-duration 3600 \
  --stream-key smoke-check \
  --max-users 300 \
  --ssh-host <host> \
  --ssh-user <user> \
  --compose-base docker-compose.base.yml \
  --compose-overlay docker-compose.staging.yml`);
}

function formatSnapshotSummary(snapshot) {
  const redis = snapshot.redis?.usedMemory ?? 'na';
  const pg = snapshot.postgres?.activeConnections ?? 'na';
  const srs = snapshot.srs?.cpuPercent ?? 'na';
  const ws = snapshot.websocket?.successfulConnections ?? 'na';
  const hls = snapshot.hls?.segmentCount ?? 'na';
  return `#${snapshot.index}: redis=${redis} pg=${pg} srs=${srs}% ws=${ws} hls_seg=${hls}`;
}

async function execLocal(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    maxBuffer: 1024 * 1024 * 8,
    encoding: 'utf8',
    ...options,
  });
  return { stdout: String(result.stdout || '').trim(), stderr: String(result.stderr || '').trim() };
}

async function startIngestStream(cfg) {
  const ffmpegCheck = await execAsync('bash', ['-lc', 'command -v ffmpeg || true']);
  if (!String(ffmpegCheck.stdout || '').trim()) {
    console.warn('[warn] ffmpeg not found, skip ingest');
    return null;
  }

  const ingestUrl = buildRtmpUrl(cfg.url, cfg.streamKey);
  if (!ingestUrl) {
    console.warn('[warn] invalid target URL, skip ingest');
    return null;
  }

  const logFile = `/tmp/dorami-soak-ingest-${Date.now()}.log`;
  const fullDuration = Math.max(15, cfg.ingestDuration);
  const command = `${cfg.ingestCommandTemplate} "${ingestUrl}" -t ${fullDuration}`;
  const detached = `${command} > ${shellQuote(logFile)} 2>&1 < /dev/null & echo $!`;
  const { stdout } = await execAsync('bash', ['-lc', detached]);
  const pid = Number(String(stdout).trim());

  if (!pid || !Number.isFinite(pid)) {
    return null;
  }

  return { pid, logFile };
}

function stopProcess(handle) {
  if (!handle?.pid) return;
  try {
    process.kill(handle.pid, 'SIGTERM');
  } catch {
    // ignore
  }
}

function buildRtmpUrl(baseUrl, streamKey) {
  try {
    const parsed = new URL(baseUrl);
    const prefix = parsed.protocol.startsWith('https') ? 'rtmps' : 'rtmp';
    return `${prefix}://${parsed.hostname}:1935/live/${streamKey}`;
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

