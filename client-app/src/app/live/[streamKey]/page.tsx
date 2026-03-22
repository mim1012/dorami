'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { io } from 'socket.io-client';
import { apiClient } from '@/lib/api/client';
import { getUserMessage } from '@/lib/errors/error-messages';
import { SOCKET_URL } from '@/lib/config/socket-url';
import { useLiveLayoutMachine, computeLayout } from '@/hooks/useLiveLayoutMachine';
import VideoPlayer from '@/components/stream/VideoPlayer';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatMessageList, { ChatMessageListHandle } from '@/components/chat/ChatMessageList';
import ChatInput, { ChatInputHandle } from '@/components/chat/ChatInput';

import ProductList from '@/components/product/ProductList';
import ProductDetailModal from '@/components/product/ProductDetailModal';
import FeaturedProductBar from '@/components/product/FeaturedProductBar';
import LiveQuickActionBar from '@/components/live/LiveQuickActionBar';
import LiveCartSheet from '@/components/live/LiveCartSheet';
import ProductListBottomSheet from '@/components/live/ProductListBottomSheet';
import { NoticeModal } from '@/components/notices/NoticeModal';
import { cartKeys, useCart } from '@/lib/hooks/queries/use-cart';
import { productKeys } from '@/lib/hooks/queries/use-products';
import { useChatConnection } from '@/hooks/useChatConnection';
import { useChatMessages } from '@/hooks/useChatMessages';
import { ChatMessage as ChatMessageType, SYSTEM_USERNAME } from '@/components/chat/types';
import { Body, Heading2 } from '@/components/common/Typography';
import type { Product } from '@/lib/types';
import { ProductStatus } from '@live-commerce/shared-types';
import { formatPrice } from '@/lib/utils/price';
import {
  MonitorOff,
  Loader,
  Eye,
  Zap,
  Bell,
  Volume2,
  VolumeX,
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
import { useAuthStore } from '@/lib/store/auth';
import { RECONNECT_CONFIG } from '@/lib/socket/reconnect-config';

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
  const pathname = usePathname();
  const streamKey = params.streamKey as string;

  // 10분 주기 토큰 자동 갱신 — 장기 방송(3시간+) 지원
  useTokenAutoRefresh(streamKey, { suspendForBroadcast: true });

  const isMobile = useIsMobile(1024);
  const [isMobileReady, setIsMobileReady] = useState(false);
  useEffect(() => {
    setIsMobileReady(true);
  }, []);

  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);
  const { data: cartData } = useCart();
  const queryClient = useQueryClient();
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
  const [mobileVolume, setMobileVolume] = useState(1);
  const [isVolumeControlOpen, setIsVolumeControlOpen] = useState(false);
  const [mobileMessage, setMobileMessage] = useState('');
  const [purchaseNotif, setPurchaseNotif] = useState<string | null>(null);
  const purchaseNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousStreamStatusRef = useRef<StreamStatus['status'] | null>(null);
  const [playerSessionSeed, setPlayerSessionSeed] = useState(0);
  const { showToast } = useToast();
  const hasShownSessionExpiredToast = useRef(false);
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStore();

  // ── Auth: 라이브 페이지는 비인증 유저도 시청 허용 (구매/채팅만 제한) ──────
  // 세션 만료 시에도 방송에서 이탈하지 않도록 redirect하지 않는다.

  useEffect(() => {
    const onSessionExpired = () => {
      if (!hasShownSessionExpiredToast.current) {
        hasShownSessionExpiredToast.current = true;
        showToast('로그인이 만료되었어요. 다시 로그인하면 방송을 이어서 볼 수 있어요.', 'error', {
          label: '로그인',
          onClick: () => {
            const returnTo = window.location.pathname;
            window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
          },
        });
      }
    };

    if (typeof window === 'undefined') return;
    window.addEventListener('dorami-live-session-expired', onSessionExpired as EventListener);
    return () =>
      window.removeEventListener('dorami-live-session-expired', onSessionExpired as EventListener);
  }, [showToast]);

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
  const mobileChatListRef = useRef<ChatMessageListHandle>(null);

  // Desktop chat state
  const desktopInputRef = useRef<ChatInputHandle>(null);
  const desktopChatListRef = useRef<ChatMessageListHandle>(null);
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
  // keyboardOffset: px the keyboard pushes content up from the viewport bottom.
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
      dispatch(offset > 100 ? { type: 'OPEN_KEYBOARD' } : { type: 'CLOSE_KEYBOARD' });
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [dispatch]);

  // Extracted so handleAddToCart can re-fetch after stock changes
  const fetchAllProducts = useCallback(async () => {
    try {
      const response = await apiClient.get<Product[]>('/products', {
        params: { streamKey, status: 'AVAILABLE', take: '200' },
      });
      setAllProducts(response.data ?? []);
    } catch {
      // non-critical
    }
  }, [streamKey]);

  // ── Featured product fetch + all products + real-time WS ─────────────────
  useEffect(() => {
    let isCancelled = false;

    const fetchFeatured = async () => {
      try {
        const response = await apiClient.get<{ product: FeaturedProduct | null }>(
          `/streaming/key/${streamKey}/featured-product`,
        );
        if (!isCancelled) {
          setFeaturedProduct(response.data.product);
        }
      } catch {
        // non-critical
      }
    };

    const safeFetchAllProducts = async () => {
      try {
        const products = await apiClient.get<Product[]>('/products', {
          params: { streamKey, status: 'AVAILABLE' },
        });
        if (!isCancelled) {
          setAllProducts(products.data ?? []);
        }
      } catch {
        // non-critical
      }
    };

    const setFeaturedProductIfActive = (
      updater: (product: FeaturedProduct | null) => FeaturedProduct | null,
    ) => {
      if (!isCancelled) setFeaturedProduct(updater);
    };

    fetchFeatured();
    safeFetchAllProducts();

    const wsConfig = RECONNECT_CONFIG.default;
    const ws = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: wsConfig.maxAttempts,
      reconnectionDelay: wsConfig.delays[0],
      reconnectionDelayMax: wsConfig.delays[wsConfig.delays.length - 1],
      randomizationFactor: wsConfig.jitterFactor,
      timeout: 20000,
      autoConnect: true,
    });

    const handleConnect = () => {
      if (isCancelled) return;
      ws.emit('join:stream', { streamId: streamKey });
    };

    const handleFeaturedProductUpdated = (data: any) => {
      if (isCancelled) return;
      if (data.streamKey === streamKey) setFeaturedProduct(data.product);
    };

    const handleProductAdded = (data: any) => {
      if (isCancelled) return;
      setAllProducts((prev) =>
        prev.some((p) => p.id === data.data.id) ? prev : [data.data, ...prev],
      );
    };

    const handleProductUpdated = (data: any) => {
      if (isCancelled) return;
      setAllProducts((prev) => prev.map((p) => (p.id === data.data.id ? data.data : p)));
    };

    const handleProductSoldOut = (data: any) => {
      if (isCancelled) return;
      setAllProducts((prev) =>
        prev.map((p) =>
          p.id === data.data.productId ? { ...p, status: ProductStatus.SOLD_OUT } : p,
        ),
      );
      setFeaturedProductIfActive((prev) => {
        if (prev && prev.id === data.data.productId) {
          showToast('이 상품이 품절되었습니다.', 'error');
          return { ...prev, status: ProductStatus.SOLD_OUT };
        }
        return prev;
      });
    };

    const handleCartItemAdded = (payload: any) => {
      if (isCancelled) return;
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
    };

    const handlePurchaseNotification = (data: { displayName: string; message: string }) => {
      if (isCancelled) return;
      setPurchaseNotif(data.message);
      if (purchaseNotifTimerRef.current) clearTimeout(purchaseNotifTimerRef.current);
      purchaseNotifTimerRef.current = setTimeout(() => setPurchaseNotif(null), 4000);
    };

    const handleReconnect = () => {
      if (isCancelled) return;
      if (process.env.NODE_ENV !== 'production') {
        console.log('[LiveEvents] reconnect - rejoin stream', streamKey);
      }
      handleConnect();
    };

    const handleReconnectError = (error: Error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[LiveEvents] reconnect error:', error);
      }
    };

    ws.on('connect', handleConnect);
    ws.on('reconnect', handleReconnect);
    ws.on('connect_error', handleReconnectError);
    ws.io.on('reconnect_failed', () => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[LiveEvents] reconnect failed');
      }
    });
    ws.on('stream:featured-product:updated', handleFeaturedProductUpdated);
    ws.on('live:product:added', handleProductAdded);
    ws.on('live:product:updated', handleProductUpdated);
    ws.on('live:product:soldout', handleProductSoldOut);
    ws.on('cart:item-added', handleCartItemAdded);
    ws.on('order:purchase:notification', handlePurchaseNotification);

    handleConnect();

    return () => {
      isCancelled = true;
      ws.off('connect', handleConnect);
      ws.off('reconnect', handleReconnect);
      ws.off('connect_error', handleReconnectError);
      ws.off('stream:featured-product:updated', handleFeaturedProductUpdated);
      ws.off('live:product:added', handleProductAdded);
      ws.off('live:product:updated', handleProductUpdated);
      ws.off('live:product:soldout', handleProductSoldOut);
      ws.off('cart:item-added', handleCartItemAdded);
      ws.off('order:purchase:notification', handlePurchaseNotification);
      ws.io.off('reconnect_failed');
      ws.disconnect();
      if (purchaseNotifTimerRef.current) clearTimeout(purchaseNotifTimerRef.current);
    };
  }, [streamKey]);

  const isFetchingStatusRef = useRef(false);
  // Grace timer: Prism Live / SRS reconnects cause transient OFFLINE (~1-3s).
  // Wait 10s before treating OFFLINE as real stream end to avoid VideoPlayer remounts.
  const offlineGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStreamStatus = useCallback(async () => {
    if (isFetchingStatusRef.current) return;
    isFetchingStatusRef.current = true;
    try {
      const response = await apiClient.get<StreamStatus>(`/streaming/key/${streamKey}/status`);
      const nextStatus = response.data.status;
      const previousStatus = previousStreamStatusRef.current;
      if (nextStatus === 'LIVE') {
        setStreamStatus(response.data);
        setError(null);
        // Cancel pending offline grace timer — stream recovered before 10s elapsed
        if (offlineGraceTimerRef.current) {
          clearTimeout(offlineGraceTimerRef.current);
          offlineGraceTimerRef.current = null;
        }
        if (previousStatus !== 'LIVE') {
          dispatch({ type: 'STREAM_RECOVERED' });
          // Only force-remount player if stream was genuinely offline long enough
          // (grace timer had fired). Transient SRS reconnects don't set previousStatus to null.
          if (previousStatus !== null) {
            setPlayerSessionSeed((prev) => prev + 1);
          }
        }
      } else if (nextStatus === 'OFFLINE') {
        if (previousStatus === null) {
          // Initial load: stream not live yet — show waiting screen immediately
          setStreamStatus(response.data);
          setError('현재 방송 중이 아닙니다');
        } else if (previousStatus === 'LIVE') {
          // Stream was live → start 10s grace period before acting
          // Do NOT update streamStatus or dispatch STREAM_ENDED yet
          if (!offlineGraceTimerRef.current) {
            offlineGraceTimerRef.current = setTimeout(() => {
              offlineGraceTimerRef.current = null;
              setStreamStatus((prev) => (prev ? { ...prev, status: 'OFFLINE' } : prev));
              dispatch({ type: 'STREAM_ENDED' });
            }, 10_000);
          }
        }
        // else: was already OFFLINE — grace timer already running or initial state
      }

      previousStreamStatusRef.current = nextStatus;
    } catch (err: any) {
      console.error('Failed to fetch stream status:', err);
      if (previousStreamStatusRef.current === null) {
        setError('방송을 찾을 수 없습니다');
      }
    } finally {
      setIsLoading(false);
      isFetchingStatusRef.current = false;
    }
  }, [dispatch, streamKey]);

  // Clean up grace timer on unmount
  useEffect(() => {
    return () => {
      if (offlineGraceTimerRef.current) {
        clearTimeout(offlineGraceTimerRef.current);
        offlineGraceTimerRef.current = null;
      }
    };
  }, []);

  // Poll stream status so UI can recover without manual refresh after transient disconnects.
  // NOTE: snapshot/stream are intentionally NOT in deps to avoid rapid concurrent fetches
  // that cause playerSessionSeed race conditions. Interval is adjusted via a separate effect.
  useEffect(() => {
    void fetchStreamStatus();
    const interval = setInterval(() => void fetchStreamStatus(), 15000);
    return () => clearInterval(interval);
  }, [fetchStreamStatus]);

  // Accelerate polling when reconnecting or stream is down
  useEffect(() => {
    if (snapshot !== 'ENDED' && snapshot !== 'RETRYING' && stream !== 'no_stream') return;
    const interval = setInterval(() => void fetchStreamStatus(), 5000);
    return () => clearInterval(interval);
  }, [fetchStreamStatus, snapshot, stream]);

  const handleMobileSendMessage = (message: string) => {
    if (message.trim()) {
      chatSendMessage(message);
      mobileChatListRef.current?.scrollToBottom();
    }
  };

  const handleDesktopSendMessage = (message: string) => {
    if (message.trim()) {
      chatSendMessage(message);
      desktopChatListRef.current?.scrollToBottom();
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

  // Profile completion guard: prevent rendering while redirecting
  // isMobileReady ensures useIsMobile has read window.innerWidth before
  // VideoPlayer renders — prevents Desktop→Mobile remount race condition.
  if (isLoading || !isMobileReady) {
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
    quantity: number = 1,
    selectedColor?: string,
    selectedSize?: string,
  ) => {
    const { isAuthenticated } = useAuthStore.getState();

    // Check authentication first
    if (!isAuthenticated) {
      showToast('로그인 후 이용해주세요', 'error', {
        label: '로그인',
        onClick: () => router.push('/login'),
      });
      return;
    }

    try {
      await apiClient.post('/cart', {
        productId,
        quantity,
        color: selectedColor,
        size: selectedSize,
      });
      // Invalidate cart AND product queries so stock counts update immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cartKeys.all }),
        queryClient.invalidateQueries({
          queryKey: productKeys.list({ streamKey, status: 'AVAILABLE' }),
        }),
      ]);
      // Also refresh local allProducts state for the mobile product sheet
      void fetchAllProducts();

      showToast('장바구니에 담았어요!', 'success', {
        label: '장바구니 보기',
        onClick: () => setIsCartSheetOpen(true),
      });
    } catch (error: any) {
      console.error('Failed to add to cart:', error);

      // Handle specific error types
      if (error.statusCode === 401) {
        showToast('로그인 세션이 만료되었습니다', 'error', {
          label: '로그인',
          onClick: () => router.push('/login?reason=session_expired'),
        });
      } else {
        showToast(getUserMessage(error), 'error');
      }
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
  const isMobileMuted = mobileVolume <= 0;
  const mobileVolumePercent = Math.round(mobileVolume * 100);

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
        <div
          className="relative w-full h-[100dvh] overflow-hidden bg-black"
          style={{ '--kb': `${keyboardOffset}px` } as React.CSSProperties}
        >
          {/* 0. Video — fullscreen background */}
          <div className="absolute inset-0 z-0">
            <VideoPlayer
              key={`player-${streamKey}-${playerSessionSeed}`}
              streamKey={streamKey}
              title={streamStatus.title}
              muted={isMobileMuted}
              volume={mobileVolume}
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
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-transparent h-24 pointer-events-none" />
              <div
                className="relative px-3 xs:px-4 pb-3 flex items-center justify-between gap-2"
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
              >
                {/* Left: profile + name + LIVE + viewers */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-1">
                  <div className="w-9 h-9 xs:w-10 xs:h-10 rounded-full overflow-hidden border-2 border-white/30 flex-shrink-0">
                    <Image
                      src="/logo.png"
                      alt="도레미 Live"
                      width={40}
                      height={40}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-white text-[13px] xs:text-sm font-medium line-clamp-1">
                        {streamStatus.title}
                      </span>
                      {(snapshot === 'LIVE_NORMAL' || snapshot === 'LIVE_TYPING') &&
                        stream !== 'error' && (
                          <div className="flex items-center gap-1 bg-red-500 px-1.5 xs:px-2 py-0.5 rounded flex-shrink-0">
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            <span className="text-white text-[9px] uppercase tracking-wider">
                              LIVE
                            </span>
                          </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 text-white/80">
                      <Eye className="w-3 h-3" />
                      <span className="text-[11px] xs:text-xs">{viewerCount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Right: 공지, 소리(볼륨), 문의, 닫기 pink circles */}
                <div className="flex items-start gap-1.5 xs:gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      setIsVolumeControlOpen(false);
                      setIsNoticeOpen(true);
                    }}
                    className="flex flex-col items-center gap-0.5"
                    aria-label="공지"
                  >
                    <div className="w-7 h-7 xs:w-8 xs:h-8 flex items-center justify-center rounded-full bg-[#FF007A] backdrop-blur-sm transition-all active:scale-95">
                      <Bell className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-white" />
                    </div>
                    <span className="text-white text-[8px] xs:text-[9px] drop-shadow-lg">공지</span>
                  </button>

                  <div className="relative flex flex-col items-center gap-0.5">
                    <button
                      onClick={() => setIsVolumeControlOpen((prev) => !prev)}
                      className="flex flex-col items-center gap-0.5"
                      aria-label="소리 조절"
                    >
                      <div className="w-7 h-7 xs:w-8 xs:h-8 flex items-center justify-center rounded-full bg-[#FF007A] backdrop-blur-sm transition-all active:scale-95">
                        {isMobileMuted ? (
                          <VolumeX className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-white" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-white" />
                        )}
                      </div>
                      <span className="text-white text-[8px] xs:text-[9px] drop-shadow-lg">
                        소리
                      </span>
                    </button>

                    {isVolumeControlOpen && (
                      <div className="absolute top-9 xs:top-10 right-0 w-32 xs:w-36 rounded-lg border border-white/20 bg-black/80 backdrop-blur-md px-2.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <VolumeX className="w-3.5 h-3.5 text-white/70 flex-shrink-0" />
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={mobileVolumePercent}
                            onChange={(e) => setMobileVolume(Number(e.target.value) / 100)}
                            className="w-full accent-[#FF007A]"
                            aria-label="볼륨 조절"
                          />
                          <Volume2 className="w-3.5 h-3.5 text-white/70 flex-shrink-0" />
                        </div>
                        <div className="mt-1 text-right text-[10px] text-white/80">
                          {mobileVolumePercent}%
                        </div>
                      </div>
                    )}
                  </div>

                  {(
                    [
                      {
                        key: 'inquiry',
                        icon: MessageCircle,
                        label: '문의',
                        ariaLabel: '문의',
                        onClick: () => setIsInquiryOpen(true),
                      },
                      {
                        key: 'close',
                        icon: X,
                        label: '닫기',
                        ariaLabel: '닫기',
                        onClick: () => router.push('/'),
                      },
                    ] as const
                  ).map(({ key, icon: Icon, label, ariaLabel, onClick }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setIsVolumeControlOpen(false);
                        onClick();
                      }}
                      className="flex flex-col items-center gap-0.5"
                      aria-label={ariaLabel}
                    >
                      <div className="w-7 h-7 xs:w-8 xs:h-8 flex items-center justify-center rounded-full bg-[#FF007A] backdrop-blur-sm transition-all active:scale-95">
                        <Icon className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-white" />
                      </div>
                      <span className="text-white text-[8px] xs:text-[9px] drop-shadow-lg">
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. Notice banner */}
          {notice?.text && (
            <div
              className="absolute left-0 right-0 z-20 bg-[rgba(255,100,100,0.85)] px-2.5 xs:px-3 py-1.5 overflow-hidden"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 60px)' }}
            >
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-white flex-shrink-0" />
                <div className="overflow-hidden flex-1">
                  <div className="notice-track text-white text-[11px] xs:text-xs font-medium">
                    <span className="pr-10">{notice.text}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2b. Purchase notification pill */}
          {purchaseNotif && (
            <div className="absolute left-0 right-0 z-40 flex justify-center pointer-events-none px-4 top-[calc(env(safe-area-inset-top,0px)+88px)]">
              <div className="bg-black/70 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 flex items-center gap-2 shadow-xl animate-slide-up-sheet">
                <span className="text-lg">🎉</span>
                <span className="text-white text-xs font-medium">{purchaseNotif}</span>
              </div>
            </div>
          )}

          {/* 3. Right FABs */}
          <div
            className="absolute right-3 xs:right-4 z-30 flex flex-col gap-3 xs:gap-4"
            style={{ bottom: 'calc(112px + env(safe-area-inset-bottom, 0px) + var(--kb, 0px))' }}
          >
            <button
              onClick={handleShare}
              className="flex flex-col items-center gap-1"
              aria-label="공유하기"
            >
              <div className="w-10 h-10 xs:w-12 xs:h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all active:scale-95">
                <Share2 className="w-4 h-4 xs:w-5 xs:h-5 text-white" />
              </div>
              <span className="text-white text-[10px] xs:text-xs drop-shadow-lg">공유</span>
            </button>

            <button
              onClick={() => setIsCartSheetOpen(true)}
              className="flex flex-col items-center gap-1"
              aria-label="장바구니"
            >
              <div className="relative w-10 h-10 xs:w-12 xs:h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all active:scale-95">
                <ShoppingCart className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-white" />
                {(cartData?.itemCount ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF007A] rounded-full text-[9px] text-white font-black flex items-center justify-center">
                    {(cartData?.itemCount ?? 0) > 9 ? '9+' : cartData?.itemCount}
                  </span>
                )}
              </div>
              <span className="text-white text-[10px] xs:text-xs font-medium drop-shadow-lg">
                장바구니
              </span>
            </button>

            <button
              onClick={() => setIsProductSheetOpen(true)}
              className="flex flex-col items-center gap-1"
              aria-label="지난 상품 목록"
            >
              <div className="w-10 h-10 xs:w-12 xs:h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all active:scale-95">
                <Package className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-white" />
              </div>
              <span className="text-white text-[10px] xs:text-xs font-medium drop-shadow-lg">
                {allProducts.length}개
              </span>
              <span className="text-white/70 text-[8px] xs:text-[9px] drop-shadow-lg">
                지난상품
              </span>
            </button>
          </div>

          {/* 4. Chat messages — absolute overlay */}
          <div
            className="absolute left-3 xs:left-4 right-[72px] xs:right-[84px] sm:right-[100px] z-10 max-h-[30vh] overflow-hidden flex flex-col"
            style={{ bottom: 'calc(166px + env(safe-area-inset-bottom, 0px) + var(--kb, 0px))' }}
          >
            {/* Top gradient fade */}
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-10" />
            <ChatMessageList ref={mobileChatListRef} messages={allMessages} compact />
          </div>

          {/* 5. Featured product card — glassmorphism */}
          {displayedProduct && snapshot !== 'ENDED' && snapshot !== 'NO_STREAM' && (
            <div
              className="absolute left-3 xs:left-4 right-[72px] xs:right-[84px] sm:right-[100px] z-20"
              style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px) + var(--kb, 0px))' }}
            >
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
                        {formatPrice(displayedProduct.price)}
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
              className="absolute left-0 right-0 z-10 px-3 xs:px-4 pt-2.5"
              style={{
                bottom: 'var(--kb, 0px)',
                paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
              }}
            >
              <div className="flex items-center gap-2">
                {/* Chat input pill */}
                <div className="flex-1 bg-black/30 backdrop-blur-md rounded-full px-3.5 xs:px-4 py-2.5 xs:py-3 border border-white/10">
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
                    className="w-full bg-transparent text-white text-[13px] xs:text-sm placeholder:text-white/50 focus:outline-none disabled:opacity-50"
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
                  className="flex-shrink-0 bg-gradient-to-r from-[#FF007A] to-[#FF4E50] px-3.5 xs:px-5 py-2.5 xs:py-3 rounded-full flex items-center gap-1.5 xs:gap-2 transition-all active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="구매하기"
                >
                  <ShoppingCart className="w-4 h-4 xs:w-5 xs:h-5 text-white" />
                  <span className="text-white text-[13px] xs:text-sm font-medium whitespace-nowrap">
                    구매하기
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Desktop: flex-col wrapper (video+chat row + featured bar) ── */}
      {!isMobile && (
        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex flex-[3] min-h-0 overflow-hidden">
            {/* Center: Video + overlays */}
            <div className="flex flex-1 relative items-center justify-center">
              <div className="relative w-full h-full lg:max-w-[560px] xl:max-w-[640px] 2xl:max-w-[720px] lg:h-full bg-black overflow-hidden">
                {/* Desktop top gradient scrim */}
                <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
                {/* Desktop bottom gradient scrim */}
                <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black/70 to-transparent z-10 pointer-events-none" />
                <VideoPlayer
                  key={`player-${streamKey}-${playerSessionSeed}`}
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
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
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
            <div className="flex w-[320px] min-h-0 flex-col bg-transparent border-l border-white/5">
              <ChatHeader userCount={userCount} isConnected={isConnected} compact={false} />
              <ChatMessageList
                ref={desktopChatListRef}
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

          {/* Bottom products sections removed — left sidebar ProductList is sufficient on desktop */}
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
