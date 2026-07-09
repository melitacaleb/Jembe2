// js/services/data.js
// DataLayer — the single interface all views use instead of calling api.js
// or localdb.js directly.
//
// Every read:
//   1. Returns data from IndexedDB immediately (works offline, zero latency).
//   2. Fires a background network request to refresh the local data.
//   3. Calls the provided `onRefresh` callback with fresh data when it arrives.
//
// Every write:
//   1. Updates IndexedDB immediately (optimistic — instant UI feedback).
//   2. Sends the request to the backend.
//   3. If offline, queues the write in sync_queue for replay when online.
//   4. On success, stores the server's canonical response back to IndexedDB.

import { localdb }   from './localdb.js';
import { syncEngine } from './sync.js';
import { api }       from './api.js';
import { store }     from './store.js';

// ── helpers ─────────────────────────────────────────────────────────────────
async function remoteWrite(method, path, body, localFn = null) {
  // Apply optimistic local update first if caller provides one
  if (localFn) await localFn();

  if (!navigator.onLine) {
    await localdb.queueWrite(method, path, body);
    return null;
  }
  try {
    const result = await api.request(path, { method, body });
    return result;
  } catch (err) {
    if (err.message?.includes('offline') || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      await localdb.queueWrite(method, path, body);
      return null;
    }
    throw err;
  }
}

// ── Feed ─────────────────────────────────────────────────────────────────────
export async function getFeed({ limit = 30, onRefresh } = {}) {
  const local = await localdb.getFeed(store.getUser()?.id, { limit });

  // Background network refresh
  if (navigator.onLine) {
    api.getFeed(limit, 0)
      .then(async ({ posts }) => {
        await localdb.putMany('posts', posts);
        if (onRefresh) onRefresh(posts);
      })
      .catch(() => {});
  }

  return local;
}

export async function createPost(payload) {
  const optimistic = {
    id: 'local_' + Date.now(),
    author_id: store.getUser().id,
    username:  store.getUser().username,
    full_name: store.getUser().full_name,
    avatar_url:store.getUser().avatar_url,
    account_type: store.getUser().account_type,
    like_count: 0,
    comment_count: 0,
    liked_by_viewer: false,
    created_at: new Date().toISOString(),
    ...payload,
  };
  await localdb.put('posts', optimistic);

  const result = await remoteWrite('POST', '/posts', payload);
  if (result?.post) {
    await localdb.delete('posts', optimistic.id);
    await localdb.put('posts', { ...result.post, username: optimistic.username, full_name: optimistic.full_name, avatar_url: optimistic.avatar_url, account_type: optimistic.account_type, like_count: 0, comment_count: 0, liked_by_viewer: false });
  }
  return optimistic;
}

export async function likePost(postId) {
  const post = await localdb.get('posts', postId);
  if (post) {
    post.liked_by_viewer = true;
    post.like_count = (post.like_count || 0) + 1;
    await localdb.put('posts', post);
  }
  await remoteWrite('POST', `/posts/${postId}/like`, null);
}

export async function unlikePost(postId) {
  const post = await localdb.get('posts', postId);
  if (post) {
    post.liked_by_viewer = false;
    post.like_count = Math.max(0, (post.like_count || 1) - 1);
    await localdb.put('posts', post);
  }
  await remoteWrite('DELETE', `/posts/${postId}/like`, null);
}

export async function getComments(postId, { onRefresh } = {}) {
  const local = await localdb.getPostComments(postId);
  if (navigator.onLine) {
    api.getComments(postId)
      .then(async ({ comments }) => {
        await localdb.putMany('comments', comments.map((c) => ({ ...c, post_id: postId })));
        if (onRefresh) onRefresh(comments);
      }).catch(() => {});
  }
  return local;
}

export async function addComment(postId, body) {
  const optimistic = {
    id: 'local_' + Date.now(),
    post_id: postId,
    author_id: store.getUser().id,
    username: store.getUser().username,
    avatar_url: store.getUser().avatar_url,
    body,
    created_at: new Date().toISOString(),
  };
  await localdb.put('comments', optimistic);
  await remoteWrite('POST', `/posts/${postId}/comments`, { body });
  return optimistic;
}

// ── Stories ──────────────────────────────────────────────────────────────────
export async function getStories({ onRefresh } = {}) {
  const local = await localdb.getActiveStories();
  if (navigator.onLine) {
    api.getStories()
      .then(async ({ stories }) => {
        await localdb.putMany('stories', stories);
        if (onRefresh) onRefresh(stories);
      }).catch(() => {});
  }
  return local;
}

export async function createStory(payload) {
  const optimistic = {
    id: 'local_' + Date.now(),
    author_id: store.getUser().id,
    username: store.getUser().username,
    avatar_url: store.getUser().avatar_url,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    created_at: new Date().toISOString(),
    viewed_by_viewer: false,
    ...payload,
  };
  await localdb.put('stories', optimistic);
  const result = await remoteWrite('POST', '/stories', payload);
  if (result?.story) {
    await localdb.delete('stories', optimistic.id);
    await localdb.put('stories', result.story);
  }
  return optimistic;
}

// ── Marketplace ───────────────────────────────────────────────────────────────
export async function getProducts({ category, search, onRefresh } = {}) {
  const local = await localdb.getProducts({ category, search });
  if (navigator.onLine) {
    const params = new URLSearchParams();
    if (search)   params.set('search', search);
    if (category) params.set('category', category);
    params.set('limit', '100');
    api.getProducts(`?${params}`)
      .then(async ({ products }) => {
        await localdb.putMany('products', products);
        if (onRefresh) onRefresh(products.filter((p) => {
          if (category && p.category !== category) return false;
          if (search) { const q = search.toLowerCase(); return p.title?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q); }
          return true;
        }));
      }).catch(() => {});
  }
  return local;
}

export async function createProduct(payload) {
  const optimistic = {
    id: 'local_' + Date.now(),
    seller_id: store.getUser().id,
    username: store.getUser().username,
    full_name: store.getUser().full_name,
    avatar_url: store.getUser().avatar_url,
    account_type: store.getUser().account_type,
    status: 'available',
    created_at: new Date().toISOString(),
    ...payload,
  };
  await localdb.put('products', optimistic);
  const result = await remoteWrite('POST', '/products', payload);
  if (result?.product) {
    await localdb.delete('products', optimistic.id);
    await localdb.put('products', result.product);
  }
  return optimistic;
}

export async function placeOrder(productId, quantity) {
  return remoteWrite('POST', `/products/${productId}/order`, { quantity });
}

// ── Education ─────────────────────────────────────────────────────────────────
export async function getCourses({ category, resourceType, onRefresh } = {}) {
  const local = await localdb.getCourses({ category, resourceType });
  if (navigator.onLine) {
    const params = new URLSearchParams({ limit: '100' });
    if (category)     params.set('category', category);
    if (resourceType) params.set('resource_type', resourceType);
    api.getCourses(`?${params}`)
      .then(async ({ courses }) => {
        await localdb.putMany('courses', courses);
        let filtered = courses;
        if (resourceType) filtered = filtered.filter((c) => c.resource_type === resourceType);
        if (category)     filtered = filtered.filter((c) => c.category === category);
        if (onRefresh) onRefresh(filtered);
      }).catch(() => {});
  }
  return local;
}

export async function createCourse(payload) {
  const optimistic = {
    id: 'local_' + Date.now(),
    provider_id: store.getUser().id,
    provider_name: store.getUser().full_name,
    provider_avatar: store.getUser().avatar_url,
    is_published: true,
    created_at: new Date().toISOString(),
    ...payload,
  };
  await localdb.put('courses', optimistic);
  const result = await remoteWrite('POST', '/courses', payload);
  if (result?.course) {
    await localdb.delete('courses', optimistic.id);
    await localdb.put('courses', result.course);
  }
  return optimistic;
}

export async function enrollCourse(courseId) {
  const enrollment = { course_id: courseId, user_id: store.getUser().id, enrolled_at: new Date().toISOString(), progress: 0 };
  await localdb.put('enrollments', enrollment);
  return remoteWrite('POST', `/courses/${courseId}/enroll`, null);
}

// ── Messages ──────────────────────────────────────────────────────────────────
export async function getConversations({ onRefresh } = {}) {
  const userId = store.getUser()?.id;
  const local  = await localdb.getConversations(userId);
  if (navigator.onLine) {
    api.getConversations()
      .then(async ({ conversations }) => {
        for (const c of conversations) {
          await localdb.put('users', { id: c.partner_id, username: c.username, full_name: c.full_name, avatar_url: c.avatar_url, account_type: c.account_type });
        }
        if (onRefresh) onRefresh(conversations);
      }).catch(() => {});
  }
  return local;
}

export async function getThread(partnerId, { onRefresh } = {}) {
  const userId = store.getUser()?.id;
  const local  = await localdb.getThread(userId, partnerId);
  if (navigator.onLine) {
    api.getThread(partnerId)
      .then(async ({ messages }) => {
        await localdb.putMany('messages', messages);
        if (onRefresh) onRefresh(messages);
      }).catch(() => {});
  }
  return local;
}

export async function sendMessage(partnerId, body) {
  const userId = store.getUser()?.id;
  const optimistic = {
    id: 'local_' + Date.now(),
    sender_id: userId,
    recipient_id: partnerId,
    body,
    read_at: null,
    created_at: new Date().toISOString(),
  };
  await localdb.put('messages', optimistic);

  if (!navigator.onLine) {
    await localdb.queueWrite('POST', `/messages/${partnerId}`, { body });
    return optimistic;
  }
  try {
    const { message } = await api.sendMessage(partnerId, body);
    await localdb.delete('messages', optimistic.id);
    await localdb.put('messages', message);
    return message;
  } catch (err) {
    await localdb.queueWrite('POST', `/messages/${partnerId}`, { body });
    return optimistic;
  }
}

// ── Notifications ─────────────────────────────────────────────────────────────
export async function getNotifications({ onRefresh } = {}) {
  const userId = store.getUser()?.id;
  const local  = await localdb.getNotifications(userId);
  if (navigator.onLine) {
    api.getNotifications()
      .then(async ({ notifications }) => {
        const notifs = notifications.map((n) => ({ ...n, user_id: userId }));
        await localdb.putMany('notifications', notifs);
        if (onRefresh) onRefresh(notifications);
      }).catch(() => {});
  }
  return local;
}

export async function markNotificationsRead() {
  const userId = store.getUser()?.id;
  const all    = await localdb.getNotifications(userId);
  for (const n of all) { n.is_read = true; await localdb.put('notifications', n); }
  if (navigator.onLine) api.markNotificationsRead().catch(() => {});
}

export async function getUnreadCounts() {
  const userId = store.getUser()?.id;
  const [msgs, notifs] = await Promise.all([
    localdb.getUnreadMessageCount(userId),
    localdb.getUnreadNotificationCount(userId),
  ]);
  // Background network refresh of counts
  if (navigator.onLine) {
    Promise.all([api.getUnreadMessageCount(), api.getUnreadNotificationCount()])
      .catch(() => {});
  }
  return { messages: msgs, notifications: notifs };
}

// ── User profile ──────────────────────────────────────────────────────────────
export async function getProfile(userId, { onRefresh } = {}) {
  const localUser  = await localdb.getUserProfile(userId);
  const localPosts = await localdb.getUserPosts(userId);
  const local = localUser ? { user: localUser, counts: { followers: 0, following: 0 }, posts: localPosts } : null;

  if (navigator.onLine) {
    api.getProfile(userId)
      .then(async ({ user, counts, posts }) => {
        await localdb.put('users', user);
        await localdb.putMany('posts', posts);
        if (onRefresh) onRefresh({ user, counts, posts });
      }).catch(() => {});
  }

  return local;
}

// ── Upload (image always needs a connection) ───────────────────────────────────
export async function uploadImage(file) {
  if (!navigator.onLine) {
    throw new Error('Image upload needs a connection. It will be available once you are back online.');
  }
  return api.uploadImage(file);
}
