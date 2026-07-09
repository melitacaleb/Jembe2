// js/services/router.js
class Router {
  constructor(mountSelector) {
    this.routes = {};
    this.mount = document.querySelector(mountSelector);
    window.addEventListener('hashchange', () => this.resolve());
    // Handle navigation messages from service worker
    navigator.serviceWorker?.addEventListener('message', (e) => {
      if (e.data?.type === 'navigate') window.location.hash = e.data.path;
    });
  }
  register(path, ViewClass) { this.routes[path] = ViewClass; return this; }
  navigate(path) { window.location.hash = path; }
  resolve() {
    const hash = window.location.hash.slice(1) || '/feed';
    const segments = hash.split('/').filter(Boolean);
    const path = '/' + (segments[0] || 'feed');
    const param = segments[1] || null;
    const ViewClass = this.routes[path] || this.routes['/feed'];
    this.mount.innerHTML = '';
    const view = new ViewClass(this.mount, param);
    view.render();
    document.dispatchEvent(new CustomEvent('route:changed', { detail: { path } }));
  }
  start() { this.resolve(); }
}
export { Router };
