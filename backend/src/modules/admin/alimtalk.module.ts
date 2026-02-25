import { Module } from '@nestjs/common';
import { AlimtalkService } from './alimtalk.service';

@Module({
  providers: [AlimtalkService],
  exports: [AlimtalkService],
})
export class AlimtalkModule {}
