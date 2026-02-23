'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { io } from 'socket.io-client';
import { apiClient } from '@/lib/api/client';
import { useLiveLayoutMachine, computeLayout } from '@/hooks/useLiveLayoutMachine';
import VideoPlayer from '@/components/stream/VideoPlayer';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatInput, { ChatInputHandle } from '@/components/chat/ChatInput';

import ProductList from '@/components/product/ProductList';
import ProductDetailModal from '@/components/product/ProductDetailModal';
import FeaturedProductBar from '@/components/product/FeaturedProductBar';
import LiveQuickActionBar from '@/components/live/LiveQuickActionBar';
import LiveCartSheet from '@/components/live/LiveCartSheet';
import ProductListBottomSheet from '@/components/live/ProductListBottomSheet';
import { NoticeModal } from '@/components/notices/NoticeModal';
import { useCart } from '@/lib/hooks/queries/use-cart';
import { useCartActivity } from '@/hooks/useCartActivity';
import { useChatConnection } from '@/hooks/useChatConnection';
import { useChatMessages } from '@/hooks/useChatMessages';
import { ChatMessage as ChatMessageType, SYSTEM_USERNAME } from '@/components/chat/types';
import { Body, Heading2 } from '@/components/common/Typography';
import type { Product } from '@/lib/types';
import { ProductStatus } from '@live-commerce/shared-types';
import { MonitorOff, Loader, Eye, Zap } from 'lucide-react';
import { useToast } from '@/components/common/Toast';
import { sendStreamMetrics } from '@/lib/analytics/stream-metrics';
import { useTokenAutoRefresh } from '@/lib/auth/token-auto-refresh';

interface StreamStatus {
  status: 'PENDING' | 'LIVE' | 'OFFLINE';
  viewerCount: number;
  startedAt: Date | null;
  title: string;
}

interface FeaturedProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  discountRate?: number;
  imageUrl?: string;
  stock: number;
  status: string;
}

export default function LiveStreamPage() {
  const params = useParams();
  const router = useRouter();
  const streamKey = params.streamKey as string;

  // 10분 주기 토큰 자동 갱신 — 장기 방송(3시간+) 지원
  useTokenAutoRefresh(streamKey);

  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);
  const { data: cartData } = useCart();
  const { activities: cartActivities } = useCartActivity(streamKey);
  const hasExpiringItem =
    cartData?.items?.some(
      (item) =>
        item.timerEnabled &&
        item.expiresAt &&
        item.status === 'ACTIVE' &&
        new Date(item.expiresAt).getTime() - Date.now() < 60_000,
    ) ?? false;
  const [viewerCount, setViewerCount] = useState(0);
  const [showViewerPulse, setShowViewerPulse] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [activeProductOverride, setActiveProductOverride] = useState<FeaturedProduct | null>(null);
  const [isProductSheetOpen, setIsProductSheetOpen] = useState(false);
  const { showToast } = useToast();

  // ── FSM ────────────────────────────────────────────────────────────────────
  const { snapshot, stream, dispatch } = useLiveLayoutMachine();
  const [featuredProduct, setFeaturedProduct] = useState<FeaturedProduct | null>(null);

  // ── Reconnect timing: RETRYING → LIVE_NORMAL transition ───────────────────
  const retryStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (snapshot === 'RETRYING' && retryStartRef.current === null) {
      retryStartRef.current = performance.now();
    } else if (snapshot === 'LIVE_NORMAL' && retryStartRef.current !== null) {
      const reconnectDurationMs = Math.round(performance.now() - retryStartRef.current);
      retryStartRef.current = null;
      sendStreamMetrics({
        streamKey,
        timestamp: new Date().toISOString(),
        metrics: {
          firstFrameMs: 0,
          rebufferCount: 0,
          stallDurationMs: 0,
          reconnectCount: 1,
          totalConnectionTimeMs: reconnectDurationMs,
        },
        connectionState: 'RECONNECTING',
      }).catch(() => {});
    } else if (snapshot !== 'RETRYING') {
      // Reset timer if we left RETRYING without recovering (e.g. ENDED)
      retryStartRef.current = null;
    }
  }, [snapshot, streamKey]);

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

  // Desktop chat state
  const desktopInputRef = useRef<ChatInputHandle>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Elapsed time timer for mobile top bar
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  // Notice banner
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

  // ── Socket → FSM dispatch ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handleConnect = () => dispatch({ type: 'CONNECT_OK' });
    const handleDisconnect = () => dispatch({ type: 'CONNECT_FAIL' });
    const handleReconnectAttempt = () => dispatch({ type: 'CONNECT_START' });

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
    };
  }, [socket, dispatch]);

  // ── Keyboard detection via visualViewport ──────────────────────────────────
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const ratio = vv.height / window.screen.height;
      dispatch(ratio < 0.75 ? { type: 'OPEN_KEYBOARD' } : { type: 'CLOSE_KEYBOARD' });
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [dispatch]);

  // ── Featured product fetch + all products + real-time WS ─────────────────
  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const response = await apiClient.get<{ product: FeaturedProduct | null }>(
          `/streaming/key/${streamKey}/featured-product`,
        );
        setFeaturedProduct(response.data.product);
      } catch {
        // non-critical
      }
    };
    const fetchAllProducts = async () => {
      try {
        const response = await apiClient.get<Product[]>('/products', {
          params: { streamKey, status: 'AVAILABLE' },
        });
        setAllProducts(response.data ?? []);
      } catch {
        // non-critical
      }
    };
    fetchFeatured();
    fetchAllProducts();

    const ws = io(
      process.env.NEXT_PUBLIC_WS_URL ||
        (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001'),
      {
        withCredentials: true,
      },
    );
    ws.on('connect', () => ws.emit('join:stream', { streamId: streamKey }));
    ws.on('stream:featured-product:updated', (data: any) => {
      if (data.streamKey === streamKey) setFeaturedProduct(data.product);
    });
    ws.on('live:product:added', (data: any) => {
      setAllProducts((prev) => [data.data, ...prev]);
    });
    ws.on('live:product:updated', (data: any) => {
      setAllProducts((prev) => prev.map((p) => (p.id === data.data.id ? data.data : p)));
    });
    ws.on('live:product:soldout', (data: any) => {
      setAllProducts((prev) =>
        prev.map((p) =>
          p.id === data.data.productId ? { ...p, status: ProductStatus.SOLD_OUT } : p,
        ),
      );
      setFeaturedProduct((prev) => {
        if (prev && prev.id === data.data.productId) {
          showToast('이 상품이 품절되었습니다.', 'error');
          return { ...prev, status: ProductStatus.SOLD_OUT };
        }
        return prev;
      });
    });
    return () => {
      ws.disconnect();
    };
  }, [streamKey]);

  const fetchStreamStatus = async () => {
    try {
      const response = await apiClient.get<StreamStatus>(`/streaming/key/${streamKey}/status`);
      setStreamStatus(response.data);

      if (response.data.status === 'OFFLINE') {
        setError('현재 방송 중이 아닙니다');
      }
    } catch (err: any) {
      console.error('Failed to fetch stream status:', err);
      setError('방송을 찾을 수 없습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMobileSendMessage = (message: string) => {
    if (message.trim()) {
      chatSendMessage(message);
    }
  };

  const handleDesktopSendMessage = (message: string) => {
    if (message.trim()) {
      chatSendMessage(message);
    }
  };

  const handleInquiry = () => {
    window.open('https://pf.kakao.com/_DeEAX', '_blank', 'noopener,noreferrer');
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
          <Heading2 className="text-white mb-3 text-2xl">
            {error || '방송을 찾을 수 없습니다'}
          </Heading2>
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

  const handleProductClick = async (product: Product | FeaturedProduct) => {
    if ('streamKey' in product && 'colorOptions' in product) {
      setSelectedProduct(product as Product);
      setIsModalOpen(true);
    } else {
      try {
        const response = await apiClient.get<Product>(`/products/${product.id}`);
        setSelectedProduct(response.data);
        setIsModalOpen(true);
      } catch (err) {
        console.error('Failed to fetch product details:', err);
        showToast('상품 정보를 불러올 수 없습니다.', 'error');
      }
    }
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

      showToast('장바구니에 담았어요!', 'success', {
        label: '장바구니 보기',
        onClick: () => router.push('/cart'),
      });
    } catch (error: any) {
      console.error('Failed to add to cart:', error);
      showToast(`장바구니 담기 실패: ${error.message || '알 수 없는 오류'}`, 'error');
    }
  };

  const displayedProduct: FeaturedProduct | null =
    activeProductOverride ??
    featuredProduct ??
    (allProducts.length > 0 ? (allProducts[0] as FeaturedProduct) : null);

  const handleProductSelectFromSheet = (product: Product) => {
    setActiveProductOverride({
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice,
      discountRate: product.discountRate,
      imageUrl: product.imageUrl,
      stock: product.stock,
      status: product.status,
    });
  };

  const layout = computeLayout(snapshot, !!displayedProduct);

  return (
    <div className="live-fullscreen w-full bg-[#0d0d18] lg:h-screen lg:flex lg:overflow-hidden">
      {/* ── Left: Product List — Desktop only ── */}
      <aside className="hidden lg:block w-[260px] xl:w-[300px] h-full overflow-y-auto bg-[#12121e] border-r border-white/5">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-white font-black text-lg flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-[#FF007A] to-[#7928CA]"></span>
            상품 목록
          </h2>
        </div>
        <ProductList streamKey={streamKey} onProductClick={handleProductClick} />
      </aside>

      {/* ── MOBILE: flex-col scroll layout ── */}
      <div className="flex lg:hidden flex-col w-full bg-[#0d0d18] h-screen overflow-hidden">
        {/* 1. LIVE status bar — sticky top z-30 */}
        {layout.topBar.visible && (
          <div
            className={`sticky top-0 z-30 bg-black/60 backdrop-blur-sm px-3 transition-opacity ${
              layout.topBar.dim ? 'opacity-40' : 'opacity-100'
            }`}
            style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
          >
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                <div className="w-8 h-8 rounded-full overflow-hidden shadow-lg flex-shrink-0">
                  <Image
                    src="/logo.png"
                    alt="Doremi"
                    width={32}
                    height={32}
                    className="object-contain w-full h-full"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm leading-tight line-clamp-1">
                    {streamStatus.title}
                  </p>
                  {(snapshot === 'LIVE_NORMAL' || snapshot === 'LIVE_TYPING') && (
                    <p className="text-white/60 text-[10px] font-mono">{elapsedTime}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {(snapshot === 'LIVE_NORMAL' || snapshot === 'LIVE_TYPING') &&
                stream !== 'error' ? (
                  <div className="flex items-center gap-1 bg-[#FF3B30] px-2 py-1 rounded-full">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping [animation-duration:2s] absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                    </span>
                    <span className="text-white text-[10px] font-black tracking-wider">LIVE</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full border border-white/10">
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white/40 animate-pulse" />
                    <span className="text-white/60 text-[10px] font-bold">연결 중...</span>
                  </div>
                )}
                <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full border border-white/10">
                  <Eye className="w-3 h-3 text-white/70" />
                  <span className="text-white text-[10px] font-bold">
                    {viewerCount.toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => router.push('/')}
                  className="w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white border border-white/10 active:scale-90 transition-transform"
                  aria-label="닫기"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Notice banner — sticky z-20 (only when text exists) */}
        {notice?.text && (
          <div className="sticky z-20 bg-[rgba(255,100,100,0.92)] px-3 py-1.5 overflow-hidden">
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-white flex-shrink-0" />
              <div className="overflow-hidden flex-1">
                <div className="notice-track text-white text-[11px] font-medium">
                  <span className="pr-12">{notice.text}</span>
                  <span className="pr-12">{notice.text}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Video player (16:9) with chat overlay inside */}
        <div className="relative w-full aspect-video bg-black flex-shrink-0 overflow-hidden">
          {/* Top gradient scrim */}
          <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-black/50 to-transparent z-10 pointer-events-none" />
          {/* Bottom gradient scrim */}
          <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-black/60 to-transparent z-10 pointer-events-none" />
          <VideoPlayer
            streamKey={streamKey}
            title={streamStatus.title}
            onViewerCountChange={handleViewerCountChange}
            onStreamError={setVideoError}
            hideErrorOverlay
            onStreamStateChange={(e) => {
              if (e.type === 'STREAM_ENDED') dispatch({ type: 'STREAM_ENDED' });
              else if (e.type === 'STALL') dispatch({ type: 'STALL' });
              else if (e.type === 'PLAY_OK') dispatch({ type: 'PLAY_OK' });
              else if (e.type === 'MEDIA_ERROR') dispatch({ type: 'MEDIA_ERROR' });
            }}
          />

          {/* Center overlay */}
          {layout.centerOverlay.visible && (
            <div className="absolute inset-0 z-[15] flex flex-col items-center justify-center gap-4">
              <p className="text-white text-base font-medium bg-black/50 px-6 py-3 rounded-full">
                {layout.centerOverlay.message}
              </p>
              {snapshot === 'ENDED' && (
                <button
                  onClick={() => router.push('/')}
                  className="px-10 py-3 text-white rounded-full font-bold gradient-hot-pink"
                >
                  홈으로
                </button>
              )}
            </div>
          )}
        </div>

        {/* 4. Active product card + trigger below video */}
        <div className="px-4 pt-3 pb-2 space-y-2 flex-shrink-0">
          {displayedProduct && (
            <div
              className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 backdrop-blur-sm cursor-pointer active:bg-white/10 transition-all"
              onClick={() => handleProductClick(displayedProduct)}
            >
              {displayedProduct.imageUrl && (
                <div className="relative w-[72px] h-[72px] rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
                  <Image
                    src={displayedProduct.imageUrl}
                    alt={displayedProduct.name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{displayedProduct.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {displayedProduct.discountRate && displayedProduct.discountRate > 0 ? (
                    <>
                      <span className="text-white/40 text-xs line-through">
                        $
                        {(
                          displayedProduct.originalPrice ?? displayedProduct.price
                        ).toLocaleString()}
                      </span>
                      <span className="text-red-400 text-xs font-bold">
                        {displayedProduct.discountRate}%
                      </span>
                    </>
                  ) : null}
                  <span className="text-[#FF007A] font-black text-base">
                    ${displayedProduct.price.toLocaleString()}
                  </span>
                </div>
              </div>
              <button
                className="h-10 min-w-[88px] px-4 py-2 bg-[#FF007A] text-white text-sm font-bold rounded-xl flex-shrink-0 active:bg-[#CC0062] active:scale-95 transition-all disabled:opacity-50"
                disabled={displayedProduct.status === 'SOLD_OUT'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleProductClick(displayedProduct);
                }}
              >
                구매하기
              </button>
            </div>
          )}
          {allProducts.length > 1 && (
            <button
              onClick={() => setIsProductSheetOpen(true)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/3 border border-white/8 active:bg-white/8 transition-all"
            >
              <span className="text-white/50 text-sm">전체 상품 보기</span>
              <div className="flex items-center gap-1.5">
                <span className="text-white/30 text-xs">{allProducts.length}개</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  className={`opacity-30 transition-transform duration-300 ${isProductSheetOpen ? 'rotate-90' : ''}`}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          )}
        </div>

        {/* 5. Chat feed — fills remaining space */}
        <div className="flex-1 min-h-[60px] overflow-y-auto">
          <ChatMessageList messages={allMessages} compact maxMessages={50} />
        </div>

        {/* 6. Chat input — in-flow above quick action bar */}
        {layout.bottomInput.visible && (
          <div
            className="flex-shrink-0 flex items-center px-3 bg-[rgba(0,0,0,0.7)]"
            style={{ height: 'var(--live-bottom-bar-h)' }}
          >
            <ChatInput
              compact
              disabled={layout.bottomInput.disabled || !isConnected}
              onSendMessage={handleMobileSendMessage}
              ref={mobileInputRef}
            />
          </div>
        )}

        {/* 7. Quick action bar — in-flow at bottom */}
        <div
          className="flex-shrink-0"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <LiveQuickActionBar
            streamTitle={streamStatus.title}
            onNotice={() => setIsNoticeOpen(true)}
            onCartOpen={() => setIsCartSheetOpen(true)}
            cartCount={cartData?.itemCount ?? 0}
            hasExpiringItem={hasExpiringItem}
            onInquiry={handleInquiry}
          />
        </div>
      </div>

      {/* ── Desktop: flex-col wrapper (video+chat row + featured bar) ── */}
      <div className="hidden lg:flex flex-1 flex-col min-h-0">
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Center: Video + overlays */}
          <div className="flex flex-1 relative items-center justify-center">
            <div className="relative w-full h-full lg:max-w-[480px] lg:h-full bg-black overflow-hidden">
              {/* Desktop top gradient scrim */}
              <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
              {/* Desktop bottom gradient scrim */}
              <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black/70 to-transparent z-10 pointer-events-none" />
              <VideoPlayer
                streamKey={streamKey}
                title={streamStatus.title}
                onViewerCountChange={handleViewerCountChange}
                onStreamError={setVideoError}
              />

              {/* ═══════════ DESKTOP TOP BAR ═══════════ */}
              <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between">
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
                  {videoError ? (
                    <div className="flex items-center gap-1.5 bg-black/50 px-3.5 py-1.5 rounded-full border border-white/10">
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white/40 animate-pulse" />
                      <span className="text-white/60 text-xs font-bold">연결 중...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-[#FF3B30] px-3.5 py-1.5 rounded-full shadow-[0_0_20px_rgba(255,59,48,0.4)]">
                      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                      </span>
                      <span className="text-white text-xs font-black tracking-wider">
                        LIVE<span className="sr-only"> 현재 생방송 중</span>
                      </span>
                    </div>
                  )}

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
                    <span className="text-white text-xs font-bold">
                      {viewerCount.toLocaleString()}
                    </span>
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

              {/* Stream title */}
              <div className="absolute top-[68px] left-4 right-20 z-20">
                <h1 className="text-white font-black text-base drop-shadow-lg line-clamp-1 text-glow-pink">
                  {streamStatus.title}
                </h1>
              </div>
            </div>
          </div>

          {/* Right: Chat Panel */}
          <div className="flex w-[320px] flex-col bg-[#12121e] border-l border-white/5">
            <ChatHeader userCount={userCount} isConnected={isConnected} compact={false} />
            <ChatMessageList
              messages={allMessages}
              compact={false}
              isAdmin={isAdmin}
              onDeleteMessage={chatDeleteMessage}
            />
            <LiveQuickActionBar
              streamTitle={streamStatus.title}
              onNotice={() => setIsNoticeOpen(true)}
              onCartOpen={() => setIsCartSheetOpen(true)}
              cartCount={cartData?.itemCount ?? 0}
              hasExpiringItem={hasExpiringItem}
              onInquiry={handleInquiry}
            />
            <ChatInput
              ref={desktopInputRef}
              onSendMessage={handleDesktopSendMessage}
              disabled={!isConnected}
              compact={false}
            />
          </div>
        </div>

        {/* Bottom: Featured Product Bar */}
        <FeaturedProductBar streamKey={streamKey} onProductClick={handleProductClick} />
      </div>

      {/* Product List Bottom Sheet */}
      <ProductListBottomSheet
        isOpen={isProductSheetOpen}
        onClose={() => setIsProductSheetOpen(false)}
        products={allProducts}
        activeProductId={displayedProduct?.id ?? null}
        onSelectProduct={handleProductSelectFromSheet}
      />

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Cart Sheet */}
      <LiveCartSheet isOpen={isCartSheetOpen} onClose={() => setIsCartSheetOpen(false)} />

      {/* Notice Modal */}
      <NoticeModal isOpen={isNoticeOpen} onClose={() => setIsNoticeOpen(false)} />
    </div>
  );
}
