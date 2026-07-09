// js/components/StoriesBar.js
import { api }         from '../services/api.js';
import { MediaPicker } from './MediaPicker.js';
import { store }       from '../services/store.js';
import * as data       from '../services/data.js';

export class StoriesBar {
  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'stories-bar';
  }

  async render() {
    this.root.innerHTML = '';
    this.root.appendChild(this.buildAdd());

    const stories = await data.getStories({
      onRefresh: (fresh) => {
        this.root.innerHTML = '';
        this.root.appendChild(this.buildAdd());
        const byAuthor = new Map();
        fresh.forEach((s) => { if (!byAuthor.has(s.author_id)) byAuthor.set(s.author_id, s); });
        byAuthor.forEach((s) => this.root.appendChild(this.buildBubble(s)));
      },
    });

    const byAuthor = new Map();
    stories.forEach((s) => { if (!byAuthor.has(s.author_id)) byAuthor.set(s.author_id, s); });
    byAuthor.forEach((s) => this.root.appendChild(this.buildBubble(s)));

    return this.root;
  }

  buildAdd() {
    const user = store.getUser();
    const wrap = document.createElement('div');
    wrap.className = 'story-bubble add-story';

    const ring  = document.createElement('div');
    ring.className = 'story-ring add';
    ring.innerHTML = `<img src="${user?.avatar_url || 'icons/icon-192.png'}" class="story-avatar"><span class="story-plus">+</span>`;

    const label = document.createElement('div');
    label.className = 'story-label';
    label.textContent = 'Your Story';

    const picker    = new MediaPicker({ label: '', onChange: async (urls) => {
      try { await data.createStory({ media_url: urls[0] }); await this.render(); }
      catch (err) { alert(err.message); }
    }});
    const pickerEl  = picker.render();
    pickerEl.classList.add('story-picker-hidden');

    ring.addEventListener('click', () => {
      if (!navigator.onLine) { alert('Story upload requires a connection.'); return; }
      pickerEl.querySelector('.media-btn')?.click();
    });

    wrap.appendChild(ring);
    wrap.appendChild(label);
    wrap.appendChild(pickerEl);
    return wrap;
  }

  buildBubble(story) {
    const wrap = document.createElement('div');
    wrap.className = 'story-bubble';
    const ring = document.createElement('div');
    ring.className = story.viewed_by_viewer ? 'story-ring viewed' : 'story-ring';
    ring.innerHTML = `<img src="${story.avatar_url || 'icons/icon-192.png'}" class="story-avatar">`;
    ring.addEventListener('click', () => this.open(story));
    const label = document.createElement('div');
    label.className = 'story-label';
    label.textContent = story.username || '';
    wrap.appendChild(ring);
    wrap.appendChild(label);
    return wrap;
  }

  open(story) {
    if (navigator.onLine) api.viewStory(story.id).catch(() => {});
    const overlay = document.createElement('div');
    overlay.className = 'story-viewer-overlay';
    overlay.innerHTML = `<div class="story-viewer">
      <div class="story-viewer-header">
        <img src="${story.avatar_url || 'icons/icon-192.png'}" class="avatar-sm">
        <span>${story.full_name || story.username || ''}</span>
        <button class="story-close">✕</button>
      </div>
      <img src="${story.media_url}" class="story-viewer-media">
      ${story.caption ? `<div class="story-caption">${story.caption}</div>` : ''}
    </div>`;
    overlay.querySelector('.story-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }
}
