import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PointsService } from './points.service';
import { PointsConfigService } from './points-config.service';
import { PointTransactionType } from '@prisma/client';
import { PointsExpiringSoonEvent } from '../../common/events/points.events';

@Injectable()
export class PointsExpirationService {
  private readonly logger = new Logger(PointsExpirationService.name);

  constructor(
    private prisma: PrismaService,
    private pointsService: PointsService,
    private pointsConfigService: PointsConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Process point expirations daily at 02:00
   */
  @Cron('0 2 * * *')
  async processExpirations() {
    try {
      const config = await this.pointsConfigService.getPointsConfig();

      if (!config.pointsEnabled || !config.pointExpirationEnabled) {
        return;
      }

      const now = new Date();

      // Find expired EARNED_ORDER transactions that haven't been processed
      const expiredTransactions = await this.prisma.pointTransaction.findMany({
        where: {
          transactionType: PointTransactionType.EARNED_ORDER,
          expiresAt: { lte: now },
          amount: { gt: 0 },
        },
        include: {
          balance: true,
        },
      });

      if (expiredTransactions.length === 0) {
        return;
      }

      // Group by user
      const userExpirations = new Map<string, number>();

      for (const tx of expiredTransactions) {
        const userId = tx.balance.userId;
        const current = userExpirations.get(userId) || 0;
        userExpirations.set(userId, current + tx.amount);
      }

      // Process each user's expiration
      for (const [userId, totalExpiring] of userExpirations) {
        try {
          // Get current balance - don't expire more than what user has
          const balance = await this.prisma.pointBalance.findUnique({
            where: { userId },
          });

          if (!balance || balance.currentBalance <= 0) {
            continue;
          }

          const amountToExpire = Math.min(totalExpiring, balance.currentBalance);

          if (amountToExpire <= 0) {
            continue;
          }

          await this.pointsService.deductPoints(
            userId,
            amountToExpire,
            PointTransactionType.EXPIRED,
            undefined,
            'Points expired',
          );

          // Mark the original transactions' expiresAt to null to prevent re-processing
          const userExpiredTxIds = expiredTransactions
            .filter((tx) => tx.balance.userId === userId)
            .map((tx) => tx.id);

          await this.prisma.pointTransaction.updateMany({
            where: { id: { in: userExpiredTxIds } },
            data: { expiresAt: null },
          });

          this.logger.log(`Expired ${amountToExpire} points for user ${userId}`);
        } catch (error) {
          this.logger.error(
            `Failed to expire points for user ${userId}`,
            error.stack,
          );
        }
      }

      // Send warning notifications for points expiring in 7 days
      await this.sendExpirationWarnings(config);
    } catch (error) {
      this.logger.error('Failed to process point expirations', error.stack);
    }
  }

  private async sendExpirationWarnings(config: { pointExpirationEnabled: boolean }) {
    if (!config.pointExpirationEnabled) return;

    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + 7);

    const now = new Date();

    const expiringTransactions = await this.prisma.pointTransaction.findMany({
      where: {
        transactionType: PointTransactionType.EARNED_ORDER,
        expiresAt: {
          gt: now,
          lte: warningDate,
        },
        amount: { gt: 0 },
      },
      include: {
        balance: true,
      },
    });

    // Group by user
    const userWarnings = new Map<string, { amount: number; expiresAt: Date }>();
    for (const tx of expiringTransactions) {
      const userId = tx.balance.userId;
      const existing = userWarnings.get(userId);
      if (existing) {
        existing.amount += tx.amount;
        if (tx.expiresAt && tx.expiresAt < existing.expiresAt) {
          existing.expiresAt = tx.expiresAt;
        }
      } else {
        userWarnings.set(userId, {
          amount: tx.amount,
          expiresAt: tx.expiresAt!,
        });
      }
    }

    for (const [userId, { amount, expiresAt }] of userWarnings) {
      this.eventEmitter.emit(
        'points:expiring-soon',
        new PointsExpiringSoonEvent(userId, amount, expiresAt),
      );
    }
  }
}
