'use client';

import { useState, useEffect, useCallback } from 'react';
import { getVapidPublicKey, subscribePush, unsubscribePush } from '../api/notifications';

type PermissionState = NotificationPermission | 'unsupported';

interface UsePushNotification {
  permission: PermissionState;
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export function usePushNotification(): UsePushNotification {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check initial state
  useEffect(() => {
    async function checkState() {
      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window)
      ) {
        setPermission('unsupported');
        setIsLoading(false);
        return;
      }

      setPermission(Notification.permission);

      try {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        if (registration) {
          const sub = await registration.pushManager.getSubscription();
          setIsSubscribed(!!sub);
        }
      } catch (err) {
        console.error('Failed to check push subscription:', err);
      } finally {
        setIsLoading(false);
      }
    }

    checkState();
  }, []);

  const subscribe = useCallback(async () => {
    if (permission === 'unsupported') return;

    setIsLoading(true);
    try {
      // Request notification permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        return;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Get VAPID public key from backend
      const vapidPublicKey = await getVapidPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe to push
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const json = pushSubscription.toJSON();
      const keys = json.keys as { p256dh: string; auth: string };

      // Send subscription to backend
      await subscribePush({
        endpoint: pushSubscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });

      setIsSubscribed(true);
    } catch (err) {
      console.error('Failed to subscribe to push notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [permission]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          await unsubscribePush(sub.endpoint);
          await sub.unsubscribe();
        }
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('Failed to unsubscribe from push notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { permission, isSubscribed, isLoading, subscribe, unsubscribe };
}
