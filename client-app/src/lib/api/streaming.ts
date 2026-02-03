import { apiClient } from './client';

export interface LiveStream {
  id: string;
  title: string;
  scheduledTime: string;
  thumbnailUrl?: string | null;
  isLive: boolean;
  streamer?: {
    id: string;
    name: string;
  };
}

export async function getUpcomingStreams(limit: number = 3): Promise<LiveStream[]> {
  const response = await apiClient.get<any>(`/streaming/upcoming?limit=${limit}`);
  // Backend returns { data: [...] } wrapped in another { data: ... }
  // apiClient extracts first layer, so response.data is { data: [...] }
  return response.data.data || response.data;
}

export async function getActiveStreams(): Promise<LiveStream[]> {
  const response = await apiClient.get<any>('/streaming/active');
  // Backend returns { data: [...] } wrapped in another { data: ... }
  // apiClient extracts first layer, so response.data is { data: [...] }
  return response.data.data || response.data;
}
