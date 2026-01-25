import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class ConfigSystemService {
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async getConfig(key: string): Promise<any> {
    // Try cache first
    const cached = await this.redisService.get(`config:${key}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from database
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });

    if (!config) {
      return null;
    }

    // Cache the result
    await this.redisService.set(
      `config:${key}`,
      JSON.stringify(config.value),
      this.CACHE_TTL,
    );

    return config.value;
  }

  async setConfig(key: string, value: any): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });

    // Update cache
    await this.redisService.set(
      `config:${key}`,
      JSON.stringify(value),
      this.CACHE_TTL,
    );
  }

  async deleteConfig(key: string): Promise<void> {
    await this.prisma.systemConfig.delete({
      where: { key },
    });

    // Remove from cache
    await this.redisService.del(`config:${key}`);
  }

  async getAllConfigs(): Promise<Record<string, any>> {
    const configs = await this.prisma.systemConfig.findMany();

    return configs.reduce((acc, config) => {
      acc[config.key] = config.value;
      return acc;
    }, {} as Record<string, any>);
  }
}
