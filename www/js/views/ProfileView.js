// js/views/ProfileView.js
import { BaseView }    from './BaseView.js';
import { api }         from '../services/api.js';
import { store }       from '../services/store.js';
import { MediaPicker } from '../components/MediaPicker.js';
import * as data       from '../services/data.js';

export class ProfileView extends BaseView {
  async render() {
    const userId = this.param || store.getUser()?.id;
    const wrap   = this.el('div', { class: 'profile-wrap' });
    this.mount(wrap);

    const isSelf = store.getUser()?.id === userId;

    const renderProfile = ({ user, counts, posts }) => {
      const old = wrap.querySelector('.profile-inner');
      if (old) old.remove();
      const inner = this.el('div', { class: 'profile-inner' });

      const header = this.el('div', { class: 'profile-header' });
      const avatar = this.el('img', { src: user.avatar_url || 'icons/icon-192.png', class: 'avatar-lg' });
      const info   = this.el('div', {});
      const nameRow= this.el('h2', {});
      nameRow.appendChild(document.createTextNode(user.full_name || ''));
      if (user.account_type === 'organization') nameRow.appendChild(this.el('span', { class: 'badge-org' }, ['ORG']));
      if (user.is_verified) nameRow.appendChild(this.el('span', { class: 'badge-verified' }, ['✓']));
      info.appendChild(nameRow);
      info.appendChild(this.el('div', { class: 'profile-username' }, [`@${user.username}`]));
      info.appendChild(this.el('div', { class: 'profile-bio' },      [user.bio || '']));
      info.appendChild(this.el('div', { class: 'profile-location' }, [user.location || '']));
      info.appendChild(this.el('div', { class: 'profile-stats' }, [
        this.el('span', {}, [`${counts?.followers || 0} followers`]),
        this.el('span', {}, [`${counts?.following || 0} following`]),
      ]));
      header.appendChild(avatar);
      header.appendChild(info);
      inner.appendChild(header);

      if (isSelf) {
        const picker = new MediaPicker({
          label: 'Change photo',
          onChange: async (urls) => {
            try {
              const { user: u } = await api.updateProfile(user.id, { avatar_url: urls[0] });
              store.setUser(u);
              avatar.src = urls[0];
              this.toast('Photo updated', 'success');
            } catch (err) { this.toast(err.message, 'error'); }
          },
        });
        inner.appendChild(picker.render());
        const settingsBtn = this.el('button', { class: 'btn btn-secondary btn-sm' }, ['⚙️ Settings']);
        settingsBtn.addEventListener('click', () => { window.location.hash = '/settings'; });
        inner.appendChild(settingsBtn);
      } else {
        const followBtn = this.el('button', { class: 'btn btn-primary btn-sm' }, ['Follow']);
        followBtn.addEventListener('click', async () => {
          if (!navigator.onLine) { this.toast('Follow queued for when you\'re online', 'info'); }
          try { await api.follow(user.id); this.toast('Following!', 'success'); }
          catch (err) { this.toast(err.message, 'error'); }
        });
        const msgBtn = this.el('button', { class: 'btn btn-secondary btn-sm' }, ['✉️ Message']);
        msgBtn.addEventListener('click', () => { window.location.hash = `/messages/${user.id}`; });
        inner.appendChild(followBtn);
        inner.appendChild(msgBtn);
      }

      const grid = this.el('div', { class: 'profile-grid' });
      (posts || []).forEach((p) => {
        const imgs = Array.isArray(p.media_urls) ? p.media_urls : [];
        grid.appendChild(this.el('img', { src: imgs[0] || 'icons/icon-192.png', class: 'grid-thumb' }));
      });
      inner.appendChild(grid);
      wrap.appendChild(inner);
    };

    // Show local data instantly
    const local = await data.getProfile(userId, { onRefresh: renderProfile });
    if (local) {
      renderProfile(local);
    } else {
      wrap.appendChild(this.el('div', { class: 'empty-state' }, ['Loading profile...']));
    }
  }
}
