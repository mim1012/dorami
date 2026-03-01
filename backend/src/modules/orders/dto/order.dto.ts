import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus, ShippingStatus } from '@live-commerce/shared-types';

// Re-export for backward compatibility
export { OrderStatus, PaymentStatus, ShippingStatus } from '@live-commerce/shared-types';

export class OrderItemDto {
  @ApiProperty({ description: '상품 ID', example: 'clx1234abcd' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: '주문 수량', example: 1, minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ description: '주문 상품 목록', type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiPropertyOptional({ description: '라이브 스트림 ID', example: 'clx5678efgh' })
  @IsOptional()
  @IsString()
  streamId?: string;

  @ApiPropertyOptional({ description: '사용할 포인트', example: 1000, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pointsToUse?: number;
}

export class CreateOrderFromCartDto {
  @ApiPropertyOptional({ description: '사용할 포인트', example: 1000, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pointsToUse?: number;
}

export class OrderResponseDto {
  @ApiProperty({ description: '주문 ID', example: 'ORD-20240101-00001' })
  id!: string;

  @ApiProperty({ description: '사용자 ID' })
  userId!: string;

  @ApiProperty({ description: '사용자 이메일', example: 'user@example.com' })
  userEmail!: string;

  @ApiProperty({ description: '입금자명', example: '홍길동' })
  depositorName!: string;

  @ApiProperty({ description: '인스타그램 ID', example: 'my_instagram' })
  instagramId!: string;

  @ApiProperty({
    description: '주문 상태',
    enum: OrderStatus,
    example: OrderStatus.PENDING_PAYMENT,
  })
  status!: OrderStatus;

  @ApiProperty({ description: '소계 (원)', example: '29000.00' })
  subtotal!: string;

  @ApiProperty({ description: '배송비 (원)', example: '3000.00' })
  shippingFee!: string;

  @ApiProperty({ description: '합계 (원)', example: '32000.00' })
  total!: string;

  @ApiProperty({ description: '적립 포인트', example: 290 })
  pointsEarned!: number;

  @ApiProperty({ description: '사용 포인트', example: 0 })
  pointsUsed!: number;

  @ApiProperty({ description: '결제 상태', enum: PaymentStatus, example: PaymentStatus.PENDING })
  paymentStatus!: PaymentStatus;

  @ApiProperty({ description: '배송 상태', enum: ShippingStatus, example: ShippingStatus.PENDING })
  shippingStatus!: ShippingStatus;

  @ApiProperty({ description: '주문 생성일', example: '2024-01-15T10:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ description: '주문 수정일', example: '2024-01-15T10:30:00.000Z' })
  updatedAt!: string;

  @ApiProperty({ description: '주문 항목 목록' })
  items!: {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: string;
    shippingFee: string;
  }[];
}
