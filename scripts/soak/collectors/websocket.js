const toUrl = ({ baseUrl, streamKey }) => {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/socket.io/?EIO=4&transport=websocket`;
  if (!endpoint.includes('/socket.io/')) return endpoint;
  return endpoint + `&sid=${encodeURIComponent(streamKey || 'soak')}&_=${Date.now()}`;
};

let WebSocketConstructor = globalThis.WebSocket;
if (!WebSocketConstructor) {
  try {
    // eslint-disable-next-line global-require
    ({ WebSocket: WebSocketConstructor } = require('ws'));
  } catch (error) {
    WebSocketConstructor = null;
  }
}

class WebsocketCollector {
  constructor({ baseUrl, streamKey, targetUsers, sampleWindowMs }) {
    this.endpoint = toUrl({ baseUrl, streamKey });
    this.targetUsers = Math.max(1, Number(targetUsers || 10));
    this.sampleWindowMs = Math.max(500, Number(sampleWindowMs || 8000));
    this.totalAttempts = 0;
    this.successfulConnections = 0;
    this.failedConnections = 0;
    this.reconnectCount = 0;
    this.latencies = [];
    this.disabled = !WebSocketConstructor;
  }

  async start() {
    if (this.disabled) {
      return false;
    }
    return true;
  }

  async sampleSnapshot() {
    if (this.disabled) {
      return {
        targetUsers: this.targetUsers,
        totalAttempts: 0,
        successfulConnections: 0,
        failedConnections: 0,
        reconnects: 0,
        reconnectRate: 0,
        avgOpenLatencyMs: null,
        p95OpenLatencyMs: null,
        activeConnections: 0,
        sampleWindowMs: this.sampleWindowMs,
        error: null,
        disabled: true,
      };
    }

    if (!WebSocketConstructor) {
      return {
        targetUsers: this.targetUsers,
        totalAttempts: this.targetUsers,
        successfulConnections: 0,
        failedConnections: this.targetUsers,
        reconnects: 0,
        reconnectRate: 1,
        avgOpenLatencyMs: null,
        p95OpenLatencyMs: null,
        activeConnections: 0,
        sampleWindowMs: this.sampleWindowMs,
        error: 'websocket library unavailable',
      };
    }

    const sampleWindow = [];
    const batch = 20;
    const users = this.targetUsers;

    let start = 0;
    while (start < users) {
      const chunk = Math.min(batch, users - start);
      const promises = [];
      for (let i = 0; i < chunk; i += 1) {
        const idx = start + i;
        promises.push(this.probeConnection(idx));
      }
      // eslint-disable-next-line no-await-in-loop
      const chunkResult = await Promise.all(promises);
      sampleWindow.push(...chunkResult);
      start += chunk;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    this.totalAttempts = sampleWindow.length;
    this.successfulConnections = sampleWindow.filter((x) => x.success).length;
    this.failedConnections = sampleWindow.filter((x) => !x.success).length;
    this.reconnectCount = sampleWindow.reduce((sum, item) => sum + item.reconnects, 0);

    const latencies = sampleWindow.flatMap((x) => (Number.isFinite(x.openMs) ? [x.openMs] : []));
    const avgOpenLatencyMs = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;
    const p95OpenLatencyMs = latencies.length ? percentile(latencies, 0.95) : null;

    this.latencies = latencies;

    return {
      targetUsers: users,
      totalAttempts: this.totalAttempts,
      successfulConnections: this.successfulConnections,
      failedConnections: this.failedConnections,
      reconnects: this.reconnectCount,
      reconnectRate: this.totalAttempts
        ? this.reconnectCount / this.totalAttempts
        : 0,
      avgOpenLatencyMs,
      p95OpenLatencyMs,
      activeConnections: this.successfulConnections,
      sampleWindowMs: this.sampleWindowMs,
      error: undefined,
    };
  }

  async stop() {
    //
  }

  async probeConnection(index) {
    let reconnects = 0;
    const maxAttempts = 2;
    let attempt = 0;
    let lastError = null;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const result = await attemptConnection(this.endpoint, this.sampleWindowMs, index, attempt);
        return { ...result, reconnects };
      } catch (error) {
        lastError = error;
        reconnects += 1;
        if (attempt < maxAttempts) {
          await sleep(150);
          continue;
        }
      }
    }
    return { success: false, openMs: null, reconnects: Math.max(0, reconnects - 1), error: String(lastError) };
  }
}

const attemptConnection = (endpoint, timeoutMs, index, attempt) =>
  new Promise((resolve, reject) => {
    const wsUrl = `${endpoint}&attempt=${attempt}&i=${index}`;
    const start = Date.now();
    const socket = new WebSocketConstructor(wsUrl);
    let resolved = false;

    const cleanup = () => {
      try {
        socket.close();
      } catch {
        //
      }
    };

    const to = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      reject(new Error('websocket_timeout'));
    }, timeoutMs);

    socket.addEventListener('open', () => {
      if (resolved) return;
      const openMs = Date.now() - start;
      resolved = true;
      clearTimeout(to);
      cleanup();
      resolve({ success: true, openMs, open: true, reconnects: 0 });
    });

    socket.addEventListener('error', (event) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(to);
      reject(new Error(event?.message || 'websocket_error'));
    });

    socket.addEventListener('close', () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(to);
      reject(new Error('websocket_closed'));
    });
  });

const percentile = (values, ratio) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * ratio);
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createWebsocketCollector(opts) {
  return new WebsocketCollector(opts);
}

module.exports = {
  createWebsocketCollector,
};
