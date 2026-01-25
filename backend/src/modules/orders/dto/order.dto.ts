import { IsString, IsNotEmpty, IsArray, IsNumber, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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
}

export class OrderResponseDto {
  id: string;
  userId: string;
  userEmail: string;
  depositorName: string;
  instagramId: string;
  status: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentStatus: string;
  shippingStatus: string;
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
