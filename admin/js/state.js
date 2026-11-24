/* Page state shared by every view. DATA and ROOMS change when the location changes. */
let DEF = { moveAge: 30, leaveAge: 6, caps: {} };
let CUR = 'loading', rafPending = false, APP_READY = false;
/* Redraw the open page on the next frame; safe to call from anywhere, any number of times */
function refresh() {
  if (rafPending) return; rafPending = true;
  requestAnimationFrame(() => { rafPending = false; if (!F || !APP_READY) return; document.querySelectorAll('[data-day]').forEach(i => { i.value = DAY; }); if (RENDER[CUR]) RENDER[CUR](); updateBadge(); });
}
let opts = JSON.parse(JSON.stringify(DEF)), F = null, sel = null, filters = { children: 'all', rosters: 'all' }, groupOpen = true;
let DATA = { asOf: '2026-11-16', kids: [], plans: [] };
let ACT_ROOM = null, CI_ROOM = null, SI_ROOM = 'all', CT_ROOM = 'all', PH_ROOM = 'all';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kidsById = {};
function setData(d) {
  DATA = d;
  Object.keys(kidsById).forEach(k => delete kidsById[k]);
  DATA.kids.forEach(k => kidsById[k.id] = k);
}
const GROUPS = [['Infant', 'Infant rooms'], ['Toddler', 'Toddler rooms'], ['Preschool', 'Preschool rooms'], ['Kindergarten', 'Kindergarten classes']];
const AGE_TEXT = { Infant: 'Under 18 months', Toddler: '18 to under 30 months', Preschool: '30 months to under 6 years', Kindergarten: '44 months to under 7 years' };
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);
function monthLabel(birth, add) { const p = birth.split('-'); const i = (+p[1] - 1) + add; return MONTHS[((i % 12) + 12) % 12] + ' ' + (+p[0] + Math.floor(i / 12)); }
const optsKey = () => 'nf-opts-' + LOC.id;
function loadOpts() {
  const o = JSON.parse(JSON.stringify(DEF));
  try { const s = JSON.parse(localStorage.getItem(optsKey()) || 'null'); if (s) Object.assign(o, s); } catch (e) {}
  return o;
}
function save() { try { localStorage.setItem(optsKey(), JSON.stringify(opts)); } catch (e) {} }
