import { Controller, Post, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { ReservationService } from './reservation.service';
import { CreateOrderDto, CreateOrderFromCartDto } from './dto/order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Orders')
@ApiBearerAuth()
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
  @ApiOperation({
    summary: '장바구니로 주문 생성',
    description: '현재 장바구니 항목으로 주문을 생성합니다. 포인트 사용 가능.',
  })
  @ApiResponse({ status: 201, description: '주문 생성 성공' })
  @ApiResponse({ status: 400, description: '장바구니 없음 또는 재고 부족' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  async createOrderFromCart(
    @CurrentUser('userId') userId: string,
    @Body() dto?: CreateOrderFromCartDto,
  ) {
    return this.ordersService.createOrderFromCart(userId, dto?.pointsToUse);
  }

  @Post()
  @ApiOperation({ summary: '직접 주문 생성', description: '상품을 직접 주문합니다.' })
  @ApiResponse({ status: 201, description: '주문 생성 성공' })
  @ApiResponse({ status: 400, description: '재고 부족' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  async createOrder(@CurrentUser('userId') userId: string, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.createOrder(userId, createOrderDto);
  }

  // NOTE: confirmOrder endpoint removed for security
  // Payment confirmation should only be available via admin:
  // PATCH /api/admin/orders/:id/confirm-payment (see admin.controller.ts)

  @Patch(':id/cancel')
  @ApiOperation({ summary: '주문 취소', description: '본인의 주문을 취소합니다.' })
  @ApiParam({
    name: 'id',
    description: '주문 ID (예: ORD-20240101-00001)',
    example: 'ORD-20240101-00001',
  })
  @ApiResponse({ status: 200, description: '주문 취소 성공' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async cancelOrder(@Param('id') orderId: string, @CurrentUser('userId') userId: string) {
    await this.ordersService.cancelOrder(orderId, userId);
    return { message: 'Order cancelled successfully' };
  }

  @Get()
  @ApiOperation({ summary: '내 주문 목록 조회' })
  @ApiResponse({ status: 200, description: '주문 목록' })
  async getMyOrders(@CurrentUser('userId') userId: string) {
    return this.ordersService.findByUserId(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '주문 상세 조회' })
  @ApiParam({ name: 'id', description: '주문 ID', example: 'ORD-20240101-00001' })
  @ApiResponse({ status: 200, description: '주문 상세 정보' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async getOrderById(@Param('id') orderId: string, @CurrentUser('userId') userId: string) {
    return this.ordersService.findById(orderId, userId);
  }

  // Reservation endpoints
  @Post('reservations/:productId')
  @ApiOperation({ summary: '대기열 참여', description: '품절 상품의 대기열에 참여합니다.' })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiResponse({ status: 201, description: '대기열 참여 성공' })
  @ApiResponse({ status: 409, description: '이미 대기열에 있음' })
  async joinQueue(@Param('productId') productId: string, @CurrentUser('userId') userId: string) {
    return this.reservationService.addToQueue(userId, productId);
  }

  @Get('reservations/:productId/position')
  @ApiOperation({ summary: '대기열 위치 조회' })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiResponse({ status: 200, description: '대기열 위치 정보' })
  async getQueuePosition(
    @Param('productId') productId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.reservationService.getPosition(userId, productId);
  }

  @Patch('reservations/:productId/cancel')
  @ApiOperation({ summary: '대기열 취소' })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiResponse({ status: 200, description: '대기열 취소 성공' })
  async cancelReservation(
    @Param('productId') productId: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.reservationService.cancelReservation(userId, productId);
    return { message: 'Reservation cancelled' };
  }
}
