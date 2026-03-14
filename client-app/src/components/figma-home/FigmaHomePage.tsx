'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from './Header';
import { LiveBanner } from './LiveBanner';
import { UpcomingLives } from './UpcomingLives';
import { PastProducts } from './PastProducts';
import { ProductDetailModal } from './ProductDetailModal';
import { Footer } from './Footer';
import { useMainPageData } from '@/lib/hooks/queries/use-mainpage';
import { getPastProducts, type PastProductItem } from '@/lib/api/mainpage';
import { cartKeys } from '@/lib/hooks/queries/use-cart';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/components/common/Toast';

export function FigmaHomePage() {
  const { data, isLoading } = useMainPageData();
  const currentLive = data?.currentLive ?? null;
  const upcomingLives = data?.upcomingLives ?? [];

  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<PastProductItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: pastProductsData, isLoading: isPastLoading } = useQuery({
    queryKey: ['pastProducts'],
    queryFn: () => getPastProducts(1, 8),
    staleTime: 30_000,
  });
  const pastProducts = pastProductsData?.data ?? [];

  const handleProductClick = (product: PastProductItem) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleAddToCart = async (
    productId: string,
    quantity: number = 1,
    selectedColor?: string,
    selectedSize?: string,
  ) => {
    try {
      await apiClient.post('/cart', {
        productId,
        quantity,
        color: selectedColor,
        size: selectedSize,
      });
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      showToast('장바구니에 담았습니다.', 'success');
      setIsModalOpen(false);
      setSelectedProduct(null);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || '장바구니 담기에 실패했습니다.';
      showToast(errorMessage, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-screen-2xl mx-auto px-4 py-6 md:py-8 space-y-12 md:space-y-20">
        <section className="pt-2">
          <LiveBanner currentLive={currentLive} isLoading={isLoading} />
        </section>
        <section>
          <UpcomingLives upcomingLives={upcomingLives} isLoading={isLoading} />
        </section>
        <section>
          <PastProducts
            products={pastProducts}
            isLoading={isPastLoading}
            onProductClick={handleProductClick}
          />
        </section>
      </main>

      <Footer />

      {isModalOpen && selectedProduct && (
        <ProductDetailModal
          product={{
            id: selectedProduct.id,
            name: selectedProduct.name,
            price: selectedProduct.price,
            originalPrice: selectedProduct.originalPrice ?? selectedProduct.price,
            stock: selectedProduct.stock,
            discountRate: selectedProduct.discountRate ?? 0,
            image: selectedProduct.imageUrl ?? '',
          }}
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
