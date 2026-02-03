import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { BusinessExceptionFilter } from './common/filters/business-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';
import cookieParser from 'cookie-parser';
import { join } from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('Bootstrap starting...');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  logger.log('AppModule created');

  // Serve static files from uploads directory
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  logger.log('Static assets configured');

  // Cookie Parser Middleware (for HTTP-only cookies)
  app.use(cookieParser());
  logger.log('Cookie parser registered');

  // Manual CORS middleware removed - using NestJS built-in CORS instead

  // Global Validation Pipe - CRITICAL: Input validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // Strip properties not in DTO
      forbidNonWhitelisted: true,   // Throw error for unknown properties
      transform: true,              // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,  // Allow implicit type conversion
      },
      disableErrorMessages: process.env.NODE_ENV === 'production',  // Hide details in production
    }),
  );
  logger.log('Validation pipe enabled');

  // Global Exception Filter
  app.useGlobalFilters(new BusinessExceptionFilter());

  // Global Response Transformer
  app.useGlobalInterceptors(new TransformInterceptor());

  // CORS Configuration - Whitelist based
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Content-Type'],
    maxAge: 86400,  // 24 hours preflight cache
  });

  logger.log(`CORS enabled for origins: ${allowedOrigins.join(', ')}`);

  // Setup Redis Adapter for Socket.IO
  // Temporarily disabled to allow server to start
  // TODO: Fix Redis adapter connection hanging issue
  // const redisIoAdapter = new RedisIoAdapter(app);
  // await redisIoAdapter.connectToRedis();
  // app.useWebSocketAdapter(redisIoAdapter);

  // API Prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  logger.log(`Starting server on port ${port}...`);
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}/api`);
  logger.log(`WebSocket server ready for connections`);
}
bootstrap();
