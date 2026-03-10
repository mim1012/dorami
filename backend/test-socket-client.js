const io = require('socket.io-client');

const socket = io('http://localhost:3001/test', {
  transports: ['websocket', 'polling'],
  reconnection: true,
});

socket.on('connect', () => {
  console.log('✅ Connected to server:', socket.id);
  
  // Send ping every 2 seconds
  const interval = setInterval(() => {
    console.log('📤 Sending ping...');
    socket.emit('ping');
  }, 2000);
  
  socket.on('pong', (data) => {
    console.log('📥 Received pong:', data);
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Disconnected');
    clearInterval(interval);
  });
});

socket.on('connect_error', (err) => {
  console.error('❌ Connection error:', err.message);
});

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n👋 Closing connection...');
  socket.close();
  process.exit(0);
});
