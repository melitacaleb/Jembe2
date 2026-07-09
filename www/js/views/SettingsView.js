// js/views/SettingsView.js
import { BaseView } from './BaseView.js';
import { api }      from '../services/api.js';
import { store }    from '../services/store.js';
import { localdb }  from '../services/localdb.js';
import { syncEngine }from '../services/sync.js';

const OPTIONS = {
  story_privacy:   [{ value:'public',label:'Everyone'},{ value:'followers',label:'Followers only'},{ value:'private',label:'Only me'}],
  profile_privacy: [{ value:'public',label:'Everyone'},{ value:'followers',label:'Followers only'},{ value:'private',label:'Only me'}],
  allow_messages:  [{ value:'everyone',label:'Everyone'},{ value:'followers',label:'Followers only'},{ value:'no_one',label:'No one'}],
};

export class SettingsView extends BaseView {
  async render() {
    const wrap = this.el('div', { class: 'settings-wrap' });
    this.mount(wrap);
    wrap.appendChild(this.el('h2', { class: 'section-title' }, ['⚙️ Settings']));

    // Offline sync status card
    wrap.appendChild(await this.buildSyncCard());

    try {
      const { settings } = await api.getSettings();
      wrap.appendChild(this.buildPrivacyCard(settings));
      wrap.appendChild(this.buildAccountCard(settings));
    } catch (_) {
      // Offline — show cached user info and sync card only
      const user = store.getUser();
      if (user) {
        const card = this.el('div', { class: 'settings-card' });
        card.appendChild(this.el('h3', { class: 'settings-card-title' }, ['Account']));
        card.appendChild(this.el('div', { class: 'setting-row static' }, [
          this.el('label', { class: 'setting-label' }, ['Username']),
          this.el('span',  { class: 'setting-value' }, [`@${user.username}`]),
        ]));
        card.appendChild(this.el('div', { class: 'setting-row static' }, [
          this.el('label', { class: 'setting-label' }, ['Status']),
          this.el('span',  { class: 'setting-value' }, ['📡 Offline — connect to change settings']),
        ]));
        const logoutBtn = this.el('button', { class: 'btn btn-secondary btn-sm' }, ['Log out']);
        logoutBtn.addEventListener('click', () => { api.setToken(null); window.location.hash = '/auth'; location.reload(); });
        card.appendChild(logoutBtn);
        wrap.appendChild(card);
      }
    }
  }

  async buildSyncCard() {
    const card = this.el('div', { class: 'settings-card' });
    card.appendChild(this.el('h3', { class: 'settings-card-title' }, ['Offline Storage']));

    const lastSync = await localdb.getMeta('last_sync');
    const queue    = await localdb.getQueue();
    const online   = navigator.onLine;

    const statusRow = this.el('div', { class: 'setting-row static' });
    statusRow.appendChild(this.el('label', { class: 'setting-label' }, ['Connection']));
    statusRow.appendChild(this.el('span',  { class: 'setting-value' }, [online ? '🟢 Online' : '🔴 Offline']));
    card.appendChild(statusRow);

    const syncRow = this.el('div', { class: 'setting-row static' });
    syncRow.appendChild(this.el('label', { class: 'setting-label' }, ['Last synced']));
    syncRow.appendChild(this.el('span',  { class: 'setting-value' }, [lastSync ? this.timeAgo(lastSync) : 'Never']));
    card.appendChild(syncRow);

    if (queue.length) {
      const qRow = this.el('div', { class: 'setting-row static' });
      qRow.appendChild(this.el('label', { class: 'setting-label' }, ['Queued writes']));
      qRow.appendChild(this.el('span',  { class: 'setting-value' }, [`${queue.length} waiting to sync`]));
      card.appendChild(qRow);
    }

    if (online) {
      const syncBtn = this.el('button', { class: 'btn btn-secondary btn-sm' }, ['🔄 Sync now']);
      syncBtn.addEventListener('click', async () => {
        syncBtn.textContent = 'Syncing...';
        syncBtn.disabled    = true;
        await syncEngine.flushQueue();
        await syncEngine.pullAll();
        syncBtn.textContent = '✅ Done';
        setTimeout(() => window.location.reload(), 800);
      });
      card.appendChild(syncBtn);
    }

    const clearBtn = this.el('button', { class: 'btn btn-secondary btn-sm' }, ['🗑️ Clear local cache']);
    clearBtn.style.marginLeft = '8px';
    clearBtn.addEventListener('click', async () => {
      if (!confirm('Clear all locally cached data? You will need to reconnect to reload it.')) return;
      for (const store of ['posts','products','courses','messages','notifications','stories','users','follows','comments']) {
        await localdb.clear(store).catch(() => {});
      }
      this.toast('Cache cleared', 'success');
    });
    card.appendChild(clearBtn);

    return card;
  }

  buildPrivacyCard(settings) {
    const card = this.el('div', { class: 'settings-card' });
    card.appendChild(this.el('h3', { class: 'settings-card-title' }, ['Privacy']));
    [
      ['Who can see your stories?',  'story_privacy'],
      ['Who can see your profile?',  'profile_privacy'],
      ['Who can message you?',       'allow_messages'],
    ].forEach(([label, key]) => card.appendChild(this.buildSelectRow(label, key, settings[key])));

    const locRow = this.el('div', { class: 'setting-row' });
    locRow.appendChild(this.el('label', { class: 'setting-label' }, ['Show location on profile']));
    const toggle = document.createElement('input');
    toggle.type = 'checkbox'; toggle.checked = !!settings.show_location;
    toggle.addEventListener('change', async () => {
      try { await api.updateSettings({ show_location: toggle.checked }); this.toast('Saved','success'); }
      catch (err) { this.toast(err.message,'error'); }
    });
    locRow.appendChild(toggle);
    card.appendChild(locRow);
    return card;
  }

  buildSelectRow(labelText, key, currentValue) {
    const row = this.el('div', { class: 'setting-row' });
    row.appendChild(this.el('label', { class: 'setting-label' }, [labelText]));
    const sel = this.el('select', { class: 'input setting-select' },
      OPTIONS[key].map((o) => this.el('option', { value: o.value, ...(o.value === currentValue ? { selected: 'selected' } : {}) }, [o.label]))
    );
    sel.value = currentValue;
    sel.addEventListener('change', async () => {
      try { await api.updateSettings({ [key]: sel.value }); this.toast('Saved','success'); }
      catch (err) { this.toast(err.message,'error'); }
    });
    row.appendChild(sel);
    return row;
  }

  buildAccountCard(settings) {
    const card = this.el('div', { class: 'settings-card' });
    card.appendChild(this.el('h3', { class: 'settings-card-title' }, ['Account']));
    card.appendChild(this.el('div', { class: 'setting-row static' }, [
      this.el('label', { class: 'setting-label' }, ['Username']),
      this.el('span',  { class: 'setting-value' }, [`@${settings.username}`]),
    ]));
    card.appendChild(this.el('div', { class: 'setting-row static' }, [
      this.el('label', { class: 'setting-label' }, ['Email']),
      this.el('span',  { class: 'setting-value' }, [settings.email]),
    ]));
    const logoutBtn = this.el('button', { class: 'btn btn-secondary btn-sm' }, ['Log out']);
    logoutBtn.addEventListener('click', () => { api.setToken(null); window.location.hash = '/auth'; location.reload(); });
    card.appendChild(logoutBtn);
    return card;
  }
}
