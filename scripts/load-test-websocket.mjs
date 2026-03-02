#!/usr/bin/env node
/**
 * Phase 2: WebSocket 300 Concurrent Connections Test
 * Socket.IO 채팅 300명 동시 접속 테스트
 *
 * Usage:
 *   node scripts/load-test-websocket.mjs [staging_url] [stream_key] [duration]
 *
 * Example:
 *   node scripts/load-test-websocket.mjs https://staging.doremi-live.com stream-key 600
 */

import { io } from 'socket.io-client';
import prettyBytes from 'pretty-bytes';

const STAGING_URL = process.argv[2] || 'https://staging.doremi-live.com';
const STREAM_KEY = process.argv[3] || 'smoke-check';
const DURATION = parseInt(process.argv[4] || '600', 10);

const NUM_USERS = 300;
const MESSAGES_PER_USER_PER_MIN = 1;

class LoadTester {
  constructor() {
    this.sockets = [];
    this.stats = {
      connected: 0,
      disconnected: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      latencies: [],
      startTime: Date.now(),
    };
  }

  async connect() {
    console.log(`
╔════════════════════════════════════════════════════════╗
║      WebSocket 300 Concurrent Connections Test        ║
╚════════════════════════════════════════════════════════╝

📊 Configuration:
  Server: ${STAGING_URL}
  Stream: ${STREAM_KEY}
  Concurrent Users: ${NUM_USERS}
  Duration: ${DURATION}s
  Messages/user/min: ${MESSAGES_PER_USER_PER_MIN}
  Expected messages/sec: ${(NUM_USERS * MESSAGES_PER_USER_PER_MIN / 60).toFixed(1)}

🚀 Connecting ${NUM_USERS} users...
`);

    const startTime = Date.now();
    let connectedCount = 0;

    for (let i = 0; i < NUM_USERS; i++) {
      const socket = io(STAGING_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionDelayMax: 500,
        reconnectionAttempts: 5,
        path: '/socket.io/',
      });

      socket.on('connect', () => {
        this.stats.connected++;
        connectedCount++;

        // Join stream room
        socket.emit('join_stream', { streamKey: STREAM_KEY });

        // Periodically send messages
        const messageInterval = setInterval(() => {
          if (socket.connected) {
            const timestamp = Date.now();
            socket.emit('chat_message', {
              streamKey: STREAM_KEY,
              message: `User ${i} - ${timestamp}`,
              timestamp,
            });
            this.stats.messagesSent++;
          }
        }, (60000 / MESSAGES_PER_USER_PER_MIN) * Math.random());

        socket._messageInterval = messageInterval;

        // Log progress every 50 users
        if (this.stats.connected % 50 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          console.log(`  ✓ ${this.stats.connected}/${NUM_USERS} connected (${elapsed.toFixed(1)}s)`);
        }
      });

      socket.on('chat_message', () => {
        this.stats.messagesReceived++;
      });

      socket.on('disconnect', () => {
        this.stats.disconnected++;
        clearInterval(socket._messageInterval);
      });

      socket.on('error', (error) => {
        this.stats.errors++;
        console.error(`  ✗ Socket ${i} error: ${error.message}`);
      });

      this.sockets.push(socket);

      // Stagger connections (10ms between each)
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Wait for all connections
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.stats.connected >= NUM_USERS * 0.95) {
          // 95% threshold
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Timeout after 60s
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 60000);
    });

    console.log(`\n✅ Connected: ${this.stats.connected}/${NUM_USERS}`);
    console.log(`⚠️  Failed: ${NUM_USERS - this.stats.connected}`);
  }

  async run() {
    const startTime = Date.now();
    const endTime = startTime + DURATION * 1000;

    console.log(`\n🔄 Running test for ${DURATION}s...\n`);

    // Print metrics every 10 seconds
    const metricsInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const connectedNow = this.sockets.filter((s) => s.connected).length;
      const msgRate = (this.stats.messagesSent / elapsed).toFixed(1);

      console.log(
        `[${elapsed.toFixed(0)}s] Connected: ${connectedNow}/${NUM_USERS} | ` +
          `Sent: ${this.stats.messagesSent} | Received: ${this.stats.messagesReceived} | ` +
          `Rate: ${msgRate} msg/s | Errors: ${this.stats.errors}`
      );
    }, 10000);

    // Wait for duration
    await new Promise((resolve) => setTimeout(resolve, DURATION * 1000));

    clearInterval(metricsInterval);
  }

  disconnect() {
    console.log(`\n🛑 Disconnecting ${this.sockets.length} sockets...`);
    this.sockets.forEach((socket) => {
      clearInterval(socket._messageInterval);
      socket.disconnect();
    });
  }

  printSummary() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const connectedNow = this.sockets.filter((s) => s.connected).length;

    console.log(`
╔════════════════════════════════════════════════════════╗
║                   TEST SUMMARY                         ║
╚════════════════════════════════════════════════════════╝

📊 Connection Stats:
  Total Requested: ${NUM_USERS}
  Peak Connected: ${this.stats.connected}
  Currently Connected: ${connectedNow}
  Failed: ${NUM_USERS - this.stats.connected}
  Success Rate: ${((this.stats.connected / NUM_USERS) * 100).toFixed(2)}%

💬 Message Stats:
  Total Sent: ${this.stats.messagesSent}
  Total Received: ${this.stats.messagesReceived}
  Avg Send Rate: ${(this.stats.messagesSent / elapsed).toFixed(1)} msg/s
  Avg Receive Rate: ${(this.stats.messagesReceived / elapsed).toFixed(1)} msg/s

⚠️  Errors:
  Total: ${this.stats.errors}
  Error Rate: ${((this.stats.errors / NUM_USERS) * 100).toFixed(2)}%

⏱️  Duration: ${elapsed.toFixed(1)}s
`);

    // Success criteria
    const successRate = (this.stats.connected / NUM_USERS) * 100;
    const disconnectRate = (this.stats.disconnected / this.stats.connected) * 100;

    console.log('🎯 Success Criteria:');
    console.log(`  Success Rate >= 95%: ${successRate >= 95 ? '✅' : '❌'} (${successRate.toFixed(2)}%)`);
    console.log(`  Disconnect Rate < 1%: ${disconnectRate < 1 ? '✅' : '❌'} (${disconnectRate.toFixed(2)}%)`);
    console.log(`  Error Rate < 2%: ${this.stats.errors / NUM_USERS < 0.02 ? '✅' : '❌'}`);
  }
}

async function main() {
  const tester = new LoadTester();

  try {
    await tester.connect();
    await tester.run();
    tester.disconnect();
    tester.printSummary();
  } catch (error) {
    console.error('Test failed:', error);
    tester.sockets.forEach((s) => s.disconnect());
    process.exit(1);
  }
}

main();
