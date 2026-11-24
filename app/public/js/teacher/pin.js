/* PIN unlock on a classroom tablet: pick your name, type your 4-digit PIN on a big keypad.
   Resolves with the new actor, or null if cancelled. */
import { api } from '../shared/api.js';
import { html, set } from '../shared/dom.js';

export function pinUnlock() {
  return new Promise(async resolve => {
    let d = document.getElementById('modal');
    if (!d) { d = document.createElement('dialog'); d.id = 'modal'; d.setAttribute('aria-labelledby', 'modal-title'); document.body.appendChild(d); }
    let staff = [];
    try { staff = await api.get('/api/auth/device-staff'); } catch (e) { staff = []; }
    let done = false;
    const finish = v => { if (done) return; done = true; if (d.open) d.close(); resolve(v); };
    d.onclose = () => finish(null);

    const pickName = () => {
      set(d, html`<div class="modal-form pin"><header><h2 id="modal-title">Who is using the tablet?</h2><button type="button" class="icon-btn" data-close aria-label="Close">&times;</button></header>
        ${staff.length ? html`<div class="staff-pick">${staff.map(s => html`<button type="button" class="btn big" data-user="${s.id}">${s.name}</button>`)}</div>`
          : html`<p class="intro">No staff for this room have a PIN yet. A supervisor can set PINs under Staff and logins.</p>`}</div>`);
      d.querySelector('[data-close]').onclick = () => finish(null);
      d.querySelectorAll('[data-user]').forEach(b => { b.onclick = () => keypad(staff.find(s => s.id === b.dataset.user)); });
      if (!d.open) d.showModal();
      const f = d.querySelector('[data-user]'); if (f) f.focus();
    };

    const keypad = person => {
      let pin = '';
      set(d, html`<div class="modal-form pin"><header><h2 id="modal-title">${person.name}</h2><button type="button" class="icon-btn" data-close aria-label="Close">&times;</button></header>
        <p class="intro">Enter your 4-digit PIN.</p>
        <label class="sr-only" for="pinInput">PIN</label>
        <input id="pinInput" class="pin-input" type="password" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]*">
        <div class="dots" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        <p class="form-error" role="alert" hidden></p>
        <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => html`<button type="button" class="key" data-k="${n}">${n}</button>`)}
          <button type="button" class="key" data-back aria-label="Back">Back</button><button type="button" class="key" data-k="0">0</button><button type="button" class="key" data-names>Names</button></div></div>`);
      const input = d.querySelector('#pinInput'), err = d.querySelector('.form-error'), dots = d.querySelectorAll('.dots span');
      const show = () => { dots.forEach((s, i) => s.classList.toggle('on', i < pin.length)); input.value = pin; };
      const submit = async () => {
        try {
          const r = await api.post('/api/auth/pin-unlock', { userId: person.id, pin });
          finish(r.actor);
        } catch (e) { pin = ''; show(); err.textContent = e.message; err.hidden = false; input.focus(); }
      };
      const add = k => { if (pin.length >= 4) return; pin += k; show(); if (pin.length === 4) submit(); };
      d.querySelector('[data-close]').onclick = () => finish(null);
      d.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => add(b.dataset.k); });
      d.querySelector('[data-back]').onclick = () => { pin = pin.slice(0, -1); show(); };
      d.querySelector('[data-names]').onclick = pickName;
      input.addEventListener('input', () => { pin = input.value.replace(/\D/g, '').slice(0, 4); show(); if (pin.length === 4) submit(); });
      input.focus();
    };

    if (staff.length === 1) { if (!d.open) d.showModal(); keypad(staff[0]); } else pickName();
  });
}
