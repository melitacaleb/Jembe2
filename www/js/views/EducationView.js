// js/views/EducationView.js
import { BaseView }    from './BaseView.js';
import { store }       from '../services/store.js';
import { MediaPicker } from '../components/MediaPicker.js';
import * as data       from '../services/data.js';

const CATEGORIES = ['Soil Health','Irrigation','Livestock','Crop Protection','Finance & Markets','Climate Resilience','General'];

export class EducationView extends BaseView {
  async render() {
    const wrap = this.el('div', { class: 'education-wrap' });
    this.mount(wrap);
    wrap.appendChild(this.el('h2', { class: 'section-title' }, ['📚 Education']));
    wrap.appendChild(this.el('p', { class: 'section-sub' }, ['Courses, brochures, and templates from NGOs and organizations — available offline.']));

    if (!navigator.onLine) {
      wrap.appendChild(this.el('div', { class: 'offline-note' }, ['📡 Showing cached resources — you\'re offline']));
    }

    const user = store.getUser();
    if (user?.account_type === 'organization') wrap.appendChild(this.buildPublishForm());

    const tabs = this.el('div', { class: 'edu-tabs' });
    const TABS = [{ key: '', label: 'All' }, { key: 'course', label: 'Courses' }, { key: 'brochure', label: 'Brochures' }, { key: 'template', label: 'Templates' }];
    const grid = this.el('div', { class: 'course-grid' });
    wrap.appendChild(tabs);
    wrap.appendChild(grid);

    const load = async (resourceType) => {
      grid.innerHTML = '';
      const courses = await data.getCourses({
        resourceType: resourceType || null,
        onRefresh: (fresh) => { grid.innerHTML = ''; fresh.forEach((c) => grid.appendChild(this.buildCard(c))); },
      });
      if (!courses.length) { grid.appendChild(this.el('div', { class: 'empty-state' }, ['Nothing here yet.'])); return; }
      courses.forEach((c) => grid.appendChild(this.buildCard(c)));
    };

    TABS.forEach((t, i) => {
      const btn = this.el('button', { class: i === 0 ? 'edu-tab active' : 'edu-tab' }, [t.label]);
      btn.addEventListener('click', () => {
        tabs.querySelectorAll('.edu-tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        load(t.key);
      });
      tabs.appendChild(btn);
    });

    await load('');
  }

  buildPublishForm() {
    const box    = this.el('div', { class: 'composer' });
    const rtype  = this.el('select', { class: 'input' }, [
      this.el('option', { value: 'course' }, ['Course']),
      this.el('option', { value: 'brochure' }, ['Brochure']),
      this.el('option', { value: 'template' }, ['Template']),
    ]);
    const title   = this.el('input',    { class: 'input', placeholder: 'Title' });
    const cat     = this.el('select',   { class: 'input' }, CATEGORIES.map((c) => this.el('option', { value: c }, [c])));
    const content = this.el('input',    { class: 'input', placeholder: 'Content URL (video / PDF / article)' });
    const desc    = this.el('textarea', { class: 'input', placeholder: 'Description', rows: '2' });
    const error   = this.el('div',      { class: 'form-error' });
    const submit  = this.el('button',   { class: 'btn btn-primary' }, ['Publish']);
    const picker  = new MediaPicker({ label: 'Cover photo' });

    submit.addEventListener('click', async () => {
      if (picker.isUploading()) { error.textContent = 'Photo still uploading.'; return; }
      try {
        await data.createCourse({ title: title.value, category: cat.value, resource_type: rtype.value, cover_url: picker.getUrl() || '', content_url: content.value, description: desc.value });
        this.toast('Published!', 'success');
        window.location.reload();
      } catch (err) { error.textContent = err.message; }
    });

    [rtype, title, cat, picker.render(), content, desc, error, submit].forEach((n) => box.appendChild(n));
    return box;
  }

  buildCard(c) {
    const card    = this.el('div', { class: 'course-card' });
    const img     = this.el('img', { src: c.cover_url || 'icons/icon-192.png', class: 'course-img' });
    const typeMap = { course: '🎓 Course', brochure: '📄 Brochure', template: '📋 Template' };
    const badge   = this.el('span', { class: 'badge-cat' }, [`${typeMap[c.resource_type] || '🎓'} · ${c.category}`]);
    const title   = this.el('div', { class: 'course-title' }, [c.title]);
    const by      = this.el('div', { class: 'course-provider' }, [`By ${c.provider_name || ''}`]);
    const desc    = this.el('p',   { class: 'course-desc' }, [c.description || '']);
    const actions = this.el('div', { class: 'course-actions' });

    if (c.resource_type === 'course') {
      const enroll = this.el('button', { class: 'btn btn-secondary btn-sm' }, ['Enroll']);
      enroll.addEventListener('click', async () => {
        try {
          if (!navigator.onLine) { this.toast('Enrollment queued for when you\'re online', 'info'); }
          await data.enrollCourse(c.id);
          this.toast('Enrolled!', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
      });
      actions.appendChild(enroll);
    }

    const open = this.el('a', { href: c.content_url || '#', target: '_blank', class: 'btn btn-link btn-sm' },
      [c.resource_type === 'course' ? 'View material' : 'Download']);
    actions.appendChild(open);

    [img, badge, title, by, desc, actions].forEach((n) => card.appendChild(n));
    return card;
  }
}
