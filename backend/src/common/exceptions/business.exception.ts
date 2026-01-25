import { HttpException, HttpStatus } from '@nestjs/common';

export interface ErrorContext {
  [key: string]: any;
}

export class BusinessException extends HttpException {
  constructor(
    public readonly errorCode: string,
    public readonly context?: ErrorContext,
    message?: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        errorCode,
        message: message || errorCode,
        context,
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }
}

// Predefined Business Exceptions
export class InsufficientStockException extends BusinessException {
  constructor(productId: string, available: number, requested: number) {
    super(
      'INSUFFICIENT_STOCK',
      { productId, available, requested },
      `Insufficient stock. Available: ${available}, Requested: ${requested}`,
    );
  }
}

export class CartExpiredException extends BusinessException {
  constructor(cartId: string) {
    super('CART_EXPIRED', { cartId }, `Cart ${cartId} has expired`);
  }
}

export class OrderNotFoundException extends BusinessException {
  constructor(orderId: string) {
    super(
      'ORDER_NOT_FOUND',
      { orderId },
      `Order ${orderId} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class UnauthorizedException extends BusinessException {
  constructor(reason?: string) {
    super(
      'UNAUTHORIZED',
      { reason },
      reason || 'Unauthorized access',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class ProductNotFoundException extends BusinessException {
  constructor(productId: string) {
    super(
      'PRODUCT_NOT_FOUND',
      { productId },
      `Product ${productId} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}
