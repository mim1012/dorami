import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { BusinessExceptionFilter } from './common/filters/business-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { CsrfGuard } from './common/guards';
import cookieParser from 'cookie-parser';
import { SocketIoProvider } from './modules/websocket/socket-io.provider';
import { PrismaService } from './common/prisma/prisma.service';
import { StreamingService } from './modules/streaming/streaming.service';
import helmet from 'helmet';
import compression from 'compression';
import { join } from 'path';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { CustomIoAdapter } from './common/adapters/custom-io.adapter';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { authenticateSocket } from './common/middleware/ws-jwt-auth.middleware';
import { rateLimitCheck } from './common/middleware/ws-rate-limit.middleware';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('🚀 Bootstrap starting...');

  // Validate critical environment variables
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_HOST', 'REDIS_PORT'];

  const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);
  if (missingEnvVars.length > 0) {
    logger.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
  }

  logger.log('✅ Environment variables validated');

  // Production mode check
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    logger.log('🏭 Running in PRODUCTION mode');
  } else {
    logger.warn('⚠️ Running in DEVELOPMENT mode');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  logger.log('AppModule created');

  // Serve static files from uploads directory
  // process.cwd() == backend/ (workspace root), __dirname == dist/src/ after compile
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
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
          // In production Swagger is disabled so we don't need unsafe-inline for scripts/styles
          scriptSrc: isProduction ? ["'none'"] : ["'self'", "'unsafe-inline'"],
          styleSrc: isProduction ? ["'none'"] : ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'wss:', 'ws:'],
          fontSrc: ["'self'", 'https:', 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", 'https:'],
          frameSrc: ["'none'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
      // HSTS: enforce HTTPS for 1 year, include subdomains
      strictTransportSecurity: isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      // Prevent MIME-type sniffing
      xContentTypeOptions: true,
      // Clickjacking protection
      xFrameOptions: { action: 'deny' },
      // Referrer policy: don't leak full URL to third parties
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginEmbedderPolicy: false, // Required for loading external resources
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  // Permissions-Policy: restrict browser features
  app.use(
    (
      _req: unknown,
      res: { setHeader: (name: string, value: string) => void },
      next: () => void,
    ) => {
      res.setHeader(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      );
      next();
    },
  );
  logger.log('Security headers (helmet + permissions-policy) enabled');

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
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error for unknown properties
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: false, // Use explicit @Type() decorators in DTOs instead
      },
      disableErrorMessages: process.env.NODE_ENV === 'production', // Hide details in production
    }),
  );
  logger.log('Validation pipe enabled');

  // Global Exception Filter
  app.useGlobalFilters(new BusinessExceptionFilter());

  // Global Response Transformer
  app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));

  // CSRF Protection Guard (Double Submit Cookie Pattern)
  // Always enabled in production; can be disabled in non-production with CSRF_ENABLED=false
  if (isProduction || process.env.CSRF_ENABLED !== 'false') {
    const reflector = app.get(Reflector);
    app.useGlobalGuards(new CsrfGuard(reflector));
    logger.log('CSRF protection enabled');
  } else {
    logger.warn('CSRF protection disabled (CSRF_ENABLED=false) — development only');
  }

  // CORS Configuration - Whitelist based
  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
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
    maxAge: 86400, // 24 hours preflight cache
  });

  logger.log(`CORS enabled for origins: ${allowedOrigins.join(', ')}`);

  // Manual Socket.IO server creation and attachment
  const httpServer = app.getHttpServer();

  logger.log('📡 Creating Socket.IO server manually...');
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // Attach Redis adapter to Socket.IO
  logger.log('🔌 Connecting to Redis for Socket.IO adapter...');
  const pubClient = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  io.adapter(createAdapter(pubClient, subClient));
  logger.log('✅ Redis adapter connected');

  // Set IO server on the SocketIoProvider for dependency injection
  const socketIoProvider = app.get(SocketIoProvider);
  socketIoProvider.setServer(io);
  logger.log('✅ SocketIoProvider configured for DI');

  // Attach to httpServer
  (httpServer as unknown as { io: Server }).io = io;
  logger.log('✅ Socket.IO server attached to HTTP server');

  // Use CustomIoAdapter to allow NestJS Gateways to use our pre-configured Socket.IO server
  app.useWebSocketAdapter(new CustomIoAdapter(app, io));
  logger.log('✅ CustomIoAdapter configured for NestJS Gateways');

  // API Prefix
  app.setGlobalPrefix('api');

  // Swagger/OpenAPI Documentation (non-production only)
  if (process.env.APP_ENV !== 'production') {
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

  const port = process.env.PORT ?? 3001;
  logger.log(`Starting server on port ${port}...`);

  await app.listen(port);

  logger.log(`HTTP server started on port ${port}`);

  // Get service instances from app context
  const jwtService = app.get(JwtService);
  const prismaService = app.get(PrismaService);
  const eventEmitter = app.get(EventEmitter2);
  const streamingService = app.get(StreamingService);

  // Manually create /chat namespace with full ChatGateway logic
  const chatNamespace = io.of('/chat');
  logger.log('✅ Created /chat namespace manually');

  chatNamespace.on('connection', async (socket) => {
    try {
      // Authenticate socket
      const authenticatedSocket = await authenticateSocket(socket, jwtService);
      logger.log(
        `✅ Client connected to /chat: ${authenticatedSocket.id} (User: ${authenticatedSocket.user.userId})`,
      );

      // Send welcome message
      socket.emit('connection:success', {
        type: 'connection:success',
        data: {
          message: 'Connected to chat server',
          userId: authenticatedSocket.user.userId,
          timestamp: new Date().toISOString(),
        },
      });

      // Handle chat:join-room
      socket.on('chat:join-room', async (payload: { liveId: string }) => {
        if (!rateLimitCheck(socket, 'chat:join-room', { windowMs: 10000, maxEvents: 10 })) {
          return;
        }
        const roomName = `live:${payload.liveId}`;
        await socket.join(roomName);

        logger.log(`📥 User ${authenticatedSocket.user.userId} joined room ${roomName}`);

        // Send recent chat history (last 50 messages from Redis)
        try {
          const historyKey = `chat:${payload.liveId}:history`;
          const messages = await pubClient.lRange(historyKey, -50, -1);
          if (messages.length > 0) {
            socket.emit('chat:history', {
              type: 'chat:history',
              data: {
                liveId: payload.liveId,
                messages: messages.map((m) => JSON.parse(String(m))),
              },
            });
          }
        } catch (err) {
          logger.warn(`Failed to load chat history for ${payload.liveId}: ${err}`);
        }

        // Notify room members
        chatNamespace.to(roomName).emit('chat:user-joined', {
          type: 'chat:user-joined',
          data: {
            userId: authenticatedSocket.user.userId,
            liveId: payload.liveId,
            timestamp: new Date().toISOString(),
          },
        });

        // Confirm to client
        socket.emit('chat:join-room:success', {
          type: 'chat:join-room:success',
          data: {
            roomName,
            timestamp: new Date().toISOString(),
          },
        });
      });

      // Handle chat:leave-room
      socket.on('chat:leave-room', async (payload: { liveId: string }) => {
        if (!rateLimitCheck(socket, 'chat:leave-room', { windowMs: 10000, maxEvents: 10 })) {
          return;
        }
        const roomName = `live:${payload.liveId}`;
        await socket.leave(roomName);

        logger.log(`📤 User ${authenticatedSocket.user.userId} left room ${roomName}`);

        // Notify room members
        chatNamespace.to(roomName).emit('chat:user-left', {
          type: 'chat:user-left',
          data: {
            userId: authenticatedSocket.user.userId,
            liveId: payload.liveId,
            timestamp: new Date().toISOString(),
          },
        });

        socket.emit('chat:leave-room:success', {
          type: 'chat:leave-room:success',
          data: {
            roomName,
            timestamp: new Date().toISOString(),
          },
        });
      });

      // Handle chat:send-message
      socket.on('chat:send-message', async (payload: { liveId: string; message: string }) => {
        // Rate limiting: max 20 messages per 10 seconds
        if (!rateLimitCheck(socket, 'chat:send-message', { windowMs: 10000, maxEvents: 20 })) {
          return;
        }

        // Validate message
        if (!payload.message || typeof payload.message !== 'string') {
          socket.emit('error', {
            type: 'error',
            errorCode: 'INVALID_MESSAGE',
            message: 'Message is required and must be a string',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        // Sanitize: strip HTML tags to prevent XSS
        const sanitizedMessage = payload.message.replace(/<[^>]*>/g, '').trim();

        // Validate length (max 500 characters)
        if (sanitizedMessage.length === 0 || sanitizedMessage.length > 500) {
          socket.emit('error', {
            type: 'error',
            errorCode: 'MESSAGE_TOO_LONG',
            message: 'Message must be between 1 and 500 characters',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        const roomName = `live:${payload.liveId}`;

        // Fetch user's instagramId for display in chat
        let username = '익명';
        try {
          const user = await prismaService.user.findUnique({
            where: { id: authenticatedSocket.user.userId },
            select: { instagramId: true },
          });
          username = user?.instagramId ?? '익명';
        } catch {
          // Fallback to anonymous
        }

        const messageData = {
          id: Date.now().toString(),
          liveId: payload.liveId,
          userId: authenticatedSocket.user.userId,
          username,
          message: sanitizedMessage,
          timestamp: new Date().toISOString(),
        };

        // Store message in Redis (async, non-blocking, max 100 messages, 24h TTL)
        const historyKey = `chat:${payload.liveId}:history`;
        pubClient
          .rPush(historyKey, JSON.stringify(messageData))
          .then(() => pubClient.lTrim(historyKey, -100, -1))
          .then(() => pubClient.expire(historyKey, 86400))
          .catch((err) => logger.warn(`Failed to cache chat message: ${err}`));

        // Broadcast to all clients in room
        chatNamespace.to(roomName).emit('chat:message', {
          type: 'chat:message',
          data: messageData,
        });

        socket.emit('chat:send-message:success', {
          type: 'chat:send-message:success',
          data: {
            timestamp: new Date().toISOString(),
          },
        });
      });

      // Handle chat:delete-message
      socket.on('chat:delete-message', async (payload: { liveId: string; messageId: string }) => {
        // Check if user is ADMIN
        if (authenticatedSocket.user.role !== 'ADMIN') {
          socket.emit('error', {
            type: 'error',
            errorCode: 'FORBIDDEN',
            message: 'Only administrators can delete messages',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        // Validate messageId
        if (!payload.messageId) {
          socket.emit('error', {
            type: 'error',
            errorCode: 'INVALID_MESSAGE_ID',
            message: 'Message ID is required',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        const roomName = `live:${payload.liveId}`;

        logger.log(
          `🗑️  Admin ${authenticatedSocket.user.userId} deleted message ${payload.messageId} in ${roomName}`,
        );

        // Broadcast deletion to all clients in room
        chatNamespace.to(roomName).emit('chat:message-deleted', {
          type: 'chat:message-deleted',
          data: {
            messageId: payload.messageId,
            liveId: payload.liveId,
            deletedBy: authenticatedSocket.user.userId,
            timestamp: new Date().toISOString(),
          },
        });

        socket.emit('chat:delete-message:success', {
          type: 'chat:delete-message:success',
          data: {
            messageId: payload.messageId,
            timestamp: new Date().toISOString(),
          },
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.log(`👋 Client disconnected from /chat: ${authenticatedSocket.id}`);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Chat connection failed: ${errorMessage}`);
      if (process.env.NODE_ENV !== 'production') {
        logger.error(error instanceof Error ? error.stack : String(error));
      }
      socket.emit('error', {
        type: 'error',
        errorCode: 'AUTH_FAILED',
        message: 'Authentication failed',
        timestamp: new Date().toISOString(),
      });
      socket.disconnect();
    }
  });

  // Create /streaming namespace with StreamingGateway logic
  const streamingNamespace = io.of('/streaming');
  const socketStreams = new Map<string, string>();
  logger.log('✅ Created /streaming namespace manually');

  streamingNamespace.on('connection', async (socket) => {
    try {
      const authenticatedSocket = await authenticateSocket(socket, jwtService);
      logger.log(
        `✅ Client connected to /streaming: ${authenticatedSocket.id} (User: ${authenticatedSocket.user.userId})`,
      );

      socket.emit('connection:success', {
        type: 'connection:success',
        data: {
          message: 'Connected to streaming server',
          userId: authenticatedSocket.user.userId,
          timestamp: new Date().toISOString(),
        },
      });

      // Handle stream:viewer:join
      socket.on('stream:viewer:join', async (payload: { streamKey: string }) => {
        if (!rateLimitCheck(socket, 'stream:viewer:join', { windowMs: 10000, maxEvents: 10 })) {
          return;
        }
        const { streamKey } = payload;
        const roomName = `stream:${streamKey}`;

        await socket.join(roomName);
        socketStreams.set(socket.id, streamKey);

        // Add userId to viewer Set (idempotent — reconnects don't double-count)
        const userId = authenticatedSocket.user.userId;
        await pubClient.sAdd(`stream:${streamKey}:viewer_ids`, userId);
        const viewerCount = Number(await pubClient.sCard(`stream:${streamKey}:viewer_ids`));

        logger.log(
          `📥 Viewer ${authenticatedSocket.user.userId} joined stream ${streamKey}, count: ${viewerCount}`,
        );

        // Broadcast viewer count update
        streamingNamespace.to(roomName).emit('stream:viewer:update', {
          type: 'stream:viewer:update',
          data: {
            streamKey,
            viewerCount,
            timestamp: new Date().toISOString(),
          },
        });

        socket.emit('stream:viewer:join:success', {
          type: 'stream:viewer:join:success',
          data: {
            streamKey,
            viewerCount,
            timestamp: new Date().toISOString(),
          },
        });
      });

      // Handle stream:viewer:leave
      socket.on('stream:viewer:leave', async (payload: { streamKey: string }) => {
        if (!rateLimitCheck(socket, 'stream:viewer:leave', { windowMs: 10000, maxEvents: 10 })) {
          return;
        }
        const { streamKey } = payload;
        const roomName = `stream:${streamKey}`;

        await socket.leave(roomName);
        socketStreams.delete(socket.id);

        // Remove userId from viewer Set
        const userId = authenticatedSocket.user.userId;
        await pubClient.sRem(`stream:${streamKey}:viewer_ids`, userId);
        const viewerCount = Number(await pubClient.sCard(`stream:${streamKey}:viewer_ids`));

        logger.log(`📤 Viewer ${authenticatedSocket.user.userId} left stream ${streamKey}`);

        // Broadcast viewer count update
        streamingNamespace.to(roomName).emit('stream:viewer:update', {
          type: 'stream:viewer:update',
          data: {
            streamKey,
            viewerCount: Math.max(0, viewerCount),
            timestamp: new Date().toISOString(),
          },
        });

        socket.emit('stream:viewer:leave:success', {
          type: 'stream:viewer:leave:success',
          data: {
            streamKey,
            timestamp: new Date().toISOString(),
          },
        });
      });

      // Handle disconnect
      socket.on('disconnect', async () => {
        const streamKey = socketStreams.get(socket.id);
        if (streamKey) {
          const roomName = `stream:${streamKey}`;
          const userId = authenticatedSocket.user.userId;
          await pubClient.sRem(`stream:${streamKey}:viewer_ids`, userId);
          const viewerCount = Number(await pubClient.sCard(`stream:${streamKey}:viewer_ids`));

          streamingNamespace.to(roomName).emit('stream:viewer:update', {
            type: 'stream:viewer:update',
            data: {
              streamKey,
              viewerCount: Math.max(0, viewerCount),
              timestamp: new Date().toISOString(),
            },
          });

          socketStreams.delete(socket.id);
        }
        logger.log(`👋 Client disconnected from /streaming: ${authenticatedSocket.id}`);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Streaming connection failed: ${errorMessage}`);
      if (process.env.NODE_ENV !== 'production') {
        logger.error(error instanceof Error ? error.stack : String(error));
      }
      socket.emit('error', {
        type: 'error',
        errorCode: 'AUTH_FAILED',
        message: 'Authentication failed',
        timestamp: new Date().toISOString(),
      });
      socket.disconnect();
    }
  });

  // Listen for stream:ended events from StreamingService and broadcast to /streaming namespace
  // (Replaces the dead StreamingGateway.handleStreamEnded which was never registered in any module)
  eventEmitter.on('stream:ended', (payload: { streamId: string; streamKey?: string }) => {
    void (async () => {
      if (!payload.streamKey) {
        return;
      }
      const roomName = `stream:${payload.streamKey}`;
      logger.log(`Broadcasting stream:ended to room ${roomName}`);
      streamingNamespace.to(roomName).emit('stream:ended', {
        streamKey: payload.streamKey,
      });

      // Broadcast upcoming streams update to all connected clients
      try {
        const streams = await streamingService.getUpcomingStreams(3);
        io.emit('upcoming:updated', { streams });
        logger.log('Broadcasted upcoming:updated to all clients after stream ended');
      } catch (error) {
        logger.warn(`Failed to broadcast upcoming:updated: ${error}`);
      }
    })();
  });

  // Listen for stream:started events
  eventEmitter.on('stream:started', (_payload: { streamId: string; streamKey?: string }) => {
    void (async () => {
      try {
        const streams = await streamingService.getUpcomingStreams(3);
        io.emit('upcoming:updated', { streams });
        logger.log('Broadcasted upcoming:updated to all clients after stream started');
      } catch (error) {
        logger.warn(`Failed to broadcast upcoming:updated: ${error}`);
      }
    })();
  });

  // Listen for stream:created events
  eventEmitter.on('stream:created', (_payload: { streamId: string }) => {
    void (async () => {
      try {
        const streams = await streamingService.getUpcomingStreams(3);
        io.emit('upcoming:updated', { streams });
        logger.log('Broadcasted upcoming:updated to all clients after stream created');
      } catch (error) {
        logger.warn(`Failed to broadcast upcoming:updated: ${error}`);
      }
    })();
  });

  // Listen for order:paid events from OrdersService and broadcast purchase notification
  eventEmitter.on('order:paid', (payload: { orderId: string; userId: string; paidAt: Date }) => {
    void (async () => {
      try {
        const [user, order] = await Promise.all([
          prismaService.user.findUnique({
            where: { id: payload.userId },
            select: { instagramId: true, name: true },
          }),
          prismaService.order.findUnique({
            where: { id: payload.orderId },
            include: {
              orderItems: {
                include: {
                  Product: {
                    select: { streamKey: true },
                  },
                },
              },
            },
          }),
        ]);

        const displayName = user?.instagramId ?? user?.name ?? '익명';
        const streamKey = order?.orderItems?.[0]?.Product?.streamKey;

        if (!streamKey) {
          logger.warn(`order:paid — no streamKey found for order ${payload.orderId}`);
          return;
        }

        rootNamespace.to(`stream:${streamKey}`).emit('order:purchase:notification', {
          streamKey,
          displayName,
          message: `${displayName}님이 결제했습니다`,
        });

        logger.log(
          `Broadcasted order:purchase:notification to stream:${streamKey} for user ${displayName}`,
        );
      } catch (error) {
        logger.warn(`Failed to broadcast order:purchase:notification: ${error}`);
      }
    })();
  });

  // Create root namespace (/) with WebsocketGateway logic
  const rootNamespace = io.of('/');
  logger.log('✅ Configured root (/) namespace manually');

  rootNamespace.on('connection', async (socket) => {
    try {
      const authenticatedSocket = await authenticateSocket(socket, jwtService);
      logger.log(
        `✅ Client connected to /: ${authenticatedSocket.id} (User: ${authenticatedSocket.user.userId})`,
      );

      socket.emit('connected', {
        message: 'Connected to Live Commerce WebSocket',
        userId: authenticatedSocket.user.userId,
      });

      // Handle join:stream
      socket.on('join:stream', async (data: { streamId: string }) => {
        if (!rateLimitCheck(socket, 'join:stream', { windowMs: 10000, maxEvents: 10 })) {
          return;
        }
        const roomName = `stream:${data.streamId}`;
        await socket.join(roomName);

        logger.log(`📥 Client ${socket.id} joined stream room: ${roomName}`);

        rootNamespace.to(roomName).emit('user:joined', {
          userId: authenticatedSocket.user.userId,
          streamId: data.streamId,
          timestamp: new Date().toISOString(),
        });
      });

      // Handle leave:stream
      socket.on('leave:stream', async (data: { streamId: string }) => {
        if (!rateLimitCheck(socket, 'leave:stream', { windowMs: 10000, maxEvents: 10 })) {
          return;
        }
        const roomName = `stream:${data.streamId}`;
        await socket.leave(roomName);

        logger.log(`📤 Client ${socket.id} left stream room: ${roomName}`);

        rootNamespace.to(roomName).emit('user:left', {
          userId: authenticatedSocket.user.userId,
          streamId: data.streamId,
          timestamp: new Date().toISOString(),
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        const rooms = Array.from(socket.rooms).filter((room) => room !== socket.id);
        for (const room of rooms) {
          void socket.leave(room);
          logger.log(`Client ${socket.id} left room: ${room}`);
        }
        logger.log(`👋 Client disconnected from /: ${socket.id}`);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Root connection failed: ${errorMessage}`);
      if (process.env.NODE_ENV !== 'production') {
        logger.error(error instanceof Error ? error.stack : String(error));
      }
      socket.emit('error', { message: 'Authentication failed' });
      socket.disconnect();
    }
  });

  // Expose ProductGateway broadcast methods on the io server for use by services
  interface IoWithBroadcast {
    broadcastProductAdded: (streamKey: string, product: { id: string }) => void;
    broadcastProductUpdated: (streamKey: string, product: { id: string }) => void;
    broadcastProductSoldOut: (streamKey: string, productId: string) => void;
    broadcastProductDeleted: (streamKey: string, productId: string) => void;
  }
  const ioExt = io as unknown as IoWithBroadcast;

  ioExt.broadcastProductAdded = (streamKey: string, product: { id: string }) => {
    const room = `stream:${streamKey}`;
    rootNamespace.to(room).emit('live:product:added', {
      type: 'live:product:added',
      data: product,
    });
    logger.log(`Product added broadcast sent to room ${room}: ${product.id}`);
  };

  ioExt.broadcastProductUpdated = (streamKey: string, product: { id: string }) => {
    const room = `stream:${streamKey}`;
    rootNamespace.to(room).emit('live:product:updated', {
      type: 'live:product:updated',
      data: product,
    });
    logger.log(`Product updated broadcast sent to room ${room}: ${product.id}`);
  };

  ioExt.broadcastProductSoldOut = (streamKey: string, productId: string) => {
    const room = `stream:${streamKey}`;
    rootNamespace.to(room).emit('live:product:soldout', {
      type: 'live:product:soldout',
      data: { productId },
    });
    logger.log(`Product sold out broadcast sent to room ${room}: ${productId}`);
  };

  ioExt.broadcastProductDeleted = (streamKey: string, productId: string) => {
    const room = `stream:${streamKey}`;
    rootNamespace.to(room).emit('live:product:deleted', {
      type: 'live:product:deleted',
      data: { productId },
    });
    logger.log(`Product deleted broadcast sent to room ${room}: ${productId}`);
  };

  // Check if Socket.IO is attached
  setTimeout(() => {
    const sio = (httpServer as unknown as { io?: { _nsps: Map<string, unknown> } }).io;
    if (sio) {
      const namespaces = Array.from(sio._nsps.keys()).join(', ');
      logger.log(`✅ Socket.IO server verified, namespaces: ${namespaces}`);
    } else {
      logger.warn(`❌ Socket.IO server NOT attached to HTTP server`);
    }
  }, 1000);

  logger.log(`Application is running on: http://localhost:${port}/api`);

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    logger.log(`\n⚠️  Received ${signal}, starting graceful shutdown...`);

    // Close Socket.IO connections
    logger.log('🔌 Closing Socket.IO connections...');
    await new Promise<void>((resolve) => {
      void io.close(() => {
        logger.log('✅ Socket.IO connections closed');
        resolve();
      });
    });

    // Close Redis connections
    logger.log('🔌 Closing Redis connections...');
    await Promise.all([pubClient.quit(), subClient.quit()]);
    logger.log('✅ Redis connections closed');

    // Close HTTP server
    logger.log('🔌 Closing HTTP server...');
    await app.close();
    logger.log('✅ HTTP server closed');

    logger.log('✅ Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void gracefulShutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void gracefulShutdown('SIGINT');
  });

  // Unhandled rejection handler
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Uncaught exception handler
  process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught Exception:', error);
    void gracefulShutdown('UNCAUGHT_EXCEPTION');
  });
}

bootstrap().catch((error) => {
  console.error('❌ Bootstrap failed:', error);
  process.exit(1);
});
