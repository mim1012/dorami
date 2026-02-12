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
  HttpCode,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/user.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { UpdateAddressDto } from './dto/profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  /**
   * Get basic user info (no sensitive data like shipping address)
   */
  @Get('me')
  async getMyProfile(@CurrentUser('userId') userId: string) {
    return this.usersService.findById(userId);
  }

  @Get('check-instagram')
  async checkInstagramAvailability(
    @Query('instagramId') instagramId: string,
    @CurrentUser('userId') userId: string,
  ) {
    const available = await this.usersService.isInstagramIdAvailable(instagramId, userId);
    return { available };
  }

  @Get(':id')
  @AdminOnly()
  async getUserById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch('me')
  async updateMyProfile(@CurrentUser('userId') userId: string, @Body() updateDto: UpdateUserDto) {
    return this.usersService.updateProfile(userId, updateDto);
  }

  @Delete('me')
  async deleteMyAccount(@CurrentUser('userId') userId: string) {
    await this.usersService.deleteAccount(userId);
    return { message: 'Account deleted successfully' };
  }

  @Post('complete-profile')
  @HttpCode(200)
  async completeProfile(@CurrentUser('userId') userId: string, @Body() dto: CompleteProfileDto) {
    return this.usersService.completeProfile(userId, dto);
  }

  /**
   * Get full profile including decrypted shipping address
   * Use this for "My Page" where address is needed
   */
  @Get('profile/me')
  async getMyFullProfile(@CurrentUser('userId') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('profile/address')
  async updateMyAddress(@CurrentUser('userId') userId: string, @Body() dto: UpdateAddressDto) {
    return this.usersService.updateAddress(userId, dto);
  }
}
