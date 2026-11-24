/* Formatting for dates, times, ages and enum labels */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function fmtDate(iso, withDay) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (withDay ? DAYS[dow] + ' ' : '') + d + ' ' + MONTHS[m - 1] + ' ' + y;
}
/* '13:05' -> '1:05 pm' */
export function fmtTime(hm) {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  return ((h + 11) % 12 + 1) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' am' : ' pm');
}
export function fmtAge(months) {
  if (months == null) return '';
  const y = Math.floor(months / 12), r = months % 12;
  return y ? y + 'y ' + r + 'm' : r + 'm';
}
export const fmtStamp = iso => { if (!iso) return ''; const d = new Date(iso); return d.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }); };
export const childName = c => (c.preferredName || c.firstName) + ' ' + c.lastName;
export const initials = name => String(name || '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
export const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
export function addDays(iso, n) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
export const DAY_LABELS = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

/* Label for an enum value of an entry field, using /api/meta's entry types */
export function fieldLabel(metaTypes, type, field, value) {
  const f = metaTypes[type] && metaTypes[type].fields[field];
  if (!f || !f.values) return value;
  const i = f.values.indexOf(value);
  return i >= 0 ? f.labels[i] : value;
}

/* Label for a list (array) field's values */
function listLabel(metaTypes, type, field, values) { return (values || []).map(v => fieldLabel(metaTypes, type, field, v)).join(', '); }

/* One-line summary of an entry's details */
export function entrySummary(metaTypes, e) {
  const d = e.data || {}, L = (f, v) => fieldLabel(metaTypes, e.type, f, v), lc = v => String(v).toLowerCase();
  const tail = n => (n ? '. ' + n : '');
  switch (e.type) {
    case 'meal': return L('meal', d.meal) + ': ate ' + lc(L('amount', d.amount)) + (d.items ? ' (' + d.items + ')' : '');
    case 'fluids': return L('fluid', d.fluid) + (d.ounces != null ? ', ' + d.ounces + ' fl oz' : '') + tail(d.notes);
    case 'nap': return 'Slept ' + fmtTime(d.start) + (d.end ? ' to ' + fmtTime(d.end) : ' (still sleeping)') + (e.checks && e.checks.length ? ', ' + plural(e.checks.length, 'check', 'checks') + ' (last ' + fmtTime(e.checks[e.checks.length - 1].time) + ')' : '') + tail(d.notes);
    case 'toileting': return L('kind', d.kind) + ': ' + lc(L('result', d.result)) + tail(d.notes);
    case 'activity': return d.title + (d.description ? ': ' + d.description : '') + (d.foundation ? ' [' + L('foundation', d.foundation) + ']' : '');
    case 'mood': return (d.level ? L('level', d.level) + ' ' + lc(L('mood', d.mood)) : L('mood', d.mood)) + tail(d.notes);
    case 'note': return (d.kind === 'important' ? 'Important: ' : '') + d.text;
    case 'supplies': return 'Running low on ' + lc(listLabel(metaTypes, e.type, 'items', d.items)) + tail(d.notes);
    case 'temperature': return d.celsius + ' °C, ' + lc(L('status', d.status)) + tail(d.notes);
    case 'health_check': return L('status', d.status) + (d.observations ? ': ' + d.observations : '') + tail(d.notes);
    case 'medication': return d.medicine + ', ' + d.dose + (d.reason ? ' for ' + d.reason : '') + (d.parentAuthorized ? '. Parent authorization on file' : '. No parent authorization recorded') + tail(d.notes);
    case 'incident': return L('kind', d.kind) + ': ' + d.description + (d.actionTaken ? ' Action: ' + d.actionTaken : '') + (d.parentNotified ? ' Parent notified' + (d.notifiedAt ? ' at ' + fmtTime(d.notifiedAt) : '') + '.' : ' Parent not yet notified.');
    case 'name_to_face': return 'Seen' + (d.area ? ' at ' + d.area : '') + tail(d.notes);
    default: return Object.entries(d).map(([k, v]) => k + ': ' + v).join(', ');
  }
}
/* The centres' clock: times and the weekday are Toronto's, whatever time zone the tablet is set to */
const TORONTO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
const torontoParts = () => Object.fromEntries(TORONTO.formatToParts(new Date()).map(p => [p.type, p.value]));
export const nowHM = () => { const p = torontoParts(); return p.hour + ':' + p.minute; };
export const todayKey = () => torontoParts().weekday.slice(0, 3).toLowerCase();
