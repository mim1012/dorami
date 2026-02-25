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
import { useChatConnection } from '@/hooks/useChatConnection';
import { useChatMessages } from '@/hooks/useChatMessages';
import { ChatMessage as ChatMessageType, SYSTEM_USERNAME } from '@/components/chat/types';
import { Body, Heading2 } from '@/components/common/Typography';
import type { Product } from '@/lib/types';
import { ProductStatus } from '@live-commerce/shared-types';
import {
  MonitorOff,
  Loader,
  Eye,
  Zap,
  Bell,
  MessageCircle,
  X,
  Share2,
  ShoppingCart,
  Package,
} from 'lucide-react';
import { InquiryBottomSheet } from '@/components/inquiry/InquiryBottomSheet';
import { useToast } from '@/components/common/Toast';
import { sendStreamMetrics } from '@/lib/analytics/stream-metrics';
import { useTokenAutoRefresh } from '@/lib/auth/token-auto-refresh';
import { useIsMobile } from '@/hooks/useIsMobile';

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

  const isMobile = useIsMobile(1024);

  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);
  const { data: cartData } = useCart();
  const [cartActivities, setCartActivities] = useState<
    Array<{ id: string; userName: string; productName: string; timestamp: string }>
  >([]);
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
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);
  const [mobileMessage, setMobileMessage] = useState('');
  const [purchaseNotif, setPurchaseNotif] = useState<string | null>(null);
  const purchaseNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      const ratio = vv.height / window.innerHeight;
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
      setAllProducts((prev) =>
        prev.some((p) => p.id === data.data.id) ? prev : [data.data, ...prev],
      );
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
    ws.on('cart:item-added', (payload: any) => {
      const data = payload.data ?? payload;
      setCartActivities((prev) => {
        const next = [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            userName: data.userName || '익명',
            productName: data.productName || '',
            timestamp: data.timestamp || new Date().toISOString(),
          },
        ];
        return next.length > 50 ? next.slice(-50) : next;
      });
    });
    ws.on('order:purchase:notification', (data: { displayName: string; message: string }) => {
      setPurchaseNotif(data.message);
      if (purchaseNotifTimerRef.current) clearTimeout(purchaseNotifTimerRef.current);
      purchaseNotifTimerRef.current = setTimeout(() => setPurchaseNotif(null), 4000);
    });
    return () => {
      ws.disconnect();
      if (purchaseNotifTimerRef.current) clearTimeout(purchaseNotifTimerRef.current);
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

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({
          title: streamStatus?.title ?? '',
          text: `${streamStatus?.title ?? ''} - 도레LIVE`,
          url,
        });
      } catch {
        await navigator.clipboard.writeText(url).catch(() => {});
      }
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
    }
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
      {!isMobile && (
        <aside className="w-[260px] xl:w-[300px] h-full overflow-y-auto bg-[#12121e] border-r border-white/5">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-white font-black text-lg flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-[#FF007A] to-[#7928CA]"></span>
              상품 목록
            </h2>
          </div>
          <ProductList
            streamKey={streamKey}
            onProductClick={handleProductClick}
            products={allProducts}
          />
        </aside>
      )}

      {/* ── MOBILE: fullscreen overlay layout ── */}
      {isMobile && (
        <div className="relative w-full h-screen overflow-hidden bg-black">
          {/* 0. Video — fullscreen background */}
          <div className="absolute inset-0 z-0">
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
            {/* Center overlay for stream state */}
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

          {/* 1. Top bar */}
          {layout.topBar.visible && (
            <div
              className={`absolute top-0 left-0 right-0 z-30 transition-opacity ${
                layout.topBar.dim ? 'opacity-40' : 'opacity-100'
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-transparent h-32 pointer-events-none" />
              <div className="relative px-4 pt-12 pb-4 flex items-center justify-between">
                {/* Left: profile + name + LIVE + viewers */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30 flex-shrink-0">
                    <Image
                      src="/logo.png"
                      alt="도레미 Live"
                      width={40}
                      height={40}
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white text-sm font-medium line-clamp-1">
                        {streamStatus.title}
                      </span>
                      {(snapshot === 'LIVE_NORMAL' || snapshot === 'LIVE_TYPING') &&
                        stream !== 'error' && (
                          <div className="flex items-center gap-1 bg-red-500 px-2 py-0.5 rounded flex-shrink-0">
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            <span className="text-white text-[10px] uppercase tracking-wider">
                              LIVE
                            </span>
                          </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 text-white/80">
                      <Eye className="w-3 h-3" />
                      <span className="text-xs">{viewerCount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Right: 공지, 문의, 닫기 pink circles */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(
                    [
                      { icon: Bell, label: '공지', onClick: () => setIsNoticeOpen(true) },
                      { icon: MessageCircle, label: '문의', onClick: () => setIsInquiryOpen(true) },
                      { icon: X, label: '닫기', onClick: () => router.push('/') },
                    ] as const
                  ).map(({ icon: Icon, label, onClick }) => (
                    <button
                      key={label}
                      onClick={onClick}
                      className="flex flex-col items-center gap-0.5"
                      aria-label={label}
                    >
                      <div className="w-8 h-8 flex items-center justify-center rounded-full bg-[#FF007A] backdrop-blur-sm transition-all active:scale-95">
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-white text-[9px] drop-shadow-lg">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. Notice banner */}
          {notice?.text && (
            <div
              className="absolute left-0 right-0 z-20 bg-[rgba(255,100,100,0.85)] px-3 py-1.5 overflow-hidden"
              style={{ top: 'calc(max(48px, env(safe-area-inset-top)) + 76px)' }}
            >
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

          {/* 2b. Purchase notification pill */}
          {purchaseNotif && (
            <div className="absolute top-[140px] left-0 right-0 z-40 flex justify-center pointer-events-none px-4">
              <div className="bg-black/70 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 flex items-center gap-2 shadow-xl animate-slide-up-sheet">
                <span className="text-lg">🎉</span>
                <span className="text-white text-xs font-medium">{purchaseNotif}</span>
              </div>
            </div>
          )}

          {/* 3. Right FABs */}
          <div className="absolute right-4 bottom-32 z-30 flex flex-col gap-4">
            <button
              onClick={handleShare}
              className="flex flex-col items-center gap-1"
              aria-label="공유하기"
            >
              <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all active:scale-95">
                <Share2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-white text-xs drop-shadow-lg">공유</span>
            </button>

            <button
              onClick={() => setIsProductSheetOpen(true)}
              className="flex flex-col items-center gap-1"
              aria-label="지난 상품 목록"
            >
              <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all active:scale-95">
                <Package className="w-4 h-4 text-white" />
              </div>
              <span className="text-white text-xs font-medium drop-shadow-lg">
                {allProducts.length}개
              </span>
              <span className="text-white/70 text-[9px] drop-shadow-lg">지난상품</span>
            </button>
          </div>

          {/* 4. Chat messages — absolute overlay */}
          <div className="absolute left-4 bottom-[160px] z-10 w-[70%] space-y-1.5">
            <ChatMessageList messages={allMessages} compact maxMessages={4} />
          </div>

          {/* 5. Featured product card — glassmorphism */}
          {displayedProduct && snapshot !== 'ENDED' && snapshot !== 'NO_STREAM' && (
            <div className="absolute left-4 bottom-[90px] z-20 w-[65%]">
              <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-1.5 shadow-2xl">
                <div className="flex items-center gap-2">
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-md bg-white overflow-hidden flex-shrink-0 shadow-lg">
                    {displayedProduct.imageUrl ? (
                      <Image
                        src={displayedProduct.imageUrl}
                        alt={displayedProduct.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                        unoptimized={displayedProduct.imageUrl.startsWith('/uploads/')}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <Package className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white text-[10px] font-medium mb-0.5 line-clamp-1">
                      {displayedProduct.name}
                    </h3>
                    <div className="flex items-baseline gap-0.5">
                      {displayedProduct.discountRate != null &&
                        displayedProduct.discountRate > 0 && (
                          <span className="text-rose-400 text-[9px]">
                            {displayedProduct.discountRate}%
                          </span>
                        )}
                      <span className="text-white text-[11px] font-medium">
                        {displayedProduct.price.toLocaleString()}원
                      </span>
                    </div>
                  </div>
                  {/* Buy button */}
                  <button
                    onClick={() =>
                      displayedProduct.status !== 'SOLD_OUT' && handleProductClick(displayedProduct)
                    }
                    disabled={displayedProduct.status === 'SOLD_OUT'}
                    className="bg-white text-black px-3 py-1.5 rounded-md text-[10px] hover:opacity-90 transition-all active:scale-95 whitespace-nowrap shadow-lg flex-shrink-0 disabled:bg-gray-400 disabled:text-white disabled:cursor-not-allowed"
                  >
                    {displayedProduct.status === 'SOLD_OUT' ? '품절' : '구매하기'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 6. Bottom bar: chat input + CTA */}
          {layout.bottomInput.visible && (
            <div
              className="absolute bottom-0 left-0 right-0 z-10 px-4 pt-3"
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}
            >
              <div className="flex items-center gap-2">
                {/* Chat input pill */}
                <div className="flex-1 bg-black/30 backdrop-blur-md rounded-full px-4 py-3 border border-white/10">
                  <input
                    type="text"
                    value={mobileMessage}
                    onChange={(e) => setMobileMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && mobileMessage.trim()) {
                        handleMobileSendMessage(mobileMessage);
                        setMobileMessage('');
                      }
                    }}
                    placeholder="메시지를 입력하세요..."
                    disabled={layout.bottomInput.disabled || !isConnected}
                    className="w-full bg-transparent text-white text-sm placeholder:text-white/50 focus:outline-none disabled:opacity-50"
                  />
                </div>
                {/* Purchase CTA */}
                <button
                  onClick={() =>
                    displayedProduct &&
                    displayedProduct.status !== 'SOLD_OUT' &&
                    handleProductClick(displayedProduct)
                  }
                  disabled={!displayedProduct || displayedProduct.status === 'SOLD_OUT'}
                  className="flex-shrink-0 bg-gradient-to-r from-[#FF007A] to-[#FF4E50] px-5 py-3 rounded-full flex items-center gap-2 transition-all active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="구매하기"
                >
                  <ShoppingCart className="w-5 h-5 text-white" />
                  <span className="text-white text-sm font-medium whitespace-nowrap">구매하기</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Desktop: flex-col wrapper (video+chat row + featured bar) ── */}
      {!isMobile && (
        <div className="flex flex-1 flex-col min-h-0">
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
            <div className="flex w-[320px] flex-col bg-transparent border-l border-white/5">
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
                onInquiry={() => setIsInquiryOpen(true)}
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
      )}

      {/* Product List Bottom Sheet */}
      <ProductListBottomSheet
        isOpen={isProductSheetOpen}
        onClose={() => setIsProductSheetOpen(false)}
        products={allProducts}
        activeProductId={displayedProduct?.id ?? null}
        onSelectProduct={handleProductSelectFromSheet}
        onAddToCart={(p) => {
          setIsProductSheetOpen(false);
          handleProductClick(p);
        }}
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

      {/* Inquiry Bottom Sheet */}
      <InquiryBottomSheet isOpen={isInquiryOpen} onClose={() => setIsInquiryOpen(false)} />
    </div>
  );
}
