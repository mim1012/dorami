import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProfileCompleteGuard } from './profile-complete.guard';
import { ProfileIncompleteException } from '../../../common/exceptions/business.exception';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_INCOMPLETE_PROFILE_KEY } from '../decorators/allow-incomplete-profile.decorator';

describe('ProfileCompleteGuard', () => {
  let reflector: Reflector;
  let prisma: { user: { findUnique: jest.Mock } };
  let guard: ProfileCompleteGuard;

  function makeContext(
    overrides: {
      user?: object | null;
      isPublic?: boolean;
      allowIncomplete?: boolean;
      type?: string;
    } = {},
  ): ExecutionContext {
    const { user = null, isPublic = false, allowIncomplete = false, type = 'http' } = overrides;
    reflector.getAllAndOverride = jest.fn().mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return isPublic;
      if (key === ALLOW_INCOMPLETE_PROFILE_KEY) return allowIncomplete;
      return undefined;
    });
    return {
      getType: () => type,
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
    prisma = { user: { findUnique: jest.fn() } };
    guard = new ProfileCompleteGuard(reflector, prisma as any);
  });

  it('allows non-http context types', async () => {
    const ctx = makeContext({ type: 'ws' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows @Public() routes', async () => {
    const ctx = makeContext({ isPublic: true });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows @AllowIncompleteProfile() routes', async () => {
    const ctx = makeContext({ allowIncomplete: true });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('blocks requests with no user', async () => {
    const ctx = makeContext({ user: null });
    await expect(guard.canActivate(ctx)).resolves.toBe(false);
  });

  it('allows ADMIN role bypass', async () => {
    const ctx = makeContext({ user: { userId: '1', role: 'ADMIN' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows user with profileComplete cached in token', async () => {
    const ctx = makeContext({ user: { userId: '1', role: 'USER', profileComplete: true } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows user with profileCompletedAt set in DB', async () => {
    prisma.user.findUnique.mockResolvedValue({ profileCompletedAt: new Date() });
    const ctx = makeContext({ user: { userId: '1', role: 'USER' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws ProfileIncompleteException when profile not completed', async () => {
    prisma.user.findUnique.mockResolvedValue({ profileCompletedAt: null });
    const ctx = makeContext({ user: { userId: '1', role: 'USER' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ProfileIncompleteException);
  });
});
