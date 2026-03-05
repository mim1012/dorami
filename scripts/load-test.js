#!/usr/bin/env node
/**
 * WebSocket Load Test Script
 * Tests 100 concurrent Socket.IO connections to production server
 * Usage: node scripts/load-test.js
 * Dependencies: npm install socket.io-client
 */

const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'https://www.doremi-live.com';
const TOTAL_CLIENTS = 100;
const CONNECTION_INTERVAL_MS = 100;
const TEST_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const OUTPUT_FILE = path.join(__dirname, '..', 'load-test-results.json');

const results = {
  timestamp: new Date().toISOString(),
  totalClients: TOTAL_CLIENTS,
  successfulConnections: 0,
  failedConnections: 0,
  successRate: '0%',
  avgResponseTime: 0,
  totalDuration: 0,
  errors: [],
};

const clients = [];
const connectionTimes = [];
let connectionsAttempted = 0;

console.log(`Starting load test: ${TOTAL_CLIENTS} clients, ${TEST_DURATION_MS / 1000}s duration`);
console.log(`Target: ${SERVER_URL}`);
console.log('---');

const startTime = Date.now();

function connectClient(index) {
  const clientStart = Date.now();

  const socket = io(SERVER_URL, {
    transports: ['websocket'],
    timeout: 10000,
    reconnection: false,
  });

  clients.push(socket);

  socket.on('connect', () => {
    const connectionTime = Date.now() - clientStart;
    connectionTimes.push(connectionTime);
    results.successfulConnections++;
    if (index % 10 === 0) {
      console.log(`[${index + 1}/${TOTAL_CLIENTS}] Connected (${connectionTime}ms)`);
    }
  });

  socket.on('connect_error', (err) => {
    results.failedConnections++;
    results.errors.push({
      client: index,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
    if (results.errors.length <= 10) {
      console.error(`[${index + 1}/${TOTAL_CLIENTS}] Failed: ${err.message}`);
    }
  });

  connectionsAttempted++;
}

// Sequentially connect clients with interval
let clientIndex = 0;
const connectionInterval = setInterval(() => {
  if (clientIndex < TOTAL_CLIENTS) {
    connectClient(clientIndex);
    clientIndex++;
  } else {
    clearInterval(connectionInterval);
    console.log(`\nAll ${TOTAL_CLIENTS} connection attempts initiated.`);
    console.log(`Holding connections for ${TEST_DURATION_MS / 1000}s...`);
  }
}, CONNECTION_INTERVAL_MS);

// Auto-terminate after test duration
setTimeout(() => {
  const totalDuration = Date.now() - startTime;

  console.log('\n--- Test Complete ---');

  // Disconnect all clients
  clients.forEach((socket) => {
    if (socket.connected) {
      socket.disconnect();
    }
  });

  // Calculate final metrics
  results.totalDuration = totalDuration;
  results.successRate =
    TOTAL_CLIENTS > 0
      ? `${((results.successfulConnections / TOTAL_CLIENTS) * 100).toFixed(1)}%`
      : '0%';
  results.avgResponseTime =
    connectionTimes.length > 0
      ? Math.round(connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length)
      : 0;

  // Write results
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  console.log(`Successful connections: ${results.successfulConnections}/${TOTAL_CLIENTS}`);
  console.log(`Failed connections:     ${results.failedConnections}`);
  console.log(`Success rate:           ${results.successRate}`);
  console.log(`Avg connection time:    ${results.avgResponseTime}ms`);
  console.log(`Total duration:         ${totalDuration}ms`);
  console.log(`Results saved to:       ${OUTPUT_FILE}`);

  process.exit(0);
}, TEST_DURATION_MS + TOTAL_CLIENTS * CONNECTION_INTERVAL_MS + 5000);
