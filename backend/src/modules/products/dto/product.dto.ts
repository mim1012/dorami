import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  IsEnum,
  Min,
  Max,
  MaxLength,
  IsNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@live-commerce/shared-types';

// Re-export for backward compatibility
export { ProductStatus } from '@live-commerce/shared-types';

export class CreateProductDto {
  @ApiPropertyOptional({
    description: 'Stream key to associate product with',
    example: 'abc123def456',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  streamKey?: string;

  @ApiProperty({ description: 'Product name', example: 'Premium Cotton T-Shirt', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Product price in KRW', example: 29000, minimum: 1 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  price!: number;

  @ApiProperty({
    description: 'Available quantity (stock)',
    example: 50,
    minimum: 1,
    maximum: 9999,
  })
  @IsNumber()
  @Min(1)
  @Max(9999)
  @Type(() => Number)
  stock!: number; // Maps to quantity in database

  @ApiPropertyOptional({
    description: 'Color options',
    example: ['Red', 'Blue', 'Black'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  colorOptions?: string[];

  @ApiPropertyOptional({
    description: 'Size options',
    example: ['S', 'M', 'L', 'XL'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  sizeOptions?: string[];

  /** @deprecated Shipping is now global (SystemConfig). This field is ignored. */
  @ApiPropertyOptional({
    description: 'Shipping fee (deprecated - use global settings)',
    deprecated: true,
    default: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  shippingFee?: number;

  /** @deprecated Shipping is now global (SystemConfig). This field is ignored. */
  @ApiPropertyOptional({
    description: 'Free shipping message (deprecated - use global settings)',
    deprecated: true,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  freeShippingMessage?: string;

  @ApiPropertyOptional({
    description: 'Enable cart reservation timer',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  timerEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Reservation timer duration in minutes',
    example: 10,
    minimum: 1,
    maximum: 7200,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(7200)
  @Type(() => Number)
  timerDuration?: number;

  @ApiPropertyOptional({
    description: 'Product image URL',
    example: 'https://example.com/product.jpg',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Additional gallery images',
    example: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({
    description: 'Display NEW badge on product card',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @ApiPropertyOptional({
    description: 'Discount rate percentage (0-100)',
    example: 15,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @Type(() => Number)
  discountRate?: number;

  @ApiPropertyOptional({
    description: 'Original price before discount',
    example: 35000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  originalPrice?: number;

  // Legacy field support (for backward compatibility)
  @ApiPropertyOptional({ description: 'Product description (legacy)', deprecated: true })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Additional metadata (legacy)', deprecated: true })
  @IsOptional()
  metadata?: any;
}

export class UpdateProductDto {
  @ApiPropertyOptional({
    description: 'Product name',
    example: 'Premium Cotton T-Shirt',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Product price in KRW', example: 29000, minimum: 1 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  price?: number;

  @ApiPropertyOptional({
    description: 'Available quantity (stock)',
    example: 50,
    minimum: 1,
    maximum: 9999,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(9999)
  @Type(() => Number)
  stock?: number; // Maps to quantity in database

  @ApiPropertyOptional({
    description: 'Color options',
    example: ['Red', 'Blue', 'Black'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  colorOptions?: string[];

  @ApiPropertyOptional({
    description: 'Size options',
    example: ['S', 'M', 'L', 'XL'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  sizeOptions?: string[];

  /** @deprecated Shipping is now global (SystemConfig). This field is ignored. */
  @ApiPropertyOptional({
    description: 'Shipping fee (deprecated - use global settings)',
    deprecated: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  shippingFee?: number;

  /** @deprecated Shipping is now global (SystemConfig). This field is ignored. */
  @ApiPropertyOptional({
    description: 'Free shipping message (deprecated - use global settings)',
    deprecated: true,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  freeShippingMessage?: string;

  @ApiPropertyOptional({ description: 'Enable cart reservation timer', example: false })
  @IsOptional()
  @IsBoolean()
  timerEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Reservation timer duration in minutes',
    example: 10,
    minimum: 1,
    maximum: 7200,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(7200)
  @Type(() => Number)
  timerDuration?: number;

  @ApiPropertyOptional({
    description: 'Product image URL',
    example: 'https://example.com/product.jpg',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Additional gallery images',
    example: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({
    description: 'Product status',
    enum: ProductStatus,
    example: ProductStatus.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({
    description: 'Display NEW badge on product card',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @ApiPropertyOptional({
    description: 'Discount rate percentage (0-100)',
    example: 15,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @Type(() => Number)
  discountRate?: number;

  @ApiPropertyOptional({
    description: 'Original price before discount',
    example: 35000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  originalPrice?: number;

  // Legacy field support (for backward compatibility)
  @ApiPropertyOptional({ description: 'Product description (legacy)', deprecated: true })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Additional metadata (legacy)', deprecated: true })
  @IsOptional()
  metadata?: any;
}

export class UpdateStockDto {
  @ApiProperty({
    description: 'Quantity to add/subtract (positive for increase, negative for decrease)',
    example: -5,
  })
  @IsNumber()
  quantity!: number;
}

export class ProductResponseDto {
  @ApiProperty({ description: 'Product ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiPropertyOptional({ description: 'Stream key', example: 'abc123def456' })
  streamKey?: string | null;

  @ApiProperty({ description: 'Product name', example: 'Premium Cotton T-Shirt' })
  name!: string;

  @ApiProperty({ description: 'Product price in KRW', example: 29000 })
  price!: number;

  @ApiProperty({ description: 'Available quantity (stock)', example: 50 })
  stock!: number; // Maps from quantity in database

  @ApiProperty({ description: 'Color options', example: ['Red', 'Blue', 'Black'], type: [String] })
  colorOptions!: string[];

  @ApiProperty({ description: 'Size options', example: ['S', 'M', 'L', 'XL'], type: [String] })
  sizeOptions!: string[];

  @ApiProperty({ description: 'Shipping fee in KRW', example: 3000 })
  shippingFee!: number;

  @ApiPropertyOptional({
    description: 'Free shipping message',
    example: 'Free shipping over $50',
  })
  freeShippingMessage?: string;

  @ApiProperty({ description: 'Timer enabled', example: false })
  timerEnabled!: boolean;

  @ApiProperty({ description: 'Timer duration in minutes', example: 10 })
  timerDuration!: number;

  @ApiPropertyOptional({
    description: 'Product image URL',
    example: 'https://example.com/product.jpg',
  })
  imageUrl?: string;

  @ApiProperty({
    description: 'Additional gallery images',
    example: [],
    type: [String],
  })
  images!: string[];

  @ApiProperty({ description: 'Sort order for display', example: 0 })
  sortOrder!: number;

  @ApiProperty({ description: 'Display NEW badge', example: false })
  isNew!: boolean;

  @ApiPropertyOptional({ description: 'Discount rate percentage', example: 15 })
  discountRate?: number;

  @ApiPropertyOptional({ description: 'Original price before discount', example: 35000 })
  originalPrice?: number;

  @ApiProperty({
    description: 'Product status',
    enum: ProductStatus,
    example: ProductStatus.AVAILABLE,
  })
  status!: ProductStatus;

  @ApiProperty({ description: 'Created timestamp', example: '2024-01-15T10:30:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp', example: '2024-01-15T10:30:00.000Z' })
  updatedAt!: Date;

  // Legacy fields (for backward compatibility)
  @ApiPropertyOptional({ description: 'Product description (legacy)', deprecated: true })
  description?: string;

  @ApiPropertyOptional({ description: 'Additional metadata (legacy)', deprecated: true })
  metadata?: any;
}

export class GetProductsQueryDto {
  @ApiProperty({ description: 'Stream key to filter products', example: 'abc123def456' })
  @IsString()
  streamKey!: string;

  @ApiPropertyOptional({ description: 'Filter by product status', enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

export class BulkDeleteDto {
  @ApiProperty({
    description: 'Product IDs to delete',
    example: ['id1', 'id2'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids!: string[];
}

export class ReorderProductsDto {
  @ApiProperty({
    description: 'Product IDs in desired sort order',
    example: ['id1', 'id2', 'id3'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids!: string[];
}

export class PopularProductsQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 8 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 8;
}

export class PopularProductResponseDto extends ProductResponseDto {
  @ApiProperty({ description: 'Number of confirmed sales', example: 42 })
  soldCount!: number;
}

export class BulkUpdateStatusDto {
  @ApiProperty({
    description: 'Product IDs to update',
    example: ['id1', 'id2'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @ApiProperty({
    description: 'New status for all selected products',
    enum: ProductStatus,
    example: ProductStatus.SOLD_OUT,
  })
  @IsEnum(ProductStatus)
  status!: ProductStatus;
}
