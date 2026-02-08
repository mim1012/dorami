import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Development bypass: skip auth in non-production environments
    // TODO: 프로덕션 배포 시 이 블록 제거
    if (process.env.NODE_ENV !== 'production') {
      const request = context.switchToHttp().getRequest();
      // Inject a mock admin user for development
      request.user = request.user || {
        sub: 'dev-admin',
        userId: 'dev-admin',
        role: 'ADMIN',
        email: 'admin@dorami.dev',
      };
      return true;
    }

    return super.canActivate(context);
  }
}
