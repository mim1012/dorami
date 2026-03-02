'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { getUserReservations, createReservation, cancelReservation } from '@/lib/api/reservations';
import { createQueryKeys } from './create-query-keys';
import { useToast } from '@/components/common/Toast';
import type { CreateReservationDto } from '@/lib/types/reservation';

export const reservationKeys = createQueryKeys('reservations');

export function useReservations() {
  return useQuery({
    queryKey: reservationKeys.all,
    queryFn: getUserReservations,
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (data: CreateReservationDto) => createReservation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
    onError: (error: any) => {
      if (error.statusCode === 401) {
        showToast('로그인 세션이 만료되었습니다', 'error');
        router.push('/login?reason=session_expired');
      } else if (error.statusCode === 400) {
        showToast(error.message || '예약 요청 실패', 'error');
      } else {
        showToast(error.message || '알 수 없는 오류', 'error');
      }
    },
  });
}

export function useCancelReservation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (reservationId: string) => cancelReservation(reservationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
    onError: (error: any) => {
      if (error.statusCode === 401) {
        showToast('로그인 세션이 만료되었습니다', 'error');
        router.push('/login?reason=session_expired');
      } else if (error.statusCode === 400) {
        showToast(error.message || '예약 취소 실패', 'error');
      } else {
        showToast(error.message || '알 수 없는 오류', 'error');
      }
    },
  });
}
