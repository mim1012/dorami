import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GetUsersQueryDto, UserListResponseDto, UserListItemDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getUserList(query: GetUsersQueryDto): Promise<UserListResponseDto> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const skip = (page - 1) * limit;

    // Get total count
    const total = await this.prisma.user.count();

    // Get paginated users with sorting
    const users = await this.prisma.user.findMany({
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        email: true,
        name: true,
        instagramId: true,
        createdAt: true,
        lastLoginAt: true,
        status: true,
        role: true,
      },
    });

    // Map users to DTOs with order stats (placeholder for now, will be implemented in Epic 8)
    const userDtos: UserListItemDto[] = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      instagramId: user.instagramId,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      status: user.status,
      role: user.role,
      totalOrders: 0, // Epic 8 dependency - will aggregate from Orders table
      totalPurchaseAmount: 0, // Epic 8 dependency - will sum order totals
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      users: userDtos,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
