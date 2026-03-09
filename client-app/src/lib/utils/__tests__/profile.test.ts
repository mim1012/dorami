import { describe, it, expect } from '@jest/globals';
import { isProfileComplete, needsProfileCompletion } from '../profile';
import type { User } from '@/lib/store/auth';

describe('isProfileComplete', () => {
  it('returns false for null user', () => {
    expect(isProfileComplete(null)).toBe(false);
  });

  it('returns false for undefined user', () => {
    expect(isProfileComplete(undefined)).toBe(false);
  });

  it('returns false when user lacks instagramId', () => {
    const user: User = {
      id: '1',
      kakaoId: 'kakao-123',
      depositorName: 'John Doe',
      shippingAddress: { fullName: 'Jane Doe' },
    } as User;
    expect(isProfileComplete(user)).toBe(false);
  });

  it('returns false when user lacks depositorName', () => {
    const user: User = {
      id: '1',
      kakaoId: 'kakao-123',
      instagramId: '@johndoe',
      shippingAddress: { fullName: 'Jane Doe' },
    } as User;
    expect(isProfileComplete(user)).toBe(false);
  });

  it('returns false when user lacks shippingAddress', () => {
    const user: User = {
      id: '1',
      kakaoId: 'kakao-123',
      instagramId: '@johndoe',
      depositorName: 'John Doe',
    } as User;
    expect(isProfileComplete(user)).toBe(false);
  });

  it('returns false when shippingAddress lacks fullName', () => {
    const user: User = {
      id: '1',
      kakaoId: 'kakao-123',
      instagramId: '@johndoe',
      depositorName: 'John Doe',
      shippingAddress: { address1: '123 Main St' },
    } as User;
    expect(isProfileComplete(user)).toBe(false);
  });

  it('returns true when all required fields are present', () => {
    const user: User = {
      id: '1',
      kakaoId: 'kakao-123',
      instagramId: '@johndoe',
      depositorName: 'John Doe',
      shippingAddress: {
        fullName: 'Jane Doe',
        address1: '123 Main St',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001',
        phone: '+1 213-555-1234',
      },
    } as User;
    expect(isProfileComplete(user)).toBe(true);
  });

  it('returns true with minimal shipping address (only fullName required)', () => {
    const user: User = {
      id: '1',
      kakaoId: 'kakao-123',
      instagramId: '@johndoe',
      depositorName: 'John Doe',
      shippingAddress: { fullName: 'Jane Doe' },
    } as User;
    expect(isProfileComplete(user)).toBe(true);
  });

  it('returns false when instagramId is empty string', () => {
    const user: User = {
      id: '1',
      kakaoId: 'kakao-123',
      instagramId: '',
      depositorName: 'John Doe',
      shippingAddress: { fullName: 'Jane Doe' },
    } as User;
    expect(isProfileComplete(user)).toBe(false);
  });

  it('returns false when depositorName is empty string', () => {
    const user: User = {
      id: '1',
      kakaoId: 'kakao-123',
      instagramId: '@johndoe',
      depositorName: '',
      shippingAddress: { fullName: 'Jane Doe' },
    } as User;
    expect(isProfileComplete(user)).toBe(false);
  });

  it('returns false when fullName is empty string', () => {
    const user: User = {
      id: '1',
      kakaoId: 'kakao-123',
      instagramId: '@johndoe',
      depositorName: 'John Doe',
      shippingAddress: { fullName: '' },
    } as User;
    expect(isProfileComplete(user)).toBe(false);
  });
});

describe('needsProfileCompletion', () => {
  it('returns false for null user', () => {
    expect(needsProfileCompletion(null)).toBe(false);
  });

  it('returns false for unauthenticated user', () => {
    const user: User = { id: '1' } as User;
    expect(needsProfileCompletion(user)).toBe(false);
  });

  it('returns false when user is authenticated but profile is complete', () => {
    const user: User = {
      id: '1',
      kakaoId: 'kakao-123',
      instagramId: '@johndoe',
      depositorName: 'John Doe',
      shippingAddress: { fullName: 'Jane Doe' },
    } as User;
    expect(needsProfileCompletion(user)).toBe(false);
  });

  it('returns true when user is authenticated via kakaoId but profile is incomplete', () => {
    const user: User = {
      id: '1',
      kakaoId: 'kakao-123',
      instagramId: '@johndoe',
      depositorName: 'John Doe',
    } as User;
    expect(needsProfileCompletion(user)).toBe(true);
  });

  it('returns true when user is authenticated via email but profile is incomplete', () => {
    const user: User = {
      id: '1',
      email: 'john@example.com',
      instagramId: '@johndoe',
      depositorName: 'John Doe',
    } as User;
    expect(needsProfileCompletion(user)).toBe(true);
  });

  it('returns true when user is authenticated but lacks instagramId', () => {
    const user: User = {
      id: '1',
      kakaoId: 'kakao-123',
      depositorName: 'John Doe',
      shippingAddress: { fullName: 'Jane Doe' },
    } as User;
    expect(needsProfileCompletion(user)).toBe(true);
  });
});
