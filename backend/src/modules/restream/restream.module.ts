import { Module } from '@nestjs/common';
import { ReStreamService } from './restream.service';
import { ReStreamController } from './restream.controller';
import { ReStreamListener } from './restream.listener';

@Module({
  controllers: [ReStreamController],
  providers: [ReStreamService, ReStreamListener],
  exports: [ReStreamService],
})
export class ReStreamModule {}
