import {
  Controller,
  Post,
  Patch,
  Get,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { StreamingService } from './streaming.service';
import { StartStreamDto } from './dto/streaming.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
}
