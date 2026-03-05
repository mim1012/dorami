import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import { Logger } from '@nestjs/common';

const CONNECTION_TIMEOUT = parseInt(process.env.REDIS_CONNECTION_TIMEOUT_MS ?? '10000', 10);

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private pubClient: RedisClientType | null = null;
  private subClient: RedisClientType | null = null;
  private isConnected = false;

  /**
   * Connect to Redis with timeout and error handling
   */
  async connectToRedis(): Promise<boolean> {
    const redisUrl = process.env.REDIS_PUBSUB_URL ?? process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error(
        'REDIS_URL or REDIS_PUBSUB_URL must be set. ' +
          'In production/staging this is required. In development, set REDIS_URL=redis://localhost:6379',
      );
    }

    this.logger.log(
      `Connecting to Redis for Socket.IO adapter: ${redisUrl.replace(/\/\/.*@/, '//*****@')}`,
    );

    try {
      this.pubClient = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: CONNECTION_TIMEOUT,
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              this.logger.error('Redis reconnection failed after 3 attempts');
              return new Error('Redis reconnection failed');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.subClient = this.pubClient.duplicate();

      // Add error handlers
      this.pubClient.on('error', (err: Error) => {
        this.logger.error(`Redis pub client error: ${err.message}`);
      });

      this.subClient.on('error', (err: Error) => {
        this.logger.error(`Redis sub client error: ${err.message}`);
      });

      // Connect with timeout
      await Promise.race([
        Promise.all([this.pubClient.connect(), this.subClient.connect()]),
        new Promise((_, reject) =>
          setTimeout(() => {
            reject(new Error('Redis connection timeout'));
          }, CONNECTION_TIMEOUT),
        ),
      ]);

      this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
      this.isConnected = true;

      this.logger.log('Socket.IO Redis adapter connected successfully');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to connect to Redis for Socket.IO: ${errorMessage}`);
      this.logger.warn('Socket.IO will run without Redis adapter (single-server mode)');

      // Cleanup on failure
      await this.cleanup();
      return false;
    }
  }

  /**
   * Cleanup Redis connections
   */
  async cleanup(): Promise<void> {
    try {
      if (this.pubClient?.isOpen) {
        await this.pubClient.quit();
      }
      if (this.subClient?.isOpen) {
        await this.subClient.quit();
      }
    } catch {
      this.logger.warn('Error during Redis cleanup');
    }
    this.pubClient = null;
    this.subClient = null;
    this.adapterConstructor = null;
    this.isConnected = false;
  }

  override createIOServer(port: number, options?: ServerOptions) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        // CORS_ORIGINS validated by config.validation.ts; guaranteed present after app init
        origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3002')
          .split(',')
          .map((o) => o.trim()),
        credentials: true,
      },
      pingTimeout: parseInt(process.env.WS_PING_TIMEOUT_MS ?? '60000', 10),
      pingInterval: parseInt(process.env.WS_PING_INTERVAL_MS ?? '25000', 10),
      connectTimeout: parseInt(process.env.WS_CONNECT_TIMEOUT_MS ?? '45000', 10),
      transports: ['websocket', 'polling'],
    });

    // Only use Redis adapter if connected
    if (this.isConnected && this.adapterConstructor) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      server.adapter(this.adapterConstructor);
      this.logger.log('Socket.IO using Redis adapter for horizontal scaling');
    } else {
      this.logger.log('Socket.IO using default in-memory adapter');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return server;
  }
}
