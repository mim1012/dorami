import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PointTransactionType, Prisma } from '@prisma/client';
import {
  PointBalanceResponseDto,
  PointTransactionResponseDto,
  GetPointHistoryQueryDto,
} from './dto/points.dto';
import { PointsConfigService } from './points-config.service';

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    private prisma: PrismaService,
    private pointsConfigService: PointsConfigService,
  ) {}

  /**
   * Get or create a PointBalance record for a user (inside a transaction)
   */
  async getOrCreateBalance(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    let balance = await tx.pointBalance.findUnique({
      where: { userId },
    });

    if (!balance) {
      balance = await tx.pointBalance.create({
        data: { userId },
      });
    }

    return balance;
  }

  /**
   * Get user's point balance
   */
  async getBalance(userId: string): Promise<PointBalanceResponseDto> {
    const balance = await this.prisma.$transaction(async (tx) => {
      return this.getOrCreateBalance(tx, userId);
    });

    return {
      currentBalance: balance.currentBalance,
      lifetimeEarned: balance.lifetimeEarned,
      lifetimeUsed: balance.lifetimeUsed,
      lifetimeExpired: balance.lifetimeExpired,
    };
  }

  /**
   * Get transaction history with pagination and filters
   */
  async getTransactionHistory(
    userId: string,
    query: GetPointHistoryQueryDto,
  ): Promise<{
    items: PointTransactionResponseDto[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { page = 1, limit = 20, transactionType, startDate, endDate } = query;

    // Get balance to get balanceId
    const balance = await this.prisma.pointBalance.findUnique({
      where: { userId },
    });

    if (!balance) {
      return {
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const where: Prisma.PointTransactionWhereInput = {
      balanceId: balance.id,
    };

    if (transactionType) {
      where.transactionType = transactionType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {where.createdAt.gte = new Date(startDate);}
      if (endDate) {where.createdAt.lte = new Date(endDate);}
    }

    const [total, transactions] = await Promise.all([
      this.prisma.pointTransaction.count({ where }),
      this.prisma.pointTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: transactions.map((tx) => ({
        id: tx.id,
        transactionType: tx.transactionType,
        amount: tx.amount,
        balanceAfter: tx.balanceAfter,
        orderId: tx.orderId ?? undefined,
        reason: tx.reason ?? undefined,
        expiresAt: tx.expiresAt ?? undefined,
        createdAt: tx.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Add points to user's balance (atomic)
   */
  async addPoints(
    userId: string,
    amount: number,
    type: PointTransactionType,
    orderId?: string,
    reason?: string,
    expiresAt?: Date,
  ): Promise<{ newBalance: number }> {
    return await this.prisma.$transaction(async (tx) => {
      const balance = await this.getOrCreateBalance(tx, userId);

      const newBalance = balance.currentBalance + amount;

      await tx.pointBalance.update({
        where: { id: balance.id },
        data: {
          currentBalance: newBalance,
          lifetimeEarned: balance.lifetimeEarned + amount,
        },
      });

      await tx.pointTransaction.create({
        data: {
          balanceId: balance.id,
          transactionType: type,
          amount,
          balanceAfter: newBalance,
          orderId,
          reason,
          expiresAt,
        },
      });

      this.logger.log(
        `Added ${amount} points to user ${userId} (type: ${type}). New balance: ${newBalance}`,
      );

      return { newBalance };
    });
  }

  /**
   * Deduct points from user's balance (atomic, with validation)
   */
  async deductPoints(
    userId: string,
    amount: number,
    type: PointTransactionType,
    orderId?: string,
    reason?: string,
  ): Promise<{ newBalance: number }> {
    return await this.prisma.$transaction(async (tx) => {
      const balance = await this.getOrCreateBalance(tx, userId);

      if (balance.currentBalance < amount) {
        throw new BusinessException(
          'INSUFFICIENT_POINTS',
          { available: balance.currentBalance, requested: amount },
          `Insufficient points. Available: ${balance.currentBalance}, Requested: ${amount}`,
        );
      }

      const newBalance = balance.currentBalance - amount;

      await tx.pointBalance.update({
        where: { id: balance.id },
        data: {
          currentBalance: newBalance,
          lifetimeUsed:
            type === PointTransactionType.USED_ORDER
              ? balance.lifetimeUsed + amount
              : balance.lifetimeUsed,
          lifetimeExpired:
            type === PointTransactionType.EXPIRED
              ? balance.lifetimeExpired + amount
              : balance.lifetimeExpired,
        },
      });

      await tx.pointTransaction.create({
        data: {
          balanceId: balance.id,
          transactionType: type,
          amount: -amount,
          balanceAfter: newBalance,
          orderId,
          reason,
        },
      });

      this.logger.log(
        `Deducted ${amount} points from user ${userId} (type: ${type}). New balance: ${newBalance}`,
      );

      return { newBalance };
    });
  }

  /**
   * Validate if user can redeem points against an order total
   */
  async validateRedemption(
    userId: string,
    pointsToUse: number,
    orderTotal: number,
  ): Promise<void> {
    const config = await this.pointsConfigService.getPointsConfig();

    if (!config.pointsEnabled) {
      throw new BusinessException(
        'POINTS_DISABLED',
        {},
        'Points system is currently disabled',
      );
    }

    if (pointsToUse < config.pointMinRedemption) {
      throw new BusinessException(
        'POINTS_BELOW_MINIMUM',
        { minimum: config.pointMinRedemption, requested: pointsToUse },
        `Minimum points redemption is ${config.pointMinRedemption}`,
      );
    }

    const maxRedemptionAmount = Math.floor(
      orderTotal * (config.pointMaxRedemptionPct / 100),
    );

    if (pointsToUse > maxRedemptionAmount) {
      throw new BusinessException(
        'POINTS_EXCEED_MAX',
        { maxAllowed: maxRedemptionAmount, requested: pointsToUse },
        `Maximum points usage for this order is ${maxRedemptionAmount} (${config.pointMaxRedemptionPct}% of total)`,
      );
    }

    // Check balance
    const balance = await this.prisma.pointBalance.findUnique({
      where: { userId },
    });

    if (!balance || balance.currentBalance < pointsToUse) {
      throw new BusinessException(
        'INSUFFICIENT_POINTS',
        {
          available: balance?.currentBalance ?? 0,
          requested: pointsToUse,
        },
        `Insufficient points. Available: ${balance?.currentBalance ?? 0}`,
      );
    }
  }
}
