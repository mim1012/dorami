import { apiClient } from './client';
import type { MainPageData, PopularProductDto, ProductStatus } from '@live-commerce/shared-types';

// Backend response shapes (after apiClient unwraps the outer {data, success, timestamp} envelope)
interface ActiveStreamResponse {
  id: string;
  streamKey: string;
  title: string;
  viewerCount: number;
  thumbnailUrl: string | null;
  startedAt: string | null;
  host: { id: string; name: string };
}

interface UpcomingStreamResponse {
  id: string;
  streamKey: string;
  title: string;
  description: string | null;
  scheduledAt: string | null;
  thumbnailUrl: string | null;
  isLive: boolean;
  host: { id: string; name: string };
}

interface ProductResponse {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  discountRate?: number;
  imageUrl?: string;
  stock: number;
  status: ProductStatus;
  isNew?: boolean;
  soldCount?: number;
}

interface PopularProductsResponse {
  data: (ProductResponse & { soldCount: number })[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface LiveDealsResponse {
  products: ProductResponse[];
  streamTitle: string;
  streamKey: string;
}

export async function getMainPageData(): Promise<MainPageData> {
  const [activeRes, upcomingRes, popularRes, liveDealsRes] = await Promise.all([
    apiClient.get<ActiveStreamResponse[]>('/streaming/active'),
    apiClient.get<UpcomingStreamResponse[]>('/streaming/upcoming', { params: { limit: 4 } }),
    apiClient.get<PopularProductsResponse>('/products/popular', { params: { limit: 8 } }),
    apiClient
      .get<LiveDealsResponse | null>('/products/live-deals')
      .catch(() => ({ data: null as LiveDealsResponse | null })),
  ]);

  const activeStreams = activeRes.data ?? [];
  const currentLive = activeStreams[0] ?? null;
  const liveDealsData = liveDealsRes.data;

  // popular products: apiClient unwraps outer envelope → res.data = { data: [...], meta: {...} }
  const popularList = popularRes.data?.data ?? [];

  return {
    currentLive: currentLive
      ? {
          id: currentLive.id,
          streamKey: currentLive.streamKey,
          title: currentLive.title,
          viewerCount: currentLive.viewerCount ?? 0,
          thumbnailUrl: currentLive.thumbnailUrl ?? null,
          startedAt: currentLive.startedAt ?? new Date().toISOString(),
          host: currentLive.host ?? { id: '', name: '호스트' },
        }
      : null,
    liveDeals: (liveDealsData?.products ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice ?? null,
      discountRate: p.discountRate ?? null,
      imageUrl: p.imageUrl ?? null,
      stock: p.stock ?? 0,
      status: p.status,
    })),
    upcomingLives: (upcomingRes.data ?? []).map((s) => ({
      id: s.id,
      streamKey: s.streamKey,
      title: s.title,
      description: s.description ?? null,
      scheduledAt: s.scheduledAt ?? new Date().toISOString(),
      thumbnailUrl: s.thumbnailUrl ?? null,
      host: s.host ?? { id: '', name: '호스트' },
    })),
    popularProducts: popularList.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice ?? null,
      discountRate: p.discountRate ?? null,
      imageUrl: p.imageUrl ?? null,
      isNew: p.isNew ?? false,
      soldCount: p.soldCount ?? 0,
    })),
  };
}

export async function getPopularProducts(
  page = 1,
  limit = 8,
): Promise<{ data: PopularProductDto[]; meta: { page: number; limit: number; total: number } }> {
  const res = await apiClient.get<PopularProductsResponse>('/products/popular', {
    params: { page, limit },
  });
  // apiClient unwraps outer envelope → res.data = { data: [...], meta: {...} }
  const data = res.data?.data ?? [];
  const meta = res.data?.meta ?? { total: data.length, page, limit, totalPages: 1 };
  return {
    data: data.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice ?? null,
      discountRate: p.discountRate ?? null,
      imageUrl: p.imageUrl ?? null,
      isNew: p.isNew ?? false,
      soldCount: p.soldCount ?? 0,
    })),
    meta: { page: meta.page, limit: meta.limit, total: meta.total },
  };
}
