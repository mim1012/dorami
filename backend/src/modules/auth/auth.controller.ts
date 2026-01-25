import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { KakaoAuthGuard } from './guards/kakao-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { RefreshTokenDto } from './dto/auth.dto';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
      res.cookie('accessToken', loginResponse.accessToken, {
        httpOnly: true, // JavaScript cannot access
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', loginResponse.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Check if user needs to complete profile per Story 2.1 AC1
      const needsProfileCompletion =
        !user.instagramId || !user.depositorName;

      // Redirect based on profile completion status
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = needsProfileCompletion
        ? `${frontendUrl}/profile/register`
        : `${frontendUrl}/`;

      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('Kakao callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/login?error=auth_failed`);
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
      res.cookie('accessToken', loginResponse.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      });

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
