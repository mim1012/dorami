import { apiClient } from './client';
import {
  Reservation,
  ReservationList,
  CreateReservationDto,
  CreateReservationResponse,
  GetReservationsResponse,
} from '../types/reservation';

/**
 * Create a reservation when product stock is unavailable
 */
export async function createReservation(
  data: CreateReservationDto
): Promise<Reservation> {
  const response = await apiClient.post<CreateReservationResponse>('/reservations', data);
  return response.data.data;
}

/**
 * Get current user's reservations
 */
export async function getUserReservations(): Promise<ReservationList> {
  const response = await apiClient.get<GetReservationsResponse>('/reservations');
  return response.data.data;
}

/**
 * Cancel a reservation
 */
export async function cancelReservation(reservationId: string): Promise<void> {
  await apiClient.delete(`/reservations/${reservationId}`);
}
