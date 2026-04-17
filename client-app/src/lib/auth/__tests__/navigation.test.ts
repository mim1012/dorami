import {
  buildProfileRegisterRedirect,
  resolveAuthenticatedRedirect,
  sanitizeReturnPath,
} from '../navigation';

describe('auth navigation helpers', () => {
  describe('sanitizeReturnPath', () => {
    it('keeps safe internal paths', () => {
      expect(sanitizeReturnPath('/orders?tab=recent')).toBe('/orders?tab=recent');
    });

    it('rejects external and protocol-relative paths', () => {
      expect(sanitizeReturnPath('https://evil.example')).toBe('');
      expect(sanitizeReturnPath('//evil.example')).toBe('');
    });
  });

  describe('resolveAuthenticatedRedirect', () => {
    it('returns the fallback when there is no return target', () => {
      expect(resolveAuthenticatedRedirect('USER', '', '/')).toBe('/');
    });

    it('prevents regular users from landing on admin routes', () => {
      expect(resolveAuthenticatedRedirect('USER', '/admin/orders', '/')).toBe('/');
    });

    it('allows admins to keep admin return targets', () => {
      expect(resolveAuthenticatedRedirect('ADMIN', '/admin/orders', '/admin')).toBe('/admin/orders');
    });
  });

  describe('buildProfileRegisterRedirect', () => {
    it('preserves kakao name and return target for incomplete profiles', () => {
      expect(buildProfileRegisterRedirect('도라미', '/checkout?step=shipping')).toBe(
        '/profile/register?kakaoName=%EB%8F%84%EB%9D%BC%EB%AF%B8&returnTo=%2Fcheckout%3Fstep%3Dshipping',
      );
    });

    it('drops unsafe return targets', () => {
      expect(buildProfileRegisterRedirect('도라미', 'https://evil.example')).toBe(
        '/profile/register?kakaoName=%EB%8F%84%EB%9D%BC%EB%AF%B8',
      );
    });
  });
});
