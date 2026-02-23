import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AlimtalkService } from './alimtalk.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AdminController],
  providers: [AdminService, AlimtalkService, EncryptionService],
  exports: [AdminService, AlimtalkService],
})
export class AdminModule {}
