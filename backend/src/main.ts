import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { BusinessExceptionFilter } from './common/filters/business-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';
import { CsrfGuard } from './common/guards';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
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

  // Security Headers (helmet)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'wss:', 'ws:'],
          fontSrc: ["'self'", 'https:', 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", 'https:'],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Required for loading external resources
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  logger.log('Security headers (helmet) enabled');

  // Response Compression
  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6, // Compression level (1-9)
    }),
  );
  logger.log('Response compression enabled');

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

  // CSRF Protection Guard (Double Submit Cookie Pattern)
  // Skip for development if CSRF_ENABLED=false
  if (process.env.CSRF_ENABLED !== 'false') {
    const reflector = app.get(Reflector);
    app.useGlobalGuards(new CsrfGuard(reflector));
    logger.log('CSRF protection enabled');
  } else {
    logger.warn('CSRF protection disabled (CSRF_ENABLED=false)');
  }

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
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'X-CSRF-Token'],
    exposedHeaders: ['Content-Type'],
    maxAge: 86400,  // 24 hours preflight cache
  });

  logger.log(`CORS enabled for origins: ${allowedOrigins.join(', ')}`);

  // Setup Redis Adapter for Socket.IO (horizontal scaling)
  // Gracefully falls back to in-memory adapter if Redis is unavailable
  if (process.env.REDIS_ADAPTER_ENABLED !== 'false') {
    const redisIoAdapter = new RedisIoAdapter(app);
    const connected = await redisIoAdapter.connectToRedis();
    if (connected) {
      app.useWebSocketAdapter(redisIoAdapter);
      logger.log('Redis adapter enabled for WebSocket horizontal scaling');
    } else {
      logger.warn('Redis adapter disabled - running in single-server mode');
    }
  } else {
    logger.log('Redis adapter disabled by configuration');
  }

  // API Prefix
  app.setGlobalPrefix('api');

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });
  logger.log('API versioning enabled (v1)');

  // Swagger/OpenAPI Documentation (non-production only)
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('도라미 Live Commerce API')
      .setDescription(
        `
## 도라미 라이브 커머스 플랫폼 API 문서

### 인증
- Kakao OAuth 2.0 기반 로그인
- JWT Access Token (15분) + Refresh Token (7일)
- HTTP-only 쿠키 저장

### 주요 기능
- 🔐 **Auth**: 카카오 로그인, 토큰 갱신, 로그아웃
- 👤 **Users**: 프로필 조회/수정
- 📦 **Products**: 상품 CRUD, 재고 관리
- 🛒 **Cart**: 장바구니 관리 (10분 타이머)
- 📋 **Orders**: 주문 생성/조회
- 🎥 **Streaming**: 라이브 스트림 관리
- 💬 **Chat**: 실시간 채팅 (WebSocket)
- 🔔 **Notifications**: 푸시 알림
- ⚙️ **Admin**: 관리자 대시보드

### 에러 응답 형식
\`\`\`json
{
  "statusCode": 400,
  "errorCode": "ERROR_CODE",
  "message": "에러 메시지",
  "timestamp": "2026-02-03T00:00:00.000Z"
}
\`\`\`
        `,
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Access Token',
        },
        'access-token',
      )
      .addCookieAuth('accessToken', {
        type: 'apiKey',
        in: 'cookie',
        description: 'HTTP-only cookie containing JWT',
      })
      .addTag('Auth', '인증 관련 API')
      .addTag('Users', '사용자 관련 API')
      .addTag('Products', '상품 관련 API')
      .addTag('Cart', '장바구니 관련 API')
      .addTag('Orders', '주문 관련 API')
      .addTag('Streaming', '라이브 스트리밍 API')
      .addTag('Chat', '채팅 API')
      .addTag('Notifications', '알림 API')
      .addTag('Admin', '관리자 API')
      .addTag('Health', '서버 상태 확인')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
      customSiteTitle: '도라미 API 문서',
    });

    logger.log('Swagger documentation available at /api/docs');
  }

  const port = process.env.PORT || 3001;
  logger.log(`Starting server on port ${port}...`);
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}/api`);
  logger.log(`WebSocket server ready for connections`);
}
bootstrap();
