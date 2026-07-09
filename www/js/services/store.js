// js/services/store.js
class Store {
  constructor() { this.state = { user: null }; this.listeners = []; }
  setUser(user) { this.state.user = user; this.listeners.forEach((f) => f(this.state)); }
  getUser()     { return this.state.user; }
  subscribe(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }
}
export const store = new Store();
