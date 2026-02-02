import {
  Controller,
  Post,
  Patch,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StreamingService } from './streaming.service';
import {
  StartStreamDto,
  GenerateKeyDto,
  StreamHistoryQueryDto,
} from './dto/streaming.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('streaming')
export class StreamingController {
  constructor(private streamingService: StreamingService) {}

  @Post('start')
  @UseGuards(JwtAuthGuard)
  async startStream(
    @CurrentUser('userId') userId: string,
    @Body() startStreamDto: StartStreamDto,
  ) {
    return this.streamingService.startStream(userId, startStreamDto);
  }

  @Patch(':id/go-live')
  @UseGuards(JwtAuthGuard)
  async goLive(
    @Param('id') streamId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.streamingService.goLive(streamId, userId);
  }

  @Patch(':id/stop')
  @UseGuards(JwtAuthGuard)
  async stopStream(
    @Param('id') streamId: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.streamingService.stopStream(streamId, userId);
    return { message: 'Stream ended successfully' };
  }

  @Public()
  @Get(':id/status')
  async getStatus(@Param('id') streamId: string) {
    return this.streamingService.getStreamStatus(streamId);
  }

  @Public()
  @Get('active')
  async getActiveStreams() {
    return this.streamingService.getActiveStreams();
  }

  @Public()
  @Get('upcoming')
  async getUpcomingStreams(@Query('limit') limit?: string) {
    const limitNum = Math.min(10, Math.max(1, parseInt(limit, 10) || 3));
    const streams = await this.streamingService.getUpcomingStreams(limitNum);
    return { data: streams };
  }

  @Post('generate-key')
  @UseGuards(JwtAuthGuard)
  async generateKey(
    @CurrentUser('userId') userId: string,
    @Body() dto: GenerateKeyDto,
  ) {
    return this.streamingService.generateKey(userId, dto);
  }

  @Public()
  @Get('key/:streamKey/status')
  async getStatusByKey(@Param('streamKey') streamKey: string) {
    return this.streamingService.getStreamStatusByKey(streamKey);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getHistory(@Query() query: StreamHistoryQueryDto) {
    return this.streamingService.getStreamHistory(query);
  }

  @Get('live-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getLiveStatus() {
    return this.streamingService.getLiveStatus();
  }
}
