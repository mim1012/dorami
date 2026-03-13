import { Module } from '@nestjs/common';
import { TestGateway } from './test.gateway';

@Module({
  providers: [TestGateway],
})
export class TestModule {}
