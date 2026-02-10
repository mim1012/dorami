import {
  Controller,
  Post,
  Patch,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { StreamingService } from './streaming.service';
import {
  StartStreamDto,
  GenerateKeyDto,
  StreamHistoryQueryDto,
  RtmpCallbackDto,
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('history')
  async getHistory(@Query() query: StreamHistoryQueryDto) {
    return this.streamingService.getStreamHistory(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('live-status')
  async getLiveStatus() {
    return this.streamingService.getLiveStatus();
  }

  /**
   * nginx-rtmp on_publish callback
   * Called when OBS starts streaming to validate stream key
   * Returns 200 OK to allow, 403 Forbidden to reject
   */
  @Public()
  @Post('auth')
  @HttpCode(HttpStatus.OK)
  async authenticateRtmpStream(@Body() dto: RtmpCallbackDto) {
    const isAuthenticated = await this.streamingService.authenticateStream(
      dto.name,
      dto.addr,
    );

    if (!isAuthenticated) {
      throw new ForbiddenException('Invalid or expired stream key');
    }

    return { status: 'ok' };
  }

  /**
   * nginx-rtmp on_publish_done callback
   * Called when OBS stops streaming
   */
  @Public()
  @Post('done')
  @HttpCode(HttpStatus.OK)
  async handleRtmpStreamDone(@Body() dto: RtmpCallbackDto) {
    await this.streamingService.handleStreamDone(dto.name);
    return { status: 'ok' };
  }

  /**
   * Get featured product for a live stream (public)
   */
  @Public()
  @Get('key/:streamKey/featured-product')
  async getFeaturedProduct(@Param('streamKey') streamKey: string) {
    const product = await this.streamingService.getFeaturedProduct(streamKey);
    return { product };
  }

  /**
   * Set featured product for a live stream (admin only)
   */
  @Post(':streamKey/featured-product')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async setFeaturedProduct(
    @Param('streamKey') streamKey: string,
    @Body('productId') productId: string,
    @CurrentUser('userId') userId: string,
  ) {
    const product = await this.streamingService.setFeaturedProduct(
      streamKey,
      productId,
      userId,
    );
    return { success: true, product };
  }

  /**
   * Clear featured product for a live stream (admin only)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @Patch(':streamKey/featured-product/clear')
  async clearFeaturedProduct(
    @Param('streamKey') streamKey: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.streamingService.clearFeaturedProduct(streamKey, userId);
    return { success: true };
  }
}
