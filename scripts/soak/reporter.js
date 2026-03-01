const fs = require('node:fs');

function printResult({ config, snapshots, result }) {
  const output = {
    status: result.status,
    critical: result.critical,
    warning: result.warning,
    summary: result.summary,
    details: result.details || [],
    checkedSeconds: snapshots.reduce((acc, snapshot) => acc + Number(snapshot.elapsedSec || 0), 0),
    snapshotCount: snapshots.length,
  };

  const pretty = JSON.stringify(output, null, 2);
  const timestamp = new Date().toISOString();
  const header = [
    `[${timestamp}] Streaming Soak Gate`,
    `status=${output.status} critical=${output.critical} warning=${output.warning}`,
    `redis_growth=${output.summary.redis_growth}`,
    `srs_cpu_p95=${output.summary.srs_cpu_p95}`,
    `hls_segment_count=${output.summary.hls_segments}`,
    `ws_reconnect_rate=${output.summary.ws_reconnect_rate}`,
    `pg_active=${output.summary.pg_active_connections}`,
    '',
  ].join('\n');

  console.log(header);
  if (output.details.length > 0) {
    console.log('details:');
    for (const detail of output.details) {
      console.log(`- ${detail}`);
    }
  }

  console.log('RESULT_JSON_START');
  console.log(pretty);
  console.log('RESULT_JSON_END');

  if (config?.output) {
    fs.writeFileSync(config.output, `${pretty}\n`);
  }
}

module.exports = {
  printResult,
};
