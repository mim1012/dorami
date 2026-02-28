// ============================================================================
// MAINPAGE DTOs
// Shared types for the MainPage API endpoint
// Used by both Backend (DTOs) and Frontend (API client + React components)
// ============================================================================

import { ProductStatus, StreamStatus } from './index';

export interface HostDto {
  id: string;
  name: string;
}

export interface CurrentLiveDto {
  id: string;
  streamKey: string;
  title: string;
  viewerCount: number;
  thumbnailUrl: string | null;
  startedAt: string; // ISO 8601
  host: HostDto;
}

export interface LiveDealProductDto {
  id: string;
  name: string;
  price: number;
  originalPrice: number | null;
  discountRate: number | null;
  imageUrl: string | null;
  stock: number;
  status: ProductStatus;
}

export interface UpcomingLiveDto {
  id: string;
  streamKey: string;
  title: string;
  description: string | null;
  scheduledAt: string; // ISO 8601
  thumbnailUrl: string | null;
  host: HostDto;
}

export interface PopularProductDto {
  id: string;
  name: string;
  price: number;
  originalPrice: number | null;
  discountRate: number | null;
  imageUrl: string | null;
  isNew: boolean;
  soldCount: number;
}

export interface MainPageData {
  currentLive: CurrentLiveDto | null;
  liveDeals: LiveDealProductDto[];
  upcomingLives: UpcomingLiveDto[];
  popularProducts: PopularProductDto[];
}
