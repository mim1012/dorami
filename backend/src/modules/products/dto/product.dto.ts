import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';

export enum ProductStatus {
  AVAILABLE = 'AVAILABLE',
  SOLD_OUT = 'SOLD_OUT',
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  streamKey: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  stock: number;

  @IsOptional()
  metadata?: any;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @IsOptional()
  metadata?: any;
}

export class UpdateStockDto {
  @IsNumber()
  quantity: number; // Positive for increase, negative for decrease
}

export class ProductResponseDto {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  status: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}
