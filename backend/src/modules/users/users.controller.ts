import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/user.dto';
import { CompleteProfileDto, CheckInstagramDto } from './dto/complete-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getMyProfile(@CurrentUser('userId') userId: string) {
    return this.usersService.findById(userId);
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch('me')
  async updateMyProfile(
    @CurrentUser('userId') userId: string,
    @Body() updateDto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(userId, updateDto);
  }

  @Delete('me')
  async deleteMyAccount(@CurrentUser('userId') userId: string) {
    await this.usersService.deleteAccount(userId);
    return { message: 'Account deleted successfully' };
  }

  @Post('complete-profile')
  async completeProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: CompleteProfileDto,
  ) {
    return this.usersService.completeProfile(userId, dto);
  }

  @Get('check-instagram')
  async checkInstagramAvailability(
    @Query('instagramId') instagramId: string,
    @CurrentUser('userId') userId: string,
  ) {
    const isAvailable = await this.usersService.isInstagramIdAvailable(instagramId, userId);
    return { data: { available: isAvailable } };
  }
}
