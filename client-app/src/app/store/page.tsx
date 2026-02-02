'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { ProductCard } from '@/components/home/ProductCard';
import ProductDetailModal from '@/components/product/ProductDetailModal';
import { Display, Heading2, Body, Caption } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { useToast } from '@/components/common/Toast';

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
  status: 'AVAILABLE' | 'SOLD_OUT';
  streamKey: string;
  colorOptions: string[];
  sizeOptions: string[];
  shippingFee: number;
  freeShippingMessage?: string;
  timerEnabled: boolean;
  timerDuration: number;
  createdAt: string;
  updatedAt: string;
}

interface StoreResponse {
  data: Product[];
  meta: {
    total: number;
    page: number;
    totalPages: number;
  };
}

export default function StorePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const fetchStoreProducts = async (page: number = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get<StoreResponse>('/products/store', {
        params: { page, limit: 24 },
      });

      setProducts(response.data.data);
      setMeta(response.data.meta);
    } catch (err: any) {
      console.error('Failed to fetch store products:', err);
      setError(err.response?.data?.message || 'Failed to load store products');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreProducts(1);
  }, []);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= meta.totalPages) {
      fetchStoreProducts(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleProductClick = (product: Product) => {
    // Product already has all needed data - no API call required
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleAddToCart = async (
    productId: string,
    selectedColor?: string,
    selectedSize?: string,
  ) => {
    try {
      setIsAddingToCart(true);

      await apiClient.post('/cart', {
        productId,
        quantity: 1,
        color: selectedColor,
        size: selectedSize,
      });

      // Show success message
      showToast('Product added to cart! (No timer for store products)', 'success');

      // Close modal
      setIsModalOpen(false);
      setSelectedProduct(null);
    } catch (err: any) {
      console.error('Failed to add to cart:', err);
      const errorMessage = err.response?.data?.message || 'Failed to add product to cart';
      showToast(errorMessage, 'error');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const getPaginationPages = () => {
    const pages: (number | 'ellipsis')[] = [];
    const { page, totalPages } = meta;

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (page > 3) {
        pages.push('ellipsis');
      }

      // Show pages around current page
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page < totalPages - 2) {
        pages.push('ellipsis');
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (isLoading && products.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Body className="text-secondary-text">Loading store products...</Body>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Display className="text-hot-pink mb-2 flex items-center gap-3">
            <ShoppingBag className="w-10 h-10" />
            Past Products Store
          </Display>
          <Body className="text-secondary-text">
            Browse and purchase products from our completed live broadcasts
          </Body>
        </div>

        {error && (
          <div className="mb-6 bg-error/10 border border-error rounded-button p-4">
            <Caption className="text-error">{error}</Caption>
          </div>
        )}

        {/* Product Grid */}
        {products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  imageUrl={product.imageUrl || '/images/placeholder-product.jpg'}
                  onClick={() => handleProductClick(product)}
                />
              ))}
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="flex flex-col md:flex-row items-center justify-between bg-content-bg rounded-button px-6 py-4 gap-4">
                <Caption className="text-secondary-text">
                  Showing {(meta.page - 1) * 24 + 1}-{Math.min(meta.page * 24, meta.total)} of {meta.total} products
                </Caption>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(meta.page - 1)}
                    disabled={meta.page === 1 || isLoading}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  {getPaginationPages().map((pageNum, idx) => {
                    if (pageNum === 'ellipsis') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-2 text-secondary-text">
                          ...
                        </span>
                      );
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={meta.page === pageNum ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        disabled={isLoading}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(meta.page + 1)}
                    disabled={meta.page === meta.totalPages || isLoading}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-content-bg rounded-button p-12 text-center">
            <div className="text-6xl mb-4">🛍️</div>
            <Heading2 className="text-secondary-text mb-2">No Products Available</Heading2>
            <Body className="text-secondary-text">
              Check back later for products from completed live broadcasts
            </Body>
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedProduct(null);
          }}
          onAddToCart={handleAddToCart}
        />
      )}
    </div>
  );
}
