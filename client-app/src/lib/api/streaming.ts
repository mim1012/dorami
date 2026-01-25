import { apiClient } from './client';

export interface Stream {
  id: string;
  title: string;
  description?: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'PENDING' | 'OFFLINE';
  streamKey?: string;
  rtmpUrl?: string;
  hlsUrl?: string;
  scheduledStartTime?: string;
  actualStartTime?: string;
  startedAt?: string;
  endTime?: string;
  viewerCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StreamStatus {
  status: string;
  viewerCount: number;
  startedAt?: string;
  title: string;
}

export async function getActiveStreams(): Promise<Stream[]> {
  const response = await apiClient.get<Stream[]>('/streaming/active');
  return response.data;
}

export async function getStreamStatus(streamId: string): Promise<Stream> {
  const response = await apiClient.get<Stream>(`/streaming/${streamId}/status`);
  return response.data;
}

export async function getStreamStatusByKey(streamKey: string): Promise<StreamStatus> {
  const response = await apiClient.get<StreamStatus>(`/streaming/key/${streamKey}/status`);
  return response.data;
}
