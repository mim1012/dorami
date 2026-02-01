import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { KakaoAuthGuard } from './guards/kakao-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { RefreshTokenDto } from './dto/auth.dto';
import { Request, Response, CookieOptions } from 'express';

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
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';

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
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      this.logger.warn(`Invalid JWT expiration format: ${expiresIn}, using default 15m`);
      return 15 * 60 * 1000; // Default: 15 minutes
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 15 * 60 * 1000;
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
    };
  }

  @Public()
  @Get('kakao')
  @UseGuards(KakaoAuthGuard)
  async kakaoLogin() {
    // This route initiates Kakao OAuth flow
    // Passport will redirect to Kakao login page
  }

  @Public()
  @Get('kakao/callback')
  @UseGuards(KakaoAuthGuard)
  async kakaoCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const user = req.user as any;
      const loginResponse = await this.authService.login(user);

      // Set tokens in HTTP-only cookies per Story 2.1 AC1
      res.cookie('accessToken', loginResponse.accessToken, this.getAccessTokenCookieOptions());
      res.cookie('refreshToken', loginResponse.refreshToken, this.getRefreshTokenCookieOptions());

      // Check if user needs to complete profile per Story 2.1 AC1
      const needsProfileCompletion =
        !user.instagramId || !user.depositorName;

      // Redirect based on profile completion status
      const redirectUrl = needsProfileCompletion
        ? `${this.frontendUrl}/profile/register`
        : `${this.frontendUrl}/`;

      return res.redirect(redirectUrl);
    } catch (error) {
      this.logger.error('Kakao callback error:', error.stack);
      return res.redirect(`${this.frontendUrl}/login?error=auth_failed`);
    }
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response) {
    try {
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          statusCode: 401,
          errorCode: 'NO_REFRESH_TOKEN',
          message: 'Refresh token not found',
        });
      }

      const loginResponse = await this.authService.refreshToken(refreshToken);

      // Set new access token in cookie per Story 2.1 AC3
      res.cookie('accessToken', loginResponse.accessToken, this.getAccessTokenCookieOptions());

      return res.json({
        data: { message: 'Token refreshed successfully' },
      });
    } catch (error) {
      return res.status(401).json({
        statusCode: 401,
        errorCode: 'TOKEN_REFRESH_FAILED',
        message: error.message,
      });
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser('userId') userId: string,
    @Res() res: Response,
  ) {
    await this.authService.logout(userId);

    // Clear cookies per Story 2.1
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    return res.json({
      data: { message: 'Logged out successfully' },
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: any) {
    return user;
  }
}
