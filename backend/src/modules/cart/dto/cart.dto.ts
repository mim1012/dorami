import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CartStatus } from '@live-commerce/shared-types';

// Re-export for backward compatibility
export { CartStatus } from '@live-commerce/shared-types';

export class AddToCartDto {
  @ApiProperty({ description: 'Product ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Quantity to add', example: 1, minimum: 1, maximum: 10 })
  @IsNumber()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional({ description: 'Selected color option', example: 'Red' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: 'Selected size option', example: 'L' })
  @IsOptional()
  @IsString()
  size?: string;
}

export class UpdateCartItemDto {
  @ApiProperty({ description: 'New quantity', example: 2, minimum: 1, maximum: 10 })
  @IsNumber()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  quantity: number;
}

export class CartItemResponseDto {
  @ApiProperty({ description: 'Cart item ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ description: 'User ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  userId: string;

  @ApiProperty({ description: 'Product ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  productId: string;

  @ApiProperty({ description: 'Product name', example: 'Premium Cotton T-Shirt' })
  productName: string;

  @ApiProperty({ description: 'Price per item', example: 29000 })
  price: number;

  @ApiProperty({ description: 'Quantity', example: 1 })
  quantity: number;

  @ApiPropertyOptional({ description: 'Selected color', example: 'Red' })
  color?: string;

  @ApiPropertyOptional({ description: 'Selected size', example: 'L' })
  size?: string;

  @ApiProperty({ description: 'Shipping fee', example: 3000 })
  shippingFee: number;

  @ApiProperty({ description: 'Timer enabled', example: true })
  timerEnabled: boolean;

  @ApiPropertyOptional({ description: 'Expiration time (ISO 8601)', example: '2024-01-15T10:40:00.000Z' })
  expiresAt?: string;

  @ApiProperty({ description: 'Cart item status', enum: CartStatus, example: CartStatus.ACTIVE })
  status: CartStatus;

  @ApiProperty({ description: 'Created timestamp', example: '2024-01-15T10:30:00.000Z' })
  createdAt: string;

  @ApiProperty({ description: 'Updated timestamp', example: '2024-01-15T10:30:00.000Z' })
  updatedAt: string;

  // Computed fields
  @ApiProperty({ description: 'Subtotal (price × quantity)', example: 29000 })
  subtotal: number;

  @ApiProperty({ description: 'Total (subtotal + shippingFee)', example: 32000 })
  total: number;

  @ApiPropertyOptional({ description: 'Remaining time in seconds', example: 600 })
  remainingSeconds?: number;
}

export class CartSummaryDto {
  @ApiProperty({ description: 'Cart items', type: [CartItemResponseDto] })
  items: CartItemResponseDto[];

  @ApiProperty({ description: 'Total number of items', example: 3 })
  itemCount: number;

  @ApiProperty({ description: 'Subtotal (sum of all item subtotals)', example: 87000 })
  subtotal: number;

  @ApiProperty({ description: 'Total shipping fee', example: 3000 })
  totalShippingFee: number;

  @ApiProperty({ description: 'Grand total', example: 90000 })
  grandTotal: number;

  @ApiPropertyOptional({ description: 'Earliest expiration time among items', example: '2024-01-15T10:40:00.000Z' })
  earliestExpiration?: string;
}
