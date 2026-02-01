import { Module, forwardRef } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { WebsocketModule } from '../websocket/websocket.module';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { EncryptionService } from '../../common/services/encryption.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [forwardRef(() => WebsocketModule), NotificationsModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    EncryptionService,
    {
      provide: 'WEBSOCKET_GATEWAY',
      useFactory: (gateway: WebsocketGateway) => gateway,
      inject: [WebsocketGateway],
    },
  ],
  exports: [AdminService],
})
export class AdminModule {}
