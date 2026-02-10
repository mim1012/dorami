import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ReservationService } from './reservation.service';
import { CreateOrderDto, CreateOrderFromCartDto } from './dto/order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private reservationService: ReservationService,
  ) {}

  /**
   * Epic 8 Story 8.1: Create order from cart
   * Epic 13 Story 13.3: Support pointsToUse for point redemption
   */
  @Post('from-cart')
  async createOrderFromCart(
    @CurrentUser('userId') userId: string,
    @Body() dto?: CreateOrderFromCartDto,
  ) {
    return this.ordersService.createOrderFromCart(userId, dto?.pointsToUse);
  }

  @Post()
  async createOrder(
    @CurrentUser('userId') userId: string,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(userId, createOrderDto);
  }

  @Patch(':id/confirm')
  async confirmOrder(
    @Param('id') orderId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ordersService.confirmOrder(orderId, userId);
  }

  @Patch(':id/cancel')
  async cancelOrder(
    @Param('id') orderId: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.ordersService.cancelOrder(orderId, userId);
    return { message: 'Order cancelled successfully' };
  }

  @Get()
  async getMyOrders(@CurrentUser('userId') userId: string) {
    return this.ordersService.findByUserId(userId);
  }

  @Get(':id')
  async getOrderById(
    @Param('id') orderId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ordersService.findById(orderId, userId);
  }

  // Reservation endpoints
  @Post('reservations/:productId')
  async joinQueue(
    @Param('productId') productId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.reservationService.addToQueue(userId, productId);
  }

  @Get('reservations/:productId/position')
  async getQueuePosition(
    @Param('productId') productId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.reservationService.getPosition(userId, productId);
  }

  @Patch('reservations/:productId/cancel')
  async cancelReservation(
    @Param('productId') productId: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.reservationService.cancelReservation(userId, productId);
    return { message: 'Reservation cancelled' };
  }
}
