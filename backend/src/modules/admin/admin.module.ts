import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AlimtalkModule } from './alimtalk.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule, AlimtalkModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService, AlimtalkModule],
})
export class AdminModule {}
