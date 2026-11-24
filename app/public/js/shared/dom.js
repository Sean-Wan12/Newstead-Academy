/* Safe HTML building. Every value put into a template with html`...` is escaped unless it is
   itself the result of html`...` (or raw(), used only for markup we wrote ourselves).
   Arrays are joined, null/undefined/false print nothing. Use set(el, html`...`) to render. */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
export const esc = v => String(v).replace(/[&<>"'`]/g, c => ESC[c]);

class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = s => new Safe(String(s));

function part(v) {
  if (v == null || v === false) return '';
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
}
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new Safe(out);
}
export function set(el, safe) {
  if (!(safe instanceof Safe)) throw new Error('set() needs html`` output');
  el.innerHTML = safe.s;
}
export const $ = (sel, root) => (root || document).querySelector(sel);
export const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

/* Delegated events: on(container, 'click', '[data-act]', (e, el) => ...) */
export function on(root, type, selector, fn) {
  root.addEventListener(type, e => {
    const el = e.target.closest(selector);
    if (el && root.contains(el)) fn(e, el);
  });
}
