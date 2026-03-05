import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '../../common/redis/redis.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
    RedisModule,
  ],
  providers: [ChatGateway],
})
export class ChatModule {}
