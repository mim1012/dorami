const io = require('socket.io-client');

// Connect to /chat namespace
const socket = io('http://localhost:3001/chat', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  auth: {
    token: 'dummy-token-for-testing'
  }
});

socket.on('connect', () => {
  console.log('✅ Connected to /chat:', socket.id);
});

socket.on('connection:success', (data) => {
  console.log('📥 Connection success:', data);
});

socket.on('connect_error', (err) => {
  console.error('❌ Connection error:', err.message);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected');
});

// Keep alive for 5 seconds
setTimeout(() => {
  console.log('👋 Test complete, closing...');
  socket.close();
  process.exit(0);
}, 5000);
