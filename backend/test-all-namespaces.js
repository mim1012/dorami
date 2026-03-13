const io = require('socket.io-client');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5N2U1NGQwMy0xYmMxLTQ5MzQtODZjZS03YzIxODI0Y2IzMTciLCJ1c2VySWQiOiI5N2U1NGQwMy0xYmMxLTQ5MzQtODZjZS03YzIxODI0Y2IzMTciLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJrYWthb0lkIjoidGVzdF9rYWthb18wMDIiLCJyb2xlIjoiVVNFUiIsInR5cGUiOiJhY2Nlc3MiLCJqdGkiOiJhZWFmMGNjZS1jNTRiLTQ4NTItODA4Ni1lOWRjYjI3NDMxY2QiLCJpYXQiOjE3NzA5MTczNTQsImV4cCI6MTc3MDkxODI1NH0.2gasLxYPsg_GpnV2ANh8PcF0KsqO1hRkipgY_OJxMns';

console.log('🧪 Testing all Socket.IO namespaces...\n');

// Test /chat namespace
const chatSocket = io('http://localhost:3001/chat', {
  auth: { token: TOKEN },
  transports: ['websocket']
});

chatSocket.on('connection:success', (data) => {
  console.log('✅ /chat connected:', data.data.userId);
  chatSocket.disconnect();
});

chatSocket.on('error', (err) => {
  console.error('❌ /chat error:', err);
});

// Test /streaming namespace
const streamingSocket = io('http://localhost:3001/streaming', {
  auth: { token: TOKEN },
  transports: ['websocket']
});

streamingSocket.on('connection:success', (data) => {
  console.log('✅ /streaming connected:', data.data.userId);
  streamingSocket.disconnect();
});

streamingSocket.on('error', (err) => {
  console.error('❌ /streaming error:', err);
});

// Test root (/) namespace
const rootSocket = io('http://localhost:3001/', {
  auth: { token: TOKEN },
  transports: ['websocket']
});

rootSocket.on('connected', (data) => {
  console.log('✅ / (root) connected:', data.userId);
  rootSocket.disconnect();
});

rootSocket.on('error', (err) => {
  console.error('❌ / (root) error:', err);
});

// Timeout
setTimeout(() => {
  console.log('\n🎉 All namespace tests completed!');
  process.exit(0);
}, 3000);
