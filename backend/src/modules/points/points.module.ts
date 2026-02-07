import { Module } from '@nestjs/common';
import { PointsService } from './points.service';
import { PointsConfigService } from './points-config.service';
import { PointsExpirationService } from './points-expiration.service';
import { PointsController } from './points.controller';
import { PointsEventsListener } from './listeners/points-events.listener';

@Module({
  controllers: [PointsController],
  providers: [
    PointsService,
    PointsConfigService,
    PointsExpirationService,
    PointsEventsListener,
  ],
  exports: [PointsService, PointsConfigService],
})
export class PointsModule {}
