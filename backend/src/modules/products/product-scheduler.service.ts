import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProductsService } from './products.service';

@Injectable()
export class ProductSchedulerService {
  private readonly logger = new Logger(ProductSchedulerService.name);

  constructor(private readonly productsService: ProductsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleProductExpiry() {
    const count = await this.productsService.countExpiredProducts();
    if (count > 0) {
      this.logger.log(`만료 상품 ${count}개 감지 (Store에서 자동 필터링됨, 삭제하지 않음)`);
    }
  }
}
