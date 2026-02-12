import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configValidationSchema } from './common/config/config.validation';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from './common/logger/logger.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { throttlerConfig } from './common/throttler/throttler.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';
import { ProductsModule } from './modules/products/products.module';
import { StreamingModule } from './modules/streaming/streaming.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { ChatModule } from './modules/chat/chat.module';
import { CartModule } from './modules/cart/cart.module';
import { ReservationModule } from './modules/reservation/reservation.module';
import { OrdersModule } from './modules/orders/orders.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { StoreModule } from './modules/store/store.module';
import { NoticesModule } from './modules/notices/notices.module';
import { UploadModule } from './modules/upload/upload.module';
import { HealthModule } from './modules/health/health.module';
import { PointsModule } from './modules/points/points.module';
import { ReStreamModule } from './modules/restream/restream.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: configValidationSchema,
      validationOptions: {
        abortEarly: false, // Show all validation errors
        allowUnknown: true, // Allow unknown env vars
      },
    }),
    // Rate Limiting
    ThrottlerModule.forRoot(throttlerConfig),
    EventEmitterModule.forRoot({
      // Set this to `true` to use wildcards
      wildcard: true,
      // The delimiter used to segment namespaces
      delimiter: '.',
      // Set this to `true` if you want to emit the newListener event
      newListener: false,
      // Set this to `true` if you want to emit the removeListener event
      removeListener: false,
      // The maximum amount of listeners that can be assigned to an event
      maxListeners: 10,
      // Show event name in memory leak message when more than maximum amount of listeners are assigned
      verboseMemoryLeak: true,
      // Disable throwing uncaughtException if an error event is emitted and it has no listeners
      ignoreErrors: false,
    }),
    ScheduleModule.forRoot(),
    LoggerModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    AdminModule,
    ProductsModule,
    StreamingModule,
    WebsocketModule,
    ChatModule,
    CartModule,
    ReservationModule,
    OrdersModule,
    NotificationsModule,
    SettlementModule,
    StoreModule,
    NoticesModule,
    UploadModule,
    HealthModule,
    PointsModule,
    ReStreamModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global JWT Auth Guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Rate Limiting Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
