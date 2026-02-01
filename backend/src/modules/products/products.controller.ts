import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  UpdateProductDto,
  UpdateStockDto,
  ProductResponseDto,
  GetProductsQueryDto,
  ProductStatus,
} from './dto/product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Epic 5 Story 5.1: Create a new product (Admin only)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new product (Admin only)' })
  @ApiResponse({ status: 201, description: 'Product created successfully', type: ProductResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'LiveStream not found' })
  async create(@Body() createDto: CreateProductDto): Promise<{ data: ProductResponseDto }> {
    const product = await this.productsService.create(createDto);
    return { data: product };
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
    // Validate and sanitize pagination inputs
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));

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
   * Epic 5 Story 5.2, 5.3: Get products by stream key (Public)
   * Query params: streamKey (required), status (optional)
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all products for a stream (Public)' })
  @ApiQuery({ name: 'streamKey', description: 'Stream key', required: true, example: 'abc123def456' })
  @ApiQuery({ name: 'status', description: 'Filter by status', enum: ProductStatus, required: false })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully', type: [ProductResponseDto] })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  async findAll(
    @Query('streamKey') streamKey?: string,
    @Query('status') status?: ProductStatus,
  ): Promise<{ data: ProductResponseDto[] }> {
    // If streamKey is provided, filter by stream
    if (streamKey) {
      const products = await this.productsService.findByStreamKey(streamKey, status);
      return { data: products };
    }

    // Otherwise return all products (legacy behavior)
    const products = await this.productsService.findAll(status);
    return { data: products };
  }

  /**
   * Epic 5 Story 5.4: Get a single product by ID (Public)
   */
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by ID (Public)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product retrieved successfully', type: ProductResponseDto })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findById(@Param('id') id: string): Promise<{ data: ProductResponseDto }> {
    const product = await this.productsService.findById(id);
    return { data: product };
  }

  /**
   * Epic 5 Story 5.1: Update a product (Admin only)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product updated successfully', type: ProductResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductDto,
  ): Promise<{ data: ProductResponseDto }> {
    const product = await this.productsService.update(id, updateDto);
    return { data: product };
  }

  /**
   * Epic 5 Story 5.1: Mark product as sold out (Admin only)
   */
  @Patch(':id/sold-out')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark product as sold out (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product marked as sold out', type: ProductResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async markAsSoldOut(@Param('id') id: string): Promise<{ data: ProductResponseDto }> {
    const product = await this.productsService.markAsSoldOut(id);
    return { data: product };
  }

  /**
   * Update stock (increase/decrease) (Admin only)
   * Used by cart and order modules
   */
  @Patch(':id/stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
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
  ): Promise<{ data: ProductResponseDto }> {
    const product = await this.productsService.updateStock(id, updateStockDto);
    return { data: product };
  }

  /**
   * Delete a product (Admin only)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
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
