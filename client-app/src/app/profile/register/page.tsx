'use client';

import { Suspense } from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { useAuthStore } from '@/lib/store/auth';
import { useInstagramCheck } from '@/lib/hooks/use-instagram-check';
import {
  formatPhoneNumberForInput,
  formatZipCode,
  formatInstagramId,
  isValidProfilePhone,
  normalizePhoneForBackend,
  PhoneRegion,
} from '@/lib/utils/format';
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
  kakaoPhone: string;
  fullName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
}

interface FormErrors {
  email?: string;
  depositorName?: string;
  instagramId?: string;
  kakaoPhone?: string;
  fullName?: string;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface ProfileResponse {
  email?: string;
  depositorName?: string;
  instagramId?: string;
  kakaoPhone?: string;
  shippingAddress?: {
    fullName?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
}

const POST_LOGIN_RETURN_KEY = 'doremi_post_login_return_to';
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;
const inferPhoneRegion = (value?: string): PhoneRegion => {
  if (!value) {
    return 'US';
  }
  const compact = value.replace(/\s/g, '');
  if (compact.startsWith('+82') || compact.startsWith('0')) {
    return 'KR';
  }
  return 'US';
};

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
    kakaoPhone: profile.kakaoPhone ?? '',
    fullName: shipping?.fullName ?? '',
    address1: shipping?.address1 ?? '',
    address2: shipping?.address2 ?? '',
    city: shipping?.city ?? '',
    state: shipping?.state ? shipping.state.toUpperCase() : '',
    zip: shipping?.zip ? formatZipCode(shipping.zip) : '',
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
    kakaoPhone: '',
    fullName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [profilePrefetching, setProfilePrefetching] = useState(false);
  const [phoneRegion, setPhoneRegion] = useState<PhoneRegion>('US');
  const errorRef = useRef<HTMLDivElement>(null);
  const isEditMode = !!(user && isProfileComplete(user));
  const headingText = isEditMode ? '프로필 정보 수정' : '프로필 등록';
  const subheadingText = isEditMode
    ? '이미 완료된 프로필 정보를 업데이트했습니다'
    : '처음 사용자를 위해 아래 정보를 입력해주세요';

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

  // Step 1: Not authenticated ??go to login
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
          const mapped = mapProfileToFormData(response.data, user.email ?? undefined);
          const region = inferPhoneRegion(mapped.kakaoPhone);
          setFormData({
            ...mapped,
            kakaoPhone: mapped.kakaoPhone
              ? formatPhoneNumberForInput(mapped.kakaoPhone, region)
              : '',
          });
          setPhoneRegion(region);
        })
        .catch((error) => {
          if (process.env.NODE_ENV !== 'production') {
            console.error('Failed to load profile data:', error);
          }
          setSubmitError('프로필 정보를 불러올 수 없습니다. 다시 시도해주세요.');
        })
        .finally(() => {
          setProfilePrefetching(false);
          setPrefilled(true);
        });
      return;
    }

    const addr = user.shippingAddress as
      | import('@live-commerce/shared-types').ShippingAddress
      | undefined;
    const kakaoPhoneFormatted = user.kakaoPhone
      ? formatPhoneNumberForInput(user.kakaoPhone, inferPhoneRegion(user.kakaoPhone))
      : '';
    if (kakaoPhoneFormatted) {
      setPhoneRegion(inferPhoneRegion(user.kakaoPhone));
    }
    setFormData((prev) => ({
      ...prev,
      email: user.email ?? '',
      depositorName: user.depositorName || prev.depositorName,
      instagramId: user.instagramId || prev.instagramId,
      fullName: addr?.fullName || prev.fullName,
      address1: addr?.address1 || prev.address1,
      address2: addr?.address2 || prev.address2,
      city: addr?.city || prev.city,
      state: addr?.state || prev.state,
      zip: addr?.zip || prev.zip,
      kakaoPhone: kakaoPhoneFormatted || prev.kakaoPhone,
    }));
    setPrefilled(true);
  }, [user, isEditMode, prefilled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    let formattedValue = value;

    if (name === 'zip') {
      formattedValue = formatZipCode(value);
    } else if (name === 'instagramId') {
      formattedValue = formatInstagramId(value);
    } else if (name === 'kakaoPhone') {
      formattedValue = formatPhoneNumberForInput(value, phoneRegion);
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

  const handlePhoneRegionChange = (region: PhoneRegion) => {
    setPhoneRegion(region);
    setFormData((prev) => ({
      ...prev,
      kakaoPhone: formatPhoneNumberForInput(prev.kakaoPhone, region),
    }));
    if (errors.kakaoPhone) {
      setErrors((prev) => ({ ...prev, kakaoPhone: undefined }));
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

    // 인스타그램 ID: 필수 입력
    if (!formData.instagramId.trim() || formData.instagramId === '@') {
      newErrors.instagramId = '인스타그램 ID를 입력해주세요';
    } else if (!/^@[a-zA-Z0-9._]+$/.test(formData.instagramId)) {
      newErrors.instagramId = '올바른 인스타그램 ID 형식이 아닙니다';
    } else if (instagramAvailable === false) {
      newErrors.instagramId = '이미 사용 중인 Instagram ID입니다.';
    }

    if (!formData.fullName.trim()) {
      newErrors.fullName = '성함(이름)을 입력해주세요';
    }

    if (!formData.address1.trim()) {
      newErrors.address1 = '주소를 입력해주세요';
    }

    if (!formData.city.trim()) {
      newErrors.city = '도시를 입력해주세요';
    }

    if (!formData.state) {
      newErrors.state = 'State를 선택해주세요';
    }

    if (!formData.zip.trim()) {
      newErrors.zip = 'ZIP Code를 입력해주세요';
    } else if (!ZIP_PATTERN.test(formData.zip)) {
      newErrors.zip = 'ZIP Code 형식: 12345 또는 12345-6789';
    }

    // 전화번호: 선택사항, 입력 시 형식 확인
    if (formData.kakaoPhone.trim() && !isValidProfilePhone(formData.kakaoPhone)) {
      newErrors.kakaoPhone = '미국 번호 (예: +1 213-555-1234) 또는 한국 번호 (예: 010-1234-5678)';
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
        normalizedErrors.fullName = '성함(이름)을 입력해주세요';
      } else if (lower.includes('address1')) {
        normalizedErrors.address1 = '주소를 입력해주세요';
      } else if (lower.includes('city')) {
        normalizedErrors.city = '도시를 입력해주세요';
      } else if (lower.includes('state')) {
        normalizedErrors.state = 'State를 선택해주세요';
      } else if (lower.includes('zip')) {
        normalizedErrors.zip = 'ZIP Code 형식: 12345 또는 12345-6789';
      } else if (lower.includes('phone') || lower.includes('kakaophone')) {
        normalizedErrors.kakaoPhone = '올바른 전화번호 형식이 아닙니다';
      }
    });

    if (apiError.statusCode === 409 || apiError.message.includes('Instagram ID')) {
      normalizedErrors.instagramId = '이미 사용 중인 Instagram ID입니다.';
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
    const kakaoPhoneTrimmed = normalizePhoneForBackend(formData.kakaoPhone);
    const payload = {
      email: formData.email.trim(),
      depositorName: formData.depositorName.trim(),
      instagramId: igTrimmed,
      ...(kakaoPhoneTrimmed && { kakaoPhone: kakaoPhoneTrimmed }),
      fullName: formData.fullName.trim(),
      address1: formData.address1.trim(),
      address2: formData.address2.trim(),
      city: formData.city.trim(),
      state: formData.state.trim(),
      zip: formData.zip.trim(),
    };

    try {
      if (isEditMode) {
        const [profileResult, addressResult] = await Promise.allSettled([
          apiClient.patch('/users/me', {
            email: payload.email,
            depositorName: payload.depositorName,
            instagramId: payload.instagramId,
            ...(kakaoPhoneTrimmed && { kakaoPhone: kakaoPhoneTrimmed }),
          }),
          apiClient.patch<ProfileResponse>('/users/profile/address', {
            fullName: payload.fullName,
            address1: payload.address1,
            address2: payload.address2,
            city: payload.city,
            state: payload.state,
            zip: payload.zip,
          }),
        ]);

        const profileFailed = profileResult.status === 'rejected';
        const addressFailed = addressResult.status === 'rejected';

        if (profileFailed || addressFailed) {
          const failedParts: string[] = [];
          if (profileFailed) failedParts.push('기본 정보');
          if (addressFailed) failedParts.push('배송지 정보');

          const firstRejected = [profileResult, addressResult].find(
            (r): r is PromiseRejectedResult => r.status === 'rejected',
          );
          const firstError = firstRejected?.reason as unknown;
          if (firstError instanceof ApiError) {
            const handled = applyServerValidationErrors(firstError);
            if (!handled) {
              setSubmitError(
                `${failedParts.join(', ')} 저장에 실패했습니다. 정보를 확인 후 다시 시도해주세요.`,
              );
            }
          } else {
            setSubmitError(
              `${failedParts.join(', ')} 저장에 실패했습니다. 정보를 확인 후 다시 시도해주세요.`,
            );
          }
          return;
        }

        await apiClient.post('/auth/refresh');
        await refreshProfile();
        const storedReturnTo = consumeStoredReturnTo();
        const redirectPath = storedReturnTo || queryReturnTo || '/my-page';
        router.push(redirectPath);
        return;
      }

      await apiClient.post('/users/complete-profile', payload);
      await apiClient.post('/auth/refresh');
      await refreshProfile();
      const updatedUser = useAuthStore.getState().user;
      if (!isProfileComplete(updatedUser)) {
        setSubmitError('프로필 저장에 실패했습니다. 다시 시도해주세요.');
        return;
      }

      const storedReturnTo = consumeStoredReturnTo();
      const isAdmin = updatedUser?.role === 'ADMIN';
      // USER는 /admin/* 경로로 리디렉트하지 않음 (이전 세션에서 admin으로 방문한 경로 방지)
      const safeReturnTo =
        storedReturnTo && (!storedReturnTo.startsWith('/admin') || isAdmin) ? storedReturnTo : null;
      const redirectPath = isAdmin ? '/admin' : safeReturnTo || queryReturnTo || '/live';
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
                label="인스타그램 ID"
                name="instagramId"
                value={formData.instagramId}
                onChange={handleChange}
                error={errors.instagramId}
                placeholder="@username"
                fullWidth
                required
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

          {/* Phone number */}
          <div className="bg-content-bg rounded-xl p-4 sm:p-6 space-y-4">
            <Heading2 className="text-hot-pink mb-4">Phone Number</Heading2>
            <Select
              label="Region"
              name="phoneRegion"
              value={phoneRegion}
              onChange={(e) => handlePhoneRegionChange(e.target.value as PhoneRegion)}
              options={[
                { value: 'US', label: 'US (+1)' },
                { value: 'KR', label: 'KR (010)' },
              ]}
              fullWidth
            />
            <Input
              label="Phone Number"
              name="kakaoPhone"
              value={formData.kakaoPhone}
              onChange={handleChange}
              error={errors.kakaoPhone}
              placeholder={phoneRegion === 'US' ? '+1 213-555-1234' : '010-1234-5678'}
              fullWidth
            />
            <p className="text-xs text-secondary-text/60">
              Examples: +1 213-555-1234 or 010-1234-5678
            </p>
          </div>
          {/* 미국 배송지 정보 */}
          <div className="bg-content-bg rounded-xl p-4 sm:p-6 space-y-4">
            <Heading2 className="text-hot-pink mb-4">미국 배송지</Heading2>

            <Input
              label="성함(Full Name)"
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
              label="추가 주소 (Address Line 2)"
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
                label="주(State)"
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
                    ? '프로필 수정하기'
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
