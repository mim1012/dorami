import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PushNotificationService } from './push-notification.service';
import {
  SubscribeNotificationDto,
  UnsubscribeNotificationDto,
  NotificationSubscriptionResponseDto,
} from './dto/notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private pushNotificationService: PushNotificationService) {}

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe to push notifications' })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully',
    type: NotificationSubscriptionResponseDto,
  })
  async subscribe(
    @CurrentUser('userId') userId: string,
    @Body() dto: SubscribeNotificationDto,
  ) {
    return this.pushNotificationService.subscribe(userId, dto);
  }

  @Delete('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unsubscribe from push notifications' })
  @ApiResponse({ status: 200, description: 'Unsubscribed successfully' })
  async unsubscribe(
    @CurrentUser('userId') userId: string,
    @Body() dto: UnsubscribeNotificationDto,
  ) {
    return this.pushNotificationService.unsubscribe(userId, dto.endpoint);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Get all subscriptions for current user' })
  @ApiResponse({
    status: 200,
    description: 'List of subscriptions',
    type: [NotificationSubscriptionResponseDto],
  })
  async getSubscriptions(@CurrentUser('userId') userId: string) {
    return this.pushNotificationService.getSubscriptions(userId);
  }
}
