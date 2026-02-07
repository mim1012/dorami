import { IsString, IsNotEmpty, IsArray, IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, PaymentStatus, ShippingStatus } from '@live-commerce/shared-types';

// Re-export for backward compatibility
export { OrderStatus, PaymentStatus, ShippingStatus } from '@live-commerce/shared-types';

class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsString()
  @IsNotEmpty()
  streamId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pointsToUse?: number;
}

export class CreateOrderFromCartDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pointsToUse?: number;
}

export class OrderResponseDto {
  id: string;
  userId: string;
  userEmail: string;
  depositorName: string;
  instagramId: string;
  status: OrderStatus;
  subtotal: number;
  shippingFee: number;
  total: number;
  pointsEarned: number;
  pointsUsed: number;
  paymentStatus: PaymentStatus;
  shippingStatus: ShippingStatus;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    shippingFee: number;
  }[];
}
