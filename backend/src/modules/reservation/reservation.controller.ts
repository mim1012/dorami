import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ReservationService } from './reservation.service';
import {
  CreateReservationDto,
  ReservationResponseDto,
  ReservationListDto,
} from './dto/reservation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Reservation')
@Controller('reservations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  /**
   * Epic 7: Create reservation when stock is insufficient
   */
  @Post()
  @ApiOperation({ summary: 'Create reservation (when stock unavailable)' })
  @ApiResponse({ status: 201, description: 'Reservation created', type: ReservationResponseDto })
  @ApiResponse({ status: 400, description: 'Stock is available or already reserved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async createReservation(
    @CurrentUser('userId') userId: string,
    @Body() createDto: CreateReservationDto,
  ): Promise<ReservationResponseDto> {
    return this.reservationService.createReservation(userId, createDto);
  }

  /**
   * Epic 7: Get user's reservations
   */
  @Get()
  @ApiOperation({ summary: 'Get current user reservations' })
  @ApiResponse({ status: 200, description: 'Reservations retrieved', type: ReservationListDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserReservations(@CurrentUser('userId') userId: string): Promise<ReservationListDto> {
    return this.reservationService.getUserReservations(userId);
  }

  /**
   * Epic 7: Cancel reservation
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel reservation (triggers auto-promotion)' })
  @ApiParam({ name: 'id', description: 'Reservation ID' })
  @ApiResponse({ status: 204, description: 'Reservation cancelled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  async cancelReservation(
    @CurrentUser('userId') userId: string,
    @Param('id') reservationId: string,
  ): Promise<void> {
    await this.reservationService.cancelReservation(userId, reservationId);
  }
}
