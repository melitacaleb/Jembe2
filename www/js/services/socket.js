// js/services/socket.js
const WS_URL = 'wss://jembebackend.onrender.com/ws';

class SocketService {
  constructor() {
    this.ws = null;
    this.listeners = { message: [], notification: [] };
    this.shouldReconnect = true;
    this._token = null;
    this._retries = 0;
  }

  connect(token) {
    if (!token) return;
    this._token = token;
    this.shouldReconnect = true;
    this._open();
  }

  _open() {
    try { this.ws = new WebSocket(WS_URL); }
    catch (_) { return; }

    this.ws.addEventListener('open', () => {
      this._retries = 0;
      this.ws.send(JSON.stringify({ type: 'auth', token: this._token }));
    });
    this.ws.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'message')      this._emit('message',      data.payload);
        if (data.type === 'notification') this._emit('notification', data.payload);
      } catch (_) {}
    });
    this.ws.addEventListener('close', () => {
      if (!this.shouldReconnect) return;
      const delay = Math.min(1500 * Math.pow(2, this._retries++), 30000);
      setTimeout(() => this._open(), delay);
    });
    this.ws.addEventListener('error', () => {});
  }

  disconnect() { this.shouldReconnect = false; this.ws?.close(); }
  on(ev, fn)   { if (!this.listeners[ev]) this.listeners[ev] = []; this.listeners[ev].push(fn); return () => { this.listeners[ev] = this.listeners[ev].filter((f) => f !== fn); }; }
  _emit(ev, p) { (this.listeners[ev] || []).forEach((fn) => fn(p)); }
}

export const socket = new SocketService();
