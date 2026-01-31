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

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3002',
    ],
    credentials: true,
  });

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
