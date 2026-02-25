import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AlimtalkModule } from './alimtalk.module';
import { EncryptionService } from '../../common/services/encryption.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule, AlimtalkModule],
  controllers: [AdminController],
  providers: [AdminService, EncryptionService],
  exports: [AdminService, AlimtalkModule],
})
export class AdminModule {}
