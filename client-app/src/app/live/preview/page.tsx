'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { cartKeys } from '@/lib/hooks/queries/use-cart';
import type { CartSummary } from '@/lib/hooks/queries/use-cart';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatInput, { ChatInputHandle } from '@/components/chat/ChatInput';
import type { CartActivity } from '@/components/live/CartActivityFeed';
import ProductDetailModal from '@/components/product/ProductDetailModal';
import LiveQuickActionBar from '@/components/live/LiveQuickActionBar';
import LiveCartSheet from '@/components/live/LiveCartSheet';
import ProductListBottomSheet from '@/components/live/ProductListBottomSheet';
import TestControlPanel from './TestControlPanel';
import { useToast } from '@/components/common/Toast';
import type { ChatMessage } from '@/components/chat/types';
import { SYSTEM_USERNAME } from '@/components/chat/types';
import type { Product } from '@/lib/types/product';
import { ProductStatus } from '@live-commerce/shared-types';
import { formatPrice } from '@/lib/utils/price';
import { apiClient } from '@/lib/api/client';
import { getRuntimeConfig } from '@/lib/config/runtime';
import { Eye, Bell, MessageCircle, Share2, ShoppingCart, Package, X } from 'lucide-react';
import { NoticeModal } from '@/components/notices/NoticeModal';
import { InquiryBottomSheet } from '@/components/inquiry/InquiryBottomSheet';

// ── Mock Data ──
const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    userId: 'u1',
    username: 'doremi_fan',
    message: '오 대박 이거 진짜 예쁘다 😍',
    timestamp: new Date(Date.now() - 300000),
    isDeleted: false,
  },
  {
    id: '2',
    userId: 'u2',
    username: 'shopping_queen',
    message: '색상 몇가지 있나요?',
    timestamp: new Date(Date.now() - 240000),
    isDeleted: false,
  },
  {
    id: '3',
    userId: 'u3',
    username: 'jimin_style',
    message: '가격 너무 착하다 ㅠㅠ',
    timestamp: new Date(Date.now() - 180000),
    isDeleted: false,
  },
  {
    id: '4',
    userId: 'u4',
    username: 'beauty_lover',
    message: '배송 얼마나 걸려요?',
    timestamp: new Date(Date.now() - 120000),
    isDeleted: false,
  },
  {
    id: '5',
    userId: 'u1',
    username: 'doremi_fan',
    message: '바로 담았어요!! 🔥🔥',
    timestamp: new Date(Date.now() - 60000),
    isDeleted: false,
  },
  {
    id: '6',
    userId: 'u5',
    username: 'new_user_22',
    message: '첫 방송인데 너무 좋아요',
    timestamp: new Date(Date.now() - 30000),
    isDeleted: false,
  },
];

const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    streamKey: 'preview',
    name: 'Chic Evening Bag',
    price: 129000,
    originalPrice: 159000,
    discountRate: 19,
    imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&q=80',
    stock: 10,
    colorOptions: ['블랙', '아이보리', '핑크'],
    sizeOptions: [],
    shippingFee: 3000,
    freeShippingMessage: '5만원 이상 무료배송',
    timerEnabled: true,
    timerDuration: 10,
    isNew: true,
    status: ProductStatus.AVAILABLE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    streamKey: 'preview',
    name: 'Pro Audio Pods',
    price: 62300,
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
    stock: 25,
    colorOptions: ['화이트', '블랙'],
    sizeOptions: [],
    shippingFee: 0,
    freeShippingMessage: '무료배송',
    timerEnabled: true,
    timerDuration: 10,
    isNew: false,
    status: ProductStatus.AVAILABLE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const MOCK_CART_ACTIVITIES: CartActivity[] = [
  {
    id: 'ca1',
    userName: '민지',
    userColor: '#FF007A',
    productName: 'Chic Evening Bag',
    timestamp: new Date().toISOString(),
  },
];

const USER_COLORS = ['#FF007A', '#7928CA', '#FF6B35', '#00D4AA', '#4A90D9'];
const USER_NAMES = ['민지', '수현', '하은', '지우', '서연', '예린', '소희'];

let nextProductId = 3;

const STREAM_TITLE = '도레미 라이브 커머스 미리보기';
const PREVIEW_STREAM_KEY =
  process.env.NEXT_PUBLIC_PREVIEW_STREAM_KEY || '9fadba4785ad48d73f559dd3d9cf108f';

export default function LivePreviewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mobileInputRef = useRef<ChatInputHandle>(null);
  const desktopInputRef = useRef<ChatInputHandle>(null);
  const startedAtRef = useRef(new Date());
  const { showToast } = useToast();

  // 런타임에 preview 접근 허가 여부 체크
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setIsAllowed(true);
      return;
    }
    getRuntimeConfig().then(({ previewEnabled }) => {
      if (previewEnabled) setIsAllowed(true);
      else router.replace('/');
    });
  }, [router]);

  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
  const [cartActivities, setCartActivities] = useState<CartActivity[]>(MOCK_CART_ACTIVITIES);
  const [viewerCount, setViewerCount] = useState(147);
  const [showViewerPulse, setShowViewerPulse] = useState(false);
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [activeProduct, setActiveProduct] = useState<Product | null>(MOCK_PRODUCTS[0] ?? null);

  // 실제 DB 상품 fetch (없으면 mock 유지)
  useEffect(() => {
    if (!isAllowed) return;
    apiClient
      .get<Product[]>('/products', { params: { streamKey: PREVIEW_STREAM_KEY } })
      .then((res) => {
        const fetched = res.data ?? [];
        if (fetched.length > 0) {
          setProducts(fetched);
          setActiveProduct(fetched[0]);
        }
      })
      .catch(() => {
        /* mock 유지 */
      });
  }, [isAllowed]);
  const [isProductSheetOpen, setIsProductSheetOpen] = useState(false);
  const [chatSpeed, setChatSpeed] = useState(3500);
  const [cartCount, setCartCount] = useState(0);
  const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  // Product detail modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);
  const [mobileInputMessage, setMobileInputMessage] = useState('');

  // allMessages: cart activities merged as system messages (same as real page)
  const allMessages = useMemo(() => {
    const systemMessages: ChatMessage[] = cartActivities.map((activity) => ({
      id: `system-cart-${activity.id}`,
      userId: 'system',
      username: SYSTEM_USERNAME,
      message: `${activity.userName}님이 ${activity.productName}을 장바구니에 담았습니다`,
      timestamp: new Date(activity.timestamp),
      isDeleted: false,
    }));
    return [...messages, ...systemMessages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [messages, cartActivities]);

  // Elapsed time timer
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((Date.now() - startedAtRef.current.getTime()) / 1000));
      const h = String(Math.floor(diff / 3600)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      setElapsedTime(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 시뮬레이션: 뷰어 카운트 변동
  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount((prev) => {
        const change = Math.floor(Math.random() * 7) - 2;
        const newVal = Math.max(50, prev + change);
        if (change > 2) setShowViewerPulse(true);
        return newVal;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // 시뮬레이션: 자동 채팅 메시지
  useEffect(() => {
    if (chatSpeed === 0) return;
    const autoMessages = [
      '이거 진짜 갖고 싶다 ㅠㅠ',
      '사이즈 추천 부탁드려요!',
      '와 컬러 예쁘다 💜',
      '재입고 언제 되나요?',
      '방금 주문했어요 ㅎㅎ',
      '가성비 최고!!',
      '친구한테도 추천해야겠다',
      '오늘 특가 맞죠? 🔥',
    ];
    let idx = 0;
    const interval = setInterval(() => {
      const username = `user_${Math.floor(Math.random() * 999)}`;
      const newMsg: ChatMessage = {
        id: `auto-${Date.now()}-${Math.random()}`,
        userId: `auto-u-${idx}`,
        username,
        message: autoMessages[idx % autoMessages.length],
        timestamp: new Date(),
        isDeleted: false,
      };
      setMessages((prev) => [...prev.slice(-30), newMsg]);
      idx++;
    }, chatSpeed);
    return () => clearInterval(interval);
  }, [chatSpeed]);

  // 시뮬레이션: 장바구니 활동
  useEffect(() => {
    const interval = setInterval(() => {
      if (products.length === 0) return;
      const activity: CartActivity = {
        id: `ca-${Date.now()}`,
        userName: USER_NAMES[Math.floor(Math.random() * USER_NAMES.length)],
        userColor: USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)],
        productName: products[Math.floor(Math.random() * products.length)].name,
        timestamp: new Date().toISOString(),
      };
      setCartActivities((prev) => [...prev, activity]);
    }, 6000);
    return () => clearInterval(interval);
  }, [products]);

  // Pulse 리셋
  useEffect(() => {
    if (showViewerPulse) {
      const timeout = setTimeout(() => setShowViewerPulse(false), 800);
      return () => clearTimeout(timeout);
    }
  }, [showViewerPulse]);

  // activeProduct 동기화 — products 변경 시 현재 선택 유지, 없으면 첫 번째로 fallback
  useEffect(() => {
    setActiveProduct((prev) => {
      if (!prev && products.length > 0) return products[0];
      if (prev && !products.find((p) => p.id === prev.id)) return products[0] ?? null;
      return products.find((p) => p.id === prev?.id) ?? prev;
    });
  }, [products]);

  const handleSendMessage = (message: string) => {
    if (!message.trim()) return;
    const newMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      userId: 'me',
      username: 'me',
      message,
      timestamp: new Date(),
      isDeleted: false,
    };
    setMessages((prev) => [...prev.slice(-30), newMsg]);
  };

  const handleAddToCart = async (
    productId: string,
    quantity: number = 1,
    selectedColor?: string,
    selectedSize?: string,
  ) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setCartCount((prev) => prev + quantity);
    const activity: CartActivity = {
      id: `ca-me-${Date.now()}`,
      userName: '나',
      userColor: '#FF007A',
      productName: product.name,
      timestamp: new Date().toISOString(),
    };
    setCartActivities((prev) => [...prev, activity]);
    const options = [selectedColor, selectedSize].filter(Boolean).join(', ');
    showToast(`${product.name}${options ? ` (${options})` : ''} 장바구니에 담았어요!`, 'success');

    // Update TanStack Query cart cache so LiveCartSheet reflects mock adds
    queryClient.setQueryData<CartSummary>(cartKeys.summary(), (prev) => {
      const currentItems = prev?.items ?? [];
      const existingIdx = currentItems.findIndex(
        (item) =>
          item.productId === productId &&
          item.color === selectedColor &&
          item.size === selectedSize,
      );
      let updatedItems;
      if (existingIdx >= 0) {
        updatedItems = currentItems.map((item, i) =>
          i === existingIdx
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: item.price * (item.quantity + 1),
                total: item.price * (item.quantity + 1),
              }
            : item,
        );
      } else {
        const newItem = {
          id: `mock-${Date.now()}`,
          productId,
          productName: product.name,
          price: product.price,
          quantity: 1,
          color: selectedColor,
          size: selectedSize,
          shippingFee: product.shippingFee ?? 0,
          timerEnabled: product.timerEnabled,
          expiresAt: product.timerEnabled
            ? new Date(Date.now() + product.timerDuration * 60 * 1000).toISOString()
            : undefined,
          status: 'ACTIVE' as const,
          subtotal: product.price,
          total: product.price,
          remainingSeconds: product.timerEnabled ? product.timerDuration * 60 : undefined,
          product: { imageUrl: product.imageUrl, status: 'AVAILABLE' as const },
        };
        updatedItems = [...currentItems, newItem];
      }
      const grandTotal = updatedItems.reduce((sum, item) => sum + item.subtotal, 0);
      return {
        items: updatedItems,
        itemCount: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: String(grandTotal),
        totalShippingFee: '0',
        grandTotal: String(grandTotal),
      };
    });
  };

  const handleProductClick = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      setIsModalOpen(true);
    }
  };

  const handleShare = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      navigator
        .share({ title: STREAM_TITLE, text: `${STREAM_TITLE} - 도레LIVE`, url })
        .catch(() => {
          navigator.clipboard.writeText(url);
          showToast('링크가 복사되었습니다!', 'success');
        });
    } else {
      navigator.clipboard.writeText(url);
      showToast('링크가 복사되었습니다!', 'success');
    }
  };

  // ── TestControlPanel Handlers ──
  const handleBulkChat = (count: number) => {
    const bulkMessages: ChatMessage[] = Array.from({ length: count }, (_, i) => ({
      id: `bulk-${Date.now()}-${i}`,
      userId: `bulk-u-${i}`,
      username: `stress_${Math.floor(Math.random() * 9999)}`,
      message: `부하 테스트 메시지 #${i + 1} 🔥`,
      timestamp: new Date(Date.now() + i),
      isDeleted: false,
    }));
    setMessages((prev) => [...prev.slice(-(30 - count)), ...bulkMessages].slice(-30));
    showToast(`채팅 ${count}개 생성 완료`, 'success');
  };

  const handleSendLongMessage = () => {
    const longMsg: ChatMessage = {
      id: `long-${Date.now()}`,
      userId: 'long-test',
      username: 'long_message_tester',
      message:
        '이것은 200자 긴 메시지 테스트입니다. 라이브 커머스 채팅에서 긴 메시지가 어떻게 표시되는지 확인하기 위한 테스트 메시지입니다. 줄바꿈 없이 긴 텍스트가 채팅 영역에서 올바르게 처리되는지, 말줄임이 되는지, 레이아웃이 깨지지 않는지를 확인합니다. 끝까지 잘 보이나요? 테스트 완료! 🎉',
      timestamp: new Date(),
      isDeleted: false,
    };
    setMessages((prev) => [...prev.slice(-29), longMsg]);
  };

  const handleUpdateProduct = (index: number, updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p,
      ),
    );
  };

  const handleAddProduct = () => {
    const id = String(nextProductId++);
    const newProduct: Product = {
      id,
      streamKey: 'preview',
      name: `테스트 상품 #${id}`,
      price: Math.floor(Math.random() * 90000) + 10000,
      imageUrl: `https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80`,
      stock: 20,
      colorOptions: ['블랙', '화이트'],
      sizeOptions: ['S', 'M', 'L'],
      shippingFee: 3000,
      timerEnabled: false,
      timerDuration: 10,
      isNew: true,
      status: ProductStatus.AVAILABLE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProducts((prev) => [...prev, newProduct]);
    showToast(`${newProduct.name} 추가됨`, 'success');
  };

  const handleRemoveProduct = (index: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#FF007A]/20 border-t-[#FF007A] rounded-full animate-spin" />
      </div>
    );
  }

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
        <div className="p-4 space-y-4">
          {products.map((p) => (
            <div
              key={p.id}
              onClick={() => handleProductClick(p.id)}
              className={`flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer border-l-2 ${p.id === activeProduct?.id ? 'bg-[#FF007A]/10 border-[#FF007A]' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-content-bg">
                {/* eslint-disable-next-line */}
                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{p.name}</p>
                {p.discountRate && p.discountRate > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/40 text-xs line-through">
                      {formatPrice(p.originalPrice || p.price)}
                    </span>
                    <span className="text-[#FF007A] font-black text-base">
                      {formatPrice(
                        Math.round((p.originalPrice || p.price) * (1 - p.discountRate / 100)),
                      )}
                    </span>
                  </div>
                ) : (
                  <p className="text-[#FF007A] font-black text-base">{formatPrice(p.price)}</p>
                )}
                <p className="text-white/40 text-xs">재고 {p.stock}개</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── MOBILE: fullscreen overlay layout ── */}
      <div className="relative flex lg:hidden w-full h-screen overflow-hidden bg-black">
        {/* 0. Mock video — fullscreen background */}
        <div className="absolute inset-0 z-0 bg-[#12121e]">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -left-20 w-72 h-72 bg-[#FF007A]/10 rounded-full blur-3xl animate-pulse" />
            <div
              className="absolute -bottom-32 -right-20 w-96 h-96 bg-[#7928CA]/10 rounded-full blur-3xl animate-pulse"
              style={{ animationDelay: '1s' }}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center z-10">
              <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-white/30 text-xs font-medium">LIVE PREVIEW</p>
            </div>
          </div>
        </div>

        {/* 1. Top bar */}
        <div className="absolute top-0 left-0 right-0 z-30">
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-transparent h-32 pointer-events-none" />
          <div className="relative px-4 pt-12 pb-4 flex items-center justify-between">
            {/* Left: profile + name + LIVE + viewers */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7928CA] to-[#FF007A] flex items-center justify-center flex-shrink-0 border-2 border-white/30">
                <span className="text-white text-sm font-black">D</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white text-sm font-medium line-clamp-1">
                    {STREAM_TITLE}
                  </span>
                  <div className="flex items-center gap-1 bg-red-500 px-2 py-0.5 rounded flex-shrink-0">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-[10px] uppercase tracking-wider">LIVE</span>
                  </div>
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
              {products.length}개
            </span>
            <span className="text-white/70 text-[9px] drop-shadow-lg">지난상품</span>
          </button>
        </div>

        {/* 4. Chat messages — absolute overlay */}
        <div className="absolute left-4 bottom-[160px] z-10 w-[70%] space-y-1.5">
          <ChatMessageList messages={allMessages} compact maxMessages={4} />
        </div>

        {/* 5. Featured product card — glassmorphism */}
        {activeProduct && (
          <div className="absolute left-4 bottom-[90px] z-20 w-[65%]">
            <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-1.5 shadow-2xl">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 rounded-md bg-white overflow-hidden flex-shrink-0 shadow-lg">
                  {activeProduct.imageUrl ? (
                    // eslint-disable-next-line
                    <img
                      src={activeProduct.imageUrl}
                      alt={activeProduct.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <Package className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white text-[10px] font-medium mb-0.5 line-clamp-1">
                    {activeProduct.name}
                  </h3>
                  <div className="flex items-baseline gap-0.5">
                    {activeProduct.discountRate != null && activeProduct.discountRate > 0 && (
                      <span className="text-rose-400 text-[9px]">
                        {activeProduct.discountRate}%
                      </span>
                    )}
                    <span className="text-white text-[11px] font-medium">
                      {formatPrice(activeProduct.price)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleAddToCart(activeProduct.id)}
                  className="bg-white text-black px-3 py-1.5 rounded-md text-[10px] hover:opacity-90 transition-all active:scale-95 whitespace-nowrap shadow-lg flex-shrink-0"
                >
                  구매하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. Bottom bar: chat input + CTA */}
        <div
          className="absolute bottom-0 left-0 right-0 z-10 px-4 pt-3"
          style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-black/30 backdrop-blur-md rounded-full px-4 py-3 border border-white/10">
              <input
                type="text"
                value={mobileInputMessage}
                onChange={(e) => setMobileInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && mobileInputMessage.trim()) {
                    handleSendMessage(mobileInputMessage);
                    setMobileInputMessage('');
                  }
                }}
                placeholder="메시지를 입력하세요..."
                className="w-full bg-transparent text-white text-sm placeholder:text-white/50 focus:outline-none"
              />
            </div>
            <button
              onClick={() => activeProduct && handleAddToCart(activeProduct.id)}
              disabled={!activeProduct}
              className="flex-shrink-0 bg-gradient-to-r from-[#FF007A] to-[#FF4E50] px-5 py-3 rounded-full flex items-center gap-2 transition-all active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="구매하기"
            >
              <ShoppingCart className="w-5 h-5 text-white" />
              <span className="text-white text-sm font-medium whitespace-nowrap">구매하기</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Desktop: flex-col wrapper (video+chat row + featured bar) ── */}
      <div className="hidden lg:flex flex-1 flex-col min-h-0">
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Center: Video + overlays */}
          <div className="flex flex-1 relative items-center justify-center">
            <div className="relative w-full h-full lg:max-w-[480px] lg:h-full bg-black">
              {/* Desktop top gradient scrim */}
              <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
              {/* Desktop bottom gradient scrim */}
              <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black/70 to-transparent z-10 pointer-events-none" />
              {/* Mock video */}
              <div className="w-full h-full bg-white flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute -top-20 -left-20 w-72 h-72 bg-[#FF007A]/10 rounded-full blur-3xl animate-pulse" />
                  <div
                    className="absolute -bottom-32 -right-20 w-96 h-96 bg-[#7928CA]/10 rounded-full blur-3xl animate-pulse"
                    style={{ animationDelay: '1s' }}
                  />
                  <div
                    className="absolute top-1/3 left-1/2 w-48 h-48 bg-[#FF007A]/5 rounded-full blur-2xl animate-pulse"
                    style={{ animationDelay: '2s' }}
                  />
                </div>
                <div className="text-center z-10">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-white/30"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <p className="text-white/30 text-sm font-medium">LIVE PREVIEW</p>
                  <p className="text-white/15 text-xs mt-1">
                    백엔드 연결 시 실제 영상이 표시됩니다
                  </p>
                </div>
              </div>

              {/* ═══ DESKTOP TOP BAR ═══ */}
              <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between">
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

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-[#FF3B30] px-3.5 py-1.5 rounded-full shadow-[0_0_20px_rgba(255,59,48,0.4)]">
                    <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                    </span>
                    <span className="text-white text-xs font-black tracking-wider">LIVE</span>
                  </div>
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

                <button
                  onClick={handleShare}
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
                  {STREAM_TITLE}
                </h1>
              </div>

              {/* STAGING PREVIEW badge */}
              <div className="absolute top-[96px] left-4 z-20">
                <span className="bg-amber-500/80 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
                  STAGING PREVIEW
                </span>
              </div>
            </div>
          </div>

          {/* Right: Chat Panel (same structure as real page) */}
          <div className="flex w-[320px] flex-col bg-[#12121e] border-l border-white/5">
            <ChatHeader userCount={viewerCount} isConnected={true} compact={false} />
            <ChatMessageList messages={allMessages} compact={false} />
            <LiveQuickActionBar
              streamTitle={STREAM_TITLE}
              onCartOpen={() => setIsCartSheetOpen(true)}
              cartCount={cartCount}
            />
            <ChatInput
              ref={desktopInputRef}
              onSendMessage={handleSendMessage}
              disabled={false}
              compact={false}
            />
          </div>
        </div>

        {/* Bottom: Active Product Bar */}
        {activeProduct && (
          <div
            className="w-full bg-[#12121e]/95 backdrop-blur-md border-t border-white/10 p-4 cursor-pointer hover:bg-[#1a1a2e] transition-colors"
            onClick={() => handleProductClick(activeProduct.id)}
          >
            <div className="flex items-center gap-4 max-w-screen-xl mx-auto">
              <div className="relative w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-white/5">
                {/* eslint-disable-next-line */}
                <img
                  src={activeProduct.imageUrl}
                  alt={activeProduct.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm text-white font-semibold truncate">{activeProduct.name}</h3>
                <div className="flex items-center gap-2">
                  {activeProduct.discountRate && activeProduct.discountRate > 0 ? (
                    <>
                      <span className="text-white/40 text-xs line-through">
                        {formatPrice(activeProduct.originalPrice ?? activeProduct.price)}
                      </span>
                      <span className="text-xs text-red-400 font-bold">
                        {activeProduct.discountRate}%
                      </span>
                      <p className="text-lg text-[#FF007A] font-bold">
                        {formatPrice(
                          Math.round(
                            (activeProduct.originalPrice ?? activeProduct.price) *
                              (1 - activeProduct.discountRate / 100),
                          ),
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="text-lg text-[#FF007A] font-bold">
                      {formatPrice(activeProduct.price)}
                    </p>
                  )}
                  <p className="text-xs text-white/40">재고 {activeProduct.stock}</p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddToCart(activeProduct.id);
                }}
                className="px-6 py-2 bg-hot-pink text-white rounded-full hover:bg-hot-pink/80 transition-colors font-semibold"
              >
                구매하기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Product List Bottom Sheet */}
      <ProductListBottomSheet
        isOpen={isProductSheetOpen}
        onClose={() => setIsProductSheetOpen(false)}
        products={products}
        activeProductId={activeProduct?.id ?? null}
        onSelectProduct={(p) => setActiveProduct(p)}
      />

      {/* Cart Sheet */}
      <LiveCartSheet isOpen={isCartSheetOpen} onClose={() => setIsCartSheetOpen(false)} />

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Notice Modal */}
      <NoticeModal isOpen={isNoticeOpen} onClose={() => setIsNoticeOpen(false)} />

      {/* Inquiry Bottom Sheet */}
      <InquiryBottomSheet isOpen={isInquiryOpen} onClose={() => setIsInquiryOpen(false)} />

      {/* QA Test Control Panel */}
      <TestControlPanel
        onBulkChat={handleBulkChat}
        onSetChatSpeed={setChatSpeed}
        onSendLongMessage={handleSendLongMessage}
        onUpdateProduct={handleUpdateProduct}
        onAddProduct={handleAddProduct}
        onRemoveProduct={handleRemoveProduct}
        cartCount={cartCount}
        onResetCart={() => {
          setCartCount(0);
          queryClient.setQueryData<CartSummary>(cartKeys.summary(), {
            items: [],
            itemCount: 0,
            subtotal: '0',
            totalShippingFee: '0',
            grandTotal: '0',
          });
        }}
        onShare={handleShare}
        chatSpeed={chatSpeed}
        products={products}
      />
    </div>
  );
}
