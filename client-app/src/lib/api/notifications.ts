import { apiClient } from './client';

export interface PushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
  liveStreamId?: string;
}

export interface NotificationSubscription {
  id: string;
  userId: string;
  liveStreamId?: string;
  createdAt: string;
}

export async function getVapidPublicKey(): Promise<string> {
  const res = await apiClient.get<{ publicKey: string }>('/notifications/vapid-key');
  return res.data.publicKey;
}

export async function subscribePush(
  subscription: PushSubscriptionPayload,
): Promise<NotificationSubscription> {
  const res = await apiClient.post<NotificationSubscription>(
    '/notifications/subscribe',
    subscription,
  );
  return res.data;
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  // Backend DELETE expects body with { endpoint }.
  // apiClient.delete doesn't support body, so use fetch with proper auth headers.
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';
  const csrfMatch = typeof document !== 'undefined' && document.cookie.match(/csrf-token=([^;]+)/);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (csrfMatch) {
    headers['X-CSRF-Token'] = csrfMatch[1];
  }
  const res = await fetch(`${API_BASE}/notifications/unsubscribe`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
    body: JSON.stringify({ endpoint }),
  });
  if (!res.ok) {
    throw new Error(`Unsubscribe failed: ${res.status}`);
  }
}

export async function getSubscriptions(): Promise<NotificationSubscription[]> {
  const res = await apiClient.get<NotificationSubscription[]>('/notifications/subscriptions');
  return res.data;
}
