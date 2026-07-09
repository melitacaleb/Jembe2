// js/services/api.js
// ALL API calls point at the live Render backend.
// The APK uses this same file — data is always fetched from / saved to
// the same Neon Postgres database as the website.
// When offline, the service worker returns cached GET responses.

const BASE_URL = 'https://jembebackend.onrender.com/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('fc_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('fc_token', token);
    else localStorage.removeItem('fc_token');
  }

  async request(path, { method = 'GET', body = null, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && this.token) headers.Authorization = `Bearer ${this.token}`;
    let res;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (_) {
      // Network failure — service worker returns 503 with {offline:true}
      throw new Error('You are offline. Please check your connection.');
    }
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  // ---- Upload (multipart) ----
  async uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    const headers = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`${BASE_URL}/uploads`, { method: 'POST', headers, body: formData });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    return data;
  }

  // ---- Auth ----
  register(p) { return this.request('/auth/register', { method: 'POST', body: p, auth: false }); }
  login(p)    { return this.request('/auth/login',    { method: 'POST', body: p, auth: false }); }
  me()        { return this.request('/auth/me'); }

  // ---- Users ----
  getProfile(id)        { return this.request(`/users/${id}`); }
  updateProfile(id, d)  { return this.request(`/users/${id}`, { method: 'PUT', body: d }); }
  searchUsers(q)        { return this.request(`/users/search?q=${encodeURIComponent(q)}`); }
  follow(id)            { return this.request(`/users/${id}/follow`, { method: 'POST' }); }
  unfollow(id)          { return this.request(`/users/${id}/follow`, { method: 'DELETE' }); }
  getSettings()         { return this.request('/users/settings/me'); }
  updateSettings(d)     { return this.request('/users/settings/me', { method: 'PUT', body: d }); }
  registerPushToken(d)  { return this.request('/users/push-token', { method: 'POST', body: d }); }

  // ---- Posts ----
  getFeed(limit=20, offset=0) { return this.request(`/posts/feed?limit=${limit}&offset=${offset}`); }
  createPost(p)               { return this.request('/posts', { method: 'POST', body: p }); }
  deletePost(id)              { return this.request(`/posts/${id}`, { method: 'DELETE' }); }
  likePost(id)                { return this.request(`/posts/${id}/like`, { method: 'POST' }); }
  unlikePost(id)              { return this.request(`/posts/${id}/like`, { method: 'DELETE' }); }
  getComments(id)             { return this.request(`/posts/${id}/comments`); }
  addComment(id, body)        { return this.request(`/posts/${id}/comments`, { method: 'POST', body: { body } }); }

  // ---- Stories ----
  getStories()      { return this.request('/stories'); }
  createStory(p)    { return this.request('/stories', { method: 'POST', body: p }); }
  viewStory(id)     { return this.request(`/stories/${id}/view`, { method: 'POST' }); }

  // ---- Marketplace ----
  getProducts(params='')       { return this.request(`/products${params}`); }
  createProduct(p)             { return this.request('/products', { method: 'POST', body: p }); }
  myProducts()                 { return this.request('/products/mine'); }
  updateProduct(id, d)         { return this.request(`/products/${id}`, { method: 'PUT', body: d }); }
  deleteProduct(id)            { return this.request(`/products/${id}`, { method: 'DELETE' }); }
  orderProduct(id, qty)        { return this.request(`/products/${id}/order`, { method: 'POST', body: { quantity: qty } }); }
  myOrders()                   { return this.request('/products/orders/mine'); }
  updateOrderStatus(id, status){ return this.request(`/products/orders/${id}/status`, { method: 'PUT', body: { status } }); }

  // ---- Education ----
  getCourses(params='')    { return this.request(`/courses${params}`); }
  createCourse(p)          { return this.request('/courses', { method: 'POST', body: p }); }
  myCourses()              { return this.request('/courses/mine'); }
  enrollCourse(id)         { return this.request(`/courses/${id}/enroll`, { method: 'POST' }); }
  myEnrollments()          { return this.request('/courses/enrollments/mine'); }
  updateCourseProgress(id, progress) { return this.request(`/courses/${id}/progress`, { method: 'PUT', body: { progress } }); }

  // ---- Messages ----
  getConversations()        { return this.request('/messages/conversations'); }
  getThread(partnerId)      { return this.request(`/messages/${partnerId}`); }
  sendMessage(partnerId, b) { return this.request(`/messages/${partnerId}`, { method: 'POST', body: { body: b } }); }
  getUnreadMessageCount()   { return this.request('/messages/unread-count'); }

  // ---- Notifications ----
  getNotifications()        { return this.request('/notifications'); }
  getUnreadNotificationCount(){ return this.request('/notifications/unread-count'); }
  markNotificationsRead()   { return this.request('/notifications/mark-read', { method: 'PUT' }); }
}

export const api = new ApiService();
