import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { StreamingService } from './streaming.service';
import {
  StartStreamDto,
  UpdateStreamDto,
  GenerateKeyDto,
  StreamHistoryQueryDto,
  RtmpCallbackDto,
  SrsCallbackDto,
} from './dto/streaming.dto';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { parsePagination } from '../../common/utils/pagination.util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { SkipCsrf } from '../../common/guards/csrf.guard';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';

@ApiTags('Streaming')
@Controller('streaming')
export class StreamingController {
  private readonly logger = new Logger(StreamingController.name);

  constructor(
    private streamingService: StreamingService,
    private configService: ConfigService,
  ) {}

  private isPrivateIp(ip: string | undefined): boolean {
    if (!ip) {
      return false;
    }
    const normalized = ip.replace(/^::ffff:/, '');

    // Loopback
    if (normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost') {
      return true;
    }
    // 10.0.0.0/8
    if (normalized.startsWith('10.')) {
      return true;
    }
    // 192.168.0.0/16
    if (normalized.startsWith('192.168.')) {
      return true;
    }
    // 172.16.0.0/12 (172.16.x.x – 172.31.x.x)
    if (normalized.startsWith('172.')) {
      const second = parseInt(normalized.split('.')[1], 10);
      return second >= 16 && second <= 31;
    }
    return false;
  }

  @Post('start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '스트림 세션 생성',
    description: 'PENDING 상태의 스트림 세션을 생성합니다. OBS 연결 전 호출.',
  })
  @ApiResponse({ status: 201, description: '스트림 세션 생성 성공 (streamKey, rtmpUrl 포함)' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  async startStream(@CurrentUser('userId') userId: string, @Body() startStreamDto: StartStreamDto) {
    return this.streamingService.startStream(userId, startStreamDto);
  }

  @Patch(':id/go-live')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '스트림 라이브 전환', description: 'PENDING → LIVE 상태로 전환합니다.' })
  @ApiParam({ name: 'id', description: '스트림 ID' })
  @ApiResponse({ status: 200, description: '라이브 전환 성공' })
  async goLive(
    @Param('id') streamId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.streamingService.goLive(streamId, userId, role);
  }

  @Patch(':id/stop')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '스트림 종료', description: 'LIVE → OFFLINE 상태로 전환합니다.' })
  @ApiParam({ name: 'id', description: '스트림 ID' })
  @ApiResponse({ status: 200, description: '스트림 종료 성공' })
  async stopStream(
    @Param('id') streamId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    await this.streamingService.stopStream(streamId, userId, role);
    return { message: 'Stream ended successfully' };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '스트림 정보 수정' })
  @ApiParam({ name: 'id', description: '스트림 ID' })
  @ApiResponse({ status: 200, description: '스트림 정보 수정 성공' })
  async updateStream(
    @Param('id') streamId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: UpdateStreamDto,
  ) {
    return this.streamingService.updateStream(streamId, userId, dto, role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: '스트림 취소 (PENDING 상태만)' })
  @ApiParam({ name: 'id', description: '스트림 ID' })
  @ApiResponse({ status: 204, description: '스트림 취소 성공' })
  async cancelStream(
    @Param('id') streamId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    await this.streamingService.cancelStream(streamId, userId, role);
  }

  @Public()
  @Get(':id/status')
  @ApiOperation({ summary: '스트림 상태 조회 (공개)' })
  @ApiParam({ name: 'id', description: '스트림 ID' })
  @ApiResponse({ status: 200, description: '스트림 상태 정보' })
  async getStatus(@Param('id') streamId: string) {
    return this.streamingService.getStreamStatus(streamId);
  }

  @Public()
  @Get('active')
  @ApiOperation({ summary: '현재 라이브 중인 스트림 목록 (공개)' })
  @ApiResponse({ status: 200, description: '활성 스트림 목록' })
  async getActiveStreams() {
    return this.streamingService.getActiveStreamsPublic();
  }

  @Public()
  @Get('upcoming')
  @ApiOperation({ summary: '예정된 스트림 목록 (공개)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '조회 수 (기본값: 3, 최대: 10)',
    example: '3',
  })
  @ApiResponse({ status: 200, description: '예정 스트림 목록' })
  async getUpcomingStreams(@Query('limit') limit?: string) {
    const { limit: limitNum } = parsePagination(1, limit, { limit: 3, maxLimit: 10 });
    return this.streamingService.getUpcomingStreams(limitNum);
  }

  @Post('generate-key')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '스트림 키 생성',
    description: 'OBS 연결에 사용할 RTMP 스트림 키를 생성합니다.',
  })
  @ApiResponse({ status: 201, description: '스트림 키 생성 성공' })
  async generateKey(@CurrentUser('userId') userId: string, @Body() dto: GenerateKeyDto) {
    return this.streamingService.generateKey(userId, dto);
  }

  @Public()
  @Get('key/:streamKey/status')
  @ApiOperation({ summary: '스트림 키로 상태 조회 (공개)' })
  @ApiParam({ name: 'streamKey', description: 'OBS 스트림 키', example: 'live_abc123' })
  @ApiResponse({ status: 200, description: '스트림 상태' })
  async getStatusByKey(@Param('streamKey') streamKey: string) {
    return this.streamingService.getStreamStatusByKey(streamKey);
  }

  @SkipThrottle({ short: true, medium: true, long: true })
  @AdminOnly()
  @Get('history')
  @ApiBearerAuth()
  @ApiOperation({ summary: '스트림 이력 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '스트림 이력 목록' })
  async getHistory(@Query() query: StreamHistoryQueryDto) {
    return this.streamingService.getStreamHistory(query);
  }

  @SkipThrottle({ short: true, medium: true, long: true })
  @AdminOnly()
  @Get('live-status')
  @ApiBearerAuth()
  @ApiOperation({ summary: '현재 라이브 상태 요약 (관리자)' })
  @ApiResponse({ status: 200, description: '현재 라이브 상태' })
  async getLiveStatus() {
    return this.streamingService.getLiveStatus();
  }

  /**
   * nginx-rtmp on_publish callback
   * Called when OBS starts streaming to validate stream key
   * Returns 200 OK to allow, 403 Forbidden to reject
   */
  @Public()
  @SkipCsrf()
  @SkipThrottle({ short: true, medium: true, long: true })
  @Post('auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'nginx-rtmp on_publish 콜백 (내부 전용)',
    description: 'OBS 스트림 키 검증. 내부 네트워크에서만 호출 가능.',
  })
  @ApiResponse({ status: 200, description: '스트림 키 유효' })
  @ApiResponse({ status: 403, description: '유효하지 않은 스트림 키 또는 외부 IP' })
  async authenticateRtmpStream(@Body() dto: RtmpCallbackDto, @Req() req: Request) {
    // Only allow callbacks from internal/Docker network
    const clientIp = req.ip ?? req.socket?.remoteAddress;
    if (!this.isPrivateIp(clientIp)) {
      this.logger.warn(`RTMP auth rejected from external IP: ${clientIp}`);
      throw new ForbiddenException('Unauthorized callback source');
    }

    const isAuthenticated = await this.streamingService.authenticateStream(dto.name, dto.addr);

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
  @SkipCsrf()
  @SkipThrottle({ short: true, medium: true, long: true })
  @Post('done')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'nginx-rtmp on_publish_done 콜백 (내부 전용)',
    description: 'OBS 스트림 종료 알림. 내부 네트워크에서만 호출 가능.',
  })
  @ApiResponse({ status: 200, description: '처리 성공' })
  async handleRtmpStreamDone(@Body() dto: RtmpCallbackDto, @Req() req: Request) {
    const clientIp = req.ip ?? req.socket?.remoteAddress;
    if (!this.isPrivateIp(clientIp)) {
      this.logger.warn(`RTMP done rejected from external IP: ${clientIp}`);
      throw new ForbiddenException('Unauthorized callback source');
    }

    await this.streamingService.handleStreamDone(dto.name);
    return { status: 'ok' };
  }

  /**
   * SRS on_publish callback
   * Called when OBS starts streaming to validate stream key
   * Returns { code: 0 } to allow, { code: 1 } to reject
   */
  /**
   * Validate SRS webhook request: private IP + optional shared secret
   */
  private validateSrsWebhook(req: Request): boolean {
    const clientIp = req.ip ?? req.socket?.remoteAddress;
    if (!this.isPrivateIp(clientIp)) {
      this.logger.warn(`SRS callback rejected from external IP: ${clientIp}`);
      return false;
    }

    const secret = this.configService.get<string>('SRS_WEBHOOK_SECRET');
    if (secret) {
      const provided = req.headers['x-srs-secret'] ?? req.query?.['secret'];
      if (!provided || provided !== secret) {
        this.logger.warn('SRS callback rejected: missing or invalid webhook secret');
        return false;
      }
    }

    return true;
  }

  @Public()
  @SkipCsrf()
  @SkipTransform()
  @SkipThrottle({ short: true, medium: true, long: true })
  @Post('srs-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'SRS on_publish 콜백 (내부 전용)',
    description: 'SRS 스트림 키 검증. code: 0 허용, code: 1 거부.',
  })
  @ApiResponse({ status: 200, description: '{ code: 0 } 허용 또는 { code: 1 } 거부' })
  async authenticateSrsStream(@Body() dto: SrsCallbackDto, @Req() req: Request) {
    const clientIp = req.ip ?? req.socket?.remoteAddress;
    this.logger.log(
      `SRS on_publish: stream=${dto.stream} app=${dto.app} clientIp=${clientIp} srcIp=${dto.ip} client_id=${dto.client_id}`,
    );

    if (!this.validateSrsWebhook(req)) {
      this.logger.warn(
        `SRS auth rejected [IP_NOT_PRIVATE]: clientIp=${clientIp} stream=${dto.stream}`,
      );
      return { code: 1 };
    }

    const isAuthenticated = await this.streamingService.authenticateStream(dto.stream, dto.ip);

    if (!isAuthenticated) {
      this.logger.warn(`SRS auth rejected [INVALID_STREAM_KEY]: stream=${dto.stream} ip=${dto.ip}`);
      return { code: 1 };
    }

    this.logger.log(`SRS auth approved: stream=${dto.stream}`);
    return { code: 0 };
  }

  /**
   * SRS on_unpublish callback
   * Called when OBS stops streaming
   */
  @Public()
  @SkipCsrf()
  @SkipTransform()
  @SkipThrottle({ short: true, medium: true, long: true })
  @Post('srs-done')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SRS on_unpublish 콜백 (내부 전용)' })
  @ApiResponse({ status: 200, description: '{ code: 0 } 성공' })
  async handleSrsStreamDone(@Body() dto: SrsCallbackDto, @Req() req: Request) {
    if (!this.validateSrsWebhook(req)) {
      return { code: 1 };
    }

    await this.streamingService.handleStreamDone(dto.stream);
    return { code: 0 };
  }

  /**
   * SRS heartbeat callback (every ~10s)
   * Used for monitoring SRS health
   */
  @Public()
  @SkipCsrf()
  @SkipTransform()
  @SkipThrottle({ short: true, medium: true, long: true })
  @Post('srs-heartbeat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'SRS 헬스체크 콜백 (내부 전용)',
    description: 'SRS가 약 10초마다 호출하는 헬스체크.',
  })
  @ApiResponse({ status: 200, description: '{ code: 0 }' })
  async handleSrsHeartbeat(@Req() req: Request) {
    if (!this.validateSrsWebhook(req)) {
      return { code: 1 };
    }
    return { code: 0 };
  }

  /**
   * Get featured product for a live stream (public)
   */
  @Public()
  @Get('key/:streamKey/featured-product')
  @ApiOperation({
    summary: '라이브 대표 상품 조회 (공개)',
    description: '현재 라이브에서 소개 중인 상품을 반환합니다.',
  })
  @ApiParam({ name: 'streamKey', description: '스트림 키', example: 'live_abc123' })
  @ApiResponse({
    status: 200,
    description: '대표 상품 정보 (없으면 null)',
    schema: { example: { product: null } },
  })
  async getFeaturedProduct(@Param('streamKey') streamKey: string) {
    const product = await this.streamingService.getFeaturedProduct(streamKey);
    return { product };
  }

  /**
   * Set featured product for a live stream (admin only)
   */
  @Post(':streamKey/featured-product')
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: '라이브 대표 상품 설정 (관리자)' })
  @ApiParam({ name: 'streamKey', description: '스트림 키' })
  @ApiResponse({ status: 201, description: '대표 상품 설정 성공' })
  async setFeaturedProduct(
    @Param('streamKey') streamKey: string,
    @Body('productId') productId: string,
    @CurrentUser('userId') userId: string,
  ) {
    const product = await this.streamingService.setFeaturedProduct(streamKey, productId, userId);
    return { success: true, product };
  }

  /**
   * Clear featured product for a live stream (admin only)
   */
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @Patch(':streamKey/featured-product/clear')
  @ApiBearerAuth()
  @ApiOperation({ summary: '라이브 대표 상품 초기화 (관리자)' })
  @ApiParam({ name: 'streamKey', description: '스트림 키' })
  @ApiResponse({ status: 200, description: '대표 상품 초기화 성공' })
  async clearFeaturedProduct(
    @Param('streamKey') streamKey: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.streamingService.clearFeaturedProduct(streamKey, userId);
    return { success: true };
  }
}
