import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ConfigSystemService } from './config-system.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('config')
@UseGuards(JwtAuthGuard)
export class ConfigSystemController {
  constructor(private configSystemService: ConfigSystemService) {}

  @Get()
  async getAllConfigs() {
    return this.configSystemService.getAllConfigs();
  }

  @Get(':key')
  async getConfig(@Param('key') key: string) {
    return this.configSystemService.getConfig(key);
  }

  @Post(':key')
  async setConfig(@Param('key') key: string, @Body() body: { value: any }) {
    await this.configSystemService.setConfig(key, body.value);
    return { message: 'Config updated successfully' };
  }

  @Delete(':key')
  async deleteConfig(@Param('key') key: string) {
    await this.configSystemService.deleteConfig(key);
    return { message: 'Config deleted successfully' };
  }
}
