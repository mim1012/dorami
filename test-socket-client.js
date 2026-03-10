const io = require('socket.io-client');

console.log('🔌 Connecting to http://localhost:3001...');

const socket = io('http://localhost:3001', {
    transports: ['websocket', 'polling'],
    withCredentials: true
});

socket.on('connect', () => {
    console.log('✅ Connected! Socket ID:', socket.id);
    
    // Send ping
    console.log('📤 Sending ping...');
    socket.emit('ping', { message: 'Hello from Node.js test client', timestamp: Date.now() });
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected');
    process.exit(0);
});

socket.on('connect_error', (error) => {
    console.log('❌ Connection error:', error.message);
    process.exit(1);
});

socket.on('pong', (data) => {
    console.log('📨 Received pong:', data);
    
    // Success! Disconnect after 2 seconds
    setTimeout(() => {
        console.log('✅ Test successful! Disconnecting...');
        socket.disconnect();
    }, 2000);
});

// Timeout after 10 seconds
setTimeout(() => {
    console.log('⏱️ Timeout - no response received');
    process.exit(1);
}, 10000);
