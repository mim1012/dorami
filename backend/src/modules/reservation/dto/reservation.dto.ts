import {
  IsString,
  IsNumber,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ReservationStatus {
  WAITING = 'WAITING',
  PROMOTED = 'PROMOTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export class CreateReservationDto {
  @ApiProperty({ description: 'Product ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Quantity to reserve', example: 1, minimum: 1, maximum: 10 })
  @IsNumber()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  quantity: number;
}

export class ReservationResponseDto {
  @ApiProperty({ description: 'Reservation ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ description: 'User ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  userId: string;

  @ApiProperty({ description: 'Product ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  productId: string;

  @ApiProperty({ description: 'Product name', example: 'Premium Cotton T-Shirt' })
  productName: string;

  @ApiProperty({ description: 'Quantity', example: 1 })
  quantity: number;

  @ApiProperty({ description: 'Sequential reservation number (per product)', example: 5 })
  reservationNumber: number;

  @ApiProperty({ description: 'Reservation status', enum: ReservationStatus, example: ReservationStatus.WAITING })
  status: ReservationStatus;

  @ApiPropertyOptional({ description: 'Promotion timestamp (ISO 8601)', example: '2024-01-15T10:40:00.000Z' })
  promotedAt?: string;

  @ApiPropertyOptional({ description: 'Expiration time (ISO 8601)', example: '2024-01-15T10:50:00.000Z' })
  expiresAt?: string;

  @ApiProperty({ description: 'Created timestamp', example: '2024-01-15T10:30:00.000Z' })
  createdAt: string;

  @ApiPropertyOptional({ description: 'Remaining time in seconds (if promoted)', example: 600 })
  remainingSeconds?: number;

  @ApiPropertyOptional({ description: 'Position in queue (0 if promoted)', example: 3 })
  queuePosition?: number;
}

export class ReservationListDto {
  @ApiProperty({ description: 'Reservations', type: [ReservationResponseDto] })
  reservations: ReservationResponseDto[];

  @ApiProperty({ description: 'Total count', example: 10 })
  totalCount: number;

  @ApiProperty({ description: 'Waiting count', example: 8 })
  waitingCount: number;

  @ApiProperty({ description: 'Promoted count', example: 2 })
  promotedCount: number;
}
