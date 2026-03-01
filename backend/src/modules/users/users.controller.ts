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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/user.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { UpdateAddressDto } from './dto/profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  /**
   * Get basic user info (no sensitive data like shipping address).
   * SkipThrottle: called on every page load by useAuth hook.
   */
  @SkipThrottle({ short: true })
  @Get('me')
  @ApiOperation({
    summary: '내 기본 프로필 조회',
    description: '배송지 등 민감한 정보를 제외한 기본 사용자 정보를 반환합니다.',
  })
  @ApiResponse({ status: 200, description: '사용자 기본 정보' })
  async getMyProfile(@CurrentUser('userId') userId: string) {
    return this.usersService.findById(userId);
  }

  @Get('check-instagram')
  @ApiOperation({ summary: '인스타그램 ID 사용 가능 여부 확인' })
  @ApiQuery({ name: 'instagramId', description: '확인할 인스타그램 ID', example: 'my_instagram' })
  @ApiResponse({
    status: 200,
    description: '사용 가능 여부',
    schema: { example: { available: true } },
  })
  async checkInstagramAvailability(
    @Query('instagramId') instagramId: string,
    @CurrentUser('userId') userId: string,
  ) {
    const available = await this.usersService.isInstagramIdAvailable(instagramId, userId);
    return { available };
  }

  @Get(':id')
  @AdminOnly()
  @ApiOperation({ summary: '특정 사용자 조회 (관리자)' })
  @ApiParam({ name: 'id', description: '사용자 ID' })
  @ApiResponse({ status: 200, description: '사용자 정보' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async getUserById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch('me')
  @ApiOperation({ summary: '내 프로필 수정' })
  @ApiResponse({ status: 200, description: '프로필 수정 성공' })
  async updateMyProfile(@CurrentUser('userId') userId: string, @Body() updateDto: UpdateUserDto) {
    return this.usersService.updateProfile(userId, updateDto);
  }

  @Delete('me')
  @ApiOperation({ summary: '회원 탈퇴', description: '본인의 계정을 삭제합니다.' })
  @ApiResponse({ status: 200, description: '계정 삭제 성공' })
  async deleteMyAccount(@CurrentUser('userId') userId: string) {
    await this.usersService.deleteAccount(userId);
    return { message: 'Account deleted successfully' };
  }

  @Post('complete-profile')
  @HttpCode(200)
  @ApiOperation({
    summary: '프로필 완성',
    description: 'Kakao 로그인 후 필수 프로필 정보(닉네임, 전화번호 등)를 입력합니다.',
  })
  @ApiResponse({ status: 200, description: '프로필 완성 성공' })
  async completeProfile(@CurrentUser('userId') userId: string, @Body() dto: CompleteProfileDto) {
    return this.usersService.completeProfile(userId, dto);
  }

  /**
   * Get full profile including decrypted shipping address
   * Use this for "My Page" where address is needed
   */
  @Get('profile/me')
  @ApiOperation({
    summary: '내 전체 프로필 조회',
    description: '복호화된 배송지 정보를 포함한 전체 프로필을 반환합니다.',
  })
  @ApiResponse({ status: 200, description: '전체 프로필 (배송지 포함)' })
  async getMyFullProfile(@CurrentUser('userId') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('profile/address')
  @ApiOperation({
    summary: '배송지 수정',
    description: '기본 배송지를 수정합니다. 주소는 AES-256-GCM으로 암호화 저장됩니다.',
  })
  @ApiResponse({ status: 200, description: '배송지 수정 성공' })
  async updateMyAddress(@CurrentUser('userId') userId: string, @Body() dto: UpdateAddressDto) {
    return this.usersService.updateAddress(userId, dto);
  }
}
