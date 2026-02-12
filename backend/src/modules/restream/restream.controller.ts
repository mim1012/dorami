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
import { ReStreamService } from './restream.service';
import { CreateReStreamTargetDto, UpdateReStreamTargetDto } from './dto/restream.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('restream')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ReStreamController {
  constructor(private readonly restreamService: ReStreamService) {}

  @Post('targets')
  async createTarget(@CurrentUser('userId') userId: string, @Body() dto: CreateReStreamTargetDto) {
    return this.restreamService.createTarget(userId, dto);
  }

  @Get('targets')
  async getTargets(@CurrentUser('userId') userId: string) {
    return this.restreamService.getTargets(userId);
  }

  @Patch('targets/:id')
  async updateTarget(@Param('id') id: string, @Body() dto: UpdateReStreamTargetDto) {
    return this.restreamService.updateTarget(id, dto);
  }

  @Delete('targets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTarget(@Param('id') id: string) {
    await this.restreamService.deleteTarget(id);
  }

  @Get('status/:liveStreamId')
  async getStatus(@Param('liveStreamId') liveStreamId: string) {
    return this.restreamService.getStatus(liveStreamId);
  }

  @Post(':liveStreamId/targets/:targetId/start')
  @HttpCode(HttpStatus.OK)
  async manualStartTarget(
    @Param('liveStreamId') liveStreamId: string,
    @Param('targetId') targetId: string,
  ) {
    await this.restreamService.manualStartTarget(liveStreamId, targetId);
    return { message: 'Restream started' };
  }

  @Post(':liveStreamId/targets/:targetId/stop')
  @HttpCode(HttpStatus.OK)
  async manualStopTarget(
    @Param('liveStreamId') liveStreamId: string,
    @Param('targetId') targetId: string,
  ) {
    await this.restreamService.manualStopTarget(liveStreamId, targetId);
    return { message: 'Restream stopped' };
  }
}
