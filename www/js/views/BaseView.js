// js/views/BaseView.js
// Abstract base class for every screen/view in the app.
// Subclasses implement render(); helpers below keep DOM work consistent.

export class BaseView {
  constructor(container, param = null) {
    if (this.constructor === BaseView) {
      throw new Error('BaseView is abstract and cannot be instantiated directly');
    }
    this.container = container;
    this.param = param;
  }

  el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'class') node.className = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
      else node.setAttribute(key, value);
    }
    children.forEach((child) => {
      if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else if (child) node.appendChild(child);
    });
    return node;
  }

  mount(node) {
    this.container.appendChild(node);
  }

  toast(message, type = 'info') {
    const toast = this.el('div', { class: `toast toast-${type}` }, [message]);
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  timeAgo(dateStr) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  /** Subclasses must implement */
  render() {
    throw new Error('render() must be implemented by subclass');
  }
}
