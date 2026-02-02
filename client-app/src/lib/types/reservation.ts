export type ReservationStatus = 'WAITING' | 'PROMOTED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export interface Reservation {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  quantity: number;
  reservationNumber: number;
  status: ReservationStatus;
  promotedAt?: string;
  expiresAt?: string;
  createdAt: string;
  remainingSeconds?: number;
  queuePosition?: number;
}

export interface ReservationList {
  reservations: Reservation[];
  totalCount: number;
  waitingCount: number;
  promotedCount: number;
}

export interface CreateReservationDto {
  productId: string;
  quantity: number;
}

export interface CreateReservationResponse {
  data: Reservation;
}

export interface GetReservationsResponse {
  data: ReservationList;
}
