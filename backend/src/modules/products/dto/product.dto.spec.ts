import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateProductDto,
  ProductResponseDto,
  ProductStatus,
  ProductVariantResponseDto,
  UpdateProductDto,
  VariantStatus,
} from './product.dto';

describe('Product DTO variant support', () => {
  it('accepts nested variants on create', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: '후드집업',
      price: 29000,
      stock: 10,
      variants: [
        {
          color: 'Black',
          size: 'M',
          price: 29000,
          stock: 3,
          status: VariantStatus.ACTIVE,
        },
      ],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts product status on create', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: '후드집업',
      price: 29000,
      stock: 10,
      status: ProductStatus.SOLD_OUT,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts zero summary stock when variants are used', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: '후드집업',
      price: 29000,
      stock: 0,
      variants: [
        {
          color: 'Black',
          size: 'M',
          price: 29000,
          stock: 0,
          status: VariantStatus.SOLD_OUT,
        },
      ],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects variant stock below zero', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: '후드집업',
      price: 29000,
      stock: 10,
      variants: [
        {
          color: 'Black',
          size: 'M',
          price: 29000,
          stock: -1,
          status: VariantStatus.ACTIVE,
        },
      ],
    });

    const errors = await validate(dto);
    const variantErrors = errors.find((error) => error.property === 'variants');

    expect(variantErrors).toBeDefined();
    expect(variantErrors?.children?.[0]?.children?.[0]?.constraints).toHaveProperty('min');
  });

  it('accepts variants on update', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      variants: [
        {
          id: 'variant-1',
          label: 'Black / XL',
          price: 31000,
          stock: 0,
          status: VariantStatus.SOLD_OUT,
          sortOrder: 1,
        },
      ],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('exposes variant summaries on product responses', () => {
    const response: ProductResponseDto = {
      id: 'product-1',
      streamKey: 'stream-1',
      name: '후드집업',
      price: 29000,
      stock: 8,
      colorOptions: ['Black'],
      sizeOptions: ['M', 'L'],
      shippingFee: 0,
      timerEnabled: false,
      timerDuration: 10,
      images: [],
      sortOrder: 0,
      isNew: false,
      status: ProductStatus.AVAILABLE,
      excludeFromStore: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      minPrice: 29000,
      maxPrice: 31000,
      variants: [
        plainToInstance(ProductVariantResponseDto, {
          id: 'variant-1',
          productId: 'product-1',
          color: 'Black',
          size: 'M',
          label: 'Black / M',
          price: 29000,
          stock: 3,
          status: VariantStatus.ACTIVE,
          sortOrder: 0,
        }),
      ],
    } as ProductResponseDto;

    expect(response.minPrice).toBe(29000);
    expect(response.maxPrice).toBe(31000);
    expect(response.variants?.[0]?.label).toBe('Black / M');
  });
});
