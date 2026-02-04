'use client';

import { useEffect, useState } from 'react';

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

  useEffect(() => {
    // Check if Kakao SDK is loaded
    if (typeof window !== 'undefined' && window.Kakao) {
      if (!window.Kakao.isInitialized()) {
        const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
        if (kakaoKey) {
          try {
            window.Kakao.init(kakaoKey);
            setIsInitialized(true);
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
      alert('카카오톡 공유 기능을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      // Build item list for display
      const itemsText = orderData.items
        .map((item) => `${item.productName} x${item.quantity}`)
        .join(', ');

      const itemsForFeed = orderData.items.slice(0, 3).map((item) => ({
        item: item.productName,
        itemOp: `${item.price.toLocaleString('ko-KR')}원 x ${item.quantity}`,
      }));

      // Share using Kakao Link API
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: '🎉 주문이 완료되었습니다!',
          description: `주문번호: ${orderData.orderId}\n입금 기한: ${orderData.deadlineDate}`,
          imageUrl:
            'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80',
          link: {
            mobileWebUrl: `${window.location.origin}/order-complete?orderId=${orderData.orderId}`,
            webUrl: `${window.location.origin}/order-complete?orderId=${orderData.orderId}`,
          },
        },
        itemContent: {
          profileText: '라이브 커머스',
          profileImageUrl:
            'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=200&q=80',
          titleImageUrl:
            'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80',
          titleImageText: '입금 정보',
          titleImageCategory: '주문 완료',
          items: itemsForFeed,
          sum: `총 ${orderData.totalAmount.toLocaleString('ko-KR')}원`,
          sumOp: `입금자명: ${orderData.depositorName}`,
        },
        social: {
          likeCount: 0,
          commentCount: 0,
          sharedCount: 0,
        },
        buttons: [
          {
            title: '입금 정보 확인',
            link: {
              mobileWebUrl: `${window.location.origin}/order-complete?orderId=${orderData.orderId}`,
              webUrl: `${window.location.origin}/order-complete?orderId=${orderData.orderId}`,
            },
          },
          {
            title: '홈으로 이동',
            link: {
              mobileWebUrl: window.location.origin,
              webUrl: window.location.origin,
            },
          },
        ],
      });

      console.log('[useKakaoShare] Order shared successfully');
    } catch (error) {
      console.error('[useKakaoShare] Failed to share order:', error);
      alert('카카오톡 공유 중 오류가 발생했습니다.');
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
      alert('카카오톡 공유 기능을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.');
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

      console.log('[useKakaoShare] Live stream shared successfully');
    } catch (error) {
      console.error('[useKakaoShare] Failed to share live stream:', error);
      alert('카카오톡 공유 중 오류가 발생했습니다.');
    }
  };

  return {
    isInitialized,
    shareOrder,
    shareLiveStream,
  };
}
