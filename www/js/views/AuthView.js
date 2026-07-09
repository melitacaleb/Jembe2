// js/views/AuthView.js
import { BaseView } from './BaseView.js';
import { api }      from '../services/api.js';
import { store }    from '../services/store.js';
import { localdb }  from '../services/localdb.js';

export class AuthView extends BaseView {
  constructor(container, param) {
    super(container, param);
    this.mode = 'login';
    this.accountType = 'individual';
  }

  render() { this.container.appendChild(this.buildForm()); }

  buildForm() {
    const wrap = this.el('div', { class: 'auth-wrap' });
    wrap.appendChild(this.el('div', { class: 'auth-logo' }, ['🌾 Farmers Connect']));
    if (!navigator.onLine) {
      wrap.appendChild(this.el('div', { class: 'offline-note' }, ['📡 Offline — logging in with cached credentials if available']));
    }
    const tabs = this.el('div', { class: 'auth-tabs' }, [
      this._tab('Log In',   () => { this.mode = 'login';    this.refresh(); }),
      this._tab('Sign Up',  () => { this.mode = 'register'; this.refresh(); }),
    ]);
    tabs.querySelectorAll('.tab')[this.mode === 'login' ? 0 : 1].classList.add('active');
    wrap.appendChild(tabs);
    wrap.appendChild(this.mode === 'login' ? this.buildLogin() : this.buildRegister());
    return wrap;
  }

  _tab(label, onClick) {
    const b = this.el('button', { class: 'tab' }, [label]);
    b.addEventListener('click', onClick);
    return b;
  }

  refresh() { this.container.innerHTML = ''; this.render(); }

  buildLogin() {
    const email = this.el('input', { type: 'email',     class: 'input', placeholder: 'Email' });
    const pass  = this.el('input', { type: 'password',  class: 'input', placeholder: 'Password' });
    const error = this.el('div',   { class: 'form-error' });
    const btn   = this.el('button',{ class: 'btn btn-primary' }, ['Log In']);

    btn.addEventListener('click', async () => {
      if (!navigator.onLine) { error.textContent = 'Login requires a connection — please connect to the internet.'; return; }
      try {
        const { token, user } = await api.login({ email: email.value, password: pass.value });
        api.setToken(token);
        store.setUser(user);
        await localdb.put('users', user);
        window.location.hash = '/feed';
        location.reload();
      } catch (err) { error.textContent = err.message; }
    });

    return this.el('form', { class: 'auth-form' }, [email, pass, error, btn]);
  }

  buildRegister() {
    const fullName = this.el('input', { class: 'input', placeholder: 'Full name' });
    const username = this.el('input', { class: 'input', placeholder: 'Username' });
    const email    = this.el('input', { type: 'email',    class: 'input', placeholder: 'Email' });
    const password = this.el('input', { type: 'password', class: 'input', placeholder: 'Password' });
    const location = this.el('input', { class: 'input', placeholder: 'Location (e.g. Nakuru, Kenya)' });

    const typeLabel  = this.el('div', { class: 'field-label' }, ['I am registering as:']);
    const indivBtn   = this.el('button', { type: 'button', class: 'choice-btn active' }, ['👤 Individual Farmer']);
    const orgBtn     = this.el('button', { type: 'button', class: 'choice-btn'        }, ['🏢 Organization (NGO / Co-op / Agribusiness)']);
    const orgFields  = this.el('div',   { class: 'org-fields hidden' });
    const orgCat     = this.el('select', { class: 'input' }, [
      ['NGO','Cooperative','Government','Agribusiness','Other'].map((v) => this.el('option', { value: v }, [v]))
    ].flat());
    const orgWeb     = this.el('input', { class: 'input', placeholder: 'Website (optional)' });
    orgFields.appendChild(orgCat);
    orgFields.appendChild(orgWeb);

    indivBtn.addEventListener('click', () => { this.accountType = 'individual'; indivBtn.classList.add('active'); orgBtn.classList.remove('active'); orgFields.classList.add('hidden'); });
    orgBtn.addEventListener('click',   () => { this.accountType = 'organization'; orgBtn.classList.add('active'); indivBtn.classList.remove('active'); orgFields.classList.remove('hidden'); });

    const error = this.el('div',   { class: 'form-error' });
    const btn   = this.el('button',{ class: 'btn btn-primary' }, ['Create account']);

    btn.addEventListener('click', async () => {
      if (!navigator.onLine) { error.textContent = 'Registration requires a connection.'; return; }
      try {
        const payload = { full_name: fullName.value, username: username.value, email: email.value, password: password.value, location: location.value, account_type: this.accountType };
        if (this.accountType === 'organization') { payload.org_category = orgCat.value; payload.org_website = orgWeb.value; }
        const { token, user } = await api.register(payload);
        api.setToken(token);
        store.setUser(user);
        await localdb.put('users', user);
        window.location.hash = '/feed';
        location.reload();
      } catch (err) { error.textContent = err.message; }
    });

    return this.el('form', { class: 'auth-form' }, [
      fullName, username, email, password, location,
      typeLabel, this.el('div', { class: 'choice-row' }, [indivBtn, orgBtn]),
      orgFields, error, btn,
    ]);
  }
}
