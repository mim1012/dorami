import { Controller, Get, Post, Body, Put, Param, Delete } from '@nestjs/common';
import { NoticesService } from './notices.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';

@Controller('notices')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Get('current')
  getCurrentNotice() {
    return this.noticesService.getCurrentNotice();
  }

  @Get()
  findAllActive() {
    return this.noticesService.findAllActive();
  }

  @Get('admin')
  @AdminOnly()
  findAllAdmin() {
    return this.noticesService.findAllAdmin();
  }

  @Post('admin')
  @AdminOnly()
  create(@Body() createNoticeDto: CreateNoticeDto) {
    return this.noticesService.create(createNoticeDto);
  }

  @Put('admin/:id')
  @AdminOnly()
  update(@Param('id') id: string, @Body() updateNoticeDto: UpdateNoticeDto) {
    return this.noticesService.update(id, updateNoticeDto);
  }

  @Delete('admin/:id')
  @AdminOnly()
  remove(@Param('id') id: string) {
    return this.noticesService.remove(id);
  }
}
