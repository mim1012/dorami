import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

// Connection pool configuration
// These values should be tuned based on your deployment:
// - connection_limit: typically (CPU cores * 2) + 1
// - pool_timeout: seconds to wait for a connection from the pool
// Configure via DATABASE_URL query params: ?connection_limit=20&pool_timeout=30

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connectionRetries = 0;
  private readonly maxRetries = 3;
  private readonly connectionShutdownTimeoutMs = 30_000;

  constructor() {
    const databaseUrl = PrismaService.buildDatabaseUrl();

    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log:
        process.env.NODE_ENV === 'development'
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
        timeout: parseInt(process.env.PRISMA_TRANSACTION_TIMEOUT_MS ?? '10000', 10),
      },
    });
  }

  private static buildDatabaseUrl(): string {
    const databaseUrl = process.env.DATABASE_URL ?? '';
    const connectionLimit = process.env.PRISMA_CONNECTION_LIMIT ?? '30';
    const poolTimeout = process.env.PRISMA_POOL_TIMEOUT_SECONDS ?? '30';

    if (!databaseUrl) {
      return databaseUrl;
    }

    try {
      const parsed = new URL(databaseUrl);
      parsed.searchParams.set('connection_limit', connectionLimit);
      parsed.searchParams.set('pool_timeout', poolTimeout);
      return parsed.toString();
    } catch {
      // URL 형식이 비정상적일 경우, 원본 값 그대로 사용
      return databaseUrl;
    }
  }

  async onModuleInit() {
    // Log slow queries in development
    if (process.env.NODE_ENV === 'development') {
      (this as unknown as { $on: (event: string, cb: (e: Prisma.QueryEvent) => void) => void }).$on(
        'query',
        (e: Prisma.QueryEvent) => {
          if (e.duration > 100) {
            this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
          }
        },
      );
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
    const timeout = setTimeout(() => {
      this.logger.warn(
        `Database disconnect timeout exceeded (${this.connectionShutdownTimeoutMs}ms)`,
      );
    }, this.connectionShutdownTimeoutMs);

    try {
      await this.$queryRaw`SELECT 1`;
      await this.$disconnect();
      this.logger.log('Database disconnected');
    } catch (error) {
      this.logger.error('Database shutdown failed', error as Error);
    } finally {
      clearTimeout(timeout);
    }
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
