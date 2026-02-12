import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

export function AdminOnly() {
  return applyDecorators(UseGuards(JwtAuthGuard, RolesGuard), Roles('ADMIN'), ApiBearerAuth());
}
