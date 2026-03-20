'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { cartKeys } from '@/lib/hooks/queries/use-cart';
import type { CartSummary } from '@/lib/hooks/queries/use-cart';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatInput, { ChatInputHandle } from '@/components/chat/ChatInput';
import type { CartActivity } from '@/components/live/CartActivityFeed';
import ProductDetailModal from '@/components/product/ProductDetailModal';
import ProductList from '@/components/product/ProductList';
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
import { useIsMobile } from '@/hooks/useIsMobile';
import { NoticeModal } from '@/components/notices/NoticeModal';
import { InquiryBottomSheet } from '@/components/inquiry/InquiryBottomSheet';
import {
  Eye,
  Zap,
  Bell,
  Volume2,
  VolumeX,
  MessageCircle,
  Share2,
  ShoppingCart,
  Package,
  X,
} from 'lucide-react';

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
    name: '트렌디 오버핏 블레이저',
    price: 89000,
    originalPrice: 129000,
    discountRate: 31,
    imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500&q=80',
    stock: 15,
    colorOptions: ['블랙', '베이지', '네이비'],
    sizeOptions: ['S', 'M', 'L', 'XL'],
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
    name: '캐시미어 터틀넥 니트',
    price: 62300,
    originalPrice: 89000,
    discountRate: 30,
    imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=500&q=80',
    stock: 25,
    colorOptions: ['아이보리', '그레이', '카멜'],
    sizeOptions: ['FREE'],
    shippingFee: 0,
    freeShippingMessage: '무료배송',
    timerEnabled: true,
    timerDuration: 10,
    isNew: false,
    status: ProductStatus.AVAILABLE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    streamKey: 'preview',
    name: '리얼 레더 미니 크로스백',
    price: 129000,
    originalPrice: 159000,
    discountRate: 19,
    imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&q=80',
    stock: 8,
    colorOptions: ['블랙', '탄', '버건디'],
    sizeOptions: [],
    shippingFee: 0,
    freeShippingMessage: '무료배송',
    timerEnabled: false,
    timerDuration: 10,
    isNew: true,
    status: ProductStatus.AVAILABLE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    streamKey: 'preview',
    name: '하이웨스트 와이드 데님',
    price: 54900,
    imageUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500&q=80',
    stock: 30,
    colorOptions: ['라이트블루', '딥블루', '블랙'],
    sizeOptions: ['S', 'M', 'L'],
    shippingFee: 3000,
    timerEnabled: false,
    timerDuration: 10,
    isNew: false,
    status: ProductStatus.AVAILABLE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '5',
    streamKey: 'preview',
    name: '소프트 울 체크 머플러',
    price: 39000,
    originalPrice: 55000,
    discountRate: 29,
    imageUrl: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=500&q=80',
    stock: 50,
    colorOptions: ['베이지체크', '그레이체크', '네이비체크'],
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
  {
    id: '6',
    streamKey: 'preview',
    name: '프리미엄 실크 블라우스',
    price: 78000,
    imageUrl: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=500&q=80',
    stock: 12,
    colorOptions: ['화이트', '핑크', '스카이블루'],
    sizeOptions: ['S', 'M', 'L'],
    shippingFee: 3000,
    timerEnabled: false,
    timerDuration: 10,
    isNew: true,
    status: ProductStatus.AVAILABLE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '7',
    streamKey: 'preview',
    name: '빈티지 골드 이어링 세트',
    price: 28000,
    originalPrice: 42000,
    discountRate: 33,
    imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500&q=80',
    stock: 40,
    colorOptions: ['골드', '실버', '로즈골드'],
    sizeOptions: [],
    shippingFee: 0,
    freeShippingMessage: '무료배송',
    timerEnabled: false,
    timerDuration: 10,
    isNew: false,
    status: ProductStatus.AVAILABLE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '8',
    streamKey: 'preview',
    name: '코지 플리스 집업 자켓',
    price: 69000,
    imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&q=80',
    stock: 0,
    colorOptions: ['크림', '차콜', '카키'],
    sizeOptions: ['M', 'L', 'XL'],
    shippingFee: 3000,
    timerEnabled: false,
    timerDuration: 10,
    isNew: false,
    status: ProductStatus.SOLD_OUT,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '9',
    streamKey: 'preview',
    name: '데일리 코튼 티셔츠 3팩',
    price: 35000,
    originalPrice: 54000,
    discountRate: 35,
    imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80',
    stock: 100,
    colorOptions: ['화이트+블랙+그레이', '네이비+베이지+카키'],
    sizeOptions: ['S', 'M', 'L', 'XL'],
    shippingFee: 0,
    freeShippingMessage: '무료배송',
    timerEnabled: true,
    timerDuration: 10,
    isNew: false,
    status: ProductStatus.AVAILABLE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '10',
    streamKey: 'preview',
    name: '스트릿 캔버스 스니커즈',
    price: 89000,
    imageUrl: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=500&q=80',
    stock: 18,
    colorOptions: ['화이트', '블랙', '레드'],
    sizeOptions: ['230', '240', '250', '260', '270'],
    shippingFee: 0,
    freeShippingMessage: '무료배송',
    timerEnabled: false,
    timerDuration: 10,
    isNew: true,
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
    productName: '트렌디 오버핏 블레이저',
    timestamp: new Date().toISOString(),
  },
];

const USER_COLORS = ['#FF007A', '#7928CA', '#FF6B35', '#00D4AA', '#4A90D9'];
const USER_NAMES = ['민지', '수현', '하은', '지우', '서연', '예린', '소희'];

let nextProductId = 11;

const STREAM_TITLE = '도레미 라이브 커머스 미리보기';
const PREVIEW_STREAM_KEY =
  process.env.NEXT_PUBLIC_PREVIEW_STREAM_KEY || '9fadba4785ad48d73f559dd3d9cf108f';

export default function LivePreviewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile(1024);
  const [isMobileReady, setIsMobileReady] = useState(false);
  const mobileInputRef = useRef<ChatInputHandle>(null);
  const desktopInputRef = useRef<ChatInputHandle>(null);
  const startedAtRef = useRef(new Date());
  const { showToast } = useToast();

  useEffect(() => {
    setIsMobileReady(true);
  }, []);

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
  const [mobileMessage, setMobileMessage] = useState('');
  const [mobileVolume, setMobileVolume] = useState(1);
  const [isVolumeControlOpen, setIsVolumeControlOpen] = useState(false);
  const [purchaseNotif, setPurchaseNotif] = useState<string | null>(null);
  const purchaseNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mock notice text
  const [mockNoticeText] = useState<string | null>(
    '지금 방송 한정 전 상품 무료배송! 놓치지 마세요 🎁',
  );

  const isMobileMuted = mobileVolume <= 0;
  const mobileVolumePercent = Math.round(mobileVolume * 100);

  // ── Keyboard detection via visualViewport ──
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

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

  // 시뮬레이션: 구매 알림
  useEffect(() => {
    const interval = setInterval(() => {
      if (products.length === 0) return;
      const name = USER_NAMES[Math.floor(Math.random() * USER_NAMES.length)];
      const product = products[Math.floor(Math.random() * products.length)];
      setPurchaseNotif(`${name}님이 ${product.name}을 구매했습니다!`);
      if (purchaseNotifTimerRef.current) clearTimeout(purchaseNotifTimerRef.current);
      purchaseNotifTimerRef.current = setTimeout(() => setPurchaseNotif(null), 4000);
    }, 15000);
    return () => {
      clearInterval(interval);
      if (purchaseNotifTimerRef.current) clearTimeout(purchaseNotifTimerRef.current);
    };
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

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleProductSelectFromSheet = (product: Product) => {
    setActiveProduct(product);
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

  if (!isAllowed || !isMobileReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#FF007A]/20 border-t-[#FF007A] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="live-fullscreen w-full bg-[#0d0d18] lg:h-screen lg:flex lg:overflow-hidden">
      {/* ── Left: Product List — Desktop only (matches live page) ── */}
      {!isMobile && (
        <aside className="w-[260px] xl:w-[300px] h-full overflow-y-auto bg-[#12121e] border-r border-white/5">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-white font-black text-lg flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-[#FF007A] to-[#7928CA]"></span>
              상품 목록
            </h2>
          </div>
          <ProductList
            streamKey="preview"
            onProductClick={handleProductClick}
            products={products}
          />
        </aside>
      )}

      {/* ── MOBILE: fullscreen overlay layout (matches live page exactly) ── */}
      {isMobile && (
        <div
          className="relative w-full h-[100dvh] overflow-hidden bg-black"
          style={{ '--kb': `${keyboardOffset}px` } as React.CSSProperties}
        >
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

          {/* 1. Top bar (matches live page structure) */}
          <div className="absolute top-0 left-0 right-0 z-30">
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
                    className="object-contain w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-white text-[13px] xs:text-sm font-medium line-clamp-1">
                      {STREAM_TITLE}
                    </span>
                    <div className="flex items-center gap-1 bg-red-500 px-1.5 xs:px-2 py-0.5 rounded flex-shrink-0">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      <span className="text-white text-[9px] uppercase tracking-wider">LIVE</span>
                    </div>
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
                    <span className="text-white text-[8px] xs:text-[9px] drop-shadow-lg">소리</span>
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

          {/* 2. Notice banner */}
          {mockNoticeText && (
            <div
              className="absolute left-0 right-0 z-20 bg-[rgba(255,100,100,0.85)] px-2.5 xs:px-3 py-1.5 overflow-hidden"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 60px)' }}
            >
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-white flex-shrink-0" />
                <div className="overflow-hidden flex-1">
                  <div className="notice-track text-white text-[11px] xs:text-xs font-medium">
                    <span className="pr-10">{mockNoticeText}</span>
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
              onClick={() => setIsProductSheetOpen(true)}
              className="flex flex-col items-center gap-1"
              aria-label="지난 상품 목록"
            >
              <div className="w-10 h-10 xs:w-12 xs:h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all active:scale-95">
                <Package className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-white" />
              </div>
              <span className="text-white text-[10px] xs:text-xs font-medium drop-shadow-lg">
                {products.length}개
              </span>
              <span className="text-white/70 text-[8px] xs:text-[9px] drop-shadow-lg">
                지난상품
              </span>
            </button>
          </div>

          {/* 4. Chat messages — absolute overlay */}
          <div
            className="absolute left-3 xs:left-4 right-[72px] xs:right-[84px] sm:right-[100px] z-10 max-h-[40vh]"
            style={{ bottom: 'calc(166px + env(safe-area-inset-bottom, 0px) + var(--kb, 0px))' }}
          >
            {/* Top gradient fade */}
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-10" />
            <ChatMessageList messages={allMessages} compact />
          </div>

          {/* 5. Featured product card — glassmorphism */}
          {activeProduct && (
            <div
              className="absolute left-3 xs:left-4 right-[72px] xs:right-[84px] sm:right-[100px] z-20"
              style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px) + var(--kb, 0px))' }}
            >
              <div className="bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 p-1.5 shadow-2xl">
                <div className="flex items-center gap-2">
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-md bg-white overflow-hidden flex-shrink-0 shadow-lg">
                    {activeProduct.imageUrl ? (
                      <Image
                        src={activeProduct.imageUrl}
                        alt={activeProduct.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                        unoptimized={activeProduct.imageUrl.startsWith('/uploads/')}
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
                  {/* Buy button */}
                  <button
                    onClick={() =>
                      activeProduct.status !== ProductStatus.SOLD_OUT &&
                      handleProductClick(activeProduct)
                    }
                    disabled={activeProduct.status === ProductStatus.SOLD_OUT}
                    className="bg-white text-black px-3 py-1.5 rounded-md text-[10px] hover:opacity-90 transition-all active:scale-95 whitespace-nowrap shadow-lg flex-shrink-0 disabled:bg-gray-400 disabled:text-white disabled:cursor-not-allowed"
                  >
                    {activeProduct.status === ProductStatus.SOLD_OUT ? '품절' : '구매하기'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 6. Bottom bar: chat input + CTA */}
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
                      handleSendMessage(mobileMessage);
                      setMobileMessage('');
                    }
                  }}
                  placeholder="메시지를 입력하세요..."
                  className="w-full bg-transparent text-white text-[13px] xs:text-sm placeholder:text-white/50 focus:outline-none"
                />
              </div>
              {/* Purchase CTA */}
              <button
                onClick={() =>
                  activeProduct &&
                  activeProduct.status !== ProductStatus.SOLD_OUT &&
                  handleProductClick(activeProduct)
                }
                disabled={!activeProduct || activeProduct.status === ProductStatus.SOLD_OUT}
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
        </div>
      )}

      {/* ── Desktop: flex-col wrapper (video+chat row + featured bar) ── */}
      {!isMobile && (
        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Center: Video + overlays */}
            <div className="flex flex-1 relative items-center justify-center">
              <div className="relative w-full h-full lg:max-w-[560px] xl:max-w-[640px] 2xl:max-w-[720px] lg:h-full bg-black overflow-hidden">
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

                  {/* Share button */}
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

            {/* Right: Chat Panel (matches live page structure) */}
            <div className="flex w-[320px] min-h-0 flex-col bg-transparent border-l border-white/5">
              <ChatHeader userCount={viewerCount} isConnected={true} compact={false} />
              <ChatMessageList messages={allMessages} compact={false} />
              <LiveQuickActionBar
                streamTitle={STREAM_TITLE}
                onNotice={() => setIsNoticeOpen(true)}
                onCartOpen={() => setIsCartSheetOpen(true)}
                cartCount={cartCount}
                onInquiry={() => setIsInquiryOpen(true)}
              />
              <ChatInput
                ref={desktopInputRef}
                onSendMessage={handleSendMessage}
                disabled={false}
                compact={false}
              />
            </div>
          </div>

          {/* Bottom: Featured & Past Products Sections (matches live page) */}
          <div className="w-full flex flex-col gap-8 bg-content-bg/50 border-t border-border-color p-6">
            {/* Featured Products Section */}
            {products.length > 0 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-primary-text">인기 상품</h3>
                  <p className="text-sm text-secondary-text">지금 라이브에서 인기 있는 상품</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {products.slice(0, 5).map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleProductClick(product)}
                      className="group text-left hover:opacity-80 transition-opacity"
                    >
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-200 mb-2">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            unoptimized={product.imageUrl.startsWith('/uploads/')}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-medium text-primary-text truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-secondary-text">{formatPrice(product.price)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Past Products Section */}
            {products.length > 5 && (
              <div className="space-y-4 border-t border-border-color pt-6">
                <div>
                  <h3 className="text-xl font-bold text-primary-text">지난 상품</h3>
                  <p className="text-sm text-secondary-text">이전에 소개한 상품들</p>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {products.slice(5).map((product) => (
                      <button
                        key={product.id}
                        onClick={() => handleProductClick(product)}
                        className="group text-left hover:opacity-80 transition-opacity"
                      >
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-200 mb-2">
                          {product.imageUrl ? (
                            <Image
                              src={product.imageUrl}
                              alt={product.name}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              unoptimized={product.imageUrl.startsWith('/uploads/')}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                              <Package className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm font-medium text-primary-text truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-secondary-text">{formatPrice(product.price)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product List Bottom Sheet */}
      <ProductListBottomSheet
        isOpen={isProductSheetOpen}
        onClose={() => setIsProductSheetOpen(false)}
        products={products}
        activeProductId={activeProduct?.id ?? null}
        onSelectProduct={handleProductSelectFromSheet}
        onAddToCart={(p) => {
          setIsProductSheetOpen(false);
          handleProductClick(p);
        }}
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
