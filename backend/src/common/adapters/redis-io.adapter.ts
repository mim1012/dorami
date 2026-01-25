import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { INestApplicationContext } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const pubClient = createClient({
      url: process.env.REDIS_PUBSUB_URL || process.env.REDIS_URL || 'redis://localhost:6379/1',
    });

    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);

    console.log('✅ Socket.IO Redis adapter connected');
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || [
          'http://localhost:3000', // Client app
          'http://localhost:3002', // Admin app
        ],
        credentials: true,
      },
      pingTimeout: 60000,     // 60 seconds
      pingInterval: 25000,    // 25 seconds (heartbeat)
      connectTimeout: 45000,  // 45 seconds
      transports: ['websocket', 'polling'], // WebSocket preferred, polling fallback
    });

    server.adapter(this.adapterConstructor);

    return server;
  }
}
