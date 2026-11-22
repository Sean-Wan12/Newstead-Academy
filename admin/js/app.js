/* ===== Wiring: which function draws each page, and the clicks shared across pages ===== */
const RENDER = { checkin: renderCheckin, welcome: renderWelcome, dashboard: renderDash, summary: renderHome, waitlist: renderWaitlist, actions: renderActions, signin: renderSignin, contacts: renderContacts, messaging: renderMessages, photos: renderPhotos, billing: renderBilling, calendars: renderCalendars, configuration: renderConfig };
function updateBadge() { const b = $('navBadge'); if (!b) return; const n = alertsList().filter(a => a.lv !== 'info').length; b.textContent = n; b.hidden = !n; }
document.addEventListener('change', e => { if (e.target.matches('[data-day]')) setDay(e.target.value); if (e.target.id === 'billMonth' && e.target.value) { BILL_MONTH = e.target.value; refresh(); } });
document.addEventListener('input', e => { if (e.target.id === 'siSearch') renderSignin(); if (e.target.id === 'ctSearch') renderContacts(); });
document.addEventListener('click', e => {
  const t = e.target;
  const a = t.closest('[data-act]');
  if (a) {
    const act = a.dataset.act; if (a.tagName === 'A') e.preventDefault();
    const fn = { 'wl-add': () => waitlistForm(null), 'log-add': () => logForm(null), 'ph-add': photoForm, 'msg-add': msgForm, 'bill-fees': feesForm,
      'bill-create': () => createInvoices(ENROLLED()), 'bill-missing': () => createInvoices(ENROLLED().filter(k => !(D.billing[BILL_MONTH].lines || {})[k.id])),
      'wk-prev': () => { WEEK = addDays(WEEK, -7); refresh(); }, 'wk-next': () => { WEEK = addDays(WEEK, 7); refresh(); }, 'wk-edit': menuForm,
      'wk-copy': () => { const prev = D.menus[addDays(WEEK, -7)]; if (!prev) { toast('There is no menu for last week to copy.', true); return; } put('menus/' + WEEK, { week: WEEK, days: prev.days, updated: Date.now() }).then(ok => ok && toast('Copied last week\'s menu.')); },
      'ev-add': () => eventForm(null), 'centre-edit': centreForm, 'staff-add': () => staffForm(null), 'backup': backup,
      'room-add': () => roomForm(null), 'roster-import': rosterImportForm, 'ci-absent-rest': b => markRestAbsent(b) }[act];
    if (fn) fn(a); return;
  }
  const pick = (attr, set) => { const b = t.closest('[data-' + attr + ']'); if (b) { set(b.dataset[attr]); refresh(); return true; } return false; };
  if (pick('actroom', v => ACT_ROOM = v) || pick('siroom', v => SI_ROOM = v) || pick('ctroom', v => CT_ROOM = v) || pick('phroom', v => PH_ROOM = v) || pick('wlf', v => WL_FILTER = v) || pick('ciroom', v => CI_ROOM = v)) return;
  const gr = t.closest('[data-goroom]'); if (gr) { ACT_ROOM = gr.dataset.goroom; return; }
  const at = t.closest('[data-att]');
  if (at) { const kid = +at.dataset.kid, w = at.dataset.att; if (w === 'in') setAtt(kid, { in: nowHM(), absent: false, staffIn: ME.id || '' }); else if (w === 'out') setAtt(kid, { out: nowHM(), staffOut: ME.id || '' }); else if (w === 'absent') setAtt(kid, { absent: true, in: '', out: '', staffIn: ME.id || '' }); else if (w === 'undo-out') setAtt(kid, { out: '', staffOut: '' }); else if (w === 'undo-absent') setAtt(kid, { absent: false, staffIn: '' }); else attForm(kid); return; }
  const row = (attr, fn) => { const r = t.closest('[data-' + attr + ']'); if (r) { fn(r.dataset[attr]); return true; } return false; };
  row('wl', id => waitlistForm(Object.assign({ id }, D.waitlist[id]))) || row('si', id => signForm(+id)) || row('ct', id => contactForm(+id)) || row('msg', id => showMsg(Object.assign({ id }, D.messages[id]))) ||
  row('ph', id => showPhoto(Object.assign({ id }, D.photos[id]))) || row('ev', id => eventForm(Object.assign({ id }, D.events[id]))) || row('staff', id => staffForm(Object.assign({ id }, D.staff[id]))) || row('roomedit', id => roomForm(ROOMS.find(r => r.id === id))) ||
  row('log', id => logForm(logEntries().find(x => x.id === id))) || row('bill', () => { const b = t.closest('[data-bill]'), kid = +b.dataset.kid; if (b.dataset.bill === 'pay') merge('billing/' + BILL_MONTH, { lines: { [kid]: { paid: true, paidOn: todayISO() } } }); else billLineForm(kid); });
});

/* Start: open the location used last time in this browser (teachers are moved to their own once their account is known) */
let startLoc = 'rh'; try { startLoc = localStorage.getItem('na-loc') || 'rh'; } catch (e) {}
applyLocation(startLoc, true);
APP_READY = true;
applyRole();
