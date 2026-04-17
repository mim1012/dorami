import { apiClient } from './client';

export interface AuthSessionSummary {
  id: string;
  current: boolean;
  familyId?: string | null;
  deviceName?: string | null;
  deviceType?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  lastUsedAt?: string | null;
  expiresAt: string;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionListResponse {
  sessions: AuthSessionSummary[];
}

interface RevokeSessionResponse {
  message: string;
  revokedCurrentSession: boolean;
}

export async function listAuthSessions(): Promise<AuthSessionSummary[]> {
  const response = await apiClient.get<SessionListResponse>('/auth/sessions');
  return response.data.sessions;
}

export async function revokeAuthSession(sessionId: string): Promise<RevokeSessionResponse> {
  const response = await apiClient.delete<RevokeSessionResponse>(`/auth/sessions/${sessionId}`);
  return response.data;
}

export async function logoutAllAuthSessions(): Promise<void> {
  await apiClient.post('/auth/logout-all');
}
