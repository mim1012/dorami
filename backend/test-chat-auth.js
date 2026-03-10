const io = require('socket.io-client');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5N2U1NGQwMy0xYmMxLTQ5MzQtODZjZS03YzIxODI0Y2IzMTciLCJ1c2VySWQiOiI5N2U1NGQwMy0xYmMxLTQ5MzQtODZjZS03YzIxODI0Y2IzMTciLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJrYWthb0lkIjoidGVzdF9rYWthb18wMDIiLCJyb2xlIjoiVVNFUiIsInR5cGUiOiJhY2Nlc3MiLCJqdGkiOiIwYzkyZWUxYS03Y2M3LTQ5NzEtODJmNC00MmI4Nzg2NThkZDEiLCJpYXQiOjE3NzA5MTY5NTIsImV4cCI6MTc3MDkxNzg1Mn0.Uepjf4Y3V4m8GJYIT70x_VGc6kOleKJo0OgKfiUxQ2U';

const socket = io('http://localhost:3001/chat', {
  transports: ['websocket', 'polling'],
  auth: {
    token: TOKEN
  }
});

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
});

socket.on('connection:success', (data) => {
  console.log('📥 Connection success:', data);
  
  // Test join room
  console.log('\n🔵 Testing chat:join-room...');
  socket.emit('chat:join-room', { liveId: 'test-live-123' });
});

socket.on('chat:join-room:success', (data) => {
  console.log('✅ Join room success:', data);
  
  // Test send message
  console.log('\n🔵 Testing chat:send-message...');
  socket.emit('chat:send-message', {
    liveId: 'test-live-123',
    message: 'Hello from test client!'
  });
});

socket.on('chat:send-message:success', (data) => {
  console.log('✅ Send message success:', data);
});

socket.on('chat:message', (data) => {
  console.log('📨 Received message:', data);
  
  // Test leave room
  console.log('\n🔵 Testing chat:leave-room...');
  socket.emit('chat:leave-room', { liveId: 'test-live-123' });
});

socket.on('chat:leave-room:success', (data) => {
  console.log('✅ Leave room success:', data);
  
  console.log('\n✅ All tests passed! Disconnecting...');
  setTimeout(() => {
    socket.close();
    process.exit(0);
  }, 1000);
});

socket.on('chat:user-joined', (data) => {
  console.log('👋 User joined:', data);
});

socket.on('chat:user-left', (data) => {
  console.log('👋 User left:', data);
});

socket.on('error', (data) => {
  console.error('❌ Error:', data);
});

socket.on('connect_error', (err) => {
  console.error('❌ Connection error:', err.message);
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected');
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏱️ Timeout');
  socket.close();
  process.exit(1);
}, 10000);
