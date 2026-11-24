/* ===== Data the pages share ===== */
const D = { waitlist: {}, contacts: {}, messages: {}, photos: {}, events: {}, staff: {}, settings: {}, menus: {}, billing: {}, att: null, logs: null };
['waitlist', 'contacts', 'messages', 'photos', 'events', 'staff', 'settings', 'menus', 'billing'].forEach(c => watch('col', c, m => { D[c] = m; refresh(); }));
/* Both centres are in Ontario: "today" and "now" are Toronto's, whatever time zone the device is set to.
   With a date passed in, todayISO formats that date's own calendar fields (used for date arithmetic). */
const CENTRE_TZ = 'America/Toronto';
function torontoNow() {
  const p = {}; new Intl.DateTimeFormat('en-CA', { timeZone: CENTRE_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
  return p;
}
function todayISO(d) { if (!d) { const p = torontoNow(); return p.year + '-' + p.month + '-' + p.day; } return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function nowHM() { const p = torontoNow(); return p.hour + ':' + p.minute; }
let DAY = todayISO(), dayUnsubs = [];
function watchDay() {
  dayUnsubs.forEach(u => u());
  dayUnsubs = [watch('doc', 'attendance/' + DAY, v => { D.att = v; refresh(); }), watch('doc', 'logs/' + DAY, v => { D.logs = v; refresh(); })];
}
watchDay();
function setDay(d) { if (!d || d === DAY) return; DAY = d; DAY_IS_TODAY = d === todayISO(); D.att = null; D.logs = null; watchDay(); refresh(); }
/* A check-in tablet left open overnight must not keep recording on yesterday's date:
   when the day changes, a page that was showing today moves to the new today. */
let DAY_IS_TODAY = true, LAST_TODAY = todayISO();
function followToday() {
  const t = todayISO(); if (t === LAST_TODAY) return;
  LAST_TODAY = t;
  if (DAY_IS_TODAY && DAY !== t) setDay(t); else refresh();
}
setInterval(followToday, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) followToday(); });
