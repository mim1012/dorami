import { useEffect, useState } from 'react';
import { useDebounce } from './use-debounce';
import { apiClient } from '../api/client';

interface InstagramCheckResult {
  isChecking: boolean;
  isAvailable: boolean | null;
  error: string | null;
}

/**
 * Hook to check Instagram ID availability with debouncing.
 *
 * Fixes applied:
 * - C-1: isAvailable is reset to null at the start of every new check,
 *   preventing stale false state from keeping the submit button disabled.
 * - C-2: AbortController with 10s timeout and effect cleanup prevents
 *   in-flight requests from updating state after unmount / ID change,
 *   and avoids the button being permanently stuck if the API hangs.
 */
export function useInstagramCheck(instagramId: string): InstagramCheckResult {
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debouncedInstagramId = useDebounce(instagramId, 500);

  useEffect(() => {
    if (!debouncedInstagramId || debouncedInstagramId.length <= 1) {
      setIsAvailable(null);
      setError(null);
      setIsChecking(false);
      return;
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 10000);

    const checkAvailability = async () => {
      setIsChecking(true);
      setIsAvailable(null); // C-1: 이전 체크 결과를 즉시 초기화
      setError(null);

      try {
        const response = await apiClient.get<{ available: boolean }>(`/users/check-instagram`, {
          params: { instagramId: debouncedInstagramId },
          signal: abortController.signal,
        });
        setIsAvailable(response.data.available);
      } catch (err: any) {
        // AbortError는 정상적인 cleanup이므로 무시
        if (!abortController.signal.aborted) {
          setError('ID 확인에 실패했습니다. 잠시 후 다시 시도해주세요.');
          setIsAvailable(null);
        }
      } finally {
        clearTimeout(timeoutId);
        if (!abortController.signal.aborted) {
          setIsChecking(false);
        }
      }
    };

    checkAvailability();

    // C-2: debouncedInstagramId 변경 시 진행 중인 요청 취소
    return () => {
      abortController.abort();
      clearTimeout(timeoutId);
    };
  }, [debouncedInstagramId]);

  return { isChecking, isAvailable, error };
}
