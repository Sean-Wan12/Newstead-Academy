/* ===== Data the pages share ===== */
const D = { waitlist: {}, contacts: {}, messages: {}, photos: {}, events: {}, staff: {}, settings: {}, menus: {}, billing: {}, att: null, logs: null };
['waitlist', 'contacts', 'messages', 'photos', 'events', 'staff', 'settings', 'menus', 'billing'].forEach(c => watch('col', c, m => { D[c] = m; refresh(); }));
function todayISO(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function nowHM() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
let DAY = todayISO(), dayUnsubs = [];
function watchDay() {
  dayUnsubs.forEach(u => u());
  dayUnsubs = [watch('doc', 'attendance/' + DAY, v => { D.att = v; refresh(); }), watch('doc', 'logs/' + DAY, v => { D.logs = v; refresh(); })];
}
watchDay();
function setDay(d) { if (!d || d === DAY) return; DAY = d; D.att = null; D.logs = null; watchDay(); refresh(); }
