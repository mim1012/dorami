import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { EncryptionService } from '../../common/services/encryption.service';

@Module({
  imports: [ConfigModule],
  controllers: [UsersController],
  providers: [UsersService, EncryptionService],
  exports: [UsersService, EncryptionService],
})
export class UsersModule {}
