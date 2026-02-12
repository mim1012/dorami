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
import { ProductService } from './product.service';
import { ProductGateway } from './product.gateway';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductResponseDto,
  GetProductsQueryDto,
  ProductStatus,
} from './dto/product.dto';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';

@ApiTags('Products')
@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly productGateway: ProductGateway,
  ) {}

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
  async createProduct(@Body() createProductDto: CreateProductDto): Promise<ProductResponseDto> {
    const product = await this.productService.createProduct(createProductDto);

    // Broadcast product added event to all viewers
    void this.productGateway.broadcastProductAdded(product.streamKey, product);

    return product;
  }

  @Get()
  @ApiOperation({ summary: 'Get all products for a stream (Public)' })
  @ApiQuery({ name: 'streamKey', description: 'Stream key', required: true })
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
  async getProducts(@Query() query: GetProductsQueryDto): Promise<ProductResponseDto[]> {
    return this.productService.getProductsByStream(query.streamKey, query.status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by ID (Public)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: 200,
    description: 'Product retrieved successfully',
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProductById(@Param('id') id: string): Promise<ProductResponseDto> {
    return this.productService.getProductById(id);
  }

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
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.productService.updateProduct(id, updateProductDto);

    // Broadcast product updated event to all viewers
    void this.productGateway.broadcastProductUpdated(product.streamKey, product);

    return product;
  }

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
    const product = await this.productService.markAsSoldOut(id);

    // Broadcast product sold out event to all viewers
    void this.productGateway.broadcastProductSoldOut(product.streamKey, product.id);

    return product;
  }

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
  async deleteProduct(@Param('id') id: string): Promise<void> {
    await this.productService.deleteProduct(id);
  }
}
