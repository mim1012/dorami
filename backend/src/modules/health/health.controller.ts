import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
} from '@nestjs/terminus';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private redisHealth: RedisHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: '전체 헬스 체크', description: '모든 의존성(DB, Redis) 상태를 확인합니다.' })
  @ApiResponse({ status: 200, description: '모든 서비스 정상' })
  @ApiResponse({ status: 503, description: '일부 서비스 장애' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness Probe', description: '서비스 실행 여부를 확인합니다.' })
  @ApiResponse({ status: 200, description: '서비스 실행 중' })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness Probe', description: '트래픽 수신 준비 상태를 확인합니다.' })
  @ApiResponse({ status: 200, description: '트래픽 수신 준비 완료' })
  @ApiResponse({ status: 503, description: '트래픽 수신 준비 미완료' })
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }
}
