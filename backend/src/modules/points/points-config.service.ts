import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdatePointsConfigDto } from './dto/points.dto';

export interface PointsConfig {
  pointsEnabled: boolean;
  pointEarningRate: number;
  pointMinRedemption: number;
  pointMaxRedemptionPct: number;
  pointExpirationEnabled: boolean;
  pointExpirationMonths: number;
}

@Injectable()
export class PointsConfigService {
  private readonly logger = new Logger(PointsConfigService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get points configuration from SystemConfig
   */
  async getPointsConfig(): Promise<PointsConfig> {
    const config = await this.getOrCreateSystemConfig();

    return {
      pointsEnabled: config.pointsEnabled,
      pointEarningRate: config.pointEarningRate,
      pointMinRedemption: config.pointMinRedemption,
      pointMaxRedemptionPct: config.pointMaxRedemptionPct,
      pointExpirationEnabled: config.pointExpirationEnabled,
      pointExpirationMonths: config.pointExpirationMonths,
    };
  }

  /**
   * Update points configuration
   */
  async updatePointsConfig(dto: UpdatePointsConfigDto): Promise<PointsConfig> {
    const config = await this.getOrCreateSystemConfig();

    const updated = await this.prisma.systemConfig.update({
      where: { id: config.id },
      data: {
        ...(dto.pointsEnabled !== undefined && { pointsEnabled: dto.pointsEnabled }),
        ...(dto.pointEarningRate !== undefined && { pointEarningRate: dto.pointEarningRate }),
        ...(dto.pointMinRedemption !== undefined && { pointMinRedemption: dto.pointMinRedemption }),
        ...(dto.pointMaxRedemptionPct !== undefined && { pointMaxRedemptionPct: dto.pointMaxRedemptionPct }),
        ...(dto.pointExpirationEnabled !== undefined && { pointExpirationEnabled: dto.pointExpirationEnabled }),
        ...(dto.pointExpirationMonths !== undefined && { pointExpirationMonths: dto.pointExpirationMonths }),
      },
    });

    this.logger.log('Points configuration updated');

    return {
      pointsEnabled: updated.pointsEnabled,
      pointEarningRate: updated.pointEarningRate,
      pointMinRedemption: updated.pointMinRedemption,
      pointMaxRedemptionPct: updated.pointMaxRedemptionPct,
      pointExpirationEnabled: updated.pointExpirationEnabled,
      pointExpirationMonths: updated.pointExpirationMonths,
    };
  }

  private async getOrCreateSystemConfig() {
    let config = await this.prisma.systemConfig.findFirst();

    if (!config) {
      config = await this.prisma.systemConfig.create({
        data: {},
      });
    }

    return config;
  }
}
