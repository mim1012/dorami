import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  function makeContext(
    user: { role: string } | null,
    requiredRoles: string[] | undefined,
  ): ExecutionContext {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(requiredRoles);
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
    guard = new RolesGuard(reflector);
  });

  it('allows routes with no required roles', () => {
    const ctx = makeContext(null, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows routes with empty required roles array', () => {
    const ctx = makeContext(null, []);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when no user', () => {
    const ctx = makeContext(null, ['ADMIN']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user lacks required role', () => {
    const ctx = makeContext({ role: 'USER' }, ['ADMIN']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows user with matching role', () => {
    const ctx = makeContext({ role: 'ADMIN' }, ['ADMIN']);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
