// js/components/Sidebar.js
export class Sidebar {
  constructor(navEl, router) {
    this.navEl     = navEl;
    this.router    = router;
    this.collapsed = false;
    this.items     = [
      { path: '/feed',          icon: '🏠', label: 'Home' },
      { path: '/messages',      icon: '✉️', label: 'Messages',      badgeKey: 'messages' },
      { path: '/notifications', icon: '🔔', label: 'Notifications', badgeKey: 'notifications' },
      { path: '/marketplace',   icon: '🛒', label: 'Marketplace' },
      { path: '/education',     icon: '📚', label: 'Education' },
      { path: '/profile',       icon: '👤', label: 'Profile' },
      { path: '/settings',      icon: '⚙️', label: 'Settings' },
    ];
    this.badges = { messages: 0, notifications: 0 };
  }

  setBadge(key, count) { this.badges[key] = count; this.render(); }

  toggle() {
    this.collapsed = !this.collapsed;
    document.body.classList.toggle('sidebar-collapsed', this.collapsed);
    this.render();
  }

  render() {
    this.navEl.innerHTML = '';
    this.navEl.classList.toggle('collapsed', this.collapsed);

    // Brand
    const brand = document.createElement('div');
    brand.className = 'sidebar-brand';
    brand.innerHTML = this.collapsed ? '🌾' : '🌾 <span>Farmers Connect</span>';
    this.navEl.appendChild(brand);

    // Sync indicator (hidden by default, shown during sync)
    const syncDot = document.createElement('div');
    syncDot.id = 'sync-indicator';
    syncDot.className = 'sync-dot';
    syncDot.title = 'Syncing...';
    syncDot.style.display = 'none';
    brand.appendChild(syncDot);

    // Nav items
    const list = document.createElement('div');
    list.className = 'sidebar-items';
    this.items.forEach((item) => {
      const btn   = document.createElement('button');
      btn.className = 'sidebar-item';
      const count = item.badgeKey ? this.badges[item.badgeKey] : 0;
      btn.innerHTML = `
        <span class="sidebar-icon">${item.icon}${count ? `<span class="sidebar-badge">${count > 9 ? '9+' : count}</span>` : ''}</span>
        <span class="sidebar-label">${item.label}</span>
      `;
      btn.addEventListener('click', () => this.router.navigate(item.path));
      list.appendChild(btn);
    });
    this.navEl.appendChild(list);

    // Network status pip
    const netPip = document.createElement('div');
    netPip.className = navigator.onLine ? 'net-pip online' : 'net-pip offline';
    netPip.title     = navigator.onLine ? 'Online' : 'Offline — showing cached data';
    this.navEl.appendChild(netPip);

    // Collapse toggle
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'sidebar-toggle';
    toggleBtn.innerHTML = this.collapsed ? '»' : '«';
    toggleBtn.addEventListener('click', () => this.toggle());
    this.navEl.appendChild(toggleBtn);

    this.highlight();
    window.addEventListener('online',  () => { netPip.className = 'net-pip online';  netPip.title = 'Online'; }, { once: false });
    window.addEventListener('offline', () => { netPip.className = 'net-pip offline'; netPip.title = 'Offline'; }, { once: false });
  }

  highlight() {
    const cur  = (window.location.hash.slice(1).split('/').filter(Boolean)[0] || 'feed');
    const path = '/' + cur;
    this.navEl.querySelectorAll('.sidebar-item').forEach((btn, i) => {
      btn.classList.toggle('active', this.items[i].path === path);
    });
    document.addEventListener('route:changed', () => {
      const c = (window.location.hash.slice(1).split('/').filter(Boolean)[0] || 'feed');
      const p = '/' + c;
      this.navEl.querySelectorAll('.sidebar-item').forEach((b, i) => b.classList.toggle('active', this.items[i].path === p));
    });
  }
}
