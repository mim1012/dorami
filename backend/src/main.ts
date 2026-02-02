import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { BusinessExceptionFilter } from './common/filters/business-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';
import cookieParser from 'cookie-parser';
import { join } from 'path';

async function bootstrap() {
  console.log('>>> Bootstrap starting...');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  console.log('>>> AppModule created');

  // Serve static files from uploads directory
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  console.log('>>> Static assets configured');

  // Cookie Parser Middleware (for HTTP-only cookies)
  app.use(cookieParser());
  console.log('>>> Cookie parser registered');

  // Manual CORS middleware removed - using NestJS built-in CORS instead

  // Global Validation Pipe
  // Temporarily disabled due to class-validator package issues
  // app.useGlobalPipes(
  //   new ValidationPipe({
  //     whitelist: true,
  //     forbidNonWhitelisted: true,
  //     transform: true,
  //   }),
  // );
  console.log('>>> Validation pipe skipped');

  // Global Exception Filter
  app.useGlobalFilters(new BusinessExceptionFilter());

  // Global Response Transformer
  app.useGlobalInterceptors(new TransformInterceptor());

  // CORS Configuration
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [];
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Development: Allow localhost origins
  // Production: Strict origin validation
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      
      // Development environment: allow localhost and common dev origins
      if (isDevelopment) {
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return callback(null, true);
        }
      }
      
      // Check against allowed origins list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked: ${origin} not in allowed origins`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Content-Type'],
  });
  
  if (isDevelopment) {
    console.log('>>> CORS enabled for development (localhost allowed)');
  } else {
    console.log(`>>> CORS enabled with ${allowedOrigins.length} allowed origins`);
    if (allowedOrigins.length === 0) {
      console.warn('⚠️  WARNING: No CORS origins configured for production!');
    }
  }

  // Setup Redis Adapter for Socket.IO
  // Temporarily disabled to allow server to start
  // TODO: Fix Redis adapter connection hanging issue
  // const redisIoAdapter = new RedisIoAdapter(app);
  // await redisIoAdapter.connectToRedis();
  // app.useWebSocketAdapter(redisIoAdapter);

  // API Prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  console.log('>>> About to listen on port', port);
  await app.listen(port);
  console.log('>>> Server is listening');

  console.log(`🚀 Application is running on: http://localhost:${port}/api`);
  console.log(`🔌 WebSocket server ready for connections`);
}
bootstrap();
