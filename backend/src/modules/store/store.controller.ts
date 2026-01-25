import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { StoreService } from './store.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('store')
export class StoreController {
  constructor(private storeService: StoreService) {}

  // Archive endpoints removed - ARCHIVED status not in ProductStatus enum
  // TODO: Add ARCHIVED status to schema or implement soft-delete pattern

  // @Public()
  // @Get('archived')
  // async getArchivedProducts() {
  //   return this.storeService.getArchivedProducts();
  // }

  // @Patch('archive/:id')
  // @UseGuards(JwtAuthGuard)
  // async archiveProduct(@Param('id') id: string) {
  //   await this.storeService.archiveProduct(id);
  //   return { message: 'Product archived successfully' };
  // }
}
