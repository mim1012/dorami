'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserReservations, createReservation, cancelReservation } from '@/lib/api/reservations';
import { createQueryKeys } from './create-query-keys';
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

  return useMutation({
    mutationFn: (data: CreateReservationDto) => createReservation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
  });
}

export function useCancelReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reservationId: string) => cancelReservation(reservationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
  });
}
