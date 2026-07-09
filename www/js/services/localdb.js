// js/services/localdb.js
// IndexedDB local database — mirrors the Neon/Postgres backend schema.
// Works in every Android WebView and browser with no extra native plugin.
// All data persists between app restarts so the app is fully usable offline.

const DB_NAME = 'farmers_connect';
const DB_VERSION = 2;

class LocalDB {
  constructor() {
    this._db = null;
    this._ready = null;
  }

  // ── Open / upgrade ──────────────────────────────────────────────────────
  open() {
    if (this._ready) return this._ready;
    this._ready = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        const ensure = (name, opts = {}) =>
          db.objectStoreNames.contains(name)
            ? req.transaction.objectStore(name)
            : db.createObjectStore(name, opts);

        // users
        const users = ensure('users', { keyPath: 'id' });
        if (!users.indexNames.contains('username')) users.createIndex('username', 'username', { unique: true });
        if (!users.indexNames.contains('email'))    users.createIndex('email', 'email', { unique: true });

        // posts
        const posts = ensure('posts', { keyPath: 'id' });
        if (!posts.indexNames.contains('author_id'))  posts.createIndex('author_id', 'author_id');
        if (!posts.indexNames.contains('created_at')) posts.createIndex('created_at', 'created_at');

        // post_likes
        const likes = ensure('post_likes', { keyPath: ['post_id', 'user_id'] });
        if (!likes.indexNames.contains('post_id')) likes.createIndex('post_id', 'post_id');

        // comments
        const comments = ensure('comments', { keyPath: 'id' });
        if (!comments.indexNames.contains('post_id')) comments.createIndex('post_id', 'post_id');

        // stories
        const stories = ensure('stories', { keyPath: 'id' });
        if (!stories.indexNames.contains('author_id'))  stories.createIndex('author_id', 'author_id');
        if (!stories.indexNames.contains('expires_at')) stories.createIndex('expires_at', 'expires_at');

        // follows
        ensure('follows', { keyPath: ['follower_id', 'following_id'] });

        // products (marketplace)
        const products = ensure('products', { keyPath: 'id' });
        if (!products.indexNames.contains('category')) products.createIndex('category', 'category');
        if (!products.indexNames.contains('status'))   products.createIndex('status', 'status');
        if (!products.indexNames.contains('seller_id'))products.createIndex('seller_id', 'seller_id');

        // orders
        const orders = ensure('orders', { keyPath: 'id' });
        if (!orders.indexNames.contains('buyer_id'))  orders.createIndex('buyer_id', 'buyer_id');
        if (!orders.indexNames.contains('seller_id')) orders.createIndex('seller_id', 'seller_id');

        // courses / brochures / templates
        const courses = ensure('courses', { keyPath: 'id' });
        if (!courses.indexNames.contains('resource_type')) courses.createIndex('resource_type', 'resource_type');
        if (!courses.indexNames.contains('category'))      courses.createIndex('category', 'category');
        if (!courses.indexNames.contains('provider_id'))   courses.createIndex('provider_id', 'provider_id');

        // enrollments
        ensure('enrollments', { keyPath: ['course_id', 'user_id'] });

        // messages
        const msgs = ensure('messages', { keyPath: 'id' });
        if (!msgs.indexNames.contains('sender_id'))    msgs.createIndex('sender_id', 'sender_id');
        if (!msgs.indexNames.contains('recipient_id')) msgs.createIndex('recipient_id', 'recipient_id');
        if (!msgs.indexNames.contains('created_at'))   msgs.createIndex('created_at', 'created_at');

        // notifications
        const notifs = ensure('notifications', { keyPath: 'id' });
        if (!notifs.indexNames.contains('user_id'))    notifs.createIndex('user_id', 'user_id');
        if (!notifs.indexNames.contains('created_at')) notifs.createIndex('created_at', 'created_at');

        // sync_queue — offline write queue (flushed when back online)
        const queue = ensure('sync_queue', { keyPath: 'id', autoIncrement: true });
        if (!queue.indexNames.contains('created_at')) queue.createIndex('created_at', 'created_at');

        // meta — last-sync timestamps per store
        ensure('meta', { keyPath: 'key' });
      };

      req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
      req.onerror   = (e) => reject(e.target.error);
    });
    return this._ready;
  }

  async db() {
    if (this._db) return this._db;
    return this.open();
  }

  // ── Generic helpers ─────────────────────────────────────────────────────
  async _tx(stores, mode, fn) {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      tx.onerror = () => reject(tx.error);
      resolve(fn(tx));
    });
  }

  async get(store, key) {
    return this._tx(store, 'readonly', (tx) =>
      new Promise((res, rej) => {
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => res(req.result ?? null);
        req.onerror   = () => rej(req.error);
      })
    );
  }

  async getAll(store) {
    return this._tx(store, 'readonly', (tx) =>
      new Promise((res, rej) => {
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => res(req.result);
        req.onerror   = () => rej(req.error);
      })
    );
  }

  async getAllByIndex(store, indexName, value) {
    return this._tx(store, 'readonly', (tx) =>
      new Promise((res, rej) => {
        const req = tx.objectStore(store).index(indexName).getAll(value);
        req.onsuccess = () => res(req.result);
        req.onerror   = () => rej(req.error);
      })
    );
  }

  async put(store, record) {
    return this._tx(store, 'readwrite', (tx) =>
      new Promise((res, rej) => {
        const req = tx.objectStore(store).put(record);
        req.onsuccess = () => res(req.result);
        req.onerror   = () => rej(req.error);
      })
    );
  }

  async putMany(store, records) {
    if (!records?.length) return;
    return this._tx(store, 'readwrite', (tx) => {
      const os = tx.objectStore(store);
      for (const r of records) os.put(r);
      return new Promise((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror    = () => rej(tx.error);
      });
    });
  }

  async delete(store, key) {
    return this._tx(store, 'readwrite', (tx) =>
      new Promise((res, rej) => {
        const req = tx.objectStore(store).delete(key);
        req.onsuccess = () => res();
        req.onerror   = () => rej(req.error);
      })
    );
  }

  async clear(store) {
    return this._tx(store, 'readwrite', (tx) =>
      new Promise((res, rej) => {
        const req = tx.objectStore(store).clear();
        req.onsuccess = () => res();
        req.onerror   = () => rej(req.error);
      })
    );
  }

  // ── Sync queue ──────────────────────────────────────────────────────────
  async queueWrite(method, path, body = null) {
    return this.put('sync_queue', {
      method, path, body,
      created_at: new Date().toISOString(),
      retries: 0,
    });
  }

  async getQueue() {
    return this.getAll('sync_queue');
  }

  async removeFromQueue(id) {
    return this.delete('sync_queue', id);
  }

  // ── Meta / timestamps ────────────────────────────────────────────────────
  async setMeta(key, value) {
    return this.put('meta', { key, value });
  }

  async getMeta(key) {
    const rec = await this.get('meta', key);
    return rec?.value ?? null;
  }

  // ── Domain-specific reads ────────────────────────────────────────────────
  async getFeed(viewerId, { limit = 30 } = {}) {
    const all = await this.getAll('posts');
    // Sort newest-first, attach cached author info
    return all
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  }

  async getPostComments(postId) {
    const all = await this.getAllByIndex('comments', 'post_id', postId);
    return all.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  async getActiveStories() {
    const now = new Date().toISOString();
    const all = await this.getAll('stories');
    return all.filter((s) => s.expires_at > now)
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async getProducts({ category = null, search = null } = {}) {
    let all = await this.getAll('products');
    if (category) all = all.filter((p) => p.category === category);
    if (search) {
      const q = search.toLowerCase();
      all = all.filter((p) =>
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
    return all
      .filter((p) => p.status === 'available')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async getCourses({ category = null, resourceType = null } = {}) {
    let all = await this.getAll('courses');
    if (category)     all = all.filter((c) => c.category === c.category);
    if (resourceType) all = all.filter((c) => c.resource_type === resourceType);
    return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async getConversations(userId) {
    const all = await this.getAll('messages');
    const threadMap = new Map();
    for (const m of all) {
      const partnerId = m.sender_id === userId ? m.recipient_id : m.sender_id;
      const existing = threadMap.get(partnerId);
      if (!existing || new Date(m.created_at) > new Date(existing.created_at)) {
        threadMap.set(partnerId, m);
      }
    }
    const convs = [];
    for (const [partnerId, lastMsg] of threadMap) {
      const partner = await this.get('users', partnerId);
      const unread  = all.filter((m) => m.sender_id === partnerId && m.recipient_id === userId && !m.read_at).length;
      convs.push({ ...partner, partner_id: partnerId, last_message: lastMsg.body, last_at: lastMsg.created_at, unread_count: unread });
    }
    return convs.sort((a, b) => new Date(b.last_at) - new Date(a.last_at));
  }

  async getThread(userId, partnerId) {
    const all = await this.getAll('messages');
    return all
      .filter((m) => (m.sender_id === userId && m.recipient_id === partnerId) || (m.sender_id === partnerId && m.recipient_id === userId))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  async getNotifications(userId) {
    const all = await this.getAllByIndex('notifications', 'user_id', userId);
    return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async getUnreadNotificationCount(userId) {
    const all = await this.getAllByIndex('notifications', 'user_id', userId);
    return all.filter((n) => !n.is_read).length;
  }

  async getUnreadMessageCount(userId) {
    const all = await this.getAll('messages');
    return all.filter((m) => m.recipient_id === userId && !m.read_at).length;
  }

  async getUserProfile(userId) {
    return this.get('users', userId);
  }

  async getUserPosts(authorId) {
    return this.getAllByIndex('posts', 'author_id', authorId);
  }
}

export const localdb = new LocalDB();
