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

export interface UpcomingStream {
  id: string;
  streamKey?: string;
  title: string;
  description?: string | null;
  scheduledAt?: string | null;
  thumbnailUrl?: string | null;
  isLive: boolean;
  host: { id: string; name: string };
}

export async function getUpcomingStreams(limit: number = 3): Promise<UpcomingStream[]> {
  const response = await apiClient.get<UpcomingStream[]>(`/streaming/upcoming?limit=${limit}`);
  return response.data;
}

export async function getActiveStreams(): Promise<LiveStream[]> {
  const response = await apiClient.get<LiveStream[]>('/streaming/active');
  return response.data;
}

export interface StreamHistoryBulkDeleteResult {
  requestedCount: number;
  deletedCount: number;
  skippedCount: number;
  deletedIds: string[];
  skippedIds: string[];
}

export async function deleteStreamHistory(streamIds: string[]) {
  const response = await apiClient.post<StreamHistoryBulkDeleteResult>(
    '/streaming/history/bulk-delete',
    { streamIds },
  );
  return response.data;
}
