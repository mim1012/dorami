const crypto = require('node:crypto');

const normalizeLine = (line) => line.trim();

const normalizeNginxLines = (raw) => String(raw || '')
  .split('\n')
  .map(normalizeLine)
  .filter(Boolean)
  .filter((line) => !line.startsWith('#'))
  .map((line) => line.replace(/\s+/g, ' '))
  .filter((line) => line.length);

const targetBlocks = [
  'location /live/live/',
  'location /hls/',
  'location /socket.io/',
  'upstream backend',
  'upstream frontend',
  'upstream srs',
];

const captureHash = (lines) => {
  const filtered = lines.filter((line) =>
    targetBlocks.some((token) => line.includes(token)),
  );
  const normalized = filtered.join('\n');
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  return {
    hash,
    lines: filtered,
    count: filtered.length,
  };
};

async function collectNginxMetrics({ run, containerName }) {
  const raw = await run(`docker exec ${containerName} nginx -T`);
  const lines = normalizeNginxLines(raw);
  const hashInfo = captureHash(lines);

  return {
    runtimeConfigHash: hashInfo.hash,
    routingLines: hashInfo.lines,
    routeLineCount: hashInfo.count,
    error: undefined,
  };
}

module.exports = {
  collectNginxMetrics,
};
