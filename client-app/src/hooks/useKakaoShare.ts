'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/common/Toast';

// Kakao SDK types
declare global {
  interface Window {
    Kakao: any;
  }
}

interface OrderShareData {
  orderId: string;
  orderNumber?: string;
  totalAmount: number;
  depositorName: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  deadlineDate: string;
  items: Array<{
    productName: string;
    quantity: number;
    price: number;
  }>;
}

export function useKakaoShare() {
  const [isInitialized, setIsInitialized] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    // Check if Kakao SDK is loaded
    if (typeof window !== 'undefined' && window.Kakao) {
      if (!window.Kakao.isInitialized()) {
        const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
        if (kakaoKey) {
          try {
            window.Kakao.init(kakaoKey);
            setIsInitialized(true);
            if (process.env.NODE_ENV !== 'production')
              console.log('[useKakaoShare] Kakao SDK initialized');
          } catch (error) {
            console.error('[useKakaoShare] Failed to initialize Kakao SDK:', error);
          }
        } else {
          console.warn('[useKakaoShare] NEXT_PUBLIC_KAKAO_JS_KEY not found');
        }
      } else {
        setIsInitialized(true);
      }
    }
  }, []);

  /**
   * Share order information to KakaoTalk
   */
  const shareOrder = (orderData: OrderShareData) => {
    if (!isInitialized || !window.Kakao) {
      showToast('카카오톡 공유 기능을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.', 'error');
      return;
    }

    try {
      const orderUrl = `${window.location.origin}/order-complete?orderId=${orderData.orderId}`;

      // Build description with bank info
      const description = [
        `주문번호: ${orderData.orderId}`,
        `${orderData.bankName} ${orderData.accountNumber}`,
        `예금주: ${orderData.accountHolder}`,
        `입금자명: ${orderData.depositorName}`,
        `입금 기한: ${orderData.deadlineDate}`,
      ].join('\n');

      // Use commerce template for order sharing
      window.Kakao.Share.sendDefault({
        objectType: 'commerce',
        content: {
          title: '주문이 완료되었습니다',
          description,
          imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80',
          link: {
            mobileWebUrl: orderUrl,
            webUrl: orderUrl,
          },
        },
        commerce: {
          regularPrice: orderData.totalAmount,
          currencyUnit: '$',
          currencyUnitPosition: 1,
        },
        buttons: [
          {
            title: '입금 정보 확인',
            link: {
              mobileWebUrl: orderUrl,
              webUrl: orderUrl,
            },
          },
        ],
      });

      if (process.env.NODE_ENV !== 'production')
        console.log('[useKakaoShare] Order shared successfully');
    } catch (error) {
      console.error('[useKakaoShare] Failed to share order:', error);
      showToast('카카오톡 공유 중 오류가 발생했습니다.', 'error');
    }
  };

  /**
   * Share live stream to KakaoTalk
   */
  const shareLiveStream = (streamData: {
    streamKey: string;
    title: string;
    thumbnailUrl?: string;
  }) => {
    if (!isInitialized || !window.Kakao) {
      showToast('카카오톡 공유 기능을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.', 'error');
      return;
    }

    try {
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `🔴 ${streamData.title}`,
          description: '지금 라이브 방송 중입니다! 함께 시청하세요',
          imageUrl:
            streamData.thumbnailUrl ||
            'https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=800&q=80',
          link: {
            mobileWebUrl: `${window.location.origin}/live/${streamData.streamKey}`,
            webUrl: `${window.location.origin}/live/${streamData.streamKey}`,
          },
        },
        buttons: [
          {
            title: '라이브 입장하기',
            link: {
              mobileWebUrl: `${window.location.origin}/live/${streamData.streamKey}`,
              webUrl: `${window.location.origin}/live/${streamData.streamKey}`,
            },
          },
        ],
      });

      if (process.env.NODE_ENV !== 'production')
        console.log('[useKakaoShare] Live stream shared successfully');
    } catch (error) {
      console.error('[useKakaoShare] Failed to share live stream:', error);
      showToast('카카오톡 공유 중 오류가 발생했습니다.', 'error');
    }
  };

  return {
    isInitialized,
    shareOrder,
    shareLiveStream,
  };
}
