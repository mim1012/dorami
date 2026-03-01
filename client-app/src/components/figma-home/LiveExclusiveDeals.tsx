'use client';

import { Flame, PlayCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ImageWithFallback } from './figma/ImageWithFallback';
import type { LiveDealProductDto } from '@live-commerce/shared-types';
import { useAuthStore } from '@/lib/store/auth';
import { useToast } from '@/components/common/Toast';

type LiveExclusiveDealsProps = {
  liveDeals: LiveDealProductDto[];
  isLoading?: boolean;
};

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80';

export function LiveExclusiveDeals({ liveDeals, isLoading = false }: LiveExclusiveDealsProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { showToast } = useToast();

  const goToProduct = (dealId: string) => {
    if (!isAuthenticated) {
      showToast('로그인 후 이용해주세요', 'error', {
        label: '로그인',
        onClick: () => router.push('/login'),
      });
      return;
    }
    router.push(`/products/${dealId}`);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-[#FF4D8D]" fill="#FF4D8D" />
          <h3 className="text-xl md:text-2xl font-bold text-gray-900">방송 한정 특가</h3>
        </div>
        <p className="text-sm text-gray-600">라이브 방송에서 만나볼 특가 상품을 미리 확인하세요</p>
      </div>

      {isLoading && liveDeals.length === 0 && (
        <p className="rounded-lg border border-[#FFE5EE] bg-[#FFF0F5] px-4 py-2 text-sm text-[#B084CC]">
          방송 한정 특가를 불러오는 중입니다...
        </p>
      )}

      {liveDeals.length === 0 && !isLoading && (
        <p className="text-sm text-gray-500">현재 표시할 방송 한정 특가가 없습니다.</p>
      )}

      {liveDeals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {liveDeals.map((deal) => (
            <button
              key={deal.id}
              type="button"
              onClick={() => goToProduct(deal.id)}
              className="group bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-[#FFE5EE] cursor-pointer text-left"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-gray-50">
                <ImageWithFallback
                  src={deal.imageUrl ?? PLACEHOLDER_IMAGE}
                  alt={deal.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {deal.discountRate && deal.discountRate > 0 && (
                  <div className="absolute top-2 left-2">
                    <div className="px-2.5 py-1 bg-[#FF4D8D] rounded-full shadow-lg">
                      <span className="text-white font-bold text-xs">{deal.discountRate}%</span>
                    </div>
                  </div>
                )}

                <div className="absolute top-2 right-2">
                  <div className="px-2.5 py-1 bg-gradient-to-r from-[#FF4D8D] to-[#FF6BA0] rounded-full shadow-lg flex items-center gap-1">
                    <PlayCircle className="w-3 h-3 text-white" fill="white" />
                    <span className="text-xs font-bold text-white">LIVE</span>
                  </div>
                </div>
              </div>

              <div className="p-3 space-y-2.5">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm mb-1 line-clamp-1">{deal.name}</h4>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400 line-through">
                        {deal.originalPrice ? `${deal.originalPrice.toLocaleString()}원` : ''}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-[#FF4D8D]">
                        {deal.price.toLocaleString()}원
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-[#FFF0F5] to-[#F5EDFF] rounded-lg">
                  <PlayCircle className="w-3.5 h-3.5 text-[#FF4D8D]" />
                  <span className="text-xs font-bold text-gray-700">라이브 방송 특가</span>
                </div>
                <div className="text-[11px] text-gray-400">
                  {deal.stock > 0 ? `잔여 수량 ${deal.stock}개` : '품절'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-2 p-3 bg-[#FFF0F5] rounded-xl border border-[#FFE5EE]">
        <Flame className="w-4 h-4 text-[#FF4D8D]" />
        <p className="text-xs font-semibold text-gray-700">
          이 상품들은 라이브 방송 시청 중에만 구매할 수 있습니다
        </p>
      </div>
    </div>
  );
}
