import { useState, useEffect, useCallback } from 'react';
import {
  getUserReservations,
  createReservation,
  cancelReservation,
} from '../api/reservations';
import {
  ReservationList,
  CreateReservationDto,
  Reservation,
} from '../types/reservation';

export function useReservations() {
  const [reservations, setReservations] = useState<ReservationList | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReservations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getUserReservations();
      setReservations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch reservations');
      console.error('Failed to fetch reservations:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createNew = useCallback(
    async (data: CreateReservationDto): Promise<Reservation | null> => {
      try {
        setIsLoading(true);
        setError(null);
        const reservation = await createReservation(data);
        await fetchReservations(); // Refresh list
        return reservation;
      } catch (err: any) {
        setError(err.message || 'Failed to create reservation');
        console.error('Failed to create reservation:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchReservations]
  );

  const cancel = useCallback(
    async (reservationId: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);
        await cancelReservation(reservationId);
        await fetchReservations(); // Refresh list
        return true;
      } catch (err: any) {
        setError(err.message || 'Failed to cancel reservation');
        console.error('Failed to cancel reservation:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchReservations]
  );

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  return {
    reservations,
    isLoading,
    error,
    createReservation: createNew,
    cancelReservation: cancel,
    refreshReservations: fetchReservations,
  };
}
