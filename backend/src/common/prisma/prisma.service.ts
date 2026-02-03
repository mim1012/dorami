import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

// Connection pool configuration
// These values should be tuned based on your deployment:
// - connection_limit: typically (CPU cores * 2) + 1
// - pool_timeout: seconds to wait for a connection from the pool
// Configure via DATABASE_URL query params: ?connection_limit=20&pool_timeout=30

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private connectionRetries = 0;
  private readonly maxRetries = 3;

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
      // Transaction isolation level for consistency
      transactionOptions: {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000, // Max time to wait for transaction start (ms)
        timeout: 10000, // Max transaction execution time (ms)
      },
    });
  }

  async onModuleInit() {
    // Log slow queries in development
    if (process.env.NODE_ENV === 'development') {
      (this as any).$on('query', (e: Prisma.QueryEvent) => {
        if (e.duration > 100) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }

    await this.connectWithRetry();
  }

  private async connectWithRetry(): Promise<void> {
    while (this.connectionRetries < this.maxRetries) {
      try {
        await this.$connect();
        this.logger.log('Database connected successfully');
        this.connectionRetries = 0;
        return;
      } catch (error) {
        this.connectionRetries++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Database connection failed (attempt ${this.connectionRetries}/${this.maxRetries}): ${errorMessage}`,
        );

        if (this.connectionRetries >= this.maxRetries) {
          throw new Error(`Failed to connect to database after ${this.maxRetries} attempts`);
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, this.connectionRetries - 1) * 1000;
        this.logger.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Health check for the database connection
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
