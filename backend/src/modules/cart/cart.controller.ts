import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CartService } from './cart.service';
import {
  AddToCartDto,
  UpdateCartItemDto,
  CartItemResponseDto,
  CartSummaryDto,
} from './dto/cart.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Cart')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Epic 6: Add product to cart
   */
  @Post()
  @ApiOperation({ summary: 'Add product to cart (with timer if enabled)' })
  @ApiResponse({ status: 201, description: 'Product added to cart', type: CartItemResponseDto })
  @ApiResponse({ status: 400, description: 'Insufficient stock or product unavailable' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async addToCart(
    @CurrentUser('userId') userId: string,
    @Body() addToCartDto: AddToCartDto,
  ): Promise<CartItemResponseDto> {
    return this.cartService.addToCart(userId, addToCartDto);
  }

  /**
   * Epic 6: Get user's cart
   */
  @Get()
  @ApiOperation({ summary: 'Get current user cart with summary' })
  @ApiResponse({ status: 200, description: 'Cart retrieved successfully', type: CartSummaryDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCart(@CurrentUser('userId') userId: string): Promise<CartSummaryDto> {
    return this.cartService.getCart(userId);
  }

  /**
   * Epic 6: Update cart item quantity
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiParam({ name: 'id', description: 'Cart item ID' })
  @ApiResponse({ status: 200, description: 'Cart item updated', type: CartItemResponseDto })
  @ApiResponse({ status: 400, description: 'Insufficient stock' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  async updateCartItem(
    @CurrentUser('userId') userId: string,
    @Param('id') cartItemId: string,
    @Body() updateDto: UpdateCartItemDto,
  ): Promise<CartItemResponseDto> {
    return this.cartService.updateCartItem(userId, cartItemId, updateDto);
  }

  /**
   * Epic 6: Remove item from cart
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiParam({ name: 'id', description: 'Cart item ID' })
  @ApiResponse({ status: 204, description: 'Cart item removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  async removeCartItem(
    @CurrentUser('userId') userId: string,
    @Param('id') cartItemId: string,
  ): Promise<void> {
    await this.cartService.removeCartItem(userId, cartItemId);
  }

  /**
   * Epic 6: Clear cart
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear all items from cart' })
  @ApiResponse({ status: 204, description: 'Cart cleared' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async clearCart(@CurrentUser('userId') userId: string): Promise<void> {
    await this.cartService.clearCart(userId);
  }
}
