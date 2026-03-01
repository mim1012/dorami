import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubscribeNotificationDto {
  @ApiPropertyOptional({
    description: 'Live stream ID to subscribe to (null for all)',
    example: 'stream-uuid',
  })
  @IsOptional()
  @IsString()
  liveStreamId?: string;

  @ApiProperty({
    description: 'Push subscription endpoint',
    example: 'https://fcm.googleapis.com/...',
  })
  @IsString()
  @IsNotEmpty()
  endpoint!: string;

  @ApiProperty({ description: 'Encryption key (p256dh)', example: 'BNcRdreALRF...' })
  @IsString()
  @IsNotEmpty()
  p256dh!: string;

  @ApiProperty({ description: 'Auth secret', example: 'tBHSVfJWKo...' })
  @IsString()
  @IsNotEmpty()
  auth!: string;
}

export class UnsubscribeNotificationDto {
  @ApiProperty({
    description: 'Push subscription endpoint to remove',
    example: 'https://fcm.googleapis.com/...',
  })
  @IsString()
  @IsNotEmpty()
  endpoint!: string;
}

export class NotificationSubscriptionResponseDto {
  @ApiProperty({ description: 'Subscription ID', example: 'sub-uuid' })
  id!: string;

  @ApiProperty({ description: 'User ID', example: 'user-uuid' })
  userId!: string;

  @ApiPropertyOptional({ description: 'Live stream ID', example: 'stream-uuid' })
  liveStreamId?: string;

  @ApiProperty({ description: 'Created timestamp', example: '2026-02-04T10:30:00.000Z' })
  createdAt!: Date;
}
