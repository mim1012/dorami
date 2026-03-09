import { ExecutionContext, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';

@Injectable()
export class KakaoAuthGuard extends AuthGuard('kakao') {
  private readonly logger = new Logger(KakaoAuthGuard.name);

  constructor(private configService: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Kakao auth failed: ${message}`);

      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      const res = context.switchToHttp().getResponse<Response>();

      if (!res.headersSent) {
        res.redirect(`${frontendUrl}/login?error=auth_failed`);
      }

      // Throw to prevent controller execution; response is already committed.
      throw new HttpException('Kakao auth redirect', HttpStatus.FOUND);
    }
  }
}
