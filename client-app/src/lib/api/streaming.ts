import { apiClient } from './client';

export interface LiveStream {
  id: string;
  streamKey?: string;
  title: string;
  description?: string;
  scheduledAt?: string | null;
  thumbnailUrl?: string | null;
  isLive: boolean;
  status?: string;
  viewerCount?: number;
  streamer?: {
    id: string;
    name: string;
  };
}

export async function getUpcomingStreams(limit: number = 3): Promise<LiveStream[]> {
  const response = await apiClient.get<LiveStream[]>(`/streaming/upcoming?limit=${limit}`);
  return response.data;
}

export async function getActiveStreams(): Promise<LiveStream[]> {
  const response = await apiClient.get<LiveStream[]>('/streaming/active');
  return response.data;
}
