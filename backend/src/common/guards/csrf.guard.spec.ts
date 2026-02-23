import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard';

describe('CsrfGuard', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
  });

  it('should allow GET requests without CSRF token', () => {
    const guard = new CsrfGuard(reflector);
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          cookies: {},
          headers: {},
          socket: {},
        }),
        getResponse: () => ({ cookie: jest.fn() }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow HEAD requests without CSRF token', () => {
    const guard = new CsrfGuard(reflector);
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'HEAD', cookies: {}, headers: {}, socket: {} }),
        getResponse: () => ({ cookie: jest.fn() }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when CSRF tokens are missing on POST', () => {
    const guard = new CsrfGuard(reflector);
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', cookies: {}, headers: {}, socket: {} }),
        getResponse: () => ({ cookie: jest.fn() }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when cookie token present but header missing', () => {
    const guard = new CsrfGuard(reflector);
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          cookies: { 'csrf-token': 'abc123' },
          headers: {},
          socket: {},
        }),
        getResponse: () => ({ cookie: jest.fn() }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when tokens do not match', () => {
    const guard = new CsrfGuard(reflector);
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          cookies: { 'csrf-token': 'token-a' },
          headers: { 'x-csrf-token': 'token-b' },
          socket: {},
        }),
        getResponse: () => ({ cookie: jest.fn() }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow POST when matching CSRF tokens are provided', () => {
    const guard = new CsrfGuard(reflector);
    const token = 'a'.repeat(64);
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          cookies: { 'csrf-token': token },
          headers: { 'x-csrf-token': token },
          socket: {},
        }),
        getResponse: () => ({ cookie: jest.fn() }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should skip CSRF check when @SkipCsrf decorator is present', () => {
    const reflectorWithSkip = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new CsrfGuard(reflectorWithSkip);

    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'DELETE',
          cookies: {},
          headers: {},
          socket: {},
        }),
        getResponse: () => ({ cookie: jest.fn() }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should use timing-safe comparison (same-length tokens must match exactly)', () => {
    const guard = new CsrfGuard(reflector);
    // Same-length but different content
    const cookieToken = 'a'.repeat(64);
    const headerToken = 'b'.repeat(64);
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'PUT',
          cookies: { 'csrf-token': cookieToken },
          headers: { 'x-csrf-token': headerToken },
          socket: {},
        }),
        getResponse: () => ({ cookie: jest.fn() }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
