'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/contexts/CartContext';
import { Display, Heading2, Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { Trash2, Plus, Minus, ShoppingBag, Clock } from 'lucide-react';

export default function CartPage() {
  const router = useRouter();
  const {
    items,
    removeItem,
    updateQuantity,
    getTotalPrice,
    getTotalItems,
    timeRemaining,
  } = useCart();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price);
  };

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '';

    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = (seconds: number | null) => {
    if (seconds === null) return 'text-secondary-text';
    if (seconds < 60) return 'text-error animate-pulse'; // < 1 min: red + pulse
    if (seconds < 180) return 'text-yellow-500'; // < 3 min: yellow
    return 'text-success'; // > 3 min: green
  };

  const getTimerProgress = (seconds: number | null) => {
    if (seconds === null) return 0;
    const totalSeconds = 10 * 60; // 10 minutes
    return (seconds / totalSeconds) * 100;
  };

  const handleCheckout = () => {
    router.push('/checkout');
  };

  if (items.length === 0) {
    return (
      <>
        <div className="min-h-screen bg-[#121212] py-12 px-4 pb-28">
          <div className="w-full md:max-w-4xl md:mx-auto">
            <div className="text-center py-16">
              <ShoppingBag className="w-24 h-24 text-secondary-text mx-auto mb-6 opacity-30" />
              <Display className="text-hot-pink mb-4">장바구니가 비어있습니다</Display>
              <Body className="text-secondary-text mb-8">
                라이브 방송에서 마음에 드는 상품을 담아보세요
              </Body>
              <Button variant="primary" size="lg" onClick={() => router.push('/')}>
                홈으로 이동
              </Button>
            </div>
          </div>
        </div>
        <BottomTabBar />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#121212] py-6 px-4 pb-28">
        <div className="w-full md:max-w-4xl md:mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Display className="text-hot-pink mb-2">장바구니</Display>
            <Body className="text-secondary-text">
              {getTotalItems()}개 상품
            </Body>
          </div>

          {/* Timer Warning Banner */}
          {timeRemaining !== null && (
            <div className="bg-gradient-to-r from-hot-pink/20 to-error/20 border border-hot-pink/50 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className={`w-5 h-5 ${getTimerColor(timeRemaining)}`} />
                  <Body className="text-primary-text font-bold">남은 시간</Body>
                </div>
                <Display className={`${getTimerColor(timeRemaining)}`}>
                  {formatTime(timeRemaining)}
                </Display>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-white rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${
                    timeRemaining < 60
                      ? 'bg-error'
                      : timeRemaining < 180
                      ? 'bg-yellow-500'
                      : 'bg-success'
                  }`}
                  style={{ width: `${getTimerProgress(timeRemaining)}%` }}
                />
              </div>

              <Body className="text-secondary-text text-xs mt-2">
                {timeRemaining < 60
                  ? '⚠️ 시간이 거의 다 되었습니다! 서둘러 주문을 완료해주세요.'
                  : '시간 내에 주문을 완료하지 않으면 장바구니가 자동으로 비워집니다.'}
              </Body>
            </div>
          )}

          {/* Cart Items */}
          <div className="space-y-4 mb-6">
            {items.map((item) => (
              <div
                key={item.productId}
                className="bg-content-bg rounded-2xl p-4 border border-white/5"
              >
                <div className="flex gap-4">
                  {/* Product Image */}
                  <div className="flex-shrink-0 w-24 h-24 bg-white rounded-xl overflow-hidden">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-10 h-10 text-secondary-text opacity-30" />
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1">
                    <Heading2 className="text-primary-text mb-1">
                      {item.productName}
                    </Heading2>
                    <Body className="text-hot-pink font-bold text-lg mb-2">
                      {formatPrice(item.price)}
                    </Body>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="w-8 h-8 bg-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-4 h-4 text-primary-text" />
                        </button>
                        <Body className="text-primary-text font-bold w-8 text-center">
                          {item.quantity}
                        </Body>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          disabled={item.quantity >= item.stock}
                          className="w-8 h-8 bg-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-4 h-4 text-primary-text" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.productId)}
                        className="text-error hover:text-error/80 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Item Total */}
                    <div className="mt-2 flex justify-between items-center">
                      <Body className="text-secondary-text text-sm">소계</Body>
                      <Body className="text-primary-text font-bold">
                        {formatPrice(item.price * item.quantity)}
                      </Body>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total Summary */}
          <div className="bg-content-bg rounded-2xl p-6 border border-white/5 mb-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Body className="text-secondary-text">상품 금액</Body>
                <Body className="text-primary-text">
                  {formatPrice(getTotalPrice())}
                </Body>
              </div>
              <div className="flex justify-between items-center">
                <Body className="text-secondary-text">배송비</Body>
                <Body className="text-primary-text">무료</Body>
              </div>
              <div className="h-px bg-white/10 my-3" />
              <div className="flex justify-between items-center">
                <Heading2 className="text-primary-text">총 결제 금액</Heading2>
                <Display className="text-hot-pink">
                  {formatPrice(getTotalPrice())}
                </Display>
              </div>
            </div>
          </div>

          {/* Checkout Button */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleCheckout}
            className="mb-4"
          >
            주문하기
          </Button>

          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={() => router.push('/')}
          >
            계속 쇼핑하기
          </Button>
        </div>
      </div>

      <BottomTabBar />
    </>
  );
}
