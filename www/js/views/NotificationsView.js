// js/views/NotificationsView.js
import { BaseView } from './BaseView.js';
import * as data    from '../services/data.js';

const ICON = { like: '❤️', comment: '💬', follow: '👤', order: '🛒', course_enroll: '📚' };
const TEXT = { like: 'liked your post', comment: 'commented on your post', follow: 'started following you', order: 'placed an order on your listing', course_enroll: 'enrolled in your course' };

export class NotificationsView extends BaseView {
  async render() {
    const wrap = this.el('div', { class: 'notifications-wrap' });
    this.mount(wrap);
    wrap.appendChild(this.el('h2', { class: 'section-title' }, ['🔔 Notifications']));
    if (!navigator.onLine) wrap.appendChild(this.el('div', { class: 'offline-note' }, ['📡 Showing cached notifications']));

    await data.markNotificationsRead();

    const render = (notifications) => {
      const existing = wrap.querySelector('.notif-list');
      if (existing) existing.remove();
      const list = this.el('div', { class: 'notif-list' });
      if (!notifications.length) {
        list.appendChild(this.el('div', { class: 'empty-state' }, ['No notifications yet.']));
      } else {
        notifications.forEach((n) => {
          const row = this.el('div', { class: 'notification-row' });
          row.appendChild(this.el('span', { class: 'notif-icon' }, [ICON[n.type] || '🔔']));
          row.appendChild(this.el('img',  { src: n.actor_avatar || 'icons/icon-192.png', class: 'avatar-sm' }));
          const txt = this.el('div', { class: 'notif-text' });
          txt.appendChild(this.el('strong', {}, [n.actor_name || n.actor_username || '']));
          txt.appendChild(document.createTextNode(` ${TEXT[n.type] || 'interacted with your content'}`));
          txt.appendChild(this.el('div', { class: 'notif-time' }, [this.timeAgo(n.created_at)]));
          row.appendChild(txt);
          list.appendChild(row);
        });
      }
      wrap.appendChild(list);
    };

    const notifs = await data.getNotifications({ onRefresh: render });
    render(notifs);
  }
}
