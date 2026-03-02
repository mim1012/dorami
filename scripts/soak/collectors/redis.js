const parseInfo = (text) => {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'));

  const map = Object.create(null);
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx);
    const value = line.slice(idx + 1);
    map[key] = value;
  }
  return map;
};

const parseSimpleConfig = (text) => {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const map = Object.create(null);
  for (let i = 0; i < lines.length - 1; i += 2) {
    const key = lines[i];
    const value = lines[i + 1] ?? '';
    map[key] = value;
  }
  return map;
};

const toNumber = (value) => {
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

async function collectRedisMetrics({
  run,
  containerName,
  password,
  host,
  port,
  timeoutMs,
}) {
  const args = [];
  if (host) args.push(`-h ${JSON.stringify(host)}`);
  if (port) args.push(`-p ${Number(port)}`);
  if (password) args.push(`-a ${JSON.stringify(password)}`);
  args.push('--no-auth-warning');

  const redisCli = `redis-cli ${args.join(' ')}`;
  const base = `${redisCli}`;

  const ping = (await run(`${base} ping`)).trim();
  const memoryInfo = parseInfo(await run(`${base} INFO memory`));
  const statsInfo = parseInfo(await run(`${base} INFO stats`));
  const maxClients = parseSimpleConfig(await run(`${base} CONFIG GET maxclients`));

  const usedMemory = toNumber(memoryInfo.used_memory);
  const usedMemoryPeak = toNumber(memoryInfo.used_memory_peak);
  const connectedClients = toNumber(statsInfo.connected_clients ?? memoryInfo.connected_clients);
  const totalCommands = toNumber(statsInfo.total_commands_processed);

  const maxClientsValue = toNumber(maxClients.maxclients);

  return {
    ping,
    usedMemory,
    usedMemoryPeak,
    connectedClients,
    totalCommands,
    maxClients: maxClientsValue,
    error: undefined,
  };
}

module.exports = {
  collectRedisMetrics,
};
