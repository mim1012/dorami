import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from './auth.service';
import { KakaoAuthGuard } from './guards/kakao-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { SkipCsrf } from '../../common/guards/csrf.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { TokenPayload } from './dto/auth.dto';
import { Request, Response, CookieOptions } from 'express';
import { User } from '@prisma/client';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly frontendUrl: string;
  private readonly accessTokenMaxAge: number;
  private readonly refreshTokenMaxAge: number;
  private readonly isProduction: boolean;

  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    // Allow overriding cookie secure flag for HTTP staging environments
    const cookieSecureOverride = this.configService.get<string>('COOKIE_SECURE');
    this.isProduction =
      cookieSecureOverride !== undefined
        ? cookieSecureOverride === 'true'
        : this.configService.get<string>('NODE_ENV') === 'production';

    // Parse JWT expiration times from environment (e.g., "15m" -> 900000ms)
    this.accessTokenMaxAge = this.parseJwtExpiration(
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    );
    this.refreshTokenMaxAge = this.parseJwtExpiration(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    );
  }

  /**
   * Parse JWT expiration string to milliseconds
   * Examples: "15m" -> 900000, "7d" -> 604800000, "1h" -> 3600000
   */
  private parseJwtExpiration(expiresIn: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (!match) {
      this.logger.warn(`Invalid JWT expiration format: ${expiresIn}, using default 15m`);
      return 15 * 60 * 1000; // Default: 15 minutes
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 15 * 60 * 1000;
    }
  }

  /**
   * Get cookie options for access token
   */
  private getAccessTokenCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'strict' : 'lax',
      maxAge: this.accessTokenMaxAge,
      path: '/',
    };
  }

  /**
   * Get cookie options for refresh token
   */
  private getRefreshTokenCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'strict' : 'lax',
      maxAge: this.refreshTokenMaxAge,
      path: '/',
    };
  }

  @Public()
  @Get('kakao')
  @UseGuards(KakaoAuthGuard)
  @ApiOperation({
    summary: '카카오 로그인',
    description: '카카오 OAuth 로그인 페이지로 리다이렉트합니다.',
  })
  @ApiResponse({ status: 302, description: '카카오 로그인 페이지로 리다이렉트' })
  async kakaoLogin() {
    // This route initiates Kakao OAuth flow
    // Passport will redirect to Kakao login page
  }

  @Public()
  @Get('kakao/callback')
  @UseGuards(KakaoAuthGuard)
  @ApiOperation({
    summary: '카카오 OAuth 콜백',
    description: '카카오 인증 후 JWT 토큰을 쿠키에 설정하고 프론트엔드로 리다이렉트합니다.',
  })
  @ApiResponse({ status: 302, description: '프론트엔드로 리다이렉트 (/ 또는 /profile/register)' })
  async kakaoCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const user = req.user as User;
      const loginResponse = await this.authService.login(user);

      // Set tokens in HTTP-only cookies per Story 2.1 AC1
      res.cookie('accessToken', loginResponse.accessToken, this.getAccessTokenCookieOptions());
      res.cookie('refreshToken', loginResponse.refreshToken, this.getRefreshTokenCookieOptions());

      // Admin users go directly to /admin (no profile completion required)
      // Regular users: redirect to profile registration if incomplete
      const needsProfileCompletion =
        user.role !== 'ADMIN' && (!user.instagramId || !user.depositorName);

      const redirectUrl =
        user.role === 'ADMIN'
          ? `${this.frontendUrl}/admin`
          : needsProfileCompletion
            ? `${this.frontendUrl}/profile/register`
            : `${this.frontendUrl}/`;

      res.redirect(redirectUrl);
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.stack : String(error);
      this.logger.error('Kakao callback error:', errorMessage);
      res.redirect(`${this.frontendUrl}/login?error=auth_failed`);
      return;
    }
  }

  @Public()
  @SkipCsrf()
  @Throttle({
    short: { limit: 5, ttl: 10000 },
    medium: { limit: 10, ttl: 60000 },
    long: { limit: 20, ttl: 300000 },
  })
  @Post('refresh')
  @ApiOperation({
    summary: 'Access 토큰 갱신',
    description: 'Refresh 토큰 쿠키를 이용해 새 Access 토큰을 발급합니다.',
  })
  @ApiResponse({ status: 200, description: '토큰 갱신 성공' })
  @ApiResponse({ status: 401, description: 'Refresh 토큰 없음 또는 만료' })
  async refresh(@Req() req: Request, @Res() res: Response) {
    try {
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'NO_REFRESH_TOKEN',
          errorCode: 'NO_REFRESH_TOKEN',
          statusCode: 401,
          message: 'Refresh token not found',
          timestamp: new Date().toISOString(),
        });
      }

      const loginResponse = await this.authService.refreshToken(refreshToken);

      // Set new access token in cookie per Story 2.1 AC3
      res.cookie('accessToken', loginResponse.accessToken, this.getAccessTokenCookieOptions());

      return res.json({
        success: true,
        data: { message: 'Token refreshed successfully' },
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Never leak internal error details from token refresh — always return generic 401
      return res.status(401).json({
        success: false,
        error: 'TOKEN_REFRESH_FAILED',
        errorCode: 'TOKEN_REFRESH_FAILED',
        statusCode: 401,
        message: 'Token refresh failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '로그아웃', description: 'JWT 쿠키를 삭제하고 로그아웃합니다.' })
  @ApiResponse({ status: 200, description: '로그아웃 성공' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  async logout(@CurrentUser('userId') userId: string, @Res() res: Response) {
    await this.authService.logout(userId);

    // Clear cookies — options must match what was set so the browser honours the deletion
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'strict' : 'lax',
      path: '/',
    });
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'strict' : 'lax',
      path: '/',
    });

    return res.json({
      success: true,
      data: { message: 'Logged out successfully' },
      timestamp: new Date().toISOString(),
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '현재 로그인 사용자 정보 조회',
    description: 'JWT 토큰에서 사용자 정보를 반환합니다.',
  })
  @ApiResponse({ status: 200, description: '현재 사용자 토큰 페이로드' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  async getProfile(@CurrentUser() user: TokenPayload) {
    return user;
  }

  /**
   * Dev-only login endpoint for local development.
   * Creates or finds a user by email and issues JWT tokens without Kakao OAuth.
   * Only available when NODE_ENV=development.
   */
  @Public()
  @SkipCsrf()
  @SkipThrottle()
  @Post('dev-login')
  @ApiOperation({
    summary: '개발용 로그인 (개발 환경 전용)',
    description:
      'Kakao OAuth 없이 이메일로 로그인합니다. NODE_ENV=development 환경에서만 동작합니다.',
  })
  @ApiResponse({ status: 200, description: '개발 로그인 성공' })
  @ApiResponse({ status: 403, description: '개발 환경이 아님' })
  async devLogin(@Body() body: { email: string; name?: string }, @Res() res: Response) {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'production');
    if (nodeEnv !== 'development') {
      throw new ForbiddenException('Dev login is only available in development environment');
    }

    const { email, name } = body;
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        errorCode: 'INVALID_INPUT',
        message: 'email is required',
        timestamp: new Date().toISOString(),
      });
    }

    // Assign role based on ADMIN_EMAILS whitelist (same logic as Kakao OAuth)
    const adminEmails = this.configService.get<string>('ADMIN_EMAILS', '');
    const adminEmailSet = new Set(
      adminEmails
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0),
    );
    const roleToAssign = adminEmailSet.has(email) ? 'ADMIN' : 'USER';

    const { randomUUID } = await import('crypto');
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    // Preserve existing ADMIN role — never downgrade on re-login
    const finalRole = existingUser?.role === 'ADMIN' ? 'ADMIN' : roleToAssign;

    const user = await this.prisma.user.upsert({
      where: { email },
      update: {
        lastLoginAt: new Date(),
        role: finalRole,
      },
      create: {
        kakaoId: `dev_${randomUUID()}`,
        email,
        name: name || email.split('@')[0],
        role: roleToAssign,
        status: 'ACTIVE',
        lastLoginAt: new Date(),
      },
    });
    this.logger.log(`[Dev Auth] Upserted user: ${user.id} (${email}, ${user.role})`);

    const loginResponse = await this.authService.login(user);

    res.cookie('accessToken', loginResponse.accessToken, this.getAccessTokenCookieOptions());
    res.cookie('refreshToken', loginResponse.refreshToken, this.getRefreshTokenCookieOptions());

    return res.json({
      success: true,
      data: {
        message: 'Dev login successful',
        user: loginResponse.user,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
