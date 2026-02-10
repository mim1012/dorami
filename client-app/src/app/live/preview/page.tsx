'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { redirect } from 'next/navigation';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatInput, { ChatInputHandle } from '@/components/chat/ChatInput';
import EmojiPicker from '@/components/chat/EmojiPicker';
import HeartAnimation from '@/components/live/HeartAnimation';
import CartActivityFeed, { CartActivity } from '@/components/live/CartActivityFeed';
import ProductBottomSheet from '@/components/live/ProductBottomSheet';
import type { ChatMessage } from '@/components/chat/types';

// ── staging / dev 전용 ──
// dev 환경은 항상 허용, production에서는 NEXT_PUBLIC_PREVIEW_ENABLED=true 일 때만 허용
const isAllowed =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_PREVIEW_ENABLED === 'true';

// ── Mock Data ──
const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    userId: 'u1',
    username: 'dorami_fan',
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
    username: 'dorami_fan',
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

const MOCK_PRODUCTS = [
  {
    id: '1',
    name: 'Chic Evening Bag',
    price: 129000,
    imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=200&q=80',
    stock: 10,
  },
  {
    id: '2',
    name: 'Pro Audio Pods',
    price: 62300,
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&q=80',
    stock: 25,
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
const PRODUCT_NAMES = ['Chic Evening Bag', 'Pro Audio Pods'];

export default function LivePreviewPage() {
  // 허용되지 않은 환경이면 리다이렉트
  if (!isAllowed) {
    redirect('/');
  }

  const router = useRouter();
  const inputRef = useRef<ChatInputHandle>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
  const [cartActivities, setCartActivities] = useState<CartActivity[]>(MOCK_CART_ACTIVITIES);
  const [viewerCount, setViewerCount] = useState(147);
  const [showViewerPulse, setShowViewerPulse] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

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
        id: `auto-${Date.now()}`,
        userId: `auto-u-${idx}`,
        username,
        message: autoMessages[idx % autoMessages.length],
        timestamp: new Date(),
        isDeleted: false,
      };
      setMessages((prev) => [...prev.slice(-30), newMsg]);
      idx++;
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  // 시뮬레이션: 장바구니 활동
  useEffect(() => {
    const interval = setInterval(() => {
      const activity: CartActivity = {
        id: `ca-${Date.now()}`,
        userName: USER_NAMES[Math.floor(Math.random() * USER_NAMES.length)],
        userColor: USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)],
        productName: PRODUCT_NAMES[Math.floor(Math.random() * PRODUCT_NAMES.length)],
        timestamp: new Date().toISOString(),
      };
      setCartActivities((prev) => [...prev, activity]);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

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
    setShowEmojiPicker(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    inputRef.current?.insertEmoji(emoji);
    setShowEmojiPicker(false);
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
        <div className="p-4 space-y-4">
          {MOCK_PRODUCTS.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{p.name}</p>
                <p className="text-[#FF007A] font-black text-base">{p.price.toLocaleString()}원</p>
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
          <div className="w-full h-full bg-gradient-to-br from-[#1a0a2e] via-[#16213e] to-[#0a0a0a] flex items-center justify-center relative overflow-hidden">
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

          {/* Top gradient overlay */}
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none z-10" />
          {/* Bottom gradient overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-10" />

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
              도라미 라이브 커머스 미리보기
            </h1>
          </div>

          {/* ═══ PREVIEW 배지 ═══ */}
          <div className="absolute top-[96px] left-4 z-20">
            <span className="bg-amber-500/80 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
              STAGING PREVIEW
            </span>
          </div>

          {/* Cart Activity Feed */}
          <CartActivityFeed activities={cartActivities} />

          {/* Heart Animation */}
          <HeartAnimation />

          {/* Product Bottom Sheet - Mobile */}
          <div className="lg:hidden">
            <ProductBottomSheet
              products={MOCK_PRODUCTS}
              onAddToCart={() => {}}
              streamKey="preview"
            />
          </div>

          {/* ═══ CHAT - Desktop (Right Side) ═══ */}
          <div className="hidden lg:flex absolute top-0 right-0 w-[320px] h-full bg-black/50 backdrop-blur-md border-l border-white/10 flex-col">
            <ChatHeader userCount={viewerCount} isConnected={true} compact={false} />
            <ChatMessageList messages={messages} compact={false} />
            {showEmojiPicker && (
              <EmojiPicker
                onEmojiSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
            <ChatInput
              ref={inputRef}
              onSendMessage={handleSendMessage}
              onToggleEmoji={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={false}
              compact={false}
              emojiPickerOpen={showEmojiPicker}
            />
          </div>

          {/* ═══ CHAT - Mobile (Bottom) ═══ */}
          <div className="lg:hidden absolute bottom-0 left-0 w-full h-[40vh] bg-black/50 backdrop-blur-md border-l border-white/10 flex flex-col">
            <ChatHeader userCount={viewerCount} isConnected={true} compact={true} />
            <ChatMessageList messages={messages} compact={true} maxMessages={20} />
            {showEmojiPicker && (
              <EmojiPicker
                onEmojiSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
            <ChatInput
              ref={inputRef}
              onSendMessage={handleSendMessage}
              onToggleEmoji={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={false}
              compact={true}
              emojiPickerOpen={showEmojiPicker}
            />
          </div>
        </div>
      </div>

      {/* Bottom: Mock Featured Product Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0A0A0A]/95 backdrop-blur-md border-t border-gray-800 p-4 z-20 cursor-pointer hover:bg-[#0A0A0A] transition-colors lg:block hidden">
        <div className="flex items-center gap-4 max-w-screen-xl mx-auto">
          <div className="relative w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=200&q=80"
              alt="Chic Evening Bag"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm text-white font-semibold truncate">Chic Evening Bag</h3>
            <div className="flex items-center gap-2">
              <p className="text-lg text-[#FF007A] font-bold">₩129,000</p>
              <p className="text-xs text-white/40">재고 10</p>
            </div>
          </div>
          <button className="px-6 py-2 bg-[#FF007A] text-white rounded-full hover:bg-[#FF007A]/80 transition-colors font-semibold">
            구매하기
          </button>
        </div>
      </div>
    </div>
  );
}
