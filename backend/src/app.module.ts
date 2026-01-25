import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from './common/logger/logger.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { StreamingModule } from './modules/streaming/streaming.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { ChatModule } from './modules/chat/chat.module';
import { OrdersModule } from './modules/orders/orders.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { StoreModule } from './modules/store/store.module';
import { ConfigSystemModule } from './modules/config-system/config-system.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: ':',
      maxListeners: 10,
    }),
    LoggerModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    StreamingModule,
    WebsocketModule,
    ChatModule,
    OrdersModule,
    NotificationsModule,
    SettlementModule,
    StoreModule,
    ConfigSystemModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
