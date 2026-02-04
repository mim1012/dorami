// Service Worker for Push Notifications
// This file handles push notifications and notification clicks

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});

// Handle push notification received
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);

  let data = {};

  try {
    data = event.data.json();
  } catch (error) {
    console.error('[Service Worker] Failed to parse push data:', error);
    data = {
      title: '새 알림',
      body: event.data ? event.data.text() : '알림이 도착했습니다.',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: {},
    };
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/badge-72x72.png',
    data: data.data || {},
    vibrate: [200, 100, 200],
    tag: 'live-commerce-notification',
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '새 알림', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';
  const fullUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open with this URL
      for (const client of clientList) {
        if (client.url === fullUrl && 'focus' in client) {
          return client.focus();
        }
      }

      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification closed:', event);
  // You can track notification dismissals here if needed
});
