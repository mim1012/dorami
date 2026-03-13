import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProductsService } from './products.service';

@Injectable()
export class ProductSchedulerService {
  private readonly logger = new Logger(ProductSchedulerService.name);

  constructor(private readonly productsService: ProductsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleProductExpiry() {
    const count = await this.productsService.deleteExpiredProducts();
    if (count > 0) {
      this.logger.log(`만료 상품 ${count}개 자동 삭제`);
    }
  }
}
