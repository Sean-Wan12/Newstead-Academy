/* Shared interface pieces: toast messages, a modal dialog (native <dialog>, so focus and
   Escape work), a form builder with a label for every field, and confirm/secret dialogs. */
import { html, set, esc } from './dom.js';

let toastTimer = null;
export function toast(msg, isError) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = msg; t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast'; }, isError ? 6000 : 2600);
}

function dialogEl() {
  let d = document.getElementById('modal');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'modal'; d.setAttribute('aria-labelledby', 'modal-title');
    document.body.appendChild(d);
  }
  return d;
}
export function closeModal() { const d = document.getElementById('modal'); if (d && d.open) d.close(); }

let fieldSeq = 0;
function fieldHtml(f, value) {
  const id = 'f' + (++fieldSeq) + '-' + f.k, req = f.required ? html` required` : '', hint = f.hint ? html`<small class="hint" id="${id}-h">${f.hint}</small>` : '';
  const desc = f.hint ? html` aria-describedby="${id}-h"` : '';
  const label = html`<label for="${id}">${f.label}${f.required ? html`<span class="req" aria-hidden="true"> *</span>` : ''}</label>`;
  const wide = f.wide ? ' wide' : '';
  const v = value == null ? '' : value;
  if (f.type === 'checkbox') return html`<div class="field check${wide}"><input type="checkbox" id="${id}" name="${f.k}"${v ? html` checked` : ''}${desc}><label for="${id}">${f.label}</label>${hint}</div>`;
  if (f.type === 'checkboxes') {
    const cur = Array.isArray(v) ? v : [];
    return html`<fieldset class="field checks${wide}"><legend>${f.label}</legend>${f.options.map(([ov, ol], i) => html`<label class="chip"><input type="checkbox" name="${f.k}" value="${ov}"${cur.includes(ov) ? html` checked` : ''}> ${ol}</label>`)}${hint}</fieldset>`;
  }
  if (f.type === 'select') return html`<div class="field${wide}">${label}<select id="${id}" name="${f.k}"${req}${desc}>${f.options.map(([ov, ol]) => html`<option value="${ov}"${String(ov) === String(v) ? html` selected` : ''}>${ol}</option>`)}</select>${hint}</div>`;
  if (f.type === 'textarea') return html`<div class="field${wide}">${label}<textarea id="${id}" name="${f.k}" rows="${f.rows || 3}"${f.max ? html` maxlength="${f.max}"` : ''}${req}${desc}>${v}</textarea>${hint}</div>`;
  const extra = html`${f.min != null ? html` min="${f.min}"` : ''}${f.max != null && f.type === 'number' ? html` max="${f.max}"` : ''}${f.step ? html` step="${f.step}"` : ''}${f.max && f.type !== 'number' ? html` maxlength="${f.max}"` : ''}${f.placeholder ? html` placeholder="${f.placeholder}"` : ''}${f.autocomplete ? html` autocomplete="${f.autocomplete}"` : ''}${f.inputmode ? html` inputmode="${f.inputmode}"` : ''}${f.pattern ? html` pattern="${f.pattern}"` : ''}`;
  return html`<div class="field${wide}">${label}<input type="${f.type || 'text'}" id="${id}" name="${f.k}" value="${v}"${req}${extra}${desc}>${hint}</div>`;
}

/* Reads a form built by fieldsHtml back into an object typed by the field definitions */
export function readFields(form, fields) {
  const out = {};
  for (const f of fields) {
    if (f.type === 'checkboxes') out[f.k] = Array.from(form.querySelectorAll('input[name="' + f.k + '"]:checked')).map(i => i.value);
    else {
      const el = form.elements[f.k]; if (!el) continue;
      if (f.type === 'checkbox') out[f.k] = el.checked;
      else if (f.type === 'number') out[f.k] = el.value === '' ? null : Number(el.value);
      else out[f.k] = el.value;
    }
  }
  return out;
}
export const fieldsHtml = (fields, values) => html`${fields.map(f => fieldHtml(f, (values || {})[f.k]))}`;

/* openForm({ title, intro, fields, values, submit, onSubmit(values) -> truthy to close, actions: [{ label, danger, onClick }] }) */
export function openForm(o) {
  const d = dialogEl();
  set(d, html`<form method="dialog" class="modal-form" novalidate>
    <header><h2 id="modal-title">${o.title}</h2><button type="button" class="icon-btn" data-close aria-label="Close">&times;</button></header>
    ${o.intro ? html`<p class="intro">${o.intro}</p>` : ''}
    <div class="grid-form">${fieldsHtml(o.fields, o.values)}</div>
    <p class="form-error" role="alert" hidden></p>
    <footer>${(o.actions || []).map((a, i) => html`<button type="button" class="btn ${a.danger ? 'danger' : ''}" data-extra="${i}">${a.label}</button>`)}<span class="spacer"></span>
      <button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">${o.submit || 'Save'}</button></footer>
  </form>`);
  const form = d.querySelector('form'), err = d.querySelector('.form-error');
  const showErr = m => { err.textContent = m; err.hidden = !m; };
  d.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => d.close()));
  d.querySelectorAll('[data-extra]').forEach(b => b.addEventListener('click', async () => {
    try { const r = await o.actions[+b.dataset.extra].onClick(); if (r !== false) d.close(); } catch (e) { showErr(e.message); }
  }));
  form.addEventListener('submit', async ev => {
    ev.preventDefault(); showErr('');
    if (!form.checkValidity()) { const bad = form.querySelector(':invalid'); showErr('Check ' + (bad && bad.labels && bad.labels[0] ? bad.labels[0].textContent.replace(' *', '') : 'the form') + '.'); bad && bad.focus(); return; }
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try { const r = await o.onSubmit(readFields(form, o.fields), form); if (r !== false) d.close(); }
    catch (e) { showErr(e.message); }
    finally { btn.disabled = false; }
  });
  d.showModal();
  const first = form.querySelector('input:not([type=hidden]), select, textarea'); if (first) first.focus();
  return d;
}

export function confirmBox(message, okLabel, danger) {
  return new Promise(resolve => {
    const d = dialogEl();
    set(d, html`<div class="modal-form"><header><h2 id="modal-title">Please confirm</h2></header><p class="intro">${message}</p>
      <footer><span class="spacer"></span><button type="button" class="btn" data-no>Cancel</button><button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-yes>${okLabel || 'OK'}</button></footer></div>`);
    let answered = false;
    const done = v => { if (answered) return; answered = true; d.close(); resolve(v); };
    d.querySelector('[data-yes]').addEventListener('click', () => done(true));
    d.querySelector('[data-no]').addEventListener('click', () => done(false));
    d.addEventListener('close', () => done(false), { once: true });
    d.showModal(); d.querySelector('[data-yes]').focus();
  });
}

/* Shows a one-time secret (temporary password) with a note that it will not be shown again */
export function showSecret(title, label, secret, note) {
  const d = dialogEl();
  set(d, html`<div class="modal-form"><header><h2 id="modal-title">${title}</h2></header>
    <p class="intro">${label}</p><p class="secret" tabindex="0">${secret}</p><p class="hint">${note || 'Write it down or pass it on now. It will not be shown again.'}</p>
    <footer><span class="spacer"></span><button type="button" class="btn primary" data-ok>Done</button></footer></div>`);
  d.querySelector('[data-ok]').addEventListener('click', () => d.close());
  d.showModal(); d.querySelector('.secret').focus();
}

export const errorText = e => esc(e && e.message ? e.message : String(e));
