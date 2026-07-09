// js/components/MediaPicker.js
import { native }    from '../services/native.js';
import * as data     from '../services/data.js';

export class MediaPicker {
  constructor({ label = 'Add Photo', multiple = false, onChange = null } = {}) {
    this.label    = label;
    this.multiple = multiple;
    this.onChange = onChange;
    this.urls     = [];
    this.uploading = false;
    this.root      = null;
    this.previewRow= null;
    this.statusEl  = null;
  }

  getUrls()  { return this.urls; }
  getUrl()   { return this.urls[0] || null; }
  isUploading() { return this.uploading; }

  render() {
    this.root = document.createElement('div');
    this.root.className = 'media-picker';

    const btnRow = document.createElement('div');
    btnRow.className = 'media-picker-buttons';

    // Hidden file inputs for browser fallback
    const camInput = document.createElement('input');
    camInput.type = 'file'; camInput.accept = 'image/*'; camInput.capture = 'environment';
    camInput.style.display = 'none';
    if (this.multiple) camInput.multiple = true;

    const galInput = document.createElement('input');
    galInput.type = 'file'; galInput.accept = 'image/*';
    galInput.style.display = 'none';
    if (this.multiple) galInput.multiple = true;

    const camBtn = document.createElement('button');
    camBtn.type = 'button';
    camBtn.className = 'btn btn-secondary btn-sm media-btn';
    camBtn.innerHTML = '📷 Take Photo';

    const galBtn = document.createElement('button');
    galBtn.type = 'button';
    galBtn.className = 'btn btn-secondary btn-sm media-btn';
    galBtn.innerHTML = '🖼️ Gallery';

    camBtn.addEventListener('click', async () => {
      if (native.isNative()) {
        const dataUrl = await native.takePhoto();
        if (dataUrl) { await this.uploadDataUrl(dataUrl); return; }
      }
      camInput.click();
    });

    galBtn.addEventListener('click', async () => {
      if (native.isNative()) {
        const dataUrl = await native.pickPhoto();
        if (dataUrl) { await this.uploadDataUrl(dataUrl); return; }
      }
      galInput.click();
    });

    camInput.addEventListener('change', (e) => this.handleFiles(e.target.files));
    galInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

    this.statusEl   = document.createElement('div');
    this.statusEl.className = 'media-picker-status';
    this.previewRow = document.createElement('div');
    this.previewRow.className = 'media-preview-row';

    btnRow.appendChild(camBtn);
    btnRow.appendChild(galBtn);
    this.root.appendChild(btnRow);
    this.root.appendChild(this.statusEl);
    this.root.appendChild(this.previewRow);
    this.root.appendChild(camInput);
    this.root.appendChild(galInput);
    return this.root;
  }

  async handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (!this.multiple) { this.urls = []; this.previewRow.innerHTML = ''; }
    for (const f of files) {
      if (!f.type.startsWith('image/')) { this.setStatus('Only images supported.', true); continue; }
      await this.uploadFile(f);
      if (!this.multiple) break;
    }
  }

  async uploadFile(file) {
    this.uploading = true;
    this.setStatus('Uploading...');
    const localUrl = URL.createObjectURL(file);
    const thumb    = this.addThumb(localUrl);
    try {
      const { url } = await data.uploadImage(file);
      this.urls.push(url);
      thumb.src = url;
      thumb.classList.remove('uploading');
      this.setStatus(`Photo ready (${this.urls.length})`);
      if (this.onChange) this.onChange(this.urls);
    } catch (err) {
      thumb.remove();
      this.setStatus(err.message, true);
    } finally {
      this.uploading = false;
      URL.revokeObjectURL(localUrl);
    }
  }

  async uploadDataUrl(dataUrl) {
    this.uploading = true;
    this.setStatus('Uploading...');
    const thumb = this.addThumb(dataUrl);
    try {
      const res  = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      const { url } = await data.uploadImage(file);
      this.urls.push(url);
      thumb.src = url;
      thumb.classList.remove('uploading');
      this.setStatus(`Photo ready (${this.urls.length})`);
      if (this.onChange) this.onChange(this.urls);
    } catch (err) {
      thumb.remove();
      this.setStatus(err.message, true);
    } finally {
      this.uploading = false;
    }
  }

  addThumb(src) {
    const img = document.createElement('img');
    img.className = 'media-thumb uploading';
    img.src = src;
    this.previewRow.appendChild(img);
    return img;
  }

  setStatus(text, isError = false) {
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle('error', !!isError);
  }

  reset() {
    this.urls = [];
    this.previewRow.innerHTML = '';
    this.setStatus('');
  }
}
