/* Dates and times in the centres' time zone (America/Toronto), as plain strings:
   dates are 'YYYY-MM-DD', times are 'HH:MM' (24-hour). */
'use strict';

const TZ = process.env.CENTRE_TZ || 'America/Toronto';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function parts(d) {
  const o = {}; fmt.formatToParts(d || new Date()).forEach(p => { o[p.type] = p.value; });
  return o;
}
function todayISO(d) { const p = parts(d); return p.year + '-' + p.month + '-' + p.day; }
function nowHM(d) { const p = parts(d); return p.hour + ':' + p.minute; }
function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number), dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
function isValidTime(s) { return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
function weekdayKey(iso) { const [y, m, d] = iso.split('-').map(Number); return DAY_KEYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; }
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number), dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
/* True if date falls in [start, end] where end may be empty (open-ended) */
function inRange(date, start, end) { return (!start || start <= date) && (!end || date <= end); }

module.exports = { TZ, todayISO, nowHM, isValidDate, isValidTime, weekdayKey, addDays, inRange, DAY_KEYS };
