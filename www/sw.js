// sw.js — Farmers Connect offline service worker
const CACHE = 'fc-v1';
const API_CACHE = 'fc-api-v1';
const BACKEND = 'https://jembebackend.onrender.com';

// App shell files — cached at install, served offline always
const SHELL = [
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/app.js',
  '/js/services/api.js',
  '/js/services/store.js',
  '/js/services/router.js',
  '/js/services/socket.js',
  '/js/services/native.js',
  '/js/components/Sidebar.js',
  '/js/components/MediaPicker.js',
  '/js/components/StoriesBar.js',
  '/js/views/BaseView.js',
  '/js/views/AuthView.js',
  '/js/views/FeedView.js',
  '/js/views/MarketplaceView.js',
  '/js/views/EducationView.js',
  '/js/views/ProfileView.js',
  '/js/views/MessagesView.js',
  '/js/views/NotificationsView.js',
  '/js/views/SettingsView.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: cache the app shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// Activate: clear old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== API_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - API calls: network-first, fall back to cached response (shows stale data offline)
// - App shell: cache-first (always instant load)
// - Images: stale-while-revalidate
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // API requests — network first, cache fallback
  if (url.origin === BACKEND || url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirstWithCache(request));
    return;
  }

  // App shell — cache first
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

async function networkFirstWithCache(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const res = await fetch(request.clone());
    if (res.ok && request.method === 'GET') {
      cache.put(request, res.clone());
    }
    return res;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 503,
    });
  }
}

// Push notifications from backend (FCM)
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : {};
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { path: data.path || '/feed' },
    actions: [{ action: 'open', title: 'Open App' }],
  };
  e.waitUntil(self.registration.showNotification(data.title || 'Farmers Connect', options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const path = e.notification.data?.path || '/feed';
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then((cs) => {
      for (const c of cs) {
        if (c.url && 'focus' in c) {
          c.postMessage({ type: 'navigate', path });
          return c.focus();
        }
      }
      return clients.openWindow(`/index.html#${path}`);
    })
  );
});
