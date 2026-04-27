import { OrderStatus, PaymentStatus, ShippingStatus } from './order.dto';
import { OrderResponseDto } from './order.dto';

describe('OrderResponseDto variant fields', () => {
  it('supports variant metadata on order items', () => {
    const response: OrderResponseDto = {
      id: 'ORD-20260427-00001',
      userId: 'user-1',
      userEmail: 'user@example.com',
      depositorName: '홍길동',
      instagramId: 'dorami-live',
      status: OrderStatus.PENDING_PAYMENT,
      subtotal: '29000.00',
      shippingFee: '0.00',
      total: '29000.00',
      pointsEarned: 0,
      pointsUsed: 0,
      paymentStatus: PaymentStatus.PENDING,
      shippingStatus: ShippingStatus.PENDING,
      createdAt: '2026-04-27T00:00:00.000Z',
      updatedAt: '2026-04-27T00:00:00.000Z',
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          variantId: 'variant-1',
          productName: '후드집업',
          variantLabel: 'Black / M',
          quantity: 1,
          price: '29000.00',
          shippingFee: '0.00',
          color: 'Black',
          size: 'M',
        },
      ],
    };

    expect(response.items[0]?.variantId).toBe('variant-1');
    expect(response.items[0]?.variantLabel).toBe('Black / M');
  });
});
