const evaluateRedis = (snapshots, config) => {
  const first = snapshots.find((snapshot) => snapshot?.redis?.usedMemory !== null && snapshot?.redis?.usedMemory !== undefined);
  const last = snapshots[snapshots.length - 1];
  if (!first || !last || !first.redis || !last.redis) return [];

  const baseline = Number(first.redis.usedMemory);
  const latest = Number(last.redis.usedMemory);
  if (!Number.isFinite(baseline) || baseline <= 0 || !Number.isFinite(latest)) return [];

  const growthPercent = ((latest - baseline) / baseline) * 100;
  if (growthPercent > config.criticalRedisGrowthRate) {
    return [
      {
        type: 'critical',
        reason: `Redis used_memory growth ${growthPercent.toFixed(1)}% > ${config.criticalRedisGrowthRate}%`,
      },
    ];
  }
  return [];
};

const evaluatePostgres = (snapshots, config) => {
  const issues = [];
  for (const snapshot of snapshots) {
    const pg = snapshot.postgres;
    if (!pg || !Number.isFinite(pg.activeConnections) || !Number.isFinite(pg.maxConnections)) {
      continue;
    }
    const ratio = pg.maxConnections > 0 ? pg.activeConnections / pg.maxConnections : 0;
    if (ratio > config.warningPgActiveRatio) {
      issues.push({
        type: 'warning',
        reason: `pg active ratio ${ratio.toFixed(2)} > ${config.warningPgActiveRatio}`,
      });
      break;
    }
  }
  return issues;
};

const evaluateSrs = (snapshots, config, intervalSec) => {
  const issues = [];
  let currentHighStart = null;
  const highDurationMs = config.criticalSrsCpuDurationSec * 1000;

  for (const snapshot of snapshots) {
    const srs = snapshot.srs;
    const cpu = Number(srs?.cpuPercent);
    if (!Number.isFinite(cpu)) continue;
    if (cpu >= config.criticalSrsCpuP95) {
      if (currentHighStart === null) currentHighStart = snapshot.timestamp;
      const elapsed = snapshot.timestamp
        ? Date.parse(snapshot.timestamp) - Date.parse(currentHighStart)
        : 0;
      if (elapsed >= highDurationMs) {
        issues.push({
          type: 'critical',
          reason: `SRS CPU ${cpu}% over threshold for ${Math.round(elapsed / 1000)}s (>= ${config.criticalSrsCpuDurationSec}s)`,
        });
        break;
      }
    } else {
      currentHighStart = null;
    }
  }

  return issues;
};

const evaluateHls = (snapshots, config) => {
  const issues = [];
  let streakStart = null;
  let lastSegmentCount = null;

  for (const snapshot of snapshots) {
    if (!snapshot.hls || snapshot.hls.segmentCount == null || !snapshot.hls.available) {
      streakStart = null;
      lastSegmentCount = null;
      continue;
    }

    const currentCount = Number(snapshot.hls.segmentCount);
    if (!Number.isFinite(currentCount)) continue;

    if (lastSegmentCount !== null && currentCount > lastSegmentCount) {
      if (streakStart === null) {
        streakStart = snapshot.timestamp;
      }
      if (streakStart) {
        const elapsed = snapshot.timestamp ? Date.parse(snapshot.timestamp) - Date.parse(streakStart) : 0;
        if (elapsed >= config.criticalSegmentGrowthSec * 1000 && snapshot.hls.segmentCount > 0) {
          issues.push({
            type: 'critical',
            reason: `HLS segment count increases continuously for ${Math.round(elapsed / 1000)}s`,
          });
          break;
        }
      }
    } else {
      streakStart = null;
    }
    lastSegmentCount = currentCount;
  }

  return issues;
};

const evaluateWebsocket = (snapshots, config) => {
  const issues = [];
  const websocketSnapshots = snapshots.filter((snapshot) => {
    const ws = snapshot?.websocket;
    return ws && !ws.disabled;
  });
  if (websocketSnapshots.length < 2) {
    return issues;
  }

  const baseline = websocketSnapshots[0]?.websocket;
  const baselineReconnectRate = baseline?.reconnectRate || 0;
  const baselineReconnect = baseline?.reconnects || 0;
  for (const snapshot of websocketSnapshots.slice(1)) {
    const ws = snapshot.websocket;
    if (!ws) continue;
    const ratio = Number(ws.totalAttempts || 0) > 0 ? ws.reconnects / ws.totalAttempts : 0;
    if (baselineReconnectRate > 0 && ratio > baselineReconnectRate * config.warningReconnectMultiplier) {
      issues.push({
        type: 'warning',
        reason: `websocket reconnectRate ${ratio.toFixed(2)} > ${config.warningReconnectMultiplier}x baseline (${baselineReconnectRate.toFixed(2)})`,
      });
      continue;
    }
    if (baselineReconnectRate === 0 && ws.reconnects > baselineReconnect + 1) {
      issues.push({
        type: 'warning',
        reason: `websocket reconnect observed (${ws.reconnects} reconnects)`,
      });
    }
  }
  return issues;
};

const evaluateCollectorHealth = (snapshots, thresholds) => {
  const badCollectors = [];
  for (const snapshot of snapshots) {
    if (snapshot.redis && snapshot.redis.error) {
      badCollectors.push({ type: 'warning', reason: `snapshot #${snapshot.index} redis error: ${snapshot.redis.error}` });
    }
    if (snapshot.postgres && snapshot.postgres.error) {
      badCollectors.push({ type: 'warning', reason: `snapshot #${snapshot.index} postgres error: ${snapshot.postgres.error}` });
    }
    if (snapshot.srs && snapshot.srs.error) {
      badCollectors.push({ type: 'critical', reason: `snapshot #${snapshot.index} srs error: ${snapshot.srs.error}` });
    }
    if (snapshot.nginx && snapshot.nginx.error) {
      badCollectors.push({ type: 'warning', reason: `snapshot #${snapshot.index} nginx error: ${snapshot.nginx.error}` });
    }
    if (snapshot.websocket && snapshot.websocket.error) {
      badCollectors.push({ type: 'warning', reason: `snapshot #${snapshot.index} websocket error: ${snapshot.websocket.error}` });
    }
  }

  return badCollectors.slice(-5);
};

const dedupeAndLimit = (items, max = 20) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.type}:${item.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
};

function evaluateSnapshots(snapshots, thresholds) {
  const config = {
    criticalRedisGrowthRate: Number(thresholds.criticalRedisGrowthRate || 30),
    criticalSrsCpuP95: Number(thresholds.criticalSrsCpuP95 || 90),
    criticalSrsCpuDurationSec: Number(thresholds.criticalSrsCpuDurationSec || 180),
    criticalSegmentGrowthSec: Number(thresholds.criticalSegmentGrowthSec || 60),
    warningReconnectMultiplier: Number(thresholds.warningReconnectMultiplier || 2),
    warningWsActiveMaxRatio: Number(thresholds.warningWsActiveMaxRatio || 0.7),
    warningPgActiveRatio: Number(thresholds.warningPgActiveRatio || 0.8),
    warningLimit: Number(thresholds.warningLimit || 3),
  };

  const intervalMs = snapshots.length > 1
    ? Date.parse(snapshots[snapshots.length - 1].timestamp) - Date.parse(snapshots[0].timestamp)
    : 0;
  const intervalSec = intervalMs > 0 ? Math.max(1, Math.round(intervalMs / 1000 / Math.max(1, snapshots.length - 1))) : 30;

  const checks = []
    .concat(evaluateRedis(snapshots, config))
    .concat(evaluatePostgres(snapshots, config))
    .concat(evaluateSrs(snapshots, config, intervalSec))
    .concat(evaluateHls(snapshots, config))
    .concat(evaluateWebsocket(snapshots, config))
    .concat(evaluateCollectorHealth(snapshots, config));

  const deduped = dedupeAndLimit(checks, 40);
  const critical = deduped.filter((item) => item.type === 'critical').length;
  const warning = deduped.filter((item) => item.type === 'warning').length;
  const status = critical >= 1 || warning >= config.warningLimit ? 'FAIL' : 'PASS';

  const latest = snapshots[snapshots.length - 1] || {};
  const summary = {
    redis_growth: percentageChange(
      snapshots.find((snapshot) => snapshot.redis)?.redis?.usedMemory,
      latest.redis?.usedMemory,
      'na',
    ),
    srs_cpu_p95: latest.srs?.cpuPercent ?? 'na',
    hls_segments: latest.hls?.segmentCount ?? 'na',
    ws_reconnect_rate: latest.websocket ? (latest.websocket.reconnects / Math.max(1, latest.websocket.totalAttempts)) : 'na',
    pg_active_connections: latest.postgres?.activeConnections ?? 'na',
    nginx_routing_hash: latest.nginx?.runtimeConfigHash ?? 'na',
  };

  const details = deduped.map((entry) => entry.reason);

  return {
    status,
    critical,
    warning,
    summary,
    details,
  };
}

function percentageChange(from, to, fallback = 'na') {
  const a = Number(from);
  const b = Number(to);
  if (!Number.isFinite(a) || a === 0 || !Number.isFinite(b)) return fallback;
  return `${(((b - a) / a) * 100).toFixed(2)}%`;
}

module.exports = {
  evaluateSnapshots,
};
