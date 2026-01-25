# @live-commerce/shared-types

Shared TypeScript type definitions for Live Commerce platform (Frontend & Backend)

## 📦 Installation

### In Backend (NestJS)

```bash
# Add to backend/package.json
{
  "dependencies": {
    "@live-commerce/shared-types": "file:../../shared/types"
  }
}

# Install
cd backend
npm install
```

### In Frontend (React/Vue/etc.)

```bash
# Add to frontend/package.json
{
  "dependencies": {
    "@live-commerce/shared-types": "file:../shared/types"
  }
}

# Install
cd frontend
npm install
```

## 🚀 Usage

### Import Types

```typescript
import {
  User,
  Product,
  Order,
  ApiResponse,
  CreateProductRequest,
  UpdateProductRequest,
  Role,
  OrderStatus,
} from '@live-commerce/shared-types';
```

### Using with API Responses

```typescript
import { ApiResponse, Product, isSuccessResponse } from '@live-commerce/shared-types';

async function fetchProduct(id: string): Promise<Product> {
  const response: ApiResponse<Product> = await fetch(`/api/products/${id}`).then((r) => r.json());

  if (isSuccessResponse(response)) {
    return response.data;
  } else {
    throw new Error(response.error.message);
  }
}
```

### Using Request DTOs

```typescript
import { CreateProductRequest, Product } from '@live-commerce/shared-types';

const createProduct = async (data: CreateProductRequest): Promise<Product> => {
  const response = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const result = await response.json();
  return result.data;
};

// Type-safe request
await createProduct({
  streamKey: 'abc123',
  name: 'Product Name',
  price: 10000,
  quantity: 100,
  colorOptions: ['Red', 'Blue'],
  sizeOptions: ['S', 'M', 'L'],
  shippingFee: 3000,
  timerEnabled: true,
  timerDuration: 10,
  imageUrl: 'https://example.com/image.jpg',
});
```

### Using Enums

```typescript
import { OrderStatus, PaymentStatus, ShippingStatus } from '@live-commerce/shared-types';

// Type-safe enum usage
const orderStatus: OrderStatus = OrderStatus.PENDING_PAYMENT;
const paymentStatus: PaymentStatus = PaymentStatus.CONFIRMED;
const shippingStatus: ShippingStatus = ShippingStatus.SHIPPED;
```

### Using Helper Functions

```typescript
import {
  generateOrderId,
  calculateCartTotal,
  isCartExpired,
  formatDecimal,
} from '@live-commerce/shared-types';

// Generate order ID
const orderId = generateOrderId(1); // "ORD-20260125-00001"

// Calculate cart total
const total = calculateCartTotal(cartItems);
console.log(total); // { subtotal: "100000.00", totalShippingFee: "3000.00", total: "103000.00" }

// Check if cart expired
if (isCartExpired(cartItem)) {
  alert('Your cart has expired!');
}

// Format decimal numbers
const price = formatDecimal(10000); // "10000.00"
```

## 📋 Available Types

### Entity Types
- `User` - User profile
- `LiveStream` - Live streaming session
- `ChatMessage` - Real-time chat message
- `ModerationLog` - Chat moderation log
- `Product` - Product catalog
- `Cart` - Shopping cart item
- `Reservation` - Reservation queue item
- `Order` - Order information
- `OrderItem` - Order line item
- `NotificationTemplate` - Notification template
- `AuditLog` - Admin audit log
- `SystemConfig` - System configuration
- `Settlement` - Seller settlement

### Request DTOs
- `KakaoCallbackRequest`
- `UpdateUserProfileRequest`
- `CreateLiveStreamRequest`
- `CreateProductRequest`
- `UpdateProductRequest`
- `AddToCartRequest`
- `CreateOrderRequest`
- `CreateNotificationTemplateRequest`
- And many more...

### Response DTOs
- `ApiResponse<T>` - Standard API response wrapper
- `PaginatedResponse<T>` - Paginated list response
- `AuthResponse` - Authentication response
- `CartSummary` - Cart with summary

### Enums
- `Role` - User roles
- `UserStatus` - User account status
- `StreamStatus` - Live stream status
- `ProductStatus` - Product availability
- `CartStatus` - Cart item status
- `ReservationStatus` - Reservation status
- `OrderStatus` - Order status
- `PaymentStatus` - Payment status
- `ShippingStatus` - Shipping status
- `ModerationAction` - Moderation actions

### Utility Types
- `DeepPartial<T>` - Make all properties optional recursively
- `Nullable<T>` - Type or null
- `Optional<T>` - Type or undefined

### Type Guards
- `isApiError(obj)` - Check if object is ApiError
- `isSuccessResponse(response)` - Check if response is successful
- `isErrorResponse(response)` - Check if response is error

### Helper Functions
- `generateOrderId(sequence)` - Generate order ID
- `isValidOrderId(orderId)` - Validate order ID format
- `parseDecimal(value)` - Parse decimal string safely
- `formatDecimal(value, decimals)` - Format number as decimal string
- `calculateCartTotal(items)` - Calculate cart totals
- `isCartExpired(cart)` - Check if cart expired
- `isReservationExpired(reservation)` - Check if reservation expired

## 🔧 Type Safety Examples

### Backend (NestJS)

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { Product, ApiResponse } from '@live-commerce/shared-types';

@Controller('products')
export class ProductsController {
  @Get(':id')
  async getProduct(@Param('id') id: string): Promise<ApiResponse<Product>> {
    const product = await this.productsService.findById(id);

    return {
      success: true,
      data: product,
    };
  }
}
```

### Frontend (React)

```typescript
import React, { useEffect, useState } from 'react';
import { Product, ApiResponse, isSuccessResponse } from '@live-commerce/shared-types';

const ProductDetail: React.FC<{ productId: string }> = ({ productId }) => {
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetch(`/api/products/${productId}`)
      .then((res) => res.json())
      .then((response: ApiResponse<Product>) => {
        if (isSuccessResponse(response)) {
          setProduct(response.data);
        }
      });
  }, [productId]);

  if (!product) return <div>Loading...</div>;

  return (
    <div>
      <h1>{product.name}</h1>
      <p>Price: ${product.price}</p>
      <p>Stock: {product.quantity}</p>
      {product.colorOptions.length > 0 && (
        <div>
          Colors: {product.colorOptions.join(', ')}
        </div>
      )}
    </div>
  );
};
```

## 🎯 Benefits

1. **Type Safety** - Catch errors at compile-time, not runtime
2. **Single Source of Truth** - One type definition for frontend & backend
3. **Auto-completion** - Better developer experience with IDE support
4. **Refactoring Safety** - Change types once, TypeScript finds all usages
5. **API Contract Enforcement** - Ensure frontend & backend stay in sync
6. **Documentation** - Types serve as self-documenting code

## 📝 Maintenance

When updating the database schema:

1. Update `backend/prisma/schema.prisma`
2. Update `shared/types/index.ts` to match
3. Run `npm install` in both frontend and backend to refresh the package

## 🔄 Version Management

This package uses semantic versioning:

- **MAJOR** - Breaking changes to existing types
- **MINOR** - New types or non-breaking additions
- **PATCH** - Bug fixes or documentation updates

## 📚 Related Documentation

- [API Contract](../../_bmad-output/implementation-artifacts/api-contract.md)
- [Prisma Schema](../../backend/prisma/schema.prisma)
- [Epic & Stories](../../_bmad-output/planning-artifacts/epics.md)

---

**Package Version:** 1.0.0
**Last Updated:** 2026-01-25
**Maintained by:** BMAD Method Team
