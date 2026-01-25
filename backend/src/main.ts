import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { BusinessExceptionFilter } from './common/filters/business-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

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
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // API Prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}/api`);
  console.log(`🔌 WebSocket server ready for connections`);
}
bootstrap();
