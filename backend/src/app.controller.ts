import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './modules/auth/decorators/public.decorator';
import { AdminService } from './modules/admin/admin.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly adminService: AdminService,
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
    const settings = await this.adminService.getSystemSettings();
    return {
      zelleEmail: settings.zelleEmail,
      zelleRecipientName: settings.zelleRecipientName,
    };
  }
}
