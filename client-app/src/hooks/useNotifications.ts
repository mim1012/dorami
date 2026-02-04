'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';

interface UseNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission | null;
  isSubscribed: boolean;
  requestPermission: () => Promise<boolean>;
  subscribe: (liveStreamId?: string) => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
}

// VAPID Public Key - must match backend VAPID_PUBLIC_KEY
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/**
 * Hook for managing push notifications
 * Handles permission requests, service worker registration, and subscription management
 */
export function useNotifications(): UseNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Check if push notifications are supported
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const supported =
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window;

      setIsSupported(supported);
      setPermission(supported ? Notification.permission : null);
    }
  }, []);

  /**
   * Register service worker
   */
  const registerServiceWorker = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[useNotifications] Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('[useNotifications] Service Worker registration failed:', error);
      return null;
    }
  }, []);

  /**
   * Request notification permission from user
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('[useNotifications] Push notifications not supported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        console.log('[useNotifications] Notification permission granted');
        return true;
      } else {
        console.log('[useNotifications] Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('[useNotifications] Failed to request permission:', error);
      return false;
    }
  }, [isSupported]);

  /**
   * Subscribe to push notifications
   * @param liveStreamId - Optional stream ID to subscribe to specific stream
   */
  const subscribe = useCallback(
    async (liveStreamId?: string): Promise<boolean> => {
      if (!isSupported) {
        console.warn('[useNotifications] Push notifications not supported');
        return false;
      }

      if (permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          return false;
        }
      }

      try {
        // Register service worker
        const registration = await registerServiceWorker();
        if (!registration) {
          throw new Error('Service Worker registration failed');
        }

        // Check for existing subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          // Create new subscription
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });

          console.log('[useNotifications] Push subscription created:', subscription);
        }

        // Send subscription to backend
        const subscriptionData = subscription.toJSON();

        await apiClient.post('/notifications/subscribe', {
          liveStreamId,
          endpoint: subscriptionData.endpoint,
          p256dh: subscriptionData.keys?.p256dh,
          auth: subscriptionData.keys?.auth,
        });

        setIsSubscribed(true);
        console.log('[useNotifications] Subscribed to notifications');
        return true;
      } catch (error) {
        console.error('[useNotifications] Failed to subscribe:', error);
        return false;
      }
    },
    [isSupported, permission, requestPermission, registerServiceWorker]
  );

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        console.log('[useNotifications] No active subscription found');
        return true;
      }

      const subscriptionData = subscription.toJSON();

      // Unsubscribe from push manager
      await subscription.unsubscribe();

      // Remove subscription from backend
      await apiClient.delete('/notifications/unsubscribe', {
        data: {
          endpoint: subscriptionData.endpoint,
        },
      });

      setIsSubscribed(false);
      console.log('[useNotifications] Unsubscribed from notifications');
      return true;
    } catch (error) {
      console.error('[useNotifications] Failed to unsubscribe:', error);
      return false;
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    requestPermission,
    subscribe,
    unsubscribe,
  };
}

/**
 * Convert base64 VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
