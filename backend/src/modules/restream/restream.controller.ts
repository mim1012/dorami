import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { ReStreamService } from './restream.service';
import { CreateReStreamTargetDto, UpdateReStreamTargetDto } from './dto/restream.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Restream')
@ApiBearerAuth()
@Controller('restream')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ReStreamController {
  constructor(private readonly restreamService: ReStreamService) {}

  @Post('targets')
  @ApiOperation({
    summary: '리스트림 대상 추가 (관리자)',
    description: '동시 송출할 플랫폼 RTMP 대상을 추가합니다.',
  })
  @ApiResponse({ status: 201, description: '리스트림 대상 생성 성공' })
  async createTarget(@CurrentUser('userId') userId: string, @Body() dto: CreateReStreamTargetDto) {
    return this.restreamService.createTarget(userId, dto);
  }

  @Get('targets')
  @ApiOperation({ summary: '리스트림 대상 목록 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '리스트림 대상 목록' })
  async getTargets(@CurrentUser('userId') userId: string) {
    return this.restreamService.getTargets(userId);
  }

  @Patch('targets/:id')
  @ApiOperation({ summary: '리스트림 대상 수정 (관리자)' })
  @ApiParam({ name: 'id', description: '리스트림 대상 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async updateTarget(@Param('id') id: string, @Body() dto: UpdateReStreamTargetDto) {
    return this.restreamService.updateTarget(id, dto);
  }

  @Delete('targets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '리스트림 대상 삭제 (관리자)' })
  @ApiParam({ name: 'id', description: '리스트림 대상 ID' })
  @ApiResponse({ status: 204, description: '삭제 성공' })
  async deleteTarget(@Param('id') id: string) {
    await this.restreamService.deleteTarget(id);
  }

  @Get('status/:liveStreamId')
  @ApiOperation({ summary: '리스트림 상태 조회 (관리자)' })
  @ApiParam({ name: 'liveStreamId', description: '라이브 스트림 ID' })
  @ApiResponse({ status: 200, description: '리스트림 상태 정보' })
  async getStatus(@Param('liveStreamId') liveStreamId: string) {
    return this.restreamService.getStatus(liveStreamId);
  }

  @Post(':liveStreamId/targets/:targetId/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '리스트림 수동 시작 (관리자)' })
  @ApiParam({ name: 'liveStreamId', description: '라이브 스트림 ID' })
  @ApiParam({ name: 'targetId', description: '리스트림 대상 ID' })
  @ApiResponse({ status: 200, description: '리스트림 시작됨' })
  async manualStartTarget(
    @Param('liveStreamId') liveStreamId: string,
    @Param('targetId') targetId: string,
  ) {
    await this.restreamService.manualStartTarget(liveStreamId, targetId);
    return { message: 'Restream started' };
  }

  @Post(':liveStreamId/targets/:targetId/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '리스트림 수동 중지 (관리자)' })
  @ApiParam({ name: 'liveStreamId', description: '라이브 스트림 ID' })
  @ApiParam({ name: 'targetId', description: '리스트림 대상 ID' })
  @ApiResponse({ status: 200, description: '리스트림 중지됨' })
  async manualStopTarget(
    @Param('liveStreamId') liveStreamId: string,
    @Param('targetId') targetId: string,
  ) {
    await this.restreamService.manualStopTarget(liveStreamId, targetId);
    return { message: 'Restream stopped' };
  }
}
