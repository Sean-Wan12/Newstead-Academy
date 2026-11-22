/* ===== Small helpers ===== */
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const rows = m => Object.keys(m || {}).map(id => Object.assign({ id }, m[id]));
const ENROLLED = () => DATA.kids.filter(k => k.r);
const roomById = id => ROOMS.find(r => r.id === id);
const kidById = id => kidsById[id];
const money = n => '$' + (Math.round((+n || 0) * 100) / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtDate(iso, withDay) {
  if (!iso) return '';
  const p = iso.split('-').map(Number);
  if (p.length < 3) return MONTHS[p[1] - 1] + ' ' + p[0];
  const d = new Date(p[0], p[1] - 1, p[2]);
  return (withDay ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ' ' : '') + p[2] + ' ' + MONTHS[p[1] - 1] + ' ' + p[0];
}
function fmtWhen(ts) { if (!ts) return ''; const d = new Date(ts); return fmtDate(todayISO(d)) + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function addDays(iso, n) { const p = iso.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2] + n); return todayISO(d); }
function mondayOf(iso) { const p = iso.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]); const dow = (d.getDay() + 6) % 7; return addDays(iso, -dow); }
function isWeekend(iso) { const p = iso.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]).getDay(); return d === 0 || d === 6; }
const ROOM_OPTS = () => ROOMS.map(r => [r.id, r.name]);
function roomButtons(el, cur, attr, withAll) {
  const opts = (withAll ? [['all', 'All rooms']] : []).concat(ROOM_OPTS());
  $(el).innerHTML = opts.map(o => '<button type="button" class="btn sm" data-' + attr + '="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + esc(o[1]) + '</button>').join('');
}
let toastTimer = null;
function toast(msg, err) { const t = $('toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, err ? 6000 : 2500); }
function copyText(text, statusEl) {
  const done = ok => { const m = ok ? 'Copied.' : 'Copying is blocked here. Select the text and copy it instead.'; if (statusEl && $(statusEl)) $(statusEl).textContent = m; else toast(m, !ok); };
  try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch (e) { done(false); }
}
