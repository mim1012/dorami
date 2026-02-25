import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './modules/auth/decorators/public.decorator';
import { PrismaService } from './common/prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('config/payment')
  async getPaymentConfig() {
    const config = await this.prisma.systemConfig.upsert({
      where: { id: 'system' },
      update: {},
      create: { id: 'system' },
    });
    return {
      zelleEmail: config.zelleEmail,
      zelleRecipientName: config.zelleRecipientName,
    };
  }
}
