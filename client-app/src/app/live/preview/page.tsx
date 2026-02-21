'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatInput, { ChatInputHandle } from '@/components/chat/ChatInput';

import CartActivityFeed, { CartActivity } from '@/components/live/CartActivityFeed';
import ProductDetailModal from '@/components/product/ProductDetailModal';
import TestControlPanel from './TestControlPanel';
import { useToast } from '@/components/common/Toast';
import type { ChatMessage } from '@/components/chat/types';
import type { Product } from '@/lib/types/product';
import { ProductStatus } from '@live-commerce/shared-types';
import { formatPrice } from '@/lib/utils/price';

// ── staging / dev 전용 (런타임 체크 — DCE 방지) ──

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

export default function LivePreviewPage() {
  const router = useRouter();
  const inputRef = useRef<ChatInputHandle>(null);
  const { showToast } = useToast();

  // 런타임에 preview 접근 허가 여부 체크 (빌드 시 DCE 방지)
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development';
    const previewEnabled = String(process.env.NEXT_PUBLIC_PREVIEW_ENABLED || '') === 'true';
    if (isDev || previewEnabled) {
      setIsAllowed(true);
    } else {
      router.replace('/');
    }
  }, [router]);

  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
  const [cartActivities, setCartActivities] = useState<CartActivity[]>(MOCK_CART_ACTIVITIES);
  const [viewerCount, setViewerCount] = useState(147);
  const [showViewerPulse, setShowViewerPulse] = useState(false);
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [chatSpeed, setChatSpeed] = useState(3500);
  const [cartCount, setCartCount] = useState(0);

  // Product detail modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  // 시뮬레이션: 자동 채팅 메시지 (chatSpeed로 제어)
  useEffect(() => {
    if (chatSpeed === 0) return; // 정지 상태

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

  const handleAddToCart = (productId: string, selectedColor?: string, selectedSize?: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setCartCount((prev) => prev + 1);

    // 장바구니 활동 피드에 추가
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
  };

  const handleProductClick = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      setIsModalOpen(true);
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

  // 접근 허가 대기 중 로딩 표시
  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#FF007A]/20 border-t-[#FF007A] rounded-full animate-spin" />
      </div>
    );
  }

  const handleShare = () => {
    const shareData = {
      title: 'Doremi Live Commerce',
      text: '도레미 라이브 커머스에서 특별한 쇼핑을 만나보세요!',
      url: window.location.href,
    };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {
        navigator.clipboard.writeText(window.location.href);
        showToast('링크가 복사되었습니다!', 'success');
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('링크가 복사되었습니다!', 'success');
    }
  };

  return (
    <div className="live-fullscreen w-full h-screen flex bg-black overflow-hidden">
      {/* Left: Product List - Desktop Only */}
      <aside className="hidden lg:block w-[300px] h-full overflow-y-auto bg-primary-black border-r border-border-color">
        <div className="p-4 border-b border-border-color">
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
              className="flex items-center gap-3 p-3 rounded-2xl bg-content-bg hover:bg-border-color transition-all cursor-pointer"
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

      {/* Center: Video Container */}
      <div className="flex-1 relative flex items-center justify-center">
        <div className="relative w-full h-full lg:max-w-[480px] lg:h-full bg-black">
          {/* ── Mock Video Player ── */}
          <div className="w-full h-full bg-white flex items-center justify-center relative overflow-hidden">
            {/* Animated background circles */}
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
                <svg className="w-10 h-10 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-white/30 text-sm font-medium">LIVE PREVIEW</p>
              <p className="text-white/15 text-xs mt-1">백엔드 연결 시 실제 영상이 표시됩니다</p>
            </div>
          </div>

          {/* ═══ TOP BAR ═══ */}
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
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[#FF3B30] px-3.5 py-1.5 rounded-full shadow-[0_0_20px_rgba(255,59,48,0.4)]">
                <span className="relative flex h-2.5 w-2.5">
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
                <span className="text-white text-xs font-bold">{viewerCount.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={() => {
                const shareData = {
                  title: 'Doremi Live Commerce',
                  text: '도레미 라이브 커머스에서 특별한 쇼핑을 만나보세요!',
                  url: window.location.href,
                };
                if (navigator.share) {
                  navigator.share(shareData).catch(() => {
                    navigator.clipboard.writeText(window.location.href);
                    showToast('링크가 복사되었습니다!', 'success');
                  });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  showToast('링크가 복사되었습니다!', 'success');
                }
              }}
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
              도레미 라이브 커머스 미리보기
            </h1>
          </div>

          {/* ═══ PREVIEW 배지 ═══ */}
          <div className="absolute top-[96px] left-4 z-20">
            <span className="bg-amber-500/80 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
              STAGING PREVIEW
            </span>
          </div>

          {/* Cart Activity Feed — Desktop only */}
          <div className="hidden lg:block">
            <CartActivityFeed activities={cartActivities} />
          </div>

          {/* ═══ MOBILE: Layer 3 — Chat Overlay (on video, above product card) ═══ */}
          <div className="lg:hidden absolute left-0 right-0 bottom-[132px] z-[3] h-[200px] pointer-events-none overflow-hidden">
            {/* Fade-out at top so messages blend into video */}
            <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-black/40 to-transparent z-10 pointer-events-none" />
            <div className="h-full flex flex-col justify-end">
              <ChatMessageList messages={messages} compact maxMessages={15} />
            </div>
          </div>

          {/* ═══ MOBILE: Layer 4 — Product Card (fixed above input) ═══ */}
          {products.length > 0 && (
            <div className="lg:hidden absolute left-0 right-0 bottom-[52px] z-[4] px-3 pb-2 pointer-events-auto">
              <div
                className="bg-black/70 backdrop-blur-lg rounded-xl p-2.5 flex items-center gap-3 border border-white/10"
                onClick={() => handleProductClick(products[0].id)}
              >
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                  {/* eslint-disable-next-line */}
                  <img
                    src={products[0].imageUrl}
                    alt={products[0].name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{products[0].name}</p>
                  <div className="flex items-center gap-1.5">
                    {products[0].discountRate && products[0].discountRate > 0 ? (
                      <>
                        <span className="text-white/40 text-xs line-through">
                          {formatPrice(products[0].originalPrice || products[0].price)}
                        </span>
                        <span className="text-[#FF007A] font-bold text-sm">
                          {formatPrice(
                            Math.round(
                              (products[0].originalPrice || products[0].price) *
                                (1 - (products[0].discountRate || 0) / 100),
                            ),
                          )}
                        </span>
                      </>
                    ) : (
                      <span className="text-[#FF007A] font-bold text-sm">
                        {formatPrice(products[0].price)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToCart(products[0].id);
                  }}
                  className="bg-[#FF007A] hover:bg-[#E00070] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex-shrink-0"
                >
                  구매
                </button>
              </div>
            </div>
          )}

          {/* ═══ MOBILE: Layer 4 — Chat Input (fixed bottom) ═══ */}
          <div className="lg:hidden absolute left-0 right-0 bottom-0 z-[4] pointer-events-auto">
            <ChatInput ref={inputRef} onSendMessage={handleSendMessage} disabled={false} compact />
          </div>

          {/* ═══ CHAT - Desktop (Right Side) ═══ */}
          <div className="hidden lg:flex absolute top-0 right-0 w-[320px] h-full flex-col">
            <ChatHeader userCount={viewerCount} isConnected={true} compact={false} />
            <ChatMessageList messages={messages} compact={false} />
            <ChatInput
              ref={inputRef}
              onSendMessage={handleSendMessage}
              disabled={false}
              compact={false}
            />
          </div>
        </div>
      </div>

      {/* Bottom: Featured Product Bar — Desktop */}
      {products.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-primary-black/95 backdrop-blur-md border-t border-border-color p-4 z-20 cursor-pointer hover:bg-primary-black transition-colors lg:block hidden">
          <div
            className="flex items-center gap-4 max-w-screen-xl mx-auto"
            onClick={() => handleProductClick(products[0].id)}
          >
            <div className="relative w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-content-bg">
              {/* eslint-disable-next-line */}
              <img
                src={products[0].imageUrl}
                alt={products[0].name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm text-white font-semibold truncate">{products[0].name}</h3>
              <div className="flex items-center gap-2">
                {products[0].discountRate && products[0].discountRate > 0 ? (
                  <>
                    <span className="text-white/40 text-xs line-through">
                      {formatPrice(products[0].originalPrice || products[0].price)}
                    </span>
                    <p className="text-lg text-[#FF007A] font-bold">
                      {formatPrice(
                        Math.round(
                          (products[0].originalPrice || products[0].price) *
                            (1 - (products[0].discountRate || 0) / 100),
                        ),
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-lg text-[#FF007A] font-bold">
                    {formatPrice(products[0].price)}
                  </p>
                )}
                <p className="text-xs text-white/40">재고 {products[0].stock}</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddToCart(products[0].id);
              }}
              className="px-6 py-2 bg-[#FF007A] text-white rounded-full hover:bg-[#FF007A]/80 transition-colors font-semibold"
            >
              구매하기
            </button>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* QA Test Control Panel */}
      <TestControlPanel
        onBulkChat={handleBulkChat}
        onSetChatSpeed={setChatSpeed}
        onSendLongMessage={handleSendLongMessage}
        onUpdateProduct={handleUpdateProduct}
        onAddProduct={handleAddProduct}
        onRemoveProduct={handleRemoveProduct}
        cartCount={cartCount}
        onResetCart={() => setCartCount(0)}
        onShare={handleShare}
        chatSpeed={chatSpeed}
        products={products}
      />
    </div>
  );
}
