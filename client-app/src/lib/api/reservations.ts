import { apiClient } from './client';
import { Reservation, ReservationList, CreateReservationDto } from '../types/reservation';

/**
 * Create a reservation when product stock is unavailable
 */
export async function createReservation(data: CreateReservationDto): Promise<Reservation> {
  const response = await apiClient.post<Reservation>('/reservations', data);
  return response.data;
}

/**
 * Get current user's reservations
 */
export async function getUserReservations(): Promise<ReservationList> {
  const response = await apiClient.get<ReservationList>('/reservations');
  return response.data;
}

/**
 * Cancel a reservation
 */
export async function cancelReservation(reservationId: string): Promise<void> {
  await apiClient.delete(`/reservations/${reservationId}`);
}
