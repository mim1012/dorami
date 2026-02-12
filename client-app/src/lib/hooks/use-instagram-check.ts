import { useEffect, useState } from 'react';
import { useDebounce } from './use-debounce';
import { apiClient } from '../api/client';

interface InstagramCheckResult {
  isChecking: boolean;
  isAvailable: boolean | null;
  error: string | null;
}

/**
 * Hook to check Instagram ID availability with debouncing
 */
export function useInstagramCheck(instagramId: string): InstagramCheckResult {
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debouncedInstagramId = useDebounce(instagramId, 500);

  useEffect(() => {
    // Reset state if input is empty or invalid
    if (!debouncedInstagramId || debouncedInstagramId.length <= 1) {
      setIsAvailable(null);
      setError(null);
      setIsChecking(false);
      return;
    }

    // Check availability
    const checkAvailability = async () => {
      setIsChecking(true);
      setError(null);

      try {
        const response = await apiClient.get<{ available: boolean }>(`/users/check-instagram`, {
          params: { instagramId: debouncedInstagramId },
        });

        setIsAvailable(response.data.available);
      } catch (err) {
        setError('Failed to check availability');
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    };

    checkAvailability();
  }, [debouncedInstagramId]);

  return { isChecking, isAvailable, error };
}
