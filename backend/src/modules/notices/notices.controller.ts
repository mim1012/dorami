import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards } from '@nestjs/common';
import { NoticesService } from './notices.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('notices')
export class NoticesController {
    constructor(private readonly noticesService: NoticesService) { }

    @Get('current')
    getCurrentNotice() {
        return this.noticesService.getCurrentNotice();
    }

    @Get()
    findAllActive() {
        return this.noticesService.findAllActive();
    }

    @Get('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    findAllAdmin() {
        return this.noticesService.findAllAdmin();
    }

    @Post('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    create(@Body() createNoticeDto: CreateNoticeDto) {
        return this.noticesService.create(createNoticeDto);
    }

    @Put('admin/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    update(@Param('id') id: string, @Body() updateNoticeDto: UpdateNoticeDto) {
        return this.noticesService.update(id, updateNoticeDto);
    }

    @Delete('admin/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    remove(@Param('id') id: string) {
        return this.noticesService.remove(id);
    }
}
