/* ===== Modal forms ===== */
let MODAL = null;
function fieldHtml(v) {
  return fd => {
    if (fd.type === 'heading') return '<h3>' + esc(fd.label) + '</h3>';
    const id = 'f-' + fd.k, val = v[fd.k] != null ? v[fd.k] : (fd.def != null ? fd.def : ''), req = fd.req ? ' required' : '', wide = fd.wide ? ' wide' : '';
    if (fd.type === 'checkbox') return '<label class="check' + wide + '"><input type="checkbox" id="' + id + '"' + (val ? ' checked' : '') + '> ' + esc(fd.label) + '</label>';
    let input;
    if (fd.type === 'select') input = '<select id="' + id + '"' + req + '>' + fd.options.map(op => { const ov = Array.isArray(op) ? op[0] : op, ol = Array.isArray(op) ? op[1] : op; return '<option value="' + esc(ov) + '"' + (String(ov) === String(val) ? ' selected' : '') + '>' + esc(ol) + '</option>'; }).join('') + '</select>';
    else if (fd.type === 'textarea') input = '<textarea id="' + id + '" rows="' + (fd.rows || 4) + '"' + req + '>' + esc(val) + '</textarea>';
    else if (fd.type === 'file') input = '<input type="file" id="' + id + '" accept="' + (fd.accept || '') + '"' + req + '>';
    else input = '<input type="' + (fd.type || 'text') + '" id="' + id + '" value="' + esc(val) + '"' + (fd.min != null ? ' min="' + fd.min + '"' : '') + (fd.step ? ' step="' + fd.step + '"' : '') + (fd.ph ? ' placeholder="' + esc(fd.ph) + '"' : '') + req + '>';
    return '<label class="field' + wide + '" for="' + id + '">' + esc(fd.label) + (fd.hint ? ' <span class="muted small">' + esc(fd.hint) + '</span>' : '') + input + '</label>';
  };
}
function openForm(o) {
  MODAL = o;
  $('mView').hidden = true; $('mForm').hidden = false;
  $('mForm').innerHTML = '<div class="mhead"><h2 id="mTitle">' + esc(o.title) + '</h2><button type="button" class="iconx" data-close aria-label="Close">✕</button></div>' +
    (o.intro ? '<p class="muted">' + esc(o.intro) + '</p>' : '') +
    '<div class="fgrid">' + o.fields.map(fieldHtml(o.values || {})).join('') + '</div>' +
    '<div class="mfoot">' + (o.onDelete ? '<button type="button" class="btn danger" data-del>' + esc(o.deleteLabel || 'Delete') + '</button>' : '<span></span>') +
    '<div class="row"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn btn-primary">' + esc(o.submit || 'Save') + '</button></div></div>';
  $('modal').hidden = false;
  const first = $('mForm').querySelector('input:not([type=checkbox]),select,textarea'); if (first) first.focus();
}
function openView(title, html, actions) {
  MODAL = { view: true, actions: actions || {} };
  $('mForm').hidden = true; $('mView').hidden = false;
  $('mView').innerHTML = '<div class="mhead"><h2 id="mTitle">' + esc(title) + '</h2><button type="button" class="iconx" data-close aria-label="Close">✕</button></div>' + html;
  $('modal').hidden = false;
}
function closeModal() { $('modal').hidden = true; MODAL = null; }
$('mForm').addEventListener('submit', async e => {
  e.preventDefault(); const o = MODAL; if (!o || o.view) return;
  const v = {};
  o.fields.forEach(fd => { const el = $('f-' + fd.k); if (!el) return; v[fd.k] = fd.type === 'checkbox' ? el.checked : fd.type === 'number' ? (el.value === '' ? null : +el.value) : fd.type === 'file' ? (el.files[0] || null) : el.value.trim(); });
  const btn = $('mForm').querySelector('[type=submit]'); btn.disabled = true;
  let ok = true; try { ok = await o.onSave(v); } catch (err) { ok = false; toast(err && err.message ? err.message : 'That did not save.', true); }
  btn.disabled = false;
  if (ok !== false) closeModal();
});
document.addEventListener('click', async e => {
  if (e.target.closest('[data-close]') || e.target.id === 'modal') { closeModal(); return; }
  const delBtn = e.target.closest('[data-del]');
  if (delBtn && MODAL && MODAL.onDelete) {
    if (!delBtn.classList.contains('armed')) { delBtn.classList.add('armed'); delBtn.textContent = 'Click again to delete'; return; }
    const o = MODAL; const ok = await o.onDelete(); if (ok !== false) closeModal(); return;
  }
  const va = e.target.closest('[data-vact]');
  if (va && MODAL && MODAL.actions && MODAL.actions[va.dataset.vact]) { MODAL.actions[va.dataset.vact](va); return; }
}, true);
/* Keep keyboard focus inside an open form or view (Tab used to move behind it, into the page) */
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || $('modal').hidden) return;
  const f = Array.from($('modal').querySelectorAll('button, [href], input, select, textarea, summary')).filter(x => !x.disabled && x.offsetParent);
  if (!f.length) return;
  const a = document.activeElement, first = f[0], last = f[f.length - 1];
  if (!$('modal').contains(a)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
});
