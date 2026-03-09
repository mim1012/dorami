import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ProfileIncompleteException } from '../../../common/exceptions/business.exception';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_INCOMPLETE_PROFILE_KEY } from '../decorators/allow-incomplete-profile.decorator';

@Injectable()
export class ProfileCompleteGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const allowIncomplete = this.reflector.getAllAndOverride<boolean>(
      ALLOW_INCOMPLETE_PROFILE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (allowIncomplete) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as {
      userId: string;
      role?: string;
      profileComplete?: boolean;
    } | null;

    if (!user) {
      return false;
    }

    if (user.role === 'ADMIN') {
      return true;
    }

    if (user.profileComplete) {
      return true;
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { profileCompletedAt: true },
    });

    if (dbUser?.profileCompletedAt) {
      request.user.profileComplete = true;
      return true;
    }

    throw new ProfileIncompleteException(user.userId);
  }
}
