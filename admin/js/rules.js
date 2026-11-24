/* Ontario licensing rules used by every calculation on this site.
   Source: O. Reg. 137/15 (Child Care and Early Years Act, 2014), Schedule 1 and section 8.
   ratio is children per staff member; ratioText is how the regulation writes it. */
const RULES = {
  version: 'O. Reg. 137/15, consolidation of July 1, 2026',
  Infant:       { minM: 0,  maxM: 18, ratio: 10 / 3, ratioText: '3 to 10', maxGroup: 10, youngShare: 0 },
  Toddler:      { minM: 18, maxM: 30, ratio: 5,      ratioText: '1 to 5',  maxGroup: 15, youngShare: 0.20 },
  Preschool:    { minM: 30, maxM: 72, ratio: 8,      ratioText: '1 to 8',  maxGroup: 24, youngShare: 0.20 },
  Kindergarten: { minM: 44, maxM: 84, ratio: 13,     ratioText: '1 to 13', maxGroup: 26, youngShare: 0 }
};
const AGE_GROUPS = ['Infant', 'Toddler', 'Preschool', 'Kindergarten'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ym(s) { const p = s.split('-'); return { y: +p[0], m: +p[1] }; }
function ageM(birth, y, m) { const b = ym(birth); return (y - b.y) * 12 + (m - b.m); }
function youngLimit(room, cap) { return Math.round(RULES[room.lic].youngShare * cap + 1e-9); }
function staffNeeded(children, rule) { return Math.max(0, Math.ceil(children / rule.ratio - 1e-9)); }
function fmtAge(m) { const y = Math.floor(m / 12), r = m % 12; return y ? y + 'y ' + r + 'm' : r + 'm'; }

if (typeof module !== 'undefined') module.exports = { RULES, AGE_GROUPS, MONTHS, ym, ageM, youngLimit, staffNeeded, fmtAge };
