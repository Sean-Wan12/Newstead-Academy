/* Ontario licensing rules, ported from admin/js/rules.js.
   Source: O. Reg. 137/15 (Child Care and Early Years Act, 2014), Schedule 1 and section 8.
   ratio is children per staff member; ratioText is how the regulation writes it.
   minM/maxM are ages in months (maxM exclusive). youngShare is the mixed-age allowance:
   the share of a group that may be younger than the age range (toddler and preschool). */
'use strict';

const RULES = {
  version: 'O. Reg. 137/15, consolidation of July 1, 2026',
  Infant:       { minM: 0,  maxM: 18, ratio: 10 / 3, ratioText: '3 to 10', maxGroup: 10, youngShare: 0 },
  Toddler:      { minM: 18, maxM: 30, ratio: 5,      ratioText: '1 to 5',  maxGroup: 15, youngShare: 0.20 },
  Preschool:    { minM: 30, maxM: 72, ratio: 8,      ratioText: '1 to 8',  maxGroup: 24, youngShare: 0.20 },
  Kindergarten: { minM: 44, maxM: 84, ratio: 13,     ratioText: '1 to 13', maxGroup: 26, youngShare: 0 }
};
const AGE_GROUPS = ['Infant', 'Toddler', 'Preschool', 'Kindergarten'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ym(s) { const p = String(s).split('-'); return { y: +p[0], m: +p[1] }; }
/* Age in whole months in month (y, m), counting by calendar month as the forecast does */
function ageM(birth, y, m) { const b = ym(birth); return (y - b.y) * 12 + (m - b.m); }
/* Age in completed months on an exact date (YYYY-MM-DD) */
function ageMonthsOn(birthISO, dateISO) {
  const [by, bm, bd] = birthISO.split('-').map(Number), [y, m, d] = dateISO.split('-').map(Number);
  return (y - by) * 12 + (m - bm) - (d < bd ? 1 : 0);
}
function youngLimit(room, cap) { return Math.round(RULES[room.lic].youngShare * cap + 1e-9); }
function staffNeeded(children, rule) { return Math.max(0, Math.ceil(children / rule.ratio - 1e-9)); }   // never -0 for an empty room
function fmtAge(m) { const y = Math.floor(m / 12), r = m % 12; return y ? y + 'y ' + r + 'm' : r + 'm'; }

/* Ratio status for a room right now.
   ageGroup: the room's licensed age group; children/staff: counts present in the room. */
function ratioStatus(ageGroup, children, staff, capacity) {
  const rule = RULES[ageGroup];
  if (!rule) return { level: 'unknown', text: 'No licensed age group set' };
  const needed = staffNeeded(children, rule);
  const out = { needed, staff, children, ratioText: rule.ratioText, maxGroup: rule.maxGroup };
  if (capacity != null && children > capacity) return Object.assign(out, { level: 'over', text: (children - capacity) + ' over capacity' });
  if (children === 0) return Object.assign(out, { level: 'empty', text: 'No children checked in' });
  if (staff < needed) return Object.assign(out, { level: 'short', text: (needed - staff) + ' more staff needed' });
  return Object.assign(out, { level: 'ok', text: 'In ratio' });
}

module.exports = { RULES, AGE_GROUPS, MONTHS, ym, ageM, ageMonthsOn, youngLimit, staffNeeded, fmtAge, ratioStatus };
