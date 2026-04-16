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
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from './auth.service';
import { KakaoAuthGuard } from './guards/kakao-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { SkipCsrf } from '../../common/guards/csrf.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UnauthorizedException } from '../../common/exceptions/business.exception';
import { TokenPayload, DevLoginDto } from './dto/auth.dto';
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
      sameSite: 'lax',
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
      sameSite: 'lax',
      maxAge: this.refreshTokenMaxAge,
      path: '/',
    };
  }

  private logRefreshEvent(reason: string, details?: Record<string, unknown>): void {
    this.logger.warn(
      `[Refresh] ${JSON.stringify({
        reason,
        ...details,
      })}`,
    );
  }

  private sendRefreshError(res: Response, errorCode: string, message: string): Response {
    return res.status(401).json({
      success: false,
      error: errorCode,
      errorCode,
      statusCode: 401,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  private getRefreshFailureReason(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof UnauthorizedException) {
      switch (message) {
        case 'Invalid token type':
          return 'INVALID_TOKEN_TYPE';
        case 'User not found':
          return 'USER_NOT_FOUND';
        case 'Invalid refresh token':
          return 'INVALID_REFRESH_TOKEN';
        case 'Invalid or expired refresh token':
          return 'INVALID_OR_EXPIRED_REFRESH_TOKEN';
        default:
          return 'UNAUTHORIZED';
      }
    }

    if (
      (error as NodeJS.ErrnoException)?.code === 'ECONNREFUSED' ||
      message.toLowerCase().includes('redis')
    ) {
      return 'REDIS_ERROR';
    }

    if (
      (error as NodeJS.ErrnoException)?.code === 'P2025' ||
      message.toLowerCase().includes('prisma')
    ) {
      return 'DB_ERROR';
    }

    return 'UNKNOWN';
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

      // Admin users go directly to /admin
      // Regular users: redirect to /auth/kakao/callback with profile completion info
      let redirectUrl: string;
      if (user.role === 'ADMIN') {
        redirectUrl = `${this.frontendUrl}/admin`;
      } else {
        const profileStatus = this.authService.getProfileCompletionStatus(user);
        const params = new URLSearchParams({
          profileComplete: String(profileStatus.profileComplete),
          isNewUser: String(profileStatus.isNewUser),
        });
        if (!profileStatus.profileComplete && user.name) {
          params.set('kakaoName', user.name);
        }
        redirectUrl = `${this.frontendUrl}/auth/kakao/callback?${params.toString()}`;
      }

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
  @SkipThrottle()
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
        this.logRefreshEvent('NO_REFRESH_TOKEN', { source: 'cookie' });
        return this.sendRefreshError(res, 'NO_REFRESH_TOKEN', 'Refresh token not found');
      }

      const loginResponse = await this.authService.refreshToken(refreshToken);

      // Set new tokens in cookies — refreshToken must also be rotated so the
      // browser cookie matches the newly-stored Redis token on the next refresh.
      res.cookie('accessToken', loginResponse.accessToken, this.getAccessTokenCookieOptions());
      res.cookie('refreshToken', loginResponse.refreshToken, this.getRefreshTokenCookieOptions());

      this.logger.log(
        `[Refresh] ${JSON.stringify({ reason: 'SUCCESS', userId: loginResponse.user.id })}`,
      );

      return res.json({
        success: true,
        data: { message: 'Token refreshed successfully' },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'no message';
      const reason = this.getRefreshFailureReason(error);
      this.logRefreshEvent(reason, { message });

      // Never leak internal error details from token refresh — always return generic 401
      return this.sendRefreshError(res, 'TOKEN_REFRESH_FAILED', 'Token refresh failed');
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
      sameSite: 'lax',
      path: '/',
    });
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
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
  @Post('dev-login')
  @Public()
  @SkipCsrf()
  @ApiResponse({ status: 200, description: '개발 로그인 성공' })
  @ApiResponse({ status: 403, description: '개발 인증 비활성화됨' })
  async devLogin(@Body() body: DevLoginDto, @Res() res: Response, @Req() request: any) {
    const enableDevAuth = this.configService.get<string>('ENABLE_DEV_AUTH');
    if (enableDevAuth !== 'true') {
      throw new ForbiddenException('Dev login is disabled (ENABLE_DEV_AUTH=false)');
    }
    const appEnv = this.configService.get<string>('APP_ENV', 'development');
    const isStaging = appEnv === 'staging';
    if (!isStaging) {
      const clientIp: string = request.ip ?? request.socket?.remoteAddress ?? '';
      const isLocal =
        clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
      if (!isLocal) {
        this.logger.warn(`Dev login blocked from non-local IP: ${clientIp}`);
        throw new ForbiddenException('Dev login only available from localhost');
      }
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

    // Use service method to handle dev login user validation with proper role assignment
    const user = await this.authService.validateDevLoginUser(email, name);

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
