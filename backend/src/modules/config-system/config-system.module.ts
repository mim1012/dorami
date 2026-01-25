import { Module } from '@nestjs/common';
import { ConfigSystemService } from './config-system.service';
import { ConfigSystemController } from './config-system.controller';

@Module({
  controllers: [ConfigSystemController],
  providers: [ConfigSystemService],
  exports: [ConfigSystemService],
})
export class ConfigSystemModule {}
