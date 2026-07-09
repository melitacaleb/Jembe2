// js/app.js — Farmers Connect offline-first bootstrap
import { Router }          from './services/router.js';
import { api }             from './services/api.js';
import { store }           from './services/store.js';
import { socket }          from './services/socket.js';
import { localdb }         from './services/localdb.js';
import { syncEngine }      from './services/sync.js';
import { AuthView }        from './views/AuthView.js';
import { FeedView }        from './views/FeedView.js';
import { MarketplaceView } from './views/MarketplaceView.js';
import { EducationView }   from './views/EducationView.js';
import { ProfileView }     from './views/ProfileView.js';
import { MessagesView }    from './views/MessagesView.js';
import { NotificationsView}from './views/NotificationsView.js';
import { SettingsView }    from './views/SettingsView.js';
import { Sidebar }         from './components/Sidebar.js';

async function bootstrap() {
  // Open IndexedDB first — everything else depends on it
  await localdb.open();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Offline/online UI banner
  const banner = document.getElementById('offlineBanner');
  const setBanner = (online) => { if (banner) banner.style.display = online ? 'none' : 'flex'; };
  setBanner(navigator.onLine);
  window.addEventListener('online',  () => setBanner(true));
  window.addEventListener('offline', () => setBanner(false));

  // Router
  const router = new Router('#app');
  router
    .register('/auth',          AuthView)
    .register('/feed',          FeedView)
    .register('/marketplace',   MarketplaceView)
    .register('/education',     EducationView)
    .register('/profile',       ProfileView)
    .register('/messages',      MessagesView)
    .register('/notifications', NotificationsView)
    .register('/settings',      SettingsView);

  const sidebarEl = document.getElementById('sidebar');
  const sidebar   = new Sidebar(sidebarEl, router);

  // Auth — check token, fall back to localdb cached user if offline
  if (api.token) {
    try {
      const { user } = await api.me();
      store.setUser(user);
      await localdb.put('users', user);
    } catch (_) {
      // Offline or token expired — try to load from local cache
      const cached = await localdb.getMeta('current_user_id')
        .then((id) => id ? localdb.get('users', id) : null);
      if (cached) store.setUser(cached);
      else        api.setToken(null);
    }
  }

  const loggedIn = !!store.getUser();

  if (!loggedIn) {
    sidebarEl.classList.add('hidden');
    document.body.classList.remove('has-sidebar');
    if (!window.location.hash || window.location.hash === '#/feed') window.location.hash = '/auth';
    router.register('/feed', AuthView);
  } else {
    // Cache the current user id so we can load from localdb when offline
    await localdb.setMeta('current_user_id', store.getUser().id);

    sidebarEl.classList.remove('hidden');
    document.body.classList.add('has-sidebar');
    sidebar.render();

    // Badge update function — reads local DB instantly, refreshes from network
    const refreshBadges = async () => {
      try {
        const { messages: m, notifications: n } = await import('./services/data.js')
          .then((d) => d.getUnreadCounts());
        sidebar.setBadge('messages', m);
        sidebar.setBadge('notifications', n);
      } catch (_) {}
    };

    // Realtime socket — live badge updates when online
    socket.connect(api.token);
    socket.on('notification', refreshBadges);
    socket.on('message',      refreshBadges);

    // Sync engine — pull backend data into IndexedDB, flush offline writes
    await syncEngine.init();
    syncEngine.on('synced',   () => refreshBadges());

    // Sidebar sync indicator
    syncEngine.on('syncing',  (active) => {
      const el = document.getElementById('sync-indicator');
      if (el) el.style.display = active ? 'block' : 'none';
    });

    refreshBadges();
    setInterval(refreshBadges, 20000);
  }

  router.start();
}

bootstrap();
