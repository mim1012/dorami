import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddToCartDto, UpdateCartItemDto } from './cart.dto';

describe('Cart DTO quantity validation', () => {
  it('allows add-to-cart quantities greater than 10 when stock validation is handled elsewhere', async () => {
    const dto = plainToInstance(AddToCartDto, {
      productId: 'product-1',
      quantity: 25,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('allows cart item updates greater than 10 when stock validation is handled elsewhere', async () => {
    const dto = plainToInstance(UpdateCartItemDto, {
      quantity: 12,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts an optional variant id during the product-to-variant transition', async () => {
    const dto = plainToInstance(AddToCartDto, {
      productId: 'product-1',
      variantId: 'variant-1',
      quantity: 2,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('still rejects non-positive quantities', async () => {
    const dto = plainToInstance(UpdateCartItemDto, {
      quantity: 0,
    });

    const errors = await validate(dto);

    expect(errors).not.toHaveLength(0);
    expect(errors[0]?.constraints).toHaveProperty('min');
  });
});
