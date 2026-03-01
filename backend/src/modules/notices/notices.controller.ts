import { Controller, Get, Post, Body, Put, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { NoticesService } from './notices.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Notices')
@Controller('notices')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Get('current')
  @Public()
  @ApiOperation({
    summary: '현재 공지사항 조회',
    description: '현재 활성화된 공지사항을 반환합니다.',
  })
  @ApiResponse({ status: 200, description: '현재 공지사항 반환 (없으면 null)' })
  getCurrentNotice() {
    return this.noticesService.getCurrentNotice();
  }

  @Get()
  @ApiOperation({ summary: '활성 공지사항 목록 조회' })
  @ApiResponse({ status: 200, description: '활성 공지사항 목록' })
  findAllActive() {
    return this.noticesService.findAllActive();
  }

  @Get('admin')
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: '전체 공지사항 목록 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '전체 공지사항 목록' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  findAllAdmin() {
    return this.noticesService.findAllAdmin();
  }

  @Post('admin')
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: '공지사항 생성 (관리자)' })
  @ApiResponse({ status: 201, description: '공지사항 생성 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  create(@Body() createNoticeDto: CreateNoticeDto) {
    return this.noticesService.create(createNoticeDto);
  }

  @Put('admin/:id')
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: '공지사항 수정 (관리자)' })
  @ApiParam({ name: 'id', description: '공지사항 ID' })
  @ApiResponse({ status: 200, description: '공지사항 수정 성공' })
  @ApiResponse({ status: 404, description: '공지사항을 찾을 수 없음' })
  update(@Param('id') id: string, @Body() updateNoticeDto: UpdateNoticeDto) {
    return this.noticesService.update(id, updateNoticeDto);
  }

  @Delete('admin/:id')
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: '공지사항 삭제 (관리자)' })
  @ApiParam({ name: 'id', description: '공지사항 ID' })
  @ApiResponse({ status: 200, description: '공지사항 삭제 성공' })
  @ApiResponse({ status: 404, description: '공지사항을 찾을 수 없음' })
  remove(@Param('id') id: string) {
    return this.noticesService.remove(id);
  }
}
