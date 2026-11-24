/* ===== Search ===== */
const QCOL = { Page: '#616161', Child: '#2A78D6', Waitlist: '#C98500', Contact: '#EB6834', Staff: '#1BAF7A', Event: '#E34948', Message: '#6250D6' };
/* Lower case, accents removed (Zoé finds Zoe), letters, digits and spaces only */
const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
const tight = t => norm(t).replace(/ /g, '');
const KEYWORDS = { dashboard: 'home', summary: 'today notifications alerts', actions: 'attendance log check in out nap meal incident', signin: 'kiosk parents drop off pick up', billing: 'invoices fees payments subsidy money', calendars: 'menu food lunch snack holidays closures events', configuration: 'settings staff centre details backup logins', waitlist: 'registration families apply', forecast: 'capacity months openings', contacts: 'parents guardians emergency phone email', messaging: 'email announcements', photos: 'pictures videos', reports: 'export csv' };
function searchItems() {
  const it = [];
  FLAT.forEach(m => it.push({ type: 'Page', title: m.label, sub: 'Go to page', text: m.label + ' ' + (KEYWORDS[m.id] || ''), go: () => { location.hash = m.id; } }));
  ENROLLED().forEach(k => { const c = D.contacts['c' + k.id] || {}; it.push({ type: 'Child', title: k.n, sub: roomById(k.r).name + ' · ' + fmtAge(ageM(k.b, +todayISO().slice(0, 4), +todayISO().slice(5, 7))) + ' · ' + ST_TEXT[attStatus(k.id)], text: k.n + ' ' + tight(k.n) + ' ' + roomById(k.r).name, go: () => childCard(k.id) });
    [c.g1name, c.g2name, c.ename].filter(Boolean).forEach(n => it.push({ type: 'Contact', title: n, sub: 'For ' + k.n + ' (' + roomById(k.r).name + ')', text: n, go: () => contactForm(k.id) })); });
  rows(D.waitlist).forEach(w => it.push({ type: 'Waitlist', title: w.child, sub: (w.status || '') + (w.parent ? ' · ' + w.parent : ''), text: w.child + ' ' + (w.parent || '') + ' ' + (w.email || ''), go: () => { location.hash = 'waitlist'; setTimeout(() => waitlistForm(Object.assign({ id: w.id }, D.waitlist[w.id])), 50); } }));
  rows(D.staff).forEach(x => it.push({ type: 'Staff', title: x.name, sub: x.role || '', text: x.name + ' ' + (x.role || '') + ' ' + (x.email || ''), go: () => { location.hash = 'configuration'; setTimeout(() => staffForm(Object.assign({ id: x.id }, D.staff[x.id])), 50); } }));
  rows(D.events).forEach(e => it.push({ type: 'Event', title: e.title, sub: e.type + ' · ' + fmtDate(e.date), text: e.title + ' ' + e.type, go: () => { location.hash = 'calendars'; setTimeout(() => eventForm(Object.assign({ id: e.id }, D.events[e.id])), 50); } }));
  rows(D.messages).forEach(m => it.push({ type: 'Message', title: m.subject || '(no subject)', sub: 'To ' + (m.toLabel || ''), text: (m.subject || '') + ' ' + (m.body || ''), go: () => { location.hash = 'messaging'; setTimeout(() => showMsg(Object.assign({ id: m.id }, D.messages[m.id])), 50); } }));
  return it;
}
let QRES = [], QSEL = 0;
function runSearch() {
  const q = norm($('q').value).trim(), box = $('qres');
  if (!q || !canSearch()) { box.hidden = true; $('q').setAttribute('aria-expanded', 'false'); return; }
  const qt = q.replace(/ /g, '');
  QRES = searchItems().map(x => { const t = norm(x.text), ti = norm(x.title); let sc = 0;
    if (ti === q || tight(x.title) === qt) sc = 100; else if (ti.startsWith(q) || tight(x.title).startsWith(qt)) sc = 60; else if (t.split(' ').some(w => w.startsWith(q))) sc = 40; else if (q.length >= 3 && t.includes(q)) sc = 20;
    return Object.assign(x, { sc: sc ? sc - (x.type === 'Page' ? 5 : 0) : 0 }); }).filter(x => x.sc).sort((a, b) => b.sc - a.sc).slice(0, 10);
  QSEL = 0;
  box.innerHTML = QRES.length ? QRES.map((x, i) => '<button type="button" class="qi' + (i === 0 ? ' on' : '') + '" role="option" data-qi="' + i + '"><span class="qt" style="--qc:' + QCOL[x.type] + '">' + x.type + '</span><span><b>' + esc(x.title) + '</b><span class="muted">' + esc(x.sub) + '</span></span></button>').join('')
    : '<div class="qempty">Nothing matches "' + esc($('q').value) + '". Try a child\'s first name, a parent\'s name, or a page like "billing".</div>';
  box.hidden = false; $('q').setAttribute('aria-expanded', 'true');
}
function pickResult(i) { const x = QRES[i]; if (!x || !canSearch()) return; $('q').value = ''; $('qres').hidden = true; $('searchBox').classList.remove('on'); $('q').blur(); x.go(); }
$('q').addEventListener('input', runSearch);
$('q').addEventListener('focus', () => { if ($('q').value) runSearch(); });
$('q').addEventListener('keydown', e => {
  const opts = $('qres').querySelectorAll('.qi');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!opts.length) return; QSEL = (QSEL + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length; opts.forEach((o, i) => o.classList.toggle('on', i === QSEL)); opts[QSEL].scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'Enter') { e.preventDefault(); pickResult(QSEL); }
  else if (e.key === 'Escape') { e.stopPropagation(); $('q').value = ''; $('qres').hidden = true; $('searchBox').classList.remove('on'); $('q').blur(); }
});
document.addEventListener('mousedown', e => { const r = e.target.closest('[data-qi]'); if (r) { e.preventDefault(); pickResult(+r.dataset.qi); return; } if (!e.target.closest('#searchBox') && !e.target.closest('#searchBtn')) { $('qres').hidden = true; $('searchBox').classList.remove('on'); } });
document.addEventListener('keydown', e => { if (e.key === '/' && canSearch() && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && $('modal').hidden) { e.preventDefault(); $('searchBox').classList.add('on'); $('q').focus(); } });
$('searchBtn').addEventListener('click', () => { if (!canSearch()) return; const on = $('searchBox').classList.toggle('on'); if (on) $('q').focus(); });
function childCard(id) {
  const k = kidById(id), c = D.contacts['c' + id] || {}, rec = attRec(id) || {}, t = todayISO().split('-').map(Number);
  openView(k.n, '<dl class="facts left"><dt>Room</dt><dd>' + esc(roomById(k.r).name) + '</dd><dt>Age</dt><dd>' + fmtAge(ageM(k.b, t[0], t[1])) + '</dd><dt>' + esc(fmtDate(DAY)) + '</dt><dd>' + stPill(id) + (rec.byIn ? ' <span class="muted small">dropped off by ' + esc(rec.byIn) + '</span>' : '') + '</dd><dt>Parents</dt><dd>' + (esc([c.g1name, c.g2name].filter(Boolean).join(', ')) || '<span class="muted">None on file</span>') + '</dd><dt>Emergency</dt><dd>' + (c.ename ? esc(c.ename) + (c.ephone ? ' · ' + esc(c.ephone) : '') : '<span class="muted">None on file</span>') + '</dd></dl>' +
    '<div class="mfoot"><span></span><div class="row"><button class="btn" type="button" data-vact="contacts">Contacts</button><button class="btn btn-primary" type="button" data-vact="att">Attendance</button></div></div>',
    { contacts: () => contactForm(id), att: () => { ACT_ROOM = k.r; closeModal(); location.hash = 'actions'; refresh(); } });
}
