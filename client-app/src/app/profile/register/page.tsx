'use client';

import { Suspense } from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { useAuthStore } from '@/lib/store/auth';
import { useInstagramCheck } from '@/lib/hooks/use-instagram-check';
import { formatPhoneNumber, formatZipCode, formatInstagramId } from '@/lib/utils/format';
import { isProfileComplete } from '@/lib/utils/profile';
import { US_STATES } from '@/lib/constants/us-states';
import { apiClient, ApiError } from '@/lib/api/client';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Display, Body, Heading2 } from '@/components/common/Typography';

interface FormData {
  email: string;
  depositorName: string;
  instagramId: string;
  fullName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

interface FormErrors {
  email?: string;
  depositorName?: string;
  instagramId?: string;
  fullName?: string;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
}

interface ProfileResponse {
  email?: string;
  depositorName?: string;
  instagramId?: string;
  phone?: string;
  shippingAddress?: {
    fullName?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
  };
}

const POST_LOGIN_RETURN_KEY = 'doremi_post_login_return_to';
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;
const PHONE_PATTERN = /^\(\d{3}\) \d{3}-\d{4}$/;

const sanitizeReturnPath = (raw: string | null): string | null => {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith('/')) return null;
    if (decoded.startsWith('//')) return null;
    return decoded;
  } catch {
    return null;
  }
};

const consumeStoredReturnTo = (): string | null => {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(POST_LOGIN_RETURN_KEY);
  if (!stored) return null;
  window.localStorage.removeItem(POST_LOGIN_RETURN_KEY);
  return sanitizeReturnPath(stored);
};

const mapProfileToFormData = (profile: ProfileResponse, fallbackEmail?: string): FormData => {
  const shipping = profile.shippingAddress;
  return {
    email: profile.email ?? fallbackEmail ?? '',
    depositorName: profile.depositorName ?? '',
    instagramId: profile.instagramId ?? '',
    fullName: shipping?.fullName ?? '',
    address1: shipping?.address1 ?? '',
    address2: shipping?.address2 ?? '',
    city: shipping?.city ?? '',
    state: shipping?.state ? shipping.state.toUpperCase() : '',
    zip: shipping?.zip ? formatZipCode(shipping.zip) : '',
    phone: shipping?.phone ? formatPhoneNumber(shipping.phone) : '',
  };
};

function ProfileRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryReturnTo = useMemo(
    () => sanitizeReturnPath(searchParams.get('returnTo')),
    [searchParams],
  );
  const { user, isLoading: authLoading, refreshProfile } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    email: '',
    depositorName: '',
    instagramId: '',
    fullName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [profilePrefetching, setProfilePrefetching] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const isEditMode = !!(user && isProfileComplete(user));
  const headingText = isEditMode ? '프로필 정보 수정' : '프로필 등록';
  const subheadingText = isEditMode
    ? '저장된 프로필 정보를 업데이트할 수 있습니다'
    : '서비스 이용을 위해 추가 정보를 입력해주세요';

  useEffect(() => {
    if (submitError && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [submitError]);

  const {
    isChecking: checkingInstagram,
    isAvailable: instagramAvailable,
    error: instagramCheckError,
  } = useInstagramCheck(formData.instagramId);

  // Step 1: Not authenticated → go to login
  useEffect(() => {
    if (authLoading) return;
    const isAuthenticated = !!(user?.kakaoId || user?.email);
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Step 2: Pre-fill profile data when editing or email for new users
  useEffect(() => {
    if (!user || prefilled) return;

    if (isEditMode) {
      setProfilePrefetching(true);
      apiClient
        .get<ProfileResponse>('/users/profile/me')
        .then((response) => {
          setFormData(mapProfileToFormData(response.data, user.email ?? undefined));
        })
        .catch((error) => {
          if (process.env.NODE_ENV !== 'production') {
            console.error('Failed to load profile data:', error);
          }
          setSubmitError('프로필 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
        })
        .finally(() => {
          setProfilePrefetching(false);
          setPrefilled(true);
        });
      return;
    }

    setFormData((prev) => ({ ...prev, email: user.email ?? '' }));
    setPrefilled(true);
  }, [user, isEditMode, prefilled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    let formattedValue = value;

    if (name === 'phone') {
      formattedValue = formatPhoneNumber(value);
    } else if (name === 'zip') {
      formattedValue = formatZipCode(value);
    } else if (name === 'instagramId') {
      formattedValue = formatInstagramId(value);
    } else if (name === 'state') {
      formattedValue = value.toUpperCase();
    }

    setFormData((prev) => ({ ...prev, [name]: formattedValue }));

    if (successMessage) {
      setSuccessMessage(null);
    }

    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = '이메일을 입력해주세요';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다';
    }

    if (!formData.depositorName.trim()) {
      newErrors.depositorName = '입금자명을 입력해주세요';
    }

    // 인스타그램 ID: 선택 입력 (값이 있을 때만 형식 검증)
    if (formData.instagramId.trim() && formData.instagramId !== '@') {
      if (!/^@[a-zA-Z0-9._]+$/.test(formData.instagramId)) {
        newErrors.instagramId = '올바른 인스타그램 ID 형식이 아닙니다';
      } else if (instagramAvailable === false) {
        newErrors.instagramId = '이미 등록된 인스타그램 ID입니다';
      }
    }

    if (!formData.fullName.trim()) {
      newErrors.fullName = '수령인 이름을 입력해주세요';
    }

    if (!formData.address1.trim()) {
      newErrors.address1 = '주소를 입력해주세요';
    }

    if (!formData.city.trim()) {
      newErrors.city = '도시명을 입력해주세요';
    }

    if (!formData.state) {
      newErrors.state = 'State를 선택해주세요';
    }

    if (!formData.zip.trim()) {
      newErrors.zip = 'ZIP Code를 입력해주세요';
    } else if (!ZIP_PATTERN.test(formData.zip)) {
      newErrors.zip = 'ZIP Code 형식: 12345 또는 12345-6789';
    }

    // 전화번호: 선택 입력 (값이 있을 때만 형식 검증)
    if (formData.phone.trim() && !PHONE_PATTERN.test(formData.phone)) {
      newErrors.phone = '미국 전화번호 형식: (123) 456-7890';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const applyServerValidationErrors = (apiError: ApiError): boolean => {
    const detail = apiError.details as { message?: unknown } | undefined;
    const messages: string[] = [];
    if (detail) {
      if (Array.isArray(detail.message)) {
        messages.push(...detail.message.map((msg) => String(msg)));
      } else if (typeof detail.message === 'string') {
        messages.push(detail.message);
      }
    }

    const normalizedErrors: FormErrors = {};
    messages.forEach((msg) => {
      const lower = msg.toLowerCase();
      if (lower.includes('email')) {
        normalizedErrors.email = '올바른 이메일 형식이 아닙니다';
      } else if (lower.includes('instagram')) {
        normalizedErrors.instagramId = '올바른 인스타그램 ID 형식이 아닙니다';
      } else if (lower.includes('depositor')) {
        normalizedErrors.depositorName = '입금자명을 입력해주세요';
      } else if (lower.includes('fullname') || lower.includes('full name')) {
        normalizedErrors.fullName = '수령인 이름을 입력해주세요';
      } else if (lower.includes('address1')) {
        normalizedErrors.address1 = '주소를 입력해주세요';
      } else if (lower.includes('city')) {
        normalizedErrors.city = '도시명을 입력해주세요';
      } else if (lower.includes('state')) {
        normalizedErrors.state = 'State를 선택해주세요';
      } else if (lower.includes('zip')) {
        normalizedErrors.zip = 'ZIP Code 형식: 12345 또는 12345-6789';
      } else if (lower.includes('phone')) {
        normalizedErrors.phone = '미국 전화번호 형식: (123) 456-7890';
      }
    });

    if (apiError.statusCode === 409 || apiError.message.includes('Instagram ID')) {
      normalizedErrors.instagramId = '이미 등록된 인스타그램 ID입니다';
    }

    if (Object.keys(normalizedErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...normalizedErrors }));
      return true;
    }

    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    const igTrimmed = formData.instagramId.trim();
    const phoneTrimmed = formData.phone.trim();
    const payload = {
      email: formData.email.trim(),
      depositorName: formData.depositorName.trim(),
      // 선택 필드: 빈 문자열은 undefined로 변환 (백엔드 @IsOptional 처리)
      instagramId: igTrimmed && igTrimmed !== '@' ? igTrimmed : undefined,
      fullName: formData.fullName.trim(),
      address1: formData.address1.trim(),
      address2: formData.address2.trim(),
      city: formData.city.trim(),
      state: formData.state.trim(),
      zip: formData.zip.trim(),
      phone: phoneTrimmed || undefined,
    };

    try {
      if (isEditMode) {
        await apiClient.patch('/users/me', {
          email: payload.email,
          depositorName: payload.depositorName,
          instagramId: payload.instagramId,
          phone: payload.phone,
        });
        const addressResponse = await apiClient.patch<ProfileResponse>('/users/profile/address', {
          fullName: payload.fullName,
          address1: payload.address1,
          address2: payload.address2,
          city: payload.city,
          state: payload.state,
          zip: payload.zip,
          phone: payload.phone,
        });
        setFormData(mapProfileToFormData(addressResponse.data, payload.email));
        await refreshProfile();
        setSuccessMessage('프로필 정보가 저장되었습니다.');
        return;
      }

      await apiClient.post('/users/complete-profile', payload);
      await apiClient.post('/auth/refresh');
      await refreshProfile();
      const updatedUser = useAuthStore.getState().user;
      if (!isProfileComplete(updatedUser)) {
        setSubmitError('프로필 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      const storedReturnTo = consumeStoredReturnTo();
      const redirectPath =
        updatedUser?.role === 'ADMIN' ? '/admin' : storedReturnTo || queryReturnTo || '/live';
      router.push(redirectPath);
    } catch (error) {
      if (error instanceof ApiError) {
        const handled = applyServerValidationErrors(error);
        if (!handled) {
          setSubmitError(
            error.message || '프로필 등록에 실패했습니다. 정보를 확인 후 다시 시도해주세요.',
          );
        }
      } else if (error instanceof Error) {
        setSubmitError(
          error.message || '프로필 등록에 실패했습니다. 정보를 확인 후 다시 시도해주세요.',
        );
      } else {
        setSubmitError('프로필 등록에 실패했습니다. 정보를 확인 후 다시 시도해주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Only block on profilePrefetching (edit-mode API fetch).
  // authLoading is intentionally excluded: the page has its own useEffect auth check
  // (redirects to /login if !isAuthenticated). Blocking on authLoading causes a 30s+
  // spinner when Zustand persist fires the effect before hydration completes, because
  // fetchProfile() falls into the 401-refresh-retry path (up to 90s total).
  if (profilePrefetching) {
    return (
      <div className="min-h-screen bg-primary-black flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-hot-pink/20 border-t-hot-pink rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-black py-6 sm:py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Display className="text-hot-pink mb-2">{headingText}</Display>
          <Body className="text-secondary-text">{subheadingText}</Body>
        </div>

        {submitError && (
          <div ref={errorRef} className="bg-error/10 border border-error rounded-lg p-4 mb-6">
            <Body className="text-error">{submitError}</Body>
          </div>
        )}

        {successMessage && (
          <div className="bg-success/10 border border-success rounded-lg p-4 mb-6">
            <Body className="text-success">{successMessage}</Body>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 기본 정보 */}
          <div className="bg-content-bg rounded-xl p-4 sm:p-6 space-y-4">
            <Heading2 className="text-hot-pink mb-4">기본 정보</Heading2>

            <Input
              label="이메일"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              placeholder="user@example.com"
              fullWidth
              required
            />

            <Input
              label="입금자명"
              name="depositorName"
              value={formData.depositorName}
              onChange={handleChange}
              error={errors.depositorName}
              placeholder="Zelle 입금 시 사용하는 이름"
              fullWidth
              required
            />

            <div>
              <Input
                label="인스타그램 ID (선택)"
                name="instagramId"
                value={formData.instagramId}
                onChange={handleChange}
                error={errors.instagramId}
                placeholder="@username"
                fullWidth
              />
              {checkingInstagram && (
                <Body className="text-secondary-text text-xs mt-1">확인 중...</Body>
              )}
              {!checkingInstagram &&
                instagramAvailable === true &&
                formData.instagramId.length > 1 && (
                  <Body className="text-success text-xs mt-1">사용 가능한 ID입니다</Body>
                )}
              {!checkingInstagram && instagramAvailable === false && (
                <Body className="text-error text-xs mt-1">
                  이미 사용 중인 ID입니다. 다른 ID를 입력해주세요.
                </Body>
              )}
              {!checkingInstagram && instagramCheckError && instagramAvailable === null && (
                <Body className="text-warning text-xs mt-1">{instagramCheckError}</Body>
              )}
            </div>
          </div>

          {/* 미국 배송지 정보 */}
          <div className="bg-content-bg rounded-xl p-4 sm:p-6 space-y-4">
            <Heading2 className="text-hot-pink mb-4">미국 배송지</Heading2>

            <Input
              label="수령인 (Full Name)"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              error={errors.fullName}
              placeholder="First and Last Name"
              fullWidth
              required
            />

            <Input
              label="주소 (Address Line 1)"
              name="address1"
              value={formData.address1}
              onChange={handleChange}
              error={errors.address1}
              placeholder="Street address, P.O. box"
              fullWidth
              required
            />

            <Input
              label="상세 주소 (Address Line 2)"
              name="address2"
              value={formData.address2}
              onChange={handleChange}
              placeholder="Apt, Suite, Unit, Floor (선택)"
              fullWidth
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="도시 (City)"
                name="city"
                value={formData.city}
                onChange={handleChange}
                error={errors.city}
                placeholder="City"
                fullWidth
                required
              />

              <Select
                label="주 (State)"
                name="state"
                value={formData.state}
                onChange={handleChange}
                error={errors.state}
                options={US_STATES.map((state) => ({
                  value: state.code,
                  label: `${state.code} - ${state.name}`,
                }))}
                placeholder="State 선택"
                fullWidth
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="ZIP Code"
                name="zip"
                value={formData.zip}
                onChange={handleChange}
                error={errors.zip}
                placeholder="12345 또는 12345-6789"
                fullWidth
                required
              />

              <Input
                label="전화번호 (미국, 선택)"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                error={errors.phone}
                placeholder="(213) 555-1234"
                fullWidth
              />
            </div>
          </div>

          {/* 등록 버튼 */}
          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth
            disabled={isSubmitting || checkingInstagram || instagramAvailable === false}
          >
            {isSubmitting
              ? isEditMode
                ? '저장 중...'
                : '등록 중...'
              : checkingInstagram
                ? 'ID 확인 중...'
                : instagramAvailable === false
                  ? '사용 불가 ID'
                  : isEditMode
                    ? '프로필 저장'
                    : '프로필 등록 완료'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function ProfileRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-primary-black flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-hot-pink/20 border-t-hot-pink rounded-full animate-spin" />
        </div>
      }
    >
      <ProfileRegisterContent />
    </Suspense>
  );
}
