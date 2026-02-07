'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import VideoPlayer from '@/components/stream/VideoPlayer';
import ChatOverlay from '@/components/chat/ChatOverlay';
import ProductList from '@/components/product/ProductList';
import ProductDetailModal from '@/components/product/ProductDetailModal';
import FeaturedProductBar from '@/components/product/FeaturedProductBar';
import { Body, Heading2 } from '@/components/common/Typography';
import { ProductStatus } from '@live-commerce/shared-types';

interface StreamStatus {
  status: 'PENDING' | 'LIVE' | 'OFFLINE';
  viewerCount: number;
  startedAt: Date | null;
  title: string;
}

interface Product {
  id: string;
  streamKey: string;
  name: string;
  price: number;
  stock: number;
  colorOptions: string[];
  sizeOptions: string[];
  shippingFee: number;
  freeShippingMessage?: string;
  timerEnabled: boolean;
  timerDuration: number;
  imageUrl?: string;
  isNew?: boolean;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export default function LiveStreamPage() {
  const params = useParams();
  const router = useRouter();
  const streamKey = params.streamKey as string;

  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchStreamStatus();
  }, [streamKey]);

  const fetchStreamStatus = async () => {
    try {
      const response = await apiClient.get<StreamStatus>(
        `/streaming/key/${streamKey}/status`,
      );
      setStreamStatus(response.data);

      if (response.data.status === 'OFFLINE') {
        setError('This stream is not currently live');
      }
    } catch (err: any) {
      console.error('Failed to fetch stream status:', err);
      setError('Stream not found');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Body className="text-white">Loading stream...</Body>
      </div>
    );
  }

  if (error || !streamStatus) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Heading2 className="text-white mb-4">{error || 'Stream not found'}</Heading2>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-hot-pink text-white rounded-button hover:bg-hot-pink-dark transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (streamStatus.status !== 'LIVE') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Heading2 className="text-white mb-4">
            This stream is not currently live
          </Heading2>
          <Body className="text-gray-400 mb-6">
            Stream will start soon. Check back later!
          </Body>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-hot-pink text-white rounded-button hover:bg-hot-pink-dark transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const handleProductClick = (product: any) => {
    setSelectedProduct(product as Product);
    setIsModalOpen(true);
  };

  const handleAddToCart = async (productId: string, selectedColor?: string, selectedSize?: string) => {
    try {
      await apiClient.post('/cart', {
        productId,
        quantity: 1,
        color: selectedColor,
        size: selectedSize,
      });
      alert('장바구니에 담았습니다!');
      router.push('/cart');
    } catch (error: any) {
      console.error('Failed to add to cart:', error);
      alert(`장바구니 담기 실패: ${error.message || '알 수 없는 오류'}`);
    }
  };

  return (
    <div className="w-full h-screen flex bg-black">
      {/* Left: Product List - Desktop Only */}
      <aside className="hidden lg:block w-[280px] h-full overflow-y-auto bg-content-bg border-r border-gray-800">
        <ProductList streamKey={streamKey} onProductClick={handleProductClick} />
      </aside>

      {/* Center: Video Container (with Chat Overlay) */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Video Player - Portrait 9:16 */}
        <div className="relative w-full max-w-[720px] aspect-[9/16] bg-black">
          <VideoPlayer streamKey={streamKey} title={streamStatus.title} />

          {/* Chat Overlay - Desktop (Right Side) */}
          <div className="hidden lg:block">
            <ChatOverlay streamKey={streamKey} position="right" />
          </div>

          {/* Chat Overlay - Mobile (Bottom) */}
          <div className="lg:hidden">
            <ChatOverlay streamKey={streamKey} position="bottom" />
          </div>
        </div>
      </div>

      {/* Bottom: Featured Product Bar (currently hidden - Epic 5) */}
      <FeaturedProductBar streamKey={streamKey} onProductClick={handleProductClick} />

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAddToCart={handleAddToCart}
        />
      )}
    </div>
  );
}
