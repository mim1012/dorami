'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { apiClient } from '@/lib/api/client';
import VideoPlayer from '@/components/stream/VideoPlayer';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatInput, { ChatInputHandle } from '@/components/chat/ChatInput';
import EmojiPicker from '@/components/chat/EmojiPicker';
import ProductList from '@/components/product/ProductList';
import ProductDetailModal from '@/components/product/ProductDetailModal';
import FeaturedProductBar from '@/components/product/FeaturedProductBar';
import CartActivityFeed from '@/components/live/CartActivityFeed';
import { useCartActivity } from '@/hooks/useCartActivity';
import { useChatConnection } from '@/hooks/useChatConnection';
import { useChatMessages } from '@/hooks/useChatMessages';
import { ChatMessage as ChatMessageType, SYSTEM_USERNAME } from '@/components/chat/types';
import { Body, Heading2 } from '@/components/common/Typography';
import { ProductStatus } from '@live-commerce/shared-types';
import { MonitorOff, Loader, Eye, Zap } from 'lucide-react';
import { useToast } from '@/components/common/Toast';

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

interface FeaturedProduct {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  stock: number;
  status: string;
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
  const { showToast } = useToast();

  // Shared chat connection — used by both mobile and desktop chat UI
  const {
    socket,
    isConnected,
    userCount,
    sendMessage: chatSendMessage,
    deleteMessage: chatDeleteMessage,
  } = useChatConnection(streamKey);
  const { messages: chatMessages } = useChatMessages(socket);
  const mobileInputRef = useRef<ChatInputHandle>(null);
  const [showMobileEmoji, setShowMobileEmoji] = useState(false);

  // Desktop chat state
  const desktopInputRef = useRef<ChatInputHandle>(null);
  const [showDesktopEmoji, setShowDesktopEmoji] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Elapsed time timer for mobile top bar
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  // Featured product for mobile inline card
  const [featuredProduct, setFeaturedProduct] = useState<FeaturedProduct | null>(null);

  // Notice banner (reuses NoticeBox pattern)
  const { data: notice } = useQuery<{ text: string | null }>({
    queryKey: ['notice', 'current'],
    queryFn: async () => {
      const response = await apiClient.get<{ text: string | null }>('/notices/current');
      return response.data;
    },
    refetchInterval: 15000,
  });

  // Merge cart activity events as system messages into the chat stream
  const allMessages = useMemo(() => {
    const systemMessages: ChatMessageType[] = cartActivities.map((activity) => ({
      id: `system-cart-${activity.id}`,
      userId: 'system',
      username: SYSTEM_USERNAME,
      message: `${activity.userName}님이 ${activity.productName}을 장바구니에 담았습니다`,
      timestamp: new Date(activity.timestamp),
      isDeleted: false,
    }));
    return [...chatMessages, ...systemMessages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [chatMessages, cartActivities]);

  useEffect(() => {
    fetchStreamStatus();
  }, [streamKey]);

  // Real viewer count from VideoPlayer WebSocket
  const handleViewerCountChange = (count: number) => {
    setViewerCount((prev) => {
      if (count > prev) setShowViewerPulse(true);
      return count;
    });
  };

  // Pulse effect reset
  useEffect(() => {
    if (showViewerPulse) {
      const timeout = setTimeout(() => setShowViewerPulse(false), 800);
      return () => clearTimeout(timeout);
    }
  }, [showViewerPulse]);

  // Check if current user is admin (for desktop chat message deletion)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          const role = parsed?.state?.user?.role;
          setIsAdmin(role === 'ADMIN');
        } catch {
          // ignore parse errors
        }
      }
    }
  }, []);

  // Elapsed time calculation from streamStatus.startedAt
  useEffect(() => {
    if (!streamStatus?.startedAt) return;
    const startedAt = new Date(streamStatus.startedAt);
    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
      const h = String(Math.floor(diff / 3600)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      setElapsedTime(`${h}:${m}:${s}`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [streamStatus?.startedAt]);

  // Fetch featured product for mobile inline card
  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const response = await apiClient.get<{ product: FeaturedProduct | null }>(
          `/streaming/key/${streamKey}/featured-product`,
        );
        setFeaturedProduct(response.data.product);
      } catch {
        // silently fail — featured product is optional
      }
    };
    fetchFeatured();
  }, [streamKey]);

  const fetchStreamStatus = async () => {
    try {
      const response = await apiClient.get<StreamStatus>(`/streaming/key/${streamKey}/status`);
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

  const handleMobileSendMessage = (message: string) => {
    if (message.trim()) {
      chatSendMessage(message);
      setShowMobileEmoji(false);
    }
  };

  const handleMobileEmojiSelect = (emoji: string) => {
    if (mobileInputRef.current) {
      mobileInputRef.current.insertEmoji(emoji);
    }
    setShowMobileEmoji(false);
  };

  const handleDesktopSendMessage = (message: string) => {
    if (message.trim()) {
      chatSendMessage(message);
      setShowDesktopEmoji(false);
    }
  };

  const handleDesktopEmojiSelect = (emoji: string) => {
    if (desktopInputRef.current) {
      desktopInputRef.current.insertEmoji(emoji);
    }
    setShowDesktopEmoji(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-4 border-[#FF007A]/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#FF007A] animate-spin"></div>
            <div
              className="absolute inset-3 rounded-full border-3 border-transparent border-b-[#7928CA] animate-spin"
              style={{ animationDirection: 'reverse', animationDuration: '0.7s' }}
            ></div>
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
          <div className="w-28 h-28 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center shadow-hot-pink">
            <MonitorOff className="w-14 h-14 text-white/40" aria-hidden="true" />
          </div>
          <Heading2 className="text-white mb-3 text-2xl">{error || 'Stream not found'}</Heading2>
          <p className="text-white/40 text-sm mb-8">스트림을 찾을 수 없거나 종료되었습니다</p>
          <button
            onClick={() => router.push('/')}
            className="px-10 py-3.5 text-white rounded-full font-bold transition-all active:scale-95 shadow-lg gradient-hot-pink"
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
            <Loader className="w-14 h-14 text-white/40 animate-spin" aria-hidden="true" />
          </div>
          <Heading2 className="text-white mb-3 text-2xl">아직 방송 전이에요</Heading2>
          <Body className="text-white/40 mb-8">곧 시작됩니다. 잠시만 기다려주세요!</Body>
          <button
            onClick={() => router.push('/')}
            className="px-10 py-3.5 text-white rounded-full font-bold transition-all active:scale-95 shadow-lg gradient-hot-pink"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const handleProductClick = (product: Product | FeaturedProduct) => {
    setSelectedProduct(product as Product);
    setIsModalOpen(true);
  };

  const handleAddToCart = async (
    productId: string,
    selectedColor?: string,
    selectedSize?: string,
  ) => {
    try {
      await apiClient.post('/cart', {
        productId,
        quantity: 1,
        color: selectedColor,
        size: selectedSize,
      });

      showToast('장바구니에 담았어요!', 'success');
    } catch (error: any) {
      console.error('Failed to add to cart:', error);
      showToast(`장바구니 담기 실패: ${error.message || '알 수 없는 오류'}`, 'error');
    }
  };

  return (
    <div className="live-fullscreen w-full h-screen flex bg-black overflow-hidden">
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

      {/* Center: Video Container */}
      <div className="flex-1 relative flex items-center justify-center">
        <div className="relative w-full h-full lg:max-w-[480px] lg:h-full bg-black">
          <VideoPlayer
            streamKey={streamKey}
            title={streamStatus.title}
            onViewerCountChange={handleViewerCountChange}
          />

          {/* Top gradient overlay */}
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none z-10" />

          {/* Bottom gradient overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-10" />

          {/* ═══════════ MOBILE TOP BAR ═══════════ */}
          <div className="absolute top-0 left-0 right-0 z-20 px-3 py-3 flex items-center justify-between lg:hidden">
            {/* Brand avatar + label */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7928CA] to-[#FF007A] flex items-center justify-center shadow-lg">
                <span className="text-white text-xs font-black">D</span>
              </div>
              <span className="text-white font-bold text-sm drop-shadow-lg">도라미LIVE</span>
            </div>

            {/* Live timer + Viewer count */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-xl px-2.5 py-1.5 rounded-full border border-white/10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-white text-[11px] font-mono font-bold">{elapsedTime}</span>
              </div>
              <div className="flex items-center gap-1 bg-black/50 backdrop-blur-xl px-2.5 py-1.5 rounded-full border border-white/10">
                <Eye className="w-3.5 h-3.5 text-white/70" />
                <span className="text-white text-[11px] font-bold">
                  {viewerCount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* ═══════════ DESKTOP TOP BAR ═══════════ */}
          <div className="absolute top-0 left-0 right-0 z-20 p-4 hidden lg:flex items-center justify-between">
            {/* Back button */}
            <button
              onClick={() => router.push('/')}
              className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center text-white hover:bg-black/60 transition-all active:scale-90 border border-white/10"
              aria-label="뒤로가기"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* LIVE badge + Viewer count */}
            <div className="flex items-center gap-2">
              {/* LIVE badge with glow */}
              <div className="flex items-center gap-1.5 bg-[#FF3B30] px-3.5 py-1.5 rounded-full shadow-[0_0_20px_rgba(255,59,48,0.4)]">
                <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                </span>
                <span className="text-white text-xs font-black tracking-wider">
                  LIVE<span className="sr-only"> 현재 생방송 중</span>
                </span>
              </div>

              {/* Viewer count with pulse on increase */}
              <div
                className={`flex items-center gap-1.5 bg-black/40 backdrop-blur-xl px-3 py-1.5 rounded-full transition-all duration-300 border border-white/10 ${showViewerPulse ? 'scale-110 bg-[#FF007A]/30' : 'scale-100'}`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="text-white text-xs font-bold">{viewerCount.toLocaleString()}</span>
              </div>
            </div>

            {/* Share button */}
            <button
              className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center text-white hover:bg-black/60 transition-all active:scale-90 border border-white/10"
              aria-label="공유하기"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                <polyline points="16,6 12,2 8,6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </button>
          </div>

          {/* Stream title — Desktop only */}
          <div className="absolute top-[68px] left-4 right-20 z-20 hidden lg:block">
            <h1 className="text-white font-black text-base drop-shadow-lg line-clamp-1 text-glow-pink">
              {streamStatus.title}
            </h1>
          </div>

          {/* ═══════════ MOBILE NOTICE BANNER ═══════════ */}
          {notice?.text && (
            <div className="absolute top-14 left-3 right-3 z-20 lg:hidden">
              <div className="bg-amber-500/20 backdrop-blur-sm border border-amber-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-amber-200 text-xs line-clamp-1 font-medium">{notice.text}</p>
              </div>
            </div>
          )}

          {/* ═══════════ CART ACTIVITY FEED — Desktop only ═══════════ */}
          <div className="hidden lg:block">
            <CartActivityFeed activities={cartActivities} />
          </div>

          {/* ═══════════ MOBILE BOTTOM SECTION ═══════════ */}
          <div className="absolute bottom-0 left-0 right-0 z-20 lg:hidden flex flex-col pointer-events-none">
            {/* Chat messages overlay */}
            <div className="h-[28vh] mb-1">
              <ChatMessageList messages={allMessages} compact maxMessages={30} />
            </div>

            {/* Featured product inline card */}
            {featuredProduct && (
              <div className="px-3 pb-2 pointer-events-auto">
                <div
                  className="bg-black/60 backdrop-blur-md rounded-xl p-2.5 flex items-center gap-3 border border-white/10"
                  onClick={() => handleProductClick(featuredProduct)}
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0 relative">
                    {featuredProduct.imageUrl && (
                      <Image
                        src={featuredProduct.imageUrl}
                        alt={featuredProduct.name}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {featuredProduct.name}
                    </p>
                    <p className="text-[#FF007A] font-bold text-sm">
                      ₩{featuredProduct.price.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProductClick(featuredProduct);
                    }}
                    className="bg-[#FF007A] hover:bg-[#E00070] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex-shrink-0"
                  >
                    구매
                  </button>
                </div>
              </div>
            )}

            {/* Emoji picker for mobile */}
            {showMobileEmoji && (
              <div className="pointer-events-auto">
                <EmojiPicker
                  onEmojiSelect={handleMobileEmojiSelect}
                  onClose={() => setShowMobileEmoji(false)}
                />
              </div>
            )}

            {/* Chat input */}
            <div className="pointer-events-auto">
              <ChatInput
                ref={mobileInputRef}
                onSendMessage={handleMobileSendMessage}
                onToggleEmoji={() => setShowMobileEmoji(!showMobileEmoji)}
                disabled={!isConnected}
                compact
                emojiPickerOpen={showMobileEmoji}
              />
            </div>
          </div>

          {/* Chat — Desktop Only (right side panel, shared connection) */}
          <div className="hidden lg:flex absolute top-0 right-0 w-[320px] h-full flex-col z-20">
            <ChatHeader userCount={userCount} isConnected={isConnected} compact={false} />
            <ChatMessageList
              messages={allMessages}
              compact={false}
              isAdmin={isAdmin}
              onDeleteMessage={chatDeleteMessage}
            />
            {showDesktopEmoji && (
              <EmojiPicker
                onEmojiSelect={handleDesktopEmojiSelect}
                onClose={() => setShowDesktopEmoji(false)}
              />
            )}
            <ChatInput
              ref={desktopInputRef}
              onSendMessage={handleDesktopSendMessage}
              onToggleEmoji={() => setShowDesktopEmoji(!showDesktopEmoji)}
              disabled={!isConnected}
              compact={false}
              emojiPickerOpen={showDesktopEmoji}
            />
          </div>
        </div>
      </div>

      {/* Bottom: Featured Product Bar — Desktop Only */}
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
