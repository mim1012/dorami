import { renderHook, waitFor } from '@testing-library/react';
import { useProfileGuard } from '../use-profile-guard';
import { useAuth } from '../use-auth';
import { useRouter, usePathname } from 'next/navigation';

// Mock dependencies
jest.mock('../use-auth');
jest.mock('next/navigation');

describe('useProfileGuard', () => {
  let mockReplace: jest.Mock;
  let mockUseAuth: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (usePathname as jest.Mock).mockReturnValue('/live');

    mockUseAuth = useAuth as jest.Mock;
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
    });
  });

  describe('authentication check', () => {
    it('redirects to login when user is not authenticated', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1' },
        isLoading: false,
      });

      renderHook(() => useProfileGuard());

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(
          expect.stringContaining('/login?reason=session_expired'),
        );
      });
    });

    it('does not redirect when user is loading', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
      });

      renderHook(() => useProfileGuard());

      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('admin bypass', () => {
    it('does not redirect admin users even if profile is incomplete', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          kakaoId: 'kakao-123',
          role: 'ADMIN',
        },
        isLoading: false,
      });

      renderHook(() => useProfileGuard());

      await waitFor(() => {
        // Admin should not be redirected
        expect(mockReplace).not.toHaveBeenCalled();
      });
    });
  });

  describe('profile completion check', () => {
    it('redirects to profile register when profile is incomplete for non-admin users', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          kakaoId: 'kakao-123',
          role: 'USER',
          instagramId: '@johndoe',
          // Missing depositorName and shippingAddress
        },
        isLoading: false,
      });

      renderHook(() => useProfileGuard());

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/profile/register');
      });
    });

    it('does not redirect when profile is complete for non-admin users', async () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          kakaoId: 'kakao-123',
          role: 'USER',
          instagramId: '@johndoe',
          depositorName: 'John Doe',
          shippingAddress: { fullName: 'Jane Doe' },
        },
        isLoading: false,
      });

      renderHook(() => useProfileGuard());

      await waitFor(() => {
        expect(mockReplace).not.toHaveBeenCalled();
      });
    });
  });

  describe('return value', () => {
    it('returns isLoading and isProfileComplete flags', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          kakaoId: 'kakao-123',
          instagramId: '@johndoe',
          depositorName: 'John Doe',
          shippingAddress: { fullName: 'Jane Doe' },
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useProfileGuard());

      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isProfileComplete');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isProfileComplete).toBe(true);
    });

    it('returns false for isProfileComplete when profile is incomplete', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          kakaoId: 'kakao-123',
          instagramId: '@johndoe',
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useProfileGuard());

      expect(result.current.isProfileComplete).toBe(false);
    });
  });

  describe('return-to parameter preservation', () => {
    it('preserves pathname in returnTo query parameter when redirecting to login', async () => {
      (usePathname as jest.Mock).mockReturnValue('/live/abc123');

      mockUseAuth.mockReturnValue({
        user: { id: '1' },
        isLoading: false,
      });

      renderHook(() => useProfileGuard());

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(
          expect.stringContaining('returnTo=%2Flive%2Fabc123'),
        );
      });
    });

    it('defaults to / for returnTo when pathname is invalid', async () => {
      (usePathname as jest.Mock).mockReturnValue('');

      mockUseAuth.mockReturnValue({
        user: { id: '1' },
        isLoading: false,
      });

      renderHook(() => useProfileGuard());

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('returnTo=%2F'));
      });
    });
  });
});
