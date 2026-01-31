import { Module, forwardRef } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { WebsocketModule } from '../websocket/websocket.module';
import { WebsocketGateway } from '../websocket/websocket.gateway';

@Module({
  imports: [forwardRef(() => WebsocketModule)],
  controllers: [AdminController],
  providers: [
    AdminService,
    {
      provide: 'WEBSOCKET_GATEWAY',
      useFactory: (gateway: WebsocketGateway) => gateway,
      inject: [WebsocketGateway],
    },
  ],
  exports: [AdminService],
})
export class AdminModule {}
