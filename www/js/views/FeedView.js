// js/views/FeedView.js
import { BaseView }    from './BaseView.js';
import { store }       from '../services/store.js';
import { MediaPicker } from '../components/MediaPicker.js';
import { StoriesBar }  from '../components/StoriesBar.js';
import * as data       from '../services/data.js';

export class FeedView extends BaseView {
  async render() {
    const wrap = this.el('div', { class: 'feed-wrap' });
    this.mount(wrap);

    const storiesBar = new StoriesBar();
    wrap.appendChild(await storiesBar.render());
    wrap.appendChild(this.buildComposer());

    const list = this.el('div', { class: 'feed-list' });
    wrap.appendChild(list);

    const renderPosts = (posts) => {
      list.innerHTML = '';
      if (!posts.length) {
        list.appendChild(this.el('div', { class: 'empty-state' }, ['No posts yet — be the first to share!']));
        return;
      }
      posts.forEach((p) => list.appendChild(this.buildPostCard(p)));
    };

    // Show local data instantly, refresh when network responds
    const local = await data.getFeed({ limit: 30, onRefresh: renderPosts });
    renderPosts(local);
  }

  buildComposer() {
    const user = store.getUser();
    const box  = this.el('div', { class: 'composer' });
    const caption  = this.el('textarea', { class: 'input', placeholder: `Share something, ${user?.full_name || 'farmer'}...`, rows: '2' });
    const location = this.el('input',    { class: 'input', placeholder: 'Location (optional)' });
    const postBtn  = this.el('button',   { class: 'btn btn-primary' }, ['Post']);
    const error    = this.el('div',      { class: 'form-error' });

    const picker   = new MediaPicker({ label: 'Photo' });
    box.appendChild(caption);
    box.appendChild(picker.render());
    box.appendChild(location);
    box.appendChild(error);
    box.appendChild(postBtn);

    postBtn.addEventListener('click', async () => {
      if (picker.isUploading()) { error.textContent = 'Photo still uploading...'; return; }
      if (!picker.getUrl())     { error.textContent = 'Please add a photo.'; return; }
      try {
        await data.createPost({ caption: caption.value, media_urls: [picker.getUrl()], location: location.value });
        window.location.reload();
      } catch (err) { error.textContent = err.message; }
    });
    return box;
  }

  buildPostCard(post) {
    const card = this.el('article', { class: 'post-card' });

    const header = this.el('div', { class: 'post-header' });
    header.style.cursor = 'pointer';
    header.appendChild(this.el('img', { src: post.avatar_url || 'icons/icon-192.png', class: 'avatar-sm' }));
    const meta = this.el('div', { class: 'post-header-meta' });
    meta.appendChild(this.el('span', { class: 'post-author' }, [post.full_name || post.username || '']));
    if (post.account_type === 'organization') meta.appendChild(this.el('span', { class: 'badge-org' }, ['ORG']));
    header.appendChild(meta);
    header.addEventListener('click', () => { window.location.hash = `/profile/${post.author_id}`; });

    const mediaUrl = Array.isArray(post.media_urls) ? post.media_urls[0] : post.media_url || '';
    const media    = this.el('img', { src: mediaUrl, class: 'post-media', alt: '' });

    const myLike = this.el('button', { class: post.liked_by_viewer ? 'icon-btn liked' : 'icon-btn' },
      [post.liked_by_viewer ? '❤️' : '🤍', ` ${post.like_count || 0}`]);
    myLike.addEventListener('click', async () => {
      try {
        if (post.liked_by_viewer) { await data.unlikePost(post.id); post.liked_by_viewer = false; post.like_count = Math.max(0, (post.like_count || 1) - 1); }
        else                      { await data.likePost(post.id);   post.liked_by_viewer = true;  post.like_count = (post.like_count || 0) + 1; }
        myLike.className = post.liked_by_viewer ? 'icon-btn liked' : 'icon-btn';
        myLike.textContent = '';
        myLike.appendChild(document.createTextNode((post.liked_by_viewer ? '❤️' : '🤍') + ` ${post.like_count}`));
      } catch (err) { this.toast(err.message, 'error'); }
    });

    const commentToggle = this.el('button', { class: 'icon-btn' }, [`💬 ${post.comment_count || 0}`]);
    const commentBox    = this.el('div', { class: 'comment-box hidden' });
    commentToggle.addEventListener('click', async () => {
      if (!commentBox.classList.contains('hidden')) { commentBox.classList.add('hidden'); return; }
      commentBox.classList.remove('hidden');
      if (commentBox.dataset.loaded) return;
      commentBox.dataset.loaded = '1';
      const comments = await data.getComments(post.id);
      this.renderComments(commentBox, post.id, comments);
    });

    const actions = this.el('div', { class: 'post-actions' }, [myLike, commentToggle]);
    const captionEl = this.el('div', { class: 'post-caption' }, [
      this.el('strong', {}, [post.full_name || post.username || '']), ' ', post.caption || '',
    ]);
    const postMeta  = this.el('div', { class: 'post-meta' }, [
      (post.location ? post.location + ' · ' : ''), this.timeAgo(post.created_at),
    ]);

    card.appendChild(header);
    card.appendChild(media);
    card.appendChild(actions);
    card.appendChild(captionEl);
    card.appendChild(postMeta);
    card.appendChild(commentBox);
    return card;
  }

  renderComments(box, postId, comments) {
    box.innerHTML = '';
    comments.forEach((c) => {
      box.appendChild(this.el('div', { class: 'comment-row' }, [
        this.el('strong', {}, [c.username || '']), ' ', c.body,
      ]));
    });
    const row  = this.el('div', { class: 'comment-input-row' });
    const inp  = this.el('input', { class: 'input', placeholder: 'Add a comment...' });
    const btn  = this.el('button', { class: 'btn btn-secondary btn-sm' }, ['Post']);
    btn.addEventListener('click', async () => {
      if (!inp.value.trim()) return;
      const c = await data.addComment(postId, inp.value.trim());
      inp.value = '';
      box.insertBefore(
        this.el('div', { class: 'comment-row' }, [this.el('strong', {}, [c.username || 'You']), ' ', c.body]),
        row
      );
    });
    row.appendChild(inp); row.appendChild(btn);
    box.appendChild(row);
  }
}
