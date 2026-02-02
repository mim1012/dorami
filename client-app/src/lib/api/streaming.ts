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
  const response = await apiClient.get<LiveStream[]>(`/streaming/upcoming?limit=${limit}`);
  return response.data;
}
