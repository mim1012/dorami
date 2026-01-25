import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class StoreService {
  constructor(private prisma: PrismaService) {}

  // Archive functionality removed - ARCHIVED status not in ProductStatus enum
  // TODO: Add ARCHIVED status to schema or implement soft-delete pattern
}
