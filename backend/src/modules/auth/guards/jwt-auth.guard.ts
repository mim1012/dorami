import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ExtractJwt } from 'passport-jwt';

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
      const request = context.switchToHttp().getRequest();
      const token = this.extractTokenFromRequest(request);
      if (!token) {
        return true;
      }
    }

    return super.canActivate(context);
  }

  private extractTokenFromRequest(request: {
    cookies?: { accessToken?: string };
    headers?: Record<string, string | string[] | undefined>;
  }): string | null {
    if (request.cookies?.accessToken) {
      return request.cookies.accessToken;
    }

    return ExtractJwt.fromAuthHeaderAsBearerToken()(request as never);
  }
}
