'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { StreamStatus } from '@live-commerce/shared-types';

export interface LiveStream {
  id: string;
  streamKey: string;
  title?: string;
  status: StreamStatus;
  startedAt?: string;
  endedAt?: string;
  expiresAt: string;
  rtmpUrl?: string;
  playbackUrl?: string;
  viewerCount?: number;
  products?: Array<{
    id: string;
    name: string;
    price: number;
    stock: number;
    imageUrl?: string;
  }>;
}

// Query Keys
export const streamKeys = {
  all: ['streams'] as const,
  lists: () => [...streamKeys.all, 'list'] as const,
  active: () => [...streamKeys.lists(), 'active'] as const,
  upcoming: (limit: number) => [...streamKeys.lists(), 'upcoming', limit] as const,
  details: () => [...streamKeys.all, 'detail'] as const,
  detail: (streamKey: string) => [...streamKeys.details(), streamKey] as const,
};

// Fetch active (live) streams
export function useActiveStreams() {
  return useQuery({
    queryKey: streamKeys.active(),
    queryFn: async () => {
      const response = await apiClient.get<LiveStream[]>('/streaming/active');
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

// Fetch upcoming streams
export function useUpcomingStreams(limit = 3) {
  return useQuery({
    queryKey: streamKeys.upcoming(limit),
    queryFn: async () => {
      const response = await apiClient.get<LiveStream[]>('/streaming/upcoming', {
        params: { limit },
      });
      return response.data;
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

// Fetch single stream by stream key
export function useStream(streamKey: string) {
  return useQuery({
    queryKey: streamKeys.detail(streamKey),
    queryFn: async () => {
      const response = await apiClient.get<LiveStream>(`/streaming/${streamKey}`);
      return response.data;
    },
    enabled: !!streamKey,
    refetchInterval: 10000, // Refetch every 10 seconds during live
  });
}
