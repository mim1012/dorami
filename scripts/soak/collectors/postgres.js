const toNumber = (value) => {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const toQueryResult = (raw) => String(raw || '').trim();

const buildCommand = ({
  containerName,
  user,
  database,
  password,
  host,
  port,
  query,
}) => {
  const escapedQuery = JSON.stringify(query);
  return `cd / && PGPASSWORD='${password || ''}' psql -h ${host || 'localhost'} -p ${Number(
    port || 5432,
  )} -U ${user || 'postgres'} ${database ? `-d ${database}` : ''} -tA -c ${escapedQuery}`;
};

async function collectPostgresMetrics({
  run,
  containerName,
  user,
  password,
  database,
  host,
  port,
}) {
  const execCtx = `docker exec ${containerName}`;
  const runQuery = async (query) => {
    const cmd = `${execCtx} ${buildCommand({ containerName, user, database, password, host, port, query })}`;
    const raw = await run(cmd);
    return toQueryResult(raw);
  };

  const maxConnections = toNumber(await runQuery("SHOW max_connections"));
  const activeConnections = toNumber(await runQuery(
    "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';",
  ));
  const totalConnections = toNumber(await runQuery("SELECT count(*) FROM pg_stat_activity;"));
  const serverVersion = toQueryResult(await runQuery('SHOW server_version;'));

  return {
    maxConnections,
    activeConnections,
    totalConnections,
    serverVersion,
    error: undefined,
  };
}

module.exports = {
  collectPostgresMetrics,
};
