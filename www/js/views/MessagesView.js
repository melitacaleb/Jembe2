// js/views/MessagesView.js
import { BaseView } from './BaseView.js';
import { store }    from '../services/store.js';
import { socket }   from '../services/socket.js';
import * as data    from '../services/data.js';

export class MessagesView extends BaseView {
  async render() {
    const wrap = this.el('div', { class: 'messages-wrap' });
    this.mount(wrap);
    if (this.param) await this.renderThread(wrap, this.param);
    else            await this.renderList(wrap);
  }

  async renderList(wrap) {
    wrap.appendChild(this.el('h2', { class: 'section-title' }, ['✉️ Messages']));
    if (!navigator.onLine) wrap.appendChild(this.el('div', { class: 'offline-note' }, ['📡 Showing cached conversations']));

    const list = this.el('div', { class: 'conversation-list' });
    wrap.appendChild(list);

    const render = (conversations) => {
      list.innerHTML = '';
      if (!conversations.length) {
        list.appendChild(this.el('div', { class: 'empty-state' }, ['No conversations yet.']));
        return;
      }
      conversations.forEach((c) => {
        const partnerId = c.partner_id || c.id;
        const row = this.el('div', { class: 'conversation-row' });
        row.appendChild(this.el('img', { src: c.avatar_url || 'icons/icon-192.png', class: 'avatar-sm' }));
        const meta = this.el('div', { class: 'conversation-meta' });
        const nameRow = this.el('div', { class: 'conversation-name' });
        nameRow.appendChild(document.createTextNode(c.full_name || c.username || ''));
        if (c.account_type === 'organization') nameRow.appendChild(this.el('span', { class: 'badge-org' }, ['ORG']));
        meta.appendChild(nameRow);
        meta.appendChild(this.el('div', { class: 'conversation-preview' }, [c.last_message || '']));
        row.appendChild(meta);
        if (c.unread_count > 0) row.appendChild(this.el('span', { class: 'unread-pill' }, [String(c.unread_count)]));
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => { window.location.hash = `/messages/${partnerId}`; });
        list.appendChild(row);
      });
    };

    const convs = await data.getConversations({ onRefresh: render });
    render(convs);
  }

  async renderThread(wrap, partnerId) {
    const back = this.el('button', { class: 'btn btn-link btn-sm' }, ['← All messages']);
    back.addEventListener('click', () => { window.location.hash = '/messages'; });
    wrap.appendChild(back);

    const threadEl = this.el('div', { class: 'thread', id: 'thread' });
    wrap.appendChild(threadEl);
    const myId = store.getUser()?.id;

    const renderMsgs = (messages) => {
      const atBottom = threadEl.scrollTop + threadEl.clientHeight >= threadEl.scrollHeight - 40;
      const existingIds = new Set([...threadEl.querySelectorAll('[data-mid]')].map((e) => e.dataset.mid));
      messages.forEach((m) => {
        if (existingIds.has(String(m.id))) return;
        const bubble = this.el('div', { class: m.sender_id === myId ? 'msg-bubble mine' : 'msg-bubble theirs' }, [m.body]);
        bubble.dataset.mid = m.id;
        threadEl.appendChild(bubble);
      });
      if (atBottom) threadEl.scrollTop = threadEl.scrollHeight;
    };

    const msgs = await data.getThread(partnerId, { onRefresh: renderMsgs });
    renderMsgs(msgs);
    threadEl.scrollTop = threadEl.scrollHeight;

    // Live incoming messages
    const unsub = socket.on('message', (m) => {
      if (m.sender_id === partnerId || m.recipient_id === partnerId) {
        renderMsgs([m]);
      }
    });
    document.addEventListener('route:changed', unsub, { once: true });

    const inputRow = this.el('div', { class: 'thread-input-row' });
    const inp      = this.el('input', { class: 'input', placeholder: navigator.onLine ? 'Type a message...' : 'Offline — will send when reconnected' });
    const sendBtn  = this.el('button', { class: 'btn btn-primary' }, ['Send']);

    const send = async () => {
      if (!inp.value.trim()) return;
      const body = inp.value.trim();
      inp.value  = '';
      const msg  = await data.sendMessage(partnerId, body);
      renderMsgs([msg]);
      if (!navigator.onLine) this.toast('Message queued — will send when online', 'info');
    };

    sendBtn.addEventListener('click', send);
    inp.addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });
    inputRow.appendChild(inp);
    inputRow.appendChild(sendBtn);
    wrap.appendChild(inputRow);
  }
}
