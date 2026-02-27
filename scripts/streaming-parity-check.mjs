#!/usr/bin/env node

/**
 * streaming-parity-check.mjs
 *
 * Usage:
 *   node scripts/streaming-parity-check.mjs \
 *     --staging-url https://staging.example.com \
 *     --production-url https://www.example.com \
 *     --stream-key smoke-check \
 *     --collect-metadata true \
 *     --require-metadata true \
 *     --staging-ssh-host <host> \
 *     --production-ssh-host <host>
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';

const execAsync = promisify(execFile);

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h || args['-h']) {
  printHelp();
  process.exit(0);
}

const STAGING_BASE_COMPOSE = 'docker-compose.base.yml';
const STAGING_OVERLAY_COMPOSE = 'docker-compose.staging.yml';
const PRODUCTION_OVERLAY_COMPOSE = 'docker-compose.prod.yml';
const DEFAULT_WORKDIR = '/opt/dorami';
const DEFAULT_NGINX_COMMON_INCLUDE = 'nginx/streaming-routing.conf';
const METADATA_SERVICES = ['backend', 'frontend', 'nginx', 'srs', 'postgres', 'redis'];
const IMAGE_ID_SERVICES = ['backend', 'frontend', 'nginx', 'srs'];
const REQUIRED_IMAGE_SERVICES = ['backend', 'frontend', 'nginx', 'srs'];

const stagingBase = args['staging-url'];
const productionBase = args['production-url'];

if (!stagingBase || !productionBase) {
  console.error('Error: --staging-url and --production-url are required.');
  printHelp();
  process.exit(1);
}

const streamKey = args['stream-key'] ?? 'smoke-check';
const timeoutMs = Number(args.timeout ?? 8000);
const maxLatencyMs = Number(args['max-latency-ms'] ?? 2500);
const minScore = Number(args['min-score'] ?? 90);
const collectMetadata = toBool(args['collect-metadata'], false) || toBool(args['metadata-check'], false);
const requireMetadata = toBool(args['require-metadata'], false);

const scoringMode = {
  endpointWeight: Number(args['endpoint-weight'] ?? 4),
  metadataWeight: Number(args['metadata-weight'] ?? 2),
};

const parityChecks = [
  {
    key: 'health_html',
    name: 'Nginx Health',
    path: '/health',
    expectStatuses: new Set([200]),
    forbiddenStatuses: new Set(),
    required: true,
    compareMode: 'exact',
  },
  {
    key: 'api_health_live',
    name: 'Backend Health',
    path: '/api/health/live',
    expectStatuses: new Set([200]),
    forbiddenStatuses: new Set(),
    required: true,
    compareMode: 'exact',
  },
  {
    key: 'live_page',
    name: 'Live Page',
    path: '/live',
    expectStatuses: new Set([200, 301, 302, 307, 308]),
    forbiddenStatuses: new Set([500, 502, 503, 504]),
    required: true,
    compareMode: 'exact',
  },
  {
    key: 'stream_flv_route',
    name: 'HTTP-FLV Route',
    path: `/live/live/${streamKey}.flv`,
    expectStatuses: new Set([200, 206, 302, 303, 307, 308, 404, 405]),
    forbiddenStatuses: new Set([500, 502, 503, 504]),
    required: true,
    compareMode: 'allowed',
  },
  {
    key: 'stream_hls_route',
    name: 'HLS Route',
    path: `/hls/${streamKey}.m3u8`,
    expectStatuses: new Set([200, 404, 302, 307, 308, 405]),
    forbiddenStatuses: new Set([500, 502, 503, 504]),
    required: true,
    compareMode: 'allowed',
  },
  {
    key: 'socket_io_probe',
    name: 'Socket.IO Polling',
    path: '/socket.io/?EIO=4&transport=polling',
    expectStatuses: new Set([200, 400, 403]),
    forbiddenStatuses: new Set([500, 502, 503, 504]),
    required: false,
    compareMode: 'allowed',
  },
  {
    key: 'frontend_api_route',
    name: 'Frontend API Proxy',
    path: '/api/products',
    expectStatuses: new Set([200, 401, 403]),
    forbiddenStatuses: new Set([500, 502, 503, 504]),
    required: false,
    compareMode: 'allowed',
  },
];

async function main() {
  const stagingRunner = buildRunner('staging');
  const productionRunner = buildRunner('production');

  if (collectMetadata || requireMetadata) {
    if (requireMetadata) {
      validateRunner(stagingRunner, 'staging');
      validateRunner(productionRunner, 'production');
    }
  }

  const stagingEndpointRows = await runEndpointSuite(stagingBase);
  const productionEndpointRows = await runEndpointSuite(productionBase);

  const checks = [];
  checks.push(...buildEndpointChecks(stagingEndpointRows, productionEndpointRows));

  let stagingMetadata = null;
  let productionMetadata = null;
  if (collectMetadata || requireMetadata) {
    if (stagingRunner && productionRunner) {
      stagingMetadata = await collectMetadataSnapshot(stagingRunner);
      productionMetadata = await collectMetadataSnapshot(productionRunner);
      checks.push(...buildMetadataChecks(stagingMetadata, productionMetadata));
    } else if (requireMetadata) {
      throw new Error('collect-metadata requires both staging and production SSH runner info.');
    } else {
      console.log('Metadata collection skipped: missing one of staging/production SSH runner settings.');
    }
  }

  const endpointSummary = summarizeRows(checks.filter((row) => row.type === 'endpoint'));
  const metadataSummary = summarizeRows(checks.filter((row) => row.type === 'metadata'));

  const overall = calcOverall(checks);

  printHeader();
  console.log('엔드포인트 점수:', `${endpointSummary.score} / ${endpointSummary.total}`);
  console.log('메타데이터 점수:', `${metadataSummary.score} / ${metadataSummary.total}`);
  console.log('총점:', `${overall.score} / 100`);
  console.log('필수항목:', overall.requiresPassed ? 'PASS' : 'FAIL');
  console.log(`최소 기준: ${minScore}`);

  printTable(checks);

  if (stagingMetadata && productionMetadata) {
    printFingerprintSummary(stagingMetadata, productionMetadata);
  }

  if (overall.score >= minScore && overall.requiresPassed) {
    console.log('\nRESULT: PASS');
    process.exit(0);
  }

  console.log('\nRESULT: FAIL');
  process.exit(1);
}

function printHelp() {
  console.log(`
Usage:
  node scripts/streaming-parity-check.mjs \
    --staging-url <url> \
    --production-url <url> \
    [--stream-key smoke-check] \
    [--timeout 8000] \
    [--max-latency-ms 2500] \
    [--min-score 90] \
    [--collect-metadata true|false] \
    [--require-metadata true|false] \
    [--staging-ssh-host <host> --staging-ssh-user <user>] \
    [--production-ssh-host <host> --production-ssh-user <user>] \
    [--staging-ssh-key <path>] [--production-ssh-key <path>] \
    [--staging-compose-base docker-compose.base.yml] \
    [--staging-compose-overlay docker-compose.staging.yml] \
    [--production-compose-overlay docker-compose.prod.yml]
`);
}

function printHeader() {
  console.log('\n=== Streaming Parity Check v2 ===');
  console.log(`Staging:     ${stagingBase}`);
  console.log(`Production:  ${productionBase}`);
  console.log(`Stream key:  ${streamKey}`);
  console.log(`Timeout:     ${timeoutMs}ms`);
  console.log(`Latency:     ${maxLatencyMs}ms`);
  console.log(`Threshold:   ${minScore}`);
  if (collectMetadata || requireMetadata) {
    console.log(`Metadata:    enabled (require=${requireMetadata})`);
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
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
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .join('\n')
    .trim();
}

function normalizeEndpointUrl(base, path) {
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
}

function parseNumeric(value) {
  const parsed = Number(String(value).replace(/[^0-9.+-]/g, ''));
  return Number.isNaN(parsed) ? null : parsed;
}

async function runCommand(command, options = {}) {
  const { timeout = 120000, cwd = undefined, env = process.env } = options;
  try {
    const isWin = process.platform === 'win32';
    const shell = isWin ? 'bash' : '/bin/bash';
    const shellArgs = isWin ? ['-lc', command] : ['-lc', command];
    const { stdout, stderr } = await execAsync(shell, shellArgs, {
      timeout,
      cwd,
      env,
      maxBuffer: 20 * 1024 * 1024,
    });
    return { code: 0, stdout: stdout ?? '', stderr: stderr ?? '' };
  } catch (error) {
    return {
      code: Number(error?.code ?? 1),
      stdout: error?.stdout ?? '',
      stderr: error?.stderr ?? `${error?.message ?? error}`,
    };
  }
}

function buildRunner(prefix) {
  const host = args[`${prefix}-ssh-host`];
  const user = args[`${prefix}-ssh-user`];
  const key = args[`${prefix}-ssh-key`] ?? `${process.env.HOME || process.env.USERPROFILE}/.ssh/id_rsa`;
  const composeBase = args[`${prefix}-compose-base`] ?? STAGING_BASE_COMPOSE;
  const composeOverlay =
    args[`${prefix}-compose-overlay`] ??
    (prefix === 'staging' ? STAGING_OVERLAY_COMPOSE : PRODUCTION_OVERLAY_COMPOSE);
  const composeEnvFile = args[`${prefix}-compose-env`] ?? `${prefix === 'staging' ? '/opt/dorami/.env.staging' : '/opt/dorami/.env.production'}`;
  const composeWorkdir = args[`${prefix}-compose-workdir`] ?? DEFAULT_WORKDIR;
  const nginxInclude = args[`${prefix}-nginx-include`] ?? DEFAULT_NGINX_COMMON_INCLUDE;
  const composeProject = args[`${prefix}-compose-project`] ?? undefined;
  const port = Number(args[`${prefix}-ssh-port`] ?? 22);

  if (!host || !user) return null;

  return {
    enabled: true,
    host,
    user,
    key,
    port,
    composeBase,
    composeOverlay,
    composeEnvFile,
    composeProject,
    composeWorkdir,
    nginxInclude,
  };
}

function validateRunner(runner, label) {
  if (!runner) {
    throw new Error(`[${label}] runner missing required SSH config (--${label}-ssh-host/--${label}-ssh-user).`);
  }
}

function runnerComposePrefix(runner) {
  const projectOpt = runner.composeProject ? `--project-name ${shellQuote(runner.composeProject)} ` : '';
  const envFileOpt = runner.composeEnvFile ? `--env-file ${shellQuote(runner.composeEnvFile)} ` : '';
  return `cd ${shellQuote(runner.composeWorkdir)} && docker compose ${projectOpt}${envFileOpt}-f ${shellQuote(runner.composeBase)} -f ${shellQuote(runner.composeOverlay)}`;
}

async function runShell(runner, command, options = {}) {
  if (!runner) {
    return runCommand(command, options);
  }

  const wrapped = `printf '%s' ${shellQuote(Buffer.from(command).toString('base64'))} | base64 -d | bash -lc`;
  const sshArgs = [
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=no',
    '-o',
    'ConnectTimeout=8',
    '-p',
    String(runner.port),
  ];
  if (runner.key) sshArgs.push('-i', runner.key);
  sshArgs.push(`${runner.user}@${runner.host}`, wrapped);

  try {
    const { stdout, stderr } = await execAsync('ssh', sshArgs, {
      timeout: options.timeout ?? 120000,
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
    });
    return { code: 0, stdout: stdout ?? '', stderr: stderr ?? '' };
  } catch (error) {
    return {
      code: Number(error?.code ?? 1),
      stdout: error?.stdout ?? '',
      stderr: error?.stderr ?? `${error?.message ?? error}`,
    };
  }
}

async function runInService(runner, service, command) {
  const composeCmd = runnerComposePrefix(runner);
  return runShell(runner, `${composeCmd} exec -T ${shellQuote(service)} sh -lc ${shellQuote(command)}`);
}

async function requestWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        Accept: 'application/json, text/plain, */*',
      },
    });

    const elapsedMs = Date.now() - started;
    return {
      ok: true,
      status: response.status,
      elapsedMs,
      headers: {
        'cache-control': response.headers.get('cache-control') || '',
        'content-type': response.headers.get('content-type') || '',
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      elapsedMs: Date.now() - started,
      error: error?.name === 'AbortError' ? `TIMEOUT ${timeout}ms` : String(error?.message ?? error),
      headers: {},
    };
  } finally {
    clearTimeout(timer);
  }
}

function isStatusAllowed(check, status) {
  if (check.forbiddenStatuses && check.forbiddenStatuses.has(status)) return false;
  return check.expectStatuses.has(status);
}

function evaluateEndpointResult(url, check, status, elapsedMs, ok, headers, error) {
  const withinLatency = elapsedMs <= maxLatencyMs;
  const allowed = isStatusAllowed(check, status);
  return {
    pass: ok && allowed && withinLatency,
    url,
    status,
    elapsedMs,
    headers,
    requires: !!check.required,
    key: check.key,
    name: check.name,
    error,
    compareMode: check.compareMode,
  };
}

async function runEndpointSuite(baseUrl) {
  const rows = [];
  for (const check of parityChecks) {
    const url = normalizeEndpointUrl(baseUrl, check.path);
    const result = await requestWithTimeout(url, timeoutMs);
    rows.push(
      evaluateEndpointResult(
        url,
        check,
        result.status,
        result.elapsedMs,
        result.ok,
        result.headers || {},
        result.error,
      ),
    );
  }
  return rows;
}

function compareEndpointParity(stagingRow, productionRow, checkDef) {
  if (!stagingRow || !productionRow) return false;
  if (!stagingRow.pass || !productionRow.pass) return false;
  if (Math.abs(stagingRow.elapsedMs - productionRow.elapsedMs) > Math.max(200, maxLatencyMs * 0.4)) return false;

  switch (checkDef.compareMode) {
    case 'exact':
      return stagingRow.status === productionRow.status;
    case 'allowed':
    default:
      return true;
  }
}

function buildEndpointChecks(stagingRows, productionRows) {
  const checks = [];
  for (let i = 0; i < parityChecks.length; i += 1) {
    const checkDef = parityChecks[i];
    const staging = stagingRows[i];
    const production = productionRows[i];
    const pass = compareEndpointParity(staging, production, checkDef);

    checks.push({
      type: 'endpoint',
      key: `endpoint_${checkDef.key}`,
      name: checkDef.name,
      weight: scoringMode.endpointWeight,
      required: !!checkDef.required,
      pass,
      staging: staging ? `${staging.status} ${staging.elapsedMs}ms` : 'missing',
      production: production ? `${production.status} ${production.elapsedMs}ms` : 'missing',
      details: `staging=${staging.url} / production=${production.url}`,
      stagingValue: staging?.error || '',
      productionValue: production?.error || '',
    });
  }
  return checks;
}

function extractSection(raw, sectionName) {
  const lines = normalizeText(raw).split('\n');
  const startIdx = lines.findIndex((line) => new RegExp(`^${sectionName}:$`).test(line.trim()));
  if (startIdx === -1) return '';

  const startIndent = (lines[startIdx].match(/^\s*/)?.[0] ?? '').length;
  const block = [lines[startIdx]];
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const indent = (line.match(/^\s*/)?.[0] ?? '').length;
    if (line.trim().length === 0) {
      block.push(line);
      continue;
    }
    if (indent <= startIndent) break;
    block.push(line);
  }
  return normalizeSection(block.join('\n'));
}

function normalizeSection(sectionText) {
  return sectionText
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trimEnd())
    .filter((line) => line.trim().length > 0)
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function collectComposeFingerprint(runner) {
  return (async () => {
    const composeCmd = runnerComposePrefix(runner);
    const render = await runShell(runner, `${composeCmd} config`);
    if (render.code !== 0) {
      return {
        ok: false,
        stderr: render.stderr,
        rendered: '',
        fullHash: '',
        topologyHash: '',
        servicesHash: '',
        networksHash: '',
        volumesHash: '',
        servicesRaw: '',
        networksRaw: '',
        volumesRaw: '',
      };
    }
    const rendered = normalizeText(render.stdout);
    const services = extractSection(rendered, 'services');
    const networks = extractSection(rendered, 'networks');
    const volumes = extractSection(rendered, 'volumes');
    const topology = [services, networks, volumes].filter(Boolean).join('\n');
    return {
      ok: true,
      rendered: rendered,
      fullHash: sha256(rendered),
      topologyHash: sha256(topology),
      servicesHash: sha256(services),
      networksHash: sha256(networks),
      volumesHash: sha256(volumes),
      servicesRaw: services,
      networksRaw: networks,
      volumesRaw: volumes,
    };
  })();
}

async function collectImageMetadata(runner, service) {
  const composeCmd = runnerComposePrefix(runner);
  const container = normalizeText((await runShell(runner, `${composeCmd} ps -q ${shellQuote(service)}`)).stdout);
  if (!container) {
    return {
      service,
      container: null,
      imageId: null,
      imageRef: null,
      imageDigest: null,
    };
  }
  const inspect = normalizeText(
    (
      await runShell(
        runner,
        `docker inspect -f '{{.Id}}|{{.Config.Image}}|{{json .RepoDigests}}' ${shellQuote(container)}`,
      )
    ).stdout,
  );
  const [imageId = null, imageRef = null, digestRaw = '[]'] = inspect.split('|').map((value) => value || null);
  const imageDigest = normalizeDigestList(digestRaw);
  return {
    service,
    container,
    imageId,
    imageRef,
    imageDigest,
  };
}

function normalizeDigestList(raw) {
  if (!raw) return null;
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return null;
    return String(list[0] || '').trim() || null;
  } catch {
    return null;
  }
}

async function collectNginxMetadata(runner) {
  const includePath = runner.nginxInclude;
  const composeCmd = runnerComposePrefix(runner);
  const commonCommand = `
    set -e
    if [ -f ${shellQuote(includePath)} ]; then
      sha256sum ${shellQuote(includePath)} | awk '{print $1}'
    else
      echo "missing"
    fi
  `;
  const runtimeCommand = `
    set -e
    RAW=$(${composeCmd} exec -T nginx sh -lc "nginx -T 2>/dev/null" | tr -d '\r')
    if [ -z "$RAW" ]; then
      echo ""
      exit 0
    fi
    printf '%s\n' "$RAW" | grep -E '(^|[[:space:]])(location|upstream)[[:space:]].*' | grep -E '/live|/hls|/socket\\.io|upstream' || true
  `;
  const common = await runShell(runner, commonCommand);
  const runtime = await runShell(runner, runtimeCommand);

  const runtimeLines = normalizeText(runtime.stdout);
  return {
    includePath,
    includeHash: normalizeText(common.stdout),
    runtimeHash: runtimeLines ? sha256(runtimeLines) : '',
    runtimeLines,
  };
}

async function collectRedisMetadata(runner) {
  const password = normalizeText((await runInService(runner, 'redis', 'printf "%s" "${REDIS_PASSWORD}"')).stdout);
  const redisCmd = password ? `redis-cli -a ${shellQuote(password)} ` : 'redis-cli ';
  const ping = normalizeText((await runInService(runner, 'redis', `${redisCmd}ping`)).stdout);
  const maxclients = normalizeText((await runInService(runner, 'redis', `${redisCmd}CONFIG GET maxclients | awk 'NR==2{print $0}'`)).stdout);
  const maxmemory = normalizeText((await runInService(runner, 'redis', `${redisCmd}CONFIG GET maxmemory | awk 'NR==2{print $0}'`)).stdout);
  const policy = normalizeText((await runInService(runner, 'redis', `${redisCmd}CONFIG GET maxmemory-policy | awk 'NR==2{print $0}'`)).stdout);

  return {
    ping: ping || '',
    maxclients: maxclients || '',
    maxmemory: maxmemory || '',
    policy: policy || '',
  };
}

async function collectPostgresMetadata(runner) {
  const user = normalizeText((await runInService(runner, 'postgres', 'printf "%s" "${POSTGRES_USER}"')).stdout) || 'postgres';
  const db = normalizeText((await runInService(runner, 'postgres', 'printf "%s" "${POSTGRES_DB}"')).stdout) || 'live_commerce';
  const pass = normalizeText((await runInService(runner, 'postgres', 'printf "%s" "${POSTGRES_PASSWORD}"')).stdout);

  const psqlBase = `PGPASSWORD=${shellQuote(pass)} psql -X --set ON_ERROR_STOP=on -U ${shellQuote(user)} -d ${shellQuote(db)} -tA`;
  const maxConnections = normalizeText(
    (await runInService(
      runner,
      'postgres',
      `${psqlBase} -c ${shellQuote('SHOW max_connections;')}`,
    )).stdout,
  );
  const version = normalizeText((await runInService(runner, 'postgres', `${psqlBase} -c ${shellQuote('SHOW server_version;')}`)).stdout);

  return {
    maxConnections: maxConnections || '',
    version: version || '',
    user,
    db,
  };
}

async function collectMetadataSnapshot(runner) {
  const compose = await collectComposeFingerprint(runner);
  const imageEntries = await Promise.all(METADATA_SERVICES.map((service) => collectImageMetadata(runner, service)));
  const images = Object.fromEntries(imageEntries.map((entry) => [entry.service, entry]));
  const nginx = await collectNginxMetadata(runner);
  const redis = await collectRedisMetadata(runner);
  const postgres = await collectPostgresMetadata(runner);

  return {
    compose,
    images,
    nginx,
    redis,
    postgres,
  };
}

function buildMetadataChecks(stagingMeta, productionMeta) {
  if (!stagingMeta || !productionMeta) return [];
  const checks = [];

  if (!stagingMeta.compose.ok || !productionMeta.compose.ok) {
    checks.push(checkMetadata({
      key: 'compose_config_render',
      name: 'Compose config render',
      weight: scoringMode.metadataWeight,
      required: true,
      pass: !!(stagingMeta.compose.ok && productionMeta.compose.ok),
      staging: stagingMeta.compose.stderr || 'ok',
      production: productionMeta.compose.stderr || 'ok',
    }));
    return checks;
  }

  checks.push(checkMetadata({
    key: 'compose_topology_hash',
    name: 'Compose topology hash (services/network/volume)',
    weight: scoringMode.metadataWeight,
    required: true,
    pass: stagingMeta.compose.topologyHash === productionMeta.compose.topologyHash,
    staging: stagingMeta.compose.topologyHash,
    production: productionMeta.compose.topologyHash,
  }));

  checks.push(checkMetadata({
    key: 'compose_full_config_hash',
    name: 'Compose full config hash',
    weight: scoringMode.metadataWeight / 2,
    required: false,
    pass: stagingMeta.compose.fullHash === productionMeta.compose.fullHash,
    staging: stagingMeta.compose.fullHash,
    production: productionMeta.compose.fullHash,
  }));

  for (const service of IMAGE_ID_SERVICES) {
    const s = stagingMeta.images[service];
    const p = productionMeta.images[service];
    checks.push(checkMetadata({
      key: `image_id_${service}`,
      name: `Image ID (${service})`,
      weight: scoringMode.metadataWeight,
      required: REQUIRED_IMAGE_SERVICES.includes(service),
      pass: !!s?.imageId && !!p?.imageId && s.imageId === p.imageId,
      staging: `${s?.imageId || 'missing'}`,
      production: `${p?.imageId || 'missing'}`,
      details: `container: staging=${s?.container || '-'}, production=${p?.container || '-'}`,
    }));
    checks.push(checkMetadata({
      key: `image_digest_${service}`,
      name: `Image RepoDigest (${service})`,
      required: REQUIRED_IMAGE_SERVICES.includes(service),
      weight: scoringMode.metadataWeight,
      pass: !!s?.imageDigest && !!p?.imageDigest && s.imageDigest === p.imageDigest,
      staging: `${s?.imageDigest || 'missing'}`,
      production: `${p?.imageDigest || 'missing'}`,
      details: `repo-digest: staging=${s?.imageDigest || '-'}, production=${p?.imageDigest || '-'}`,
    }));
  }

  const sPostgres = stagingMeta.images.postgres;
  const pPostgres = productionMeta.images.postgres;
  const sRedis = stagingMeta.images.redis;
  const pRedis = productionMeta.images.redis;

  checks.push(checkMetadata({
    key: 'postgres_image_ref',
    name: 'Postgres image ref (postgres:16-alpine)',
    required: true,
    weight: scoringMode.metadataWeight / 2,
    pass: /postgres:16-alpine/.test(sPostgres?.imageRef || '') && /postgres:16-alpine/.test(pPostgres?.imageRef || ''),
    staging: sPostgres?.imageRef || '',
    production: pPostgres?.imageRef || '',
  }));

  checks.push(checkMetadata({
    key: 'redis_image_ref',
    name: 'Redis image ref (redis:7-alpine)',
    required: true,
    weight: scoringMode.metadataWeight / 2,
    pass: /redis:7-alpine/.test(sRedis?.imageRef || '') && /redis:7-alpine/.test(pRedis?.imageRef || ''),
    staging: sRedis?.imageRef || '',
    production: pRedis?.imageRef || '',
  }));

  checks.push(checkMetadata({
    key: 'nginx_common_include_hash',
    name: 'Nginx common routing include hash',
    required: true,
    weight: scoringMode.metadataWeight,
    pass: !!stagingMeta.nginx.includeHash && stagingMeta.nginx.includeHash === productionMeta.nginx.includeHash,
    staging: stagingMeta.nginx.includeHash,
    production: productionMeta.nginx.includeHash,
  }));

  checks.push(checkMetadata({
    key: 'nginx_runtime_routing_hash',
    name: 'Nginx routing runtime hash',
    required: true,
    weight: scoringMode.metadataWeight,
    pass: !!stagingMeta.nginx.runtimeHash && stagingMeta.nginx.runtimeHash === productionMeta.nginx.runtimeHash,
    staging: stagingMeta.nginx.runtimeHash || 'missing',
    production: productionMeta.nginx.runtimeHash || 'missing',
  }));

  checks.push(checkMetadata({
    key: 'redis_ping',
    name: 'Redis ping',
    required: true,
    weight: scoringMode.metadataWeight,
    pass: stagingMeta.redis.ping === 'PONG' && stagingMeta.redis.ping === productionMeta.redis.ping,
    staging: stagingMeta.redis.ping || 'missing',
    production: productionMeta.redis.ping || 'missing',
  }));

  checks.push(checkMetadata({
    key: 'redis_maxclients',
    name: 'Redis maxclients',
    required: false,
    weight: scoringMode.metadataWeight / 2,
    pass: stagingMeta.redis.maxclients === productionMeta.redis.maxclients && !!stagingMeta.redis.maxclients,
    staging: stagingMeta.redis.maxclients || 'missing',
    production: productionMeta.redis.maxclients || 'missing',
  }));

  checks.push(checkMetadata({
    key: 'redis_maxmemory',
    name: 'Redis maxmemory',
    required: false,
    weight: scoringMode.metadataWeight / 2,
    pass: stagingMeta.redis.maxmemory === productionMeta.redis.maxmemory && !!stagingMeta.redis.maxmemory,
    staging: stagingMeta.redis.maxmemory || 'missing',
    production: productionMeta.redis.maxmemory || 'missing',
  }));

  checks.push(checkMetadata({
    key: 'redis_mem_policy',
    name: 'Redis maxmemory-policy',
    required: false,
    weight: scoringMode.metadataWeight / 2,
    pass: stagingMeta.redis.policy === productionMeta.redis.policy && !!stagingMeta.redis.policy,
    staging: stagingMeta.redis.policy || 'missing',
    production: productionMeta.redis.policy || 'missing',
  }));

  const stgConn = parseNumeric(stagingMeta.postgres.maxConnections);
  const prodConn = parseNumeric(productionMeta.postgres.maxConnections);
  checks.push(checkMetadata({
    key: 'pg_max_connections',
    name: 'PostgreSQL max_connections >= baseline',
    required: true,
    weight: scoringMode.metadataWeight,
    pass: Number.isFinite(stgConn) && Number.isFinite(prodConn) && prodConn >= stgConn,
    staging: `${stagingMeta.postgres.maxConnections || 'missing'}`,
    production: `${productionMeta.postgres.maxConnections || 'missing'}`,
  }));

  checks.push(checkMetadata({
    key: 'pg_version',
    name: 'PostgreSQL version',
    required: true,
    weight: scoringMode.metadataWeight,
    pass: !!stagingMeta.postgres.version && stagingMeta.postgres.version === productionMeta.postgres.version,
    staging: `${stagingMeta.postgres.version || 'missing'}`,
    production: `${productionMeta.postgres.version || 'missing'}`,
  }));

  return checks;
}

function checkMetadata({ key, name, weight, required, pass, staging, production, details }) {
  return {
    type: 'metadata',
    key,
    name,
    weight,
    required,
    pass: !!pass,
    staging,
    production,
    details: details || '',
  };
}

function calcOverall(checks) {
  let weightedSum = 0;
  let weightedPass = 0;
  let requiresPassed = true;

  for (const item of checks) {
    const weight = Number(item.weight || 0);
    weightedSum += weight;
    if (item.pass) weightedPass += weight;
    if (item.required && !item.pass) requiresPassed = false;
  }

  const score = weightedSum === 0 ? 0 : Math.round((weightedPass / weightedSum) * 100);
  return { score, requiresPassed };
}

function summarizeRows(rows) {
  if (!rows.length) return { score: 100, total: 0 };
  let weightedSum = 0;
  let weightedPass = 0;
  for (const row of rows) {
    const weight = Number(row.weight || 0);
    weightedSum += weight;
    if (row.pass) weightedPass += weight;
  }
  return {
    score: weightedSum === 0 ? 100 : Math.round((weightedPass / weightedSum) * 100),
    total: weightedSum,
  };
}

function printFingerprintSummary(staging, production) {
  console.log('\n=== Fingerprint summary ===');
  console.log('composeTopologyEqual:', staging.compose.topologyHash === production.compose.topologyHash);
  console.log('nginxIncludeHash:', `${staging.nginx.includeHash} / ${production.nginx.includeHash}`);
  console.log('nginxRuntimeHash:', `${staging.nginx.runtimeHash || 'missing'} / ${production.nginx.runtimeHash || 'missing'}`);
  console.log('Redis:', `${staging.redis.ping} / ${production.redis.ping}, maxclients: ${staging.redis.maxclients}/${production.redis.maxclients}, policy: ${staging.redis.policy}/${production.redis.policy}`);
  console.log('Postgres:', `${staging.postgres.maxConnections}/${production.postgres.maxConnections}, version: ${staging.postgres.version}/${production.postgres.version}`);
}

function printTable(checks) {
  console.table(
    checks.map((row) => ({
      구분: row.type === 'endpoint' ? 'endpoint' : 'metadata',
      항목: row.name,
      점수: row.weight,
      통과: row.pass ? 'PASS' : 'FAIL',
      필요: row.required ? 'YES' : 'NO',
      스테이징: row.staging,
      프로덕션: row.production,
      상세: row.details || '',
    })),
  );
}

main().catch((error) => {
  console.error('Parity check failed:', error);
  process.exit(1);
});
