export interface OrderCreatedItem {
  productId: string;
  quantity: number;
  priceAtPurchase: number;
  streamKey?: string;
}

export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly totalAmount: number,
    public readonly items: OrderCreatedItem[],
    public readonly streamKeys: string[] = [],
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class OrderPaidEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly paidAt: Date,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class OrderShippedEvent {
  constructor(
    public readonly orderId: string,
    public readonly trackingNumber: string,
    public readonly shippedAt: Date,
    public readonly timestamp: Date = new Date(),
  ) {}
}
