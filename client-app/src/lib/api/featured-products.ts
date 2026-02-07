import { apiClient } from './client';

export interface FeaturedProduct {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
  colorOptions: string[];
  sizeOptions: string[];
  status: string;
}

/**
 * 스트림의 현재 추천 상품 조회
 */
export async function getFeaturedProduct(streamKey: string): Promise<FeaturedProduct | null> {
  const response = await apiClient.get<{ product: FeaturedProduct | null }>(
    `/streaming/key/${streamKey}/featured-product`
  );
  return response.data.product;
}

/**
 * 스트림의 추천 상품 설정 (Admin)
 */
export async function setFeaturedProduct(
  streamKey: string,
  productId: string
): Promise<FeaturedProduct> {
  const response = await apiClient.post<{ success: boolean; product: FeaturedProduct }>(
    `/streaming/${streamKey}/featured-product`,
    { productId }
  );
  return response.data.product;
}

/**
 * 스트림의 추천 상품 해제 (Admin)
 */
export async function clearFeaturedProduct(streamKey: string): Promise<void> {
  await apiClient.patch(`/streaming/${streamKey}/featured-product/clear`);
}

/**
 * 특정 스트림의 상품 목록 조회
 */
export async function getStreamProducts(streamKey: string): Promise<FeaturedProduct[]> {
  const response = await apiClient.get<FeaturedProduct[]>('/products', {
    params: { streamKey }
  });
  return response.data;
}
