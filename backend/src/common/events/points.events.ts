export class PointsEarnedEvent {
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
    public readonly amount: number,
    public readonly newBalance: number,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class PointsUsedEvent {
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
    public readonly amount: number,
    public readonly newBalance: number,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class PointsRefundedEvent {
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
    public readonly amount: number,
    public readonly newBalance: number,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class PointsExpiringSoonEvent {
  constructor(
    public readonly userId: string,
    public readonly expiringAmount: number,
    public readonly expiresAt: Date,
    public readonly timestamp: Date = new Date(),
  ) {}
}
