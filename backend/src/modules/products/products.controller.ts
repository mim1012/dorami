import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  UpdateProductDto,
  UpdateStockDto,
  ProductResponseDto,
  ProductStatus,
  ReorderProductsDto,
  BulkUpdateStatusDto,
  BulkDeleteDto,
} from './dto/product.dto';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { parsePagination } from '../../common/utils/pagination.util';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Epic 5 Story 5.1: Create a new product (Admin only)
   */
  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create a new product (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully',
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'LiveStream not found' })
  async create(@Body() createDto: CreateProductDto): Promise<ProductResponseDto> {
    return this.productsService.create(createDto);
  }

  /**
   * Get featured products for homepage (Public)
   * Note: This route must be before GET :id to avoid 'featured' being treated as an ID
   */
  @Public()
  @Get('featured')
  @ApiOperation({ summary: 'Get featured products for homepage (Public)' })
  @ApiQuery({
    name: 'limit',
    description: 'Number of products to return',
    required: false,
    example: 6,
  })
  @ApiResponse({
    status: 200,
    description: 'Featured products retrieved successfully',
    type: [ProductResponseDto],
  })
  async getFeaturedProducts(@Query('limit') limit?: string): Promise<ProductResponseDto[]> {
    const { limit: limitNum } = parsePagination(1, limit, { limit: 6, maxLimit: 20 });
    return this.productsService.getFeaturedProducts(limitNum);
  }

  /**
   * Epic 11 Story 11.1: Get store products from ended live streams (Public)
   * Note: This route must be before GET :id to avoid 'store' being treated as an ID
   */
  @Public()
  @Get('store')
  @ApiOperation({ summary: 'Get store products from ended live streams (Public)' })
  @ApiQuery({ name: 'page', description: 'Page number', required: false, example: 1 })
  @ApiQuery({ name: 'limit', description: 'Items per page', required: false, example: 24 })
  @ApiResponse({ status: 200, description: 'Store products retrieved successfully' })
  async getStoreProducts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    data: ProductResponseDto[];
    meta: { total: number; page: number; totalPages: number };
  }> {
    const { page: pageNum, limit: limitNum } = parsePagination(page, limit);

    const result = await this.productsService.getStoreProducts(pageNum, limitNum);

    return {
      data: result.products,
      meta: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * Get live deal products from the current active live stream (Public)
   * Note: This route must be before GET :id to avoid 'live-deals' being treated as an ID
   */
  @Public()
  @Get('live-deals')
  @ApiOperation({ summary: 'Get live deal products from active live stream (Public)' })
  @ApiResponse({
    status: 200,
    description: 'Live deal products retrieved successfully (null if no active stream)',
  })
  async getLiveDeals(): Promise<{
    products: ProductResponseDto[];
    streamTitle: string;
    streamKey: string;
  } | null> {
    return this.productsService.getLiveDeals();
  }

  /**
   * Get popular products sorted by confirmed sales count (Public)
   * Note: This route must be before GET :id to avoid 'popular' being treated as an ID
   */
  @Public()
  @Get('popular')
  @ApiOperation({ summary: 'Get popular products sorted by sales count (Public)' })
  @ApiQuery({ name: 'page', description: 'Page number', required: false, example: 1 })
  @ApiQuery({ name: 'limit', description: 'Items per page', required: false, example: 8 })
  @ApiResponse({ status: 200, description: 'Popular products retrieved successfully' })
  async getPopularProducts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    data: (ProductResponseDto & { soldCount: number })[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { page: pageNum, limit: limitNum } = parsePagination(page, limit, {
      limit: 8,
      maxLimit: 50,
    });
    return this.productsService.getPopularProducts(pageNum, limitNum);
  }

  /**
   * Epic 5 Story 5.2, 5.3: Get products by stream key (Public)
   * Query params: streamKey (required), status (optional)
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all products for a stream (Public)' })
  @ApiQuery({
    name: 'streamKey',
    description: 'Stream key',
    required: true,
    example: 'abc123def456',
  })
  @ApiQuery({
    name: 'status',
    description: 'Filter by status',
    enum: ProductStatus,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Products retrieved successfully',
    type: [ProductResponseDto],
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  async findAll(
    @Query('streamKey') streamKey?: string,
    @Query('status') status?: ProductStatus,
  ): Promise<ProductResponseDto[]> {
    // If streamKey is provided, filter by stream
    if (streamKey) {
      return await this.productsService.findByStreamKey(streamKey, status);
    }

    // Otherwise return all products (legacy behavior)
    return await this.productsService.findAll(status);
  }

  /**
   * Duplicate a product (Admin only)
   */
  @Post(':id/duplicate')
  @AdminOnly()
  @ApiOperation({ summary: 'Duplicate a product (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID to duplicate' })
  @ApiResponse({
    status: 201,
    description: 'Product duplicated successfully',
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async duplicate(@Param('id') id: string): Promise<ProductResponseDto> {
    return this.productsService.duplicate(id);
  }

  /**
   * Reorder products (Admin only)
   */
  @Patch('reorder')
  @AdminOnly()
  @ApiOperation({ summary: 'Reorder products by ID array (Admin only)' })
  @ApiResponse({ status: 200, description: 'Products reordered successfully' })
  async reorder(@Body() dto: ReorderProductsDto): Promise<void> {
    return this.productsService.reorder(dto);
  }

  /**
   * Bulk update product status (Admin only)
   */
  @Post('bulk-status')
  @AdminOnly()
  @ApiOperation({ summary: 'Bulk update product status (Admin only)' })
  @ApiResponse({ status: 200, description: 'Products status updated' })
  async bulkUpdateStatus(@Body() dto: BulkUpdateStatusDto): Promise<{ updated: number }> {
    return this.productsService.bulkUpdateStatus(dto);
  }

  /**
   * Bulk delete products (Admin only)
   */
  @Post('bulk-delete')
  @AdminOnly()
  @ApiOperation({ summary: 'Bulk delete products (Admin only)' })
  @ApiResponse({ status: 200, description: 'Products deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async bulkDelete(@Body() dto: BulkDeleteDto): Promise<{ deleted: number; failed: string[] }> {
    return this.productsService.bulkDelete(dto.ids);
  }

  /**
   * Epic 5 Story 5.4: Get a single product by ID (Public)
   */
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by ID (Public)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: 200,
    description: 'Product retrieved successfully',
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findById(@Param('id') id: string): Promise<ProductResponseDto> {
    return this.productsService.findById(id);
  }

  /**
   * Epic 5 Story 5.1: Update a product (Admin only)
   */
  @Patch(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update a product (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: 200,
    description: 'Product updated successfully',
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.update(id, updateDto);
  }

  /**
   * Epic 5 Story 5.1: Mark product as sold out (Admin only)
   */
  @Patch(':id/sold-out')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark product as sold out (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product marked as sold out', type: ProductResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async markAsSoldOut(@Param('id') id: string): Promise<ProductResponseDto> {
    return this.productsService.markAsSoldOut(id);
  }

  /**
   * Update stock (increase/decrease) (Admin only)
   * Used by cart and order modules
   */
  @Patch(':id/stock')
  @AdminOnly()
  @ApiOperation({ summary: 'Update product stock (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Stock updated successfully', type: ProductResponseDto })
  @ApiResponse({ status: 400, description: 'Insufficient stock' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async updateStock(
    @Param('id') id: string,
    @Body() updateStockDto: UpdateStockDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.updateStock(id, updateStockDto);
  }

  /**
   * Delete a product (Admin only)
   */
  @Delete(':id')
  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 204, description: 'Product deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete product with active carts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.productsService.delete(id);
  }
}
