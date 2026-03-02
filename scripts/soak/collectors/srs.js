const parseBytes = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^([\d.]+)\s*([KMGTP]?i?B)?$/i);
  if (!match) return null;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return null;

  const unit = (match[2] || '').toUpperCase();
  const unitMap = {
    B: 1,
    KB: 1024,
    KIB: 1024,
    MB: 1024 * 1024,
    MIB: 1024 * 1024,
    GB: 1024 ** 3,
    GIB: 1024 ** 3,
    TB: 1024 ** 4,
    TIB: 1024 ** 4,
  };
  return Math.round(numeric * (unitMap[unit] || 1));
};

const parsePercent = (value) => {
  const numeric = Number(String(value || '0').replace('%', ''));
  return Number.isFinite(numeric) ? numeric : null;
};

async function collectSrsMetrics({ run, containerName }) {
  const raw = await run(`docker stats --no-stream --format json ${containerName}`);
  const parsed = safeJson(raw);
  if (!parsed) {
    return {
      cpuPercent: null,
      memPercent: null,
      memUsageBytes: null,
      netInput: null,
      netOutput: null,
      blockInput: null,
      blockOutput: null,
      pids: null,
      error: 'docker stats parse failed',
    };
  }

  const memUsage = String(parsed.MemUsage || parsed.mem_usage || '');
  const cpuPercent = parsePercent(parsed.CPUPerc || parsed.cpu);
  const memPercent = parsePercent(parsed.MemPerc || parsed.mem_percent);

  const [memUsedText, memTotalText] = memUsage.split(' / ');
  const memUsageBytes = parseBytes(memUsedText || '');
  const memLimitBytes = parseBytes(memTotalText || '');

  return {
    cpuPercent,
    memPercent,
    memUsageBytes,
    memLimitBytes,
    netInput: parseBytes(String((parsed.NetIO || parsed.netIO || '').split(' / ')[0] || '')),
    netOutput: parseBytes(String((parsed.NetIO || parsed.netIO || '').split(' / ')[1] || '')),
    blockInput: parseBytes(String((parsed.BlockIO || parsed.blockIO || '').split(' / ')[0] || '')),
    blockOutput: parseBytes(String((parsed.BlockIO || parsed.blockIO || '').split(' / ')[1] || '')),
    pids: toNumber(parsed.PIDs || parsed.pids),
    error: undefined,
  };
}

function collectSrsMetricsFromStats(stats) {
  if (!stats || !stats.length) return null;
  const p95 = percentile(stats.map((s) => s.cpuPercent).filter(Number.isFinite), 0.95);
  return {
    cpuP95: p95,
    sampleCount: stats.length,
  };
}

function safeJson(value) {
  try {
    return JSON.parse(String(value || '').trim());
  } catch {
    return null;
  }
}

function percentile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * q);
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

module.exports = {
  collectSrsMetrics,
  collectSrsMetricsFromStats,
};
