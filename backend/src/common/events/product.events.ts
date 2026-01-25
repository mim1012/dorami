export class ProductStockUpdatedEvent {
  constructor(
    public readonly productId: string,
    public readonly oldStock: number,
    public readonly newStock: number,
    public readonly reason: 'purchase' | 'restock' | 'adjustment',
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class ProductCreatedEvent {
  constructor(
    public readonly productId: string,
    public readonly name: string,
    public readonly price: number,
    public readonly stock: number,
    public readonly timestamp: Date = new Date(),
  ) {}
}
