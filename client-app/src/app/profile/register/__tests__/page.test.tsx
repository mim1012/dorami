import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { useAuthStore } from '@/lib/store/auth';
import { apiClient } from '@/lib/api/client';
import ProfileRegisterPage from '../page';

// Mock dependencies
jest.mock('next/navigation');
jest.mock('@/lib/hooks/use-auth');
jest.mock('@/lib/store/auth');
jest.mock('@/lib/api/client');
jest.mock('@/lib/hooks/use-instagram-check', () => ({
  useInstagramCheck: jest.fn(() => ({
    isChecking: false,
    isAvailable: null,
    error: null,
  })),
}));

describe('ProfileRegisterPage', () => {
  let mockPush: jest.Mock;
  let mockReplace: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPush = jest.fn();
    mockReplace = jest.fn();

    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    });

    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: '1',
        kakaoId: 'kakao-123',
        role: 'USER',
      },
      isLoading: false,
      refreshProfile: jest.fn().mockResolvedValue(undefined),
    });

    (useAuthStore.getState as jest.Mock).mockReturnValue({
      user: {
        id: '1',
        kakaoId: 'kakao-123',
        role: 'USER',
      },
    });

    (apiClient.post as jest.Mock).mockResolvedValue({});
  });

  describe('redirect logic for completed profiles', () => {
    it('redirects regular users to /live when profile is already complete', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          id: '1',
          kakaoId: 'kakao-123',
          role: 'USER',
          instagramId: '@johndoe',
          depositorName: 'John Doe',
          shippingAddress: { fullName: 'Jane Doe' },
        },
        isLoading: false,
        refreshProfile: jest.fn(),
      });

      render(<ProfileRegisterPage />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/live');
      });
    });

    it('redirects admin users to /admin when profile is already complete', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          id: '1',
          kakaoId: 'kakao-123',
          role: 'ADMIN',
          instagramId: '@johndoe',
          depositorName: 'John Doe',
          shippingAddress: { fullName: 'Jane Doe' },
        },
        isLoading: false,
        refreshProfile: jest.fn(),
      });

      render(<ProfileRegisterPage />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/admin');
      });
    });
  });

  describe('form submission redirect after profile completion', () => {
    it('redirects regular users to /live after successful submission', async () => {
      const refreshProfileMock = jest.fn().mockResolvedValue(undefined);
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          id: '1',
          kakaoId: 'kakao-123',
          role: 'USER',
        },
        isLoading: false,
        refreshProfile: refreshProfileMock,
      });

      (useAuthStore.getState as jest.Mock).mockReturnValue({
        user: {
          id: '1',
          kakaoId: 'kakao-123',
          role: 'USER',
          instagramId: '@johndoe',
          depositorName: 'John Doe',
          shippingAddress: { fullName: 'Jane Doe' },
        },
      });

      render(<ProfileRegisterPage />);

      const submitButton = screen.getByRole('button', { name: /프로필 등록 완료/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/live');
      });
    });

    it('redirects admin users to /admin after successful submission', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          id: '1',
          kakaoId: 'kakao-123',
          role: 'ADMIN',
        },
        isLoading: false,
        refreshProfile: jest.fn(),
      });

      (useAuthStore.getState as jest.Mock).mockReturnValue({
        user: {
          id: '1',
          kakaoId: 'kakao-123',
          role: 'ADMIN',
          instagramId: '@johndoe',
          depositorName: 'John Doe',
          shippingAddress: { fullName: 'Jane Doe' },
        },
      });

      render(<ProfileRegisterPage />);

      const submitButton = screen.getByRole('button', { name: /프로필 등록 완료/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin');
      });
    });

    it('shows error when profile completion fails', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: {
          id: '1',
          kakaoId: 'kakao-123',
          role: 'USER',
        },
        isLoading: false,
        refreshProfile: jest.fn(),
      });

      // Simulate profile update failing
      (useAuthStore.getState as jest.Mock).mockReturnValue({
        user: {
          id: '1',
          kakaoId: 'kakao-123',
          role: 'USER',
          // Missing profile fields
        },
      });

      render(<ProfileRegisterPage />);

      const submitButton = screen.getByRole('button', { name: /프로필 등록 완료/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText('프로필 저장에 실패했습니다. 잠시 후 다시 시도해주세요.'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('authentication redirects', () => {
    it('redirects to login when user is not authenticated', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isLoading: false,
      });

      render(<ProfileRegisterPage />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/login');
      });
    });
  });
});
