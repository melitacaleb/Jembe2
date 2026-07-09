// js/views/MarketplaceView.js
import { BaseView }    from './BaseView.js';
import { MediaPicker } from '../components/MediaPicker.js';
import * as data       from '../services/data.js';

const CATEGORIES = ['Seeds','Livestock','Produce','Equipment','Fertilizer','Other'];

export class MarketplaceView extends BaseView {
  async render() {
    const wrap = this.el('div', { class: 'marketplace-wrap' });
    this.mount(wrap);
    wrap.appendChild(this.el('h2', { class: 'section-title' }, ['🛒 Marketplace']));

    // Search + filter bar (TOP)
    const filterRow = this.el('div', { class: 'filter-row' });
    const search    = this.el('input', { class: 'input', placeholder: 'Search products...' });
    const catSel    = this.el('select', { class: 'input' }, [
      this.el('option', { value: '' }, ['All categories']),
      ...CATEGORIES.map((c) => this.el('option', { value: c }, [c])),
    ]);
    const searchBtn = this.el('button', { class: 'btn btn-secondary' }, ['Search']);
    filterRow.appendChild(search);
    filterRow.appendChild(catSel);
    filterRow.appendChild(searchBtn);
    wrap.appendChild(filterRow);

    // Offline badge
    if (!navigator.onLine) {
      wrap.appendChild(this.el('div', { class: 'offline-note' }, ['📡 Showing cached listings — you\'re offline']));
    }

    // Sell form (collapsible, below search)
    const sellToggle = this.el('button', { class: 'btn btn-primary sell-toggle' }, ['+ Sell a Product']);
    const sellForm   = this.el('div', { class: 'hidden' });
    sellForm.appendChild(this.buildSellForm(() => loadProducts()));
    sellToggle.addEventListener('click', () => sellForm.classList.toggle('hidden'));
    wrap.appendChild(sellToggle);
    wrap.appendChild(sellForm);

    // Grid
    const grid = this.el('div', { class: 'product-grid' });
    wrap.appendChild(grid);

    const loadProducts = async () => {
      grid.innerHTML = '';
      const products = await data.getProducts({
        category: catSel.value || null,
        search:   search.value || null,
        onRefresh: (fresh) => { grid.innerHTML = ''; fresh.forEach((p) => grid.appendChild(this.buildCard(p))); },
      });
      if (!products.length) { grid.appendChild(this.el('div', { class: 'empty-state' }, ['No listings found.'])); return; }
      products.forEach((p) => grid.appendChild(this.buildCard(p)));
    };

    searchBtn.addEventListener('click', loadProducts);
    search.addEventListener('keypress', (e) => { if (e.key === 'Enter') loadProducts(); });
    catSel.addEventListener('change', loadProducts);
    await loadProducts();
  }

  buildSellForm(onDone) {
    const box      = this.el('div', { class: 'composer' });
    const title    = this.el('input',    { class: 'input', placeholder: 'Product title' });
    const cat      = this.el('select',   { class: 'input' }, CATEGORIES.map((c) => this.el('option', { value: c }, [c])));
    const price    = this.el('input',    { type: 'number', class: 'input', placeholder: 'Price (KES)' });
    const qty      = this.el('input',    { type: 'number', class: 'input', placeholder: 'Quantity', value: '1' });
    const unit     = this.el('input',    { class: 'input', placeholder: 'Unit (kg, bag, head...)' });
    const loc      = this.el('input',    { class: 'input', placeholder: 'Location' });
    const desc     = this.el('textarea', { class: 'input', placeholder: 'Description', rows: '2' });
    const error    = this.el('div',      { class: 'form-error' });
    const submit   = this.el('button',   { class: 'btn btn-primary' }, ['List Product']);
    const picker   = new MediaPicker({ label: 'Product photos', multiple: true });

    submit.addEventListener('click', async () => {
      if (picker.isUploading()) { error.textContent = 'Wait for photos to upload.'; return; }
      try {
        await data.createProduct({
          title: title.value, category: cat.value, price: Number(price.value),
          currency: 'KES', quantity: Number(qty.value), unit: unit.value,
          location: loc.value, description: desc.value,
          media_urls: picker.getUrls(),
        });
        this.toast('Listed!', 'success');
        if (onDone) onDone();
      } catch (err) { error.textContent = err.message; }
    });

    [title, cat, price, qty, unit, loc, picker.render(), desc, error, submit].forEach((n) => box.appendChild(n));
    return box;
  }

  buildCard(p) {
    const card  = this.el('div', { class: 'product-card' });
    const imgs  = Array.isArray(p.media_urls) ? p.media_urls : [];
    const img   = this.el('img', { src: imgs[0] || 'icons/icon-192.png', class: 'product-img' });
    const title = this.el('div', { class: 'product-title' }, [p.title]);
    const price = this.el('div', { class: 'product-price' }, [`${p.currency || 'KES'} ${Number(p.price).toLocaleString()} / ${p.unit}`]);
    const seller= this.el('div', { class: 'product-seller' }, [p.full_name || p.username || '']);
    const loc   = this.el('div', { class: 'product-loc' }, [p.location || '']);

    const orderBtn = this.el('button', { class: 'btn btn-secondary btn-sm' }, ['Order']);
    orderBtn.addEventListener('click', async () => {
      try {
        if (!navigator.onLine) { this.toast('Order queued — will send when online', 'info'); }
        await data.placeOrder(p.id, 1);
        this.toast('Order placed!', 'success');
      } catch (err) { this.toast(err.message, 'error'); }
    });

    [img, title, price, seller, loc, orderBtn].forEach((n) => card.appendChild(n));
    return card;
  }
}
