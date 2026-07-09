// js/services/sync.js
// SyncEngine pulls data from the Render backend into local IndexedDB and
// flushes offline writes back to the backend when connectivity returns.
//
// Sync strategy
// ─────────────
// PULL  — network-first full refresh on login + every 90 seconds while online.
//         Results are stored in IndexedDB so the app can read them offline.
// PUSH  — writes always go to IndexedDB instantly (optimistic). If a backend
//         call fails because we're offline the operation is saved to
//         `sync_queue` and replayed when connectivity resumes.
// MERGE — simple last-write-wins; the backend is the source of truth. Local
//         optimistic data is overwritten on next pull.

import { localdb }  from './localdb.js';
import { api }      from './api.js';
import { store }    from './store.js';

const POLL_INTERVAL = 90_000; // ms

class SyncEngine {
  constructor() {
    this._timer   = null;
    this._syncing = false;
    this._listeners = [];
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────
  async init() {
    await localdb.open();

    // Watch network status
    window.addEventListener('online',  () => this._onOnline());
    window.addEventListener('offline', () => this._onOffline());

    if (navigator.onLine && store.getUser()) {
      await this.pullAll();
      this._startPolling();
    }
  }

  _onOnline() {
    this._emit('status', 'online');
    if (store.getUser()) {
      this.flushQueue().then(() => this.pullAll());
      this._startPolling();
    }
  }

  _onOffline() {
    this._emit('status', 'offline');
    this._stopPolling();
  }

  _startPolling() {
    this._stopPolling();
    this._timer = setInterval(() => this.pullAll(), POLL_INTERVAL);
  }

  _stopPolling() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  // ── Pull — backend → IndexedDB ────────────────────────────────────────
  async pullAll() {
    if (this._syncing || !navigator.onLine || !store.getUser()) return;
    this._syncing = true;
    this._emit('syncing', true);
    try {
      await Promise.allSettled([
        this._pullFeed(),
        this._pullStories(),
        this._pullProducts(),
        this._pullCourses(),
        this._pullMessages(),
        this._pullNotifications(),
      ]);
      await localdb.setMeta('last_sync', new Date().toISOString());
      this._emit('synced', new Date());
    } catch (err) {
      console.warn('[sync] pullAll error:', err.message);
    } finally {
      this._syncing = false;
      this._emit('syncing', false);
    }
  }

  async _pullFeed() {
    const { posts } = await api.getFeed(50, 0);
    await localdb.putMany('posts', posts);
    // Cache author profiles alongside posts
    const authorMap = {};
    posts.forEach((p) => {
      if (!authorMap[p.author_id]) {
        authorMap[p.author_id] = {
          id: p.author_id,
          username: p.username,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          account_type: p.account_type,
        };
      }
    });
    await localdb.putMany('users', Object.values(authorMap));
  }

  async _pullStories() {
    const { stories } = await api.getStories();
    await localdb.putMany('stories', stories);
  }

  async _pullProducts() {
    const { products } = await api.getProducts('?limit=100');
    await localdb.putMany('products', products);
    const sellerMap = {};
    products.forEach((p) => {
      if (!sellerMap[p.seller_id]) {
        sellerMap[p.seller_id] = {
          id: p.seller_id,
          username: p.username,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          account_type: p.account_type,
        };
      }
    });
    await localdb.putMany('users', Object.values(sellerMap));
  }

  async _pullCourses() {
    const { courses } = await api.getCourses('?limit=100');
    await localdb.putMany('courses', courses);
  }

  async _pullMessages() {
    const { conversations } = await api.getConversations();
    for (const c of conversations) {
      // Cache partner profile
      await localdb.put('users', {
        id:           c.partner_id,
        username:     c.username,
        full_name:    c.full_name,
        avatar_url:   c.avatar_url,
        account_type: c.account_type,
      });
      // Pull the actual message thread
      const { messages } = await api.getThread(c.partner_id);
      await localdb.putMany('messages', messages);
    }
  }

  async _pullNotifications() {
    const { notifications } = await api.getNotifications();
    const userId = store.getUser()?.id;
    const notifs = notifications.map((n) => ({ ...n, user_id: userId }));
    await localdb.putMany('notifications', notifs);
  }

  // ── Flush queue — push offline writes to backend ──────────────────────
  async flushQueue() {
    if (!navigator.onLine) return;
    const queue = await localdb.getQueue();
    if (!queue.length) return;

    console.log(`[sync] Flushing ${queue.length} queued writes...`);
    for (const item of queue) {
      try {
        await api.request(item.path, { method: item.method, body: item.body });
        await localdb.removeFromQueue(item.id);
      } catch (err) {
        console.warn('[sync] Queue flush failed for item', item.id, err.message);
        // Leave in queue, will retry next time
      }
    }
    // After flushing, pull fresh data
    await this.pullAll();
  }

  // ── Event emitter ─────────────────────────────────────────────────────
  on(event, fn) {
    this._listeners.push({ event, fn });
    return () => { this._listeners = this._listeners.filter((l) => l.fn !== fn); };
  }

  _emit(event, data) {
    this._listeners.filter((l) => l.event === event).forEach((l) => l.fn(data));
  }
}

export const syncEngine = new SyncEngine();
