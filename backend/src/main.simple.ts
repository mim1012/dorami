import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { Server } from 'socket.io';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('🚀 Starting minimal server with manual Socket.IO...');

  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  const port = process.env.PORT || 3001;

  // Get HTTP server BEFORE listen
  const httpServer = app.getHttpServer();

  // Manual Socket.IO server creation and attachment
  logger.log('📡 Creating Socket.IO server manually...');
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Attach to httpServer
  (httpServer as any).io = io;
  logger.log('✅ Socket.IO server attached to HTTP server');

  // Setup test namespace
  const testNamespace = io.of('/test');
  testNamespace.on('connection', (socket) => {
    logger.log(`🔌 Client connected to /test: ${socket.id}`);

    socket.on('ping', () => {
      logger.log(`📨 Received ping from ${socket.id}`);
      socket.emit('pong', { timestamp: Date.now() });
    });

    socket.on('disconnect', () => {
      logger.log(`🔌 Client disconnected from /test: ${socket.id}`);
    });
  });

  await app.listen(port);

  logger.log(`✅ Server running on http://localhost:${port}`);
  logger.log(`🔌 WebSocket on ws://localhost:${port}`);
  logger.log(`🔌 Test namespace: ws://localhost:${port}/test`);

  // Verify attachment
  setTimeout(() => {
    const sio = (httpServer as any).io;
    if (sio) {
      const namespaces = Array.from(sio._nsps.keys());
      logger.log(`✅ Socket.IO verified, namespaces: ${namespaces.join(', ')}`);
    } else {
      logger.warn(`❌ Socket.IO server NOT found`);
    }
  }, 1000);
}

void bootstrap();
