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
  await apiClient.deleteWithBody('/notifications/unsubscribe', {
    endpoint,
  });
}

export async function getSubscriptions(): Promise<NotificationSubscription[]> {
  const res = await apiClient.get<NotificationSubscription[]>('/notifications/subscriptions');
  return res.data;
}
