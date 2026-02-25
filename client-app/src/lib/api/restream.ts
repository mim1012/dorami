import { apiClient } from './client';

export type ReStreamPlatform = 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK' | 'CUSTOM';
export type ReStreamStatus = 'IDLE' | 'CONNECTING' | 'ACTIVE' | 'FAILED' | 'STOPPED';

export interface ReStreamTarget {
  id: string;
  userId: string;
  platform: ReStreamPlatform;
  name: string;
  rtmpUrl: string;
  streamKey: string;
  enabled: boolean;
  muteAudio: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReStreamLog {
  id: string;
  targetId: string;
  liveStreamId: string;
  status: ReStreamStatus;
  startedAt: string | null;
  endedAt: string | null;
  errorMessage: string | null;
  restartCount: number;
  createdAt: string;
  target: ReStreamTarget;
}

export interface CreateReStreamTargetPayload {
  platform: ReStreamPlatform;
  name: string;
  rtmpUrl: string;
  streamKey: string;
  enabled?: boolean;
  muteAudio?: boolean;
}

export interface UpdateReStreamTargetPayload {
  platform?: ReStreamPlatform;
  name?: string;
  rtmpUrl?: string;
  streamKey?: string;
  enabled?: boolean;
  muteAudio?: boolean;
}

export async function getReStreamTargets() {
  const res = await apiClient.get<ReStreamTarget[]>('/restream/targets');
  return res.data;
}

export async function createReStreamTarget(payload: CreateReStreamTargetPayload) {
  const res = await apiClient.post<ReStreamTarget>('/restream/targets', payload);
  return res.data;
}

export async function updateReStreamTarget(id: string, payload: UpdateReStreamTargetPayload) {
  const res = await apiClient.patch<ReStreamTarget>(`/restream/targets/${id}`, payload);
  return res.data;
}

export async function deleteReStreamTarget(id: string) {
  await apiClient.delete(`/restream/targets/${id}`);
}

export async function getReStreamStatuses(liveStreamId: string) {
  const res = await apiClient.get<ReStreamLog[]>(`/restream/status/${liveStreamId}`);
  return res.data;
}

export async function startReStreamTarget(liveStreamId: string, targetId: string) {
  const res = await apiClient.post<{ message: string }>(
    `/restream/${liveStreamId}/targets/${targetId}/start`,
  );
  return res.data;
}

export async function stopReStreamTarget(liveStreamId: string, targetId: string) {
  const res = await apiClient.post<{ message: string }>(
    `/restream/${liveStreamId}/targets/${targetId}/stop`,
  );
  return res.data;
}
