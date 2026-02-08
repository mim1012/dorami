'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import VideoPlayer from '@/components/stream/VideoPlayer';
import ChatOverlay from '@/components/chat/ChatOverlay';
import ProductList from '@/components/product/ProductList';
import ProductDetailModal from '@/components/product/ProductDetailModal';
import FeaturedProductBar from '@/components/product/FeaturedProductBar';
import HeartAnimation from '@/components/live/HeartAnimation';
import CartActivityFeed from '@/components/live/CartActivityFeed';
import ProductBottomSheet from '@/components/live/ProductBottomSheet';
import { useCartActivity } from '@/hooks/useCartActivity';
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
  const { activities: cartActivities } = useCartActivity(streamKey);
  const [viewerCount, setViewerCount] = useState(0);
  const [showViewerPulse, setShowViewerPulse] = useState(false);

  useEffect(() => {
    fetchStreamStatus();
  }, [streamKey]);

  // Simulated viewer count that fluctuates
  useEffect(() => {
    if (!streamStatus || streamStatus.status !== 'LIVE') return;
    setViewerCount(streamStatus.viewerCount || Math.floor(Math.random() * 200 + 50));
    const interval = setInterval(() => {
      setViewerCount(prev => {
        const change = Math.floor(Math.random() * 7) - 2;
        const newVal = Math.max(1, prev + change);
        if (change > 2) setShowViewerPulse(true);
        return newVal;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [streamStatus]);

  // Pulse effect reset
  useEffect(() => {
    if (showViewerPulse) {
      const timeout = setTimeout(() => setShowViewerPulse(false), 800);
      return () => clearTimeout(timeout);
    }
  }, [showViewerPulse]);

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
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-4 border-[#FF007A]/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#FF007A] animate-spin"></div>
            <div className="absolute inset-3 rounded-full border-3 border-transparent border-b-[#7928CA] animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.7s' }}></div>
          </div>
          <Body className="text-white/60 text-lg font-medium">스트림 로딩 중...</Body>
        </div>
      </div>
    );
  }

  if (error || !streamStatus) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center px-6 animate-bounce-in">
          <div className="w-28 h-28 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center" style={{ boxShadow: '0 0 40px rgba(255,0,122,0.1)' }}>
            <span className="text-5xl">📺</span>
          </div>
          <Heading2 className="text-white mb-3 text-2xl">{error || 'Stream not found'}</Heading2>
          <p className="text-white/40 text-sm mb-8">스트림을 찾을 수 없거나 종료되었습니다</p>
          <button
            onClick={() => router.push('/')}
            className="px-10 py-3.5 text-white rounded-full font-bold transition-all active:scale-95 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #FF007A, #7928CA)' }}
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (streamStatus.status !== 'LIVE') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center px-6 animate-bounce-in">
          <div className="w-28 h-28 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
            <span className="text-5xl">⏳</span>
          </div>
          <Heading2 className="text-white mb-3 text-2xl">아직 방송 전이에요</Heading2>
          <Body className="text-white/40 mb-8">곧 시작됩니다. 잠시만 기다려주세요!</Body>
          <button
            onClick={() => router.push('/')}
            className="px-10 py-3.5 text-white rounded-full font-bold transition-all active:scale-95 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #FF007A, #7928CA)' }}
          >
            홈으로 돌아가기
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
      
      // Animated toast
      const toast = document.createElement('div');
      toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl text-white text-sm font-bold animate-cart-toast-in';
      toast.style.background = 'linear-gradient(135deg, rgba(255,0,122,0.9), rgba(121,40,202,0.9))';
      toast.style.backdropFilter = 'blur(20px)';
      toast.style.boxShadow = '0 8px 32px rgba(255,0,122,0.3)';
      toast.innerHTML = '🛒 장바구니에 담았어요!';
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.classList.remove('animate-cart-toast-in');
        toast.classList.add('animate-cart-toast-out');
        setTimeout(() => toast.remove(), 300);
      }, 2200);
    } catch (error: any) {
      console.error('Failed to add to cart:', error);
      alert(`장바구니 담기 실패: ${error.message || '알 수 없는 오류'}`);
    }
  };

  return (
    <div className="w-full h-screen flex bg-black overflow-hidden">
      {/* Left: Product List - Desktop Only */}
      <aside className="hidden lg:block w-[300px] h-full overflow-y-auto bg-[#0A0A0A] border-r border-white/5">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-white font-black text-lg flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-[#FF007A] to-[#7928CA]"></span>
            상품 목록
          </h2>
        </div>
        <ProductList streamKey={streamKey} onProductClick={handleProductClick} />
      </aside>

      {/* Center: Video Container — Instagram Live Style */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Video Player - Portrait 9:16 */}
        <div className="relative w-full h-full lg:max-w-[480px] lg:h-full bg-black">
          <VideoPlayer streamKey={streamKey} title={streamStatus.title} />

          {/* Top gradient overlay — stronger */}
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none z-10" />
          
          {/* Bottom gradient overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-10" />

          {/* ═══════════ TOP BAR ═══════════ */}
          <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between">
            {/* Back button */}
            <button
              onClick={() => router.push('/')}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center text-white hover:bg-black/60 transition-all active:scale-90"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* LIVE badge + Viewer count */}
            <div className="flex items-center gap-2">
              {/* LIVE badge with glow */}
              <div className="flex items-center gap-1.5 bg-[#FF3B30] px-3.5 py-1.5 rounded-full" style={{ boxShadow: '0 0 20px rgba(255,59,48,0.4)' }}>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                </span>
                <span className="text-white text-xs font-black tracking-wider">LIVE</span>
              </div>

              {/* Viewer count with pulse on increase */}
              <div className={`flex items-center gap-1.5 bg-black/40 backdrop-blur-xl px-3 py-1.5 rounded-full transition-all duration-300 ${showViewerPulse ? 'scale-110 bg-[#FF007A]/30' : 'scale-100'}`} style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="text-white text-xs font-bold">{viewerCount.toLocaleString()}</span>
              </div>
            </div>

            {/* Share button */}
            <button 
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center text-white hover:bg-black/60 transition-all active:scale-90"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16,6 12,2 8,6" /><line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </button>
          </div>

          {/* Stream title */}
          <div className="absolute top-[68px] left-4 right-20 z-20">
            <h1 className="text-white font-black text-base drop-shadow-lg line-clamp-1 text-glow-pink">
              {streamStatus.title}
            </h1>
          </div>

          {/* ═══════════ CART ACTIVITY FEED ═══════════ */}
          <CartActivityFeed activities={cartActivities} />

          {/* ═══════════ HEART ANIMATION ═══════════ */}
          <HeartAnimation />

          {/* Product Bottom Sheet - Mobile */}
          <div className="lg:hidden">
            <ProductBottomSheet
              products={[
                { id: '1', name: 'Chic Evening Bag', price: 129000, imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=200&q=80', stock: 10 },
                { id: '2', name: 'Pro Audio Pods', price: 62300, imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&q=80', stock: 25 },
              ]}
              onAddToCart={(id) => handleAddToCart(id)}
              streamKey={streamKey}
            />
          </div>

          {/* Chat Overlay - Desktop (Right Side) */}
          <div className="hidden lg:block">
            <ChatOverlay streamKey={streamKey} position="right" />
          </div>

          {/* Chat Overlay - Mobile (Bottom, transparent) */}
          <div className="lg:hidden">
            <ChatOverlay streamKey={streamKey} position="bottom" />
          </div>
        </div>
      </div>

      {/* Bottom: Featured Product Bar */}
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
