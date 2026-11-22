/* Show the view named in the address (#forecast, #checkin…). Teachers only reach their
   classroom pages; people who aren't set up yet see the welcome page. */
function route() {
  let id = location.hash.slice(1);
  const allowed = allowedViews();
  if (!ME.decided) id = 'loading';
  else if (ME.role === 'none') id = 'welcome';
  else if (!FLAT.some(m => m.id === id) || (allowed && !allowed.includes(id))) id = ME.role === 'teacher' ? 'checkin' : 'dashboard';
  const m = FLAT.find(x => x.id === id) || { label: id === 'welcome' ? 'Welcome' : 'Loading' };
  document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'view-' + id; });
  if ((MENU.find(x => x.items).items).some(x => x.id === id)) groupOpen = true;
  renderMenu(id); document.title = m.label + ' · Newstead Academy Admin';
  setRail(false); closeModal();
  if (id !== 'forecast' && sel) closeCell();
  CUR = id; renderSetupNote(); refresh();
  window.scrollTo(0, 0);
}

document.addEventListener('click', e => {
  const c = e.target.closest('.cell'); if (c) return openCell(c.dataset.r, +c.dataset.m);
  const f = e.target.closest('[data-f]'); if (f) { filters[f.dataset.w] = f.dataset.f; f.dataset.w === 'children' ? renderChildren() : renderRosters(); return; }
  if (e.target.closest('#grpBtn')) { groupOpen = !groupOpen; $('grpBtn').setAttribute('aria-expanded', groupOpen); $('grpList').hidden = !groupOpen; return; }
  if (e.target.closest('#menuBtn')) { setRail(!$('rail').classList.contains('on')); return; }
  if (e.target.closest('#scrim')) { setRail(false); return; }
  if (sel && !e.target.closest('#drawer')) { closeCell(); }
  if (e.target.closest('#copyBtn')) {
    const text = reportRows().map(r => r.join('\t')).join('\n');
    const done = ok => { $('copyMsg').textContent = ok ? 'Copied. Paste it into your spreadsheet.' : 'Copying is blocked here. Select the table below and copy it instead.'; };
    try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch (err) { done(false); }
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('modal').hidden) { closeModal(); return; } if (sel) closeCell(); setRail(false); } });
function setRail(on) {
  $('rail').classList.toggle('on', on); $('scrim').classList.toggle('on', on);
  $('menuBtn').setAttribute('aria-expanded', on); $('menuBtn').textContent = on ? '✕' : '☰';
  $('menuBtn').setAttribute('aria-label', on ? 'Close menu' : 'Open menu');
}
document.addEventListener('change', e => {
  if (e.target.id === 'locSel') { applyLocation(e.target.value); renderSetupNote(); return; }
  if (e.target.id === 'moveAge' || e.target.id === 'leaveAge') { opts[e.target.id] = +e.target.value; save(); run(); }
  if (e.target.dataset.cap) {
    const r = ROOMS.find(x => x.id === e.target.dataset.cap), v = Math.max(0, Math.min(r.licensed, Math.round(+e.target.value || 0)));
    if (v === r.licensed) delete opts.caps[r.id]; else opts.caps[r.id] = v; save(); run();
  }
});
$('reset').onclick = () => { opts = JSON.parse(JSON.stringify(DEF)); save(); syncControls(); run(); };
function syncControls() { $('moveAge').value = opts.moveAge; $('leaveAge').value = opts.leaveAge; }
window.addEventListener('hashchange', route);
