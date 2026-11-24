/* The two Newstead locations. Richmond Hill's rooms come from its licence (Nov 2026);
   Markham's rooms and roster are entered on the site (Classrooms and Classroom rosters)
   and saved in the shared database, because its licence details aren't in this file yet. */
const LOCATIONS = {
  rh: {
    id: 'rh', name: 'Richmond Hill', full: 'Newstead Academy Childcare, Richmond Hill',
    licensee: 'Newstead Education Group Corp.', address: '13085 Yonge Street, Units 12 and 22, Richmond Hill, ON L4E 3S8', phone: '(289) 234-8886',
    source: 'static', defaults: { moveAge: 30, leaveAge: 6 },
    rooms: [
      { id: 'T1', name: 'Toddler 1',      licName: 'Toddler 1',      lic: 'Toddler',      runsAs: 'Toddler',      licensed: 15 },
      { id: 'T2', name: 'Toddler 2',      licName: 'Toddler 2',      lic: 'Toddler',      runsAs: 'Toddler',      licensed: 15 },
      { id: 'T3', name: 'Toddler 3',      licName: 'Toddler 3',      lic: 'Toddler',      runsAs: 'Toddler',      licensed: 15 },
      { id: 'P1', name: 'Preschool 1',    licName: 'Preschool 1',    lic: 'Preschool',    runsAs: 'Preschool',    licensed: 24 },
      { id: 'P2', name: 'Preschool 2',    licName: 'Preschool 2',    lic: 'Preschool',    runsAs: 'Preschool',    licensed: 24 },
      { id: 'P3', name: 'Preschool 3',    licName: 'Preschool 3',    lic: 'Preschool',    runsAs: 'Preschool',    licensed: 24 },
      { id: 'K2', name: 'Kindergarten 2', licName: 'Preschool 4',    lic: 'Preschool',    runsAs: 'Kindergarten', licensed: 24 },
      { id: 'K1', name: 'Kindergarten 1', licName: 'Kindergarten 1', lic: 'Kindergarten', runsAs: 'Kindergarten', licensed: 26 }
    ],
    notes: [
      'Total licensed capacity is 167 and must not be exceeded at any time.',
      'Mixed-age grouping is approved under subsections 8(2) and 8(3) of O. Reg. 137/15.',
      'The room Lillio calls Kindergarten 2 is licensed as Preschool 4. Preschool limits apply to it: 24 children, one staff member per 8, children under 6.',
      'Preschool 4 and Kindergarten 1 have an alternate capacity for primary/junior school age (24 and 26). The forecast uses primary capacity only.',
      'The shared playground holds 63 children at once. That affects daily scheduling, not enrolment.'
    ]
  },
  mk: {
    id: 'mk', name: 'Markham', full: 'Newstead Academy Markham',
    licensee: 'Newstead Academy Child Care Markham Corp.', address: '120 South Town Centre Blvd, Markham, ON L6G 1C3', phone: '(416) 826-9772',
    source: 'setup', defaults: { moveAge: 30, leaveAge: 4 },
    rooms: null,
    notes: [
      'Licensed for infant, toddler and preschool age groups, according to the ministry\'s public licensed child care search (November 2026).',
      'Room-by-room capacities come from the Primary Capacity table on the licence. Enter them under Classrooms.',
      'There is no kindergarten room, so the forecast assumes children leave in September of the year they turn 4, when junior kindergarten starts. You can change this on the forecast page.',
      'Check the licence for any mixed-age approval or alternate capacity. The forecast applies the regulation\'s mixed-age limits to toddler and preschool rooms.'
    ]
  }
};
const LOCATION_IDS = Object.keys(LOCATIONS);
const EMPTY_ROSTER = () => ({ asOf: todayISO(), kids: [], plans: [] });

/* Markham's rooms and roster, loaded from the shared database */
const SETUP = {}; LOCATION_IDS.forEach(l => { SETUP[l] = { rooms: null, roster: null, loaded: { rooms: false, roster: false } }; });

let LOC = LOCATIONS.rh;
let ROOMS = [];

function locRooms(l) { return l.source === 'static' ? l.rooms : (SETUP[l.id].rooms || []); }
/* A roster imported on the site (Classroom rosters) wins over the file built into the site */
function locRoster(l) { return SETUP[l.id].roster || (l.source === 'static' && window.RH_DATA) || EMPTY_ROSTER(); }
/* Where the roster on screen came from, so staff can see how old it is */
function rosterInfo(l) {
  l = l || LOC;
  const imp = SETUP[l.id].roster;
  if (imp) return { from: 'import', asOf: imp.asOf, importedAt: imp.importedAt, skipped: imp.skipped || [] };
  if (l.source === 'static' && window.RH_DATA) return { from: 'file', asOf: window.RH_DATA.asOf, skipped: [] };
  return { from: 'none', asOf: null, skipped: [] };
}
function rosterAsOfText(l) {
  const i = rosterInfo(l);
  if (i.from === 'none') return 'No Lillio roster imported yet';
  const days = Math.round((new Date(todayISO() + 'T12:00') - new Date(i.asOf + 'T12:00')) / 864e5);
  return 'Roster as of ' + fmtDate(i.asOf) + (days > 7 ? ' (' + days + ' days old: import a fresh Enrollment (csv) from Lillio)' : '');
}
/* Rooms where today's roster has more children than the licence allows */
function overLicensed() {
  return ROOMS.map(r => ({ r, n: ENROLLED().filter(k => k.r === r.id).length })).filter(x => x.n > x.r.licensed);
}
const overLicensedText = x => x.r.name + ' has ' + x.n + ' children on the roster for ' + x.r.licensed + ' licensed spaces: check the roster in Lillio for a child who has left or moved rooms without an end date, then import a fresh roster.';
const isSetupLoc = () => LOC.source === 'setup';
const canSearch = () => ME.decided && ME.role === 'admin';
const hasGroup = g => ROOMS.some(r => r.runsAs === g);
const licensedTotal = () => ROOMS.reduce((s, r) => s + r.licensed, 0);

/* Load the location's rooms and roster into the page and recalculate everything */
function loadLocationData() {
  ROOMS = locRooms(LOC);
  const roster = locRoster(LOC), ids = new Set(ROOMS.map(r => r.id));
  setData(Object.assign({}, roster, { kids: roster.kids.map(k => !k.r || ids.has(k.r) ? k : Object.assign({}, k, { r: null })), plans: (roster.plans || []).filter(p => ids.has(p.r)) }));
  if (!ROOMS.some(r => r.id === ACT_ROOM)) ACT_ROOM = ROOMS.length ? ROOMS[0].id : null;
  if (!ROOMS.some(r => r.id === CI_ROOM)) CI_ROOM = ROOMS.length ? ROOMS[0].id : null;
  ['children', 'rosters'].forEach(w => { if (filters[w] !== 'all' && !ROOMS.some(r => r.id === filters[w])) filters[w] = 'all'; });
  run();
}

/* Switch location: saved data, forecast settings and rooms all follow */
function applyLocation(id, quiet) {
  if (!LOCATIONS[id]) id = 'rh';
  const changed = id !== LOC.id;
  LOC = LOCATIONS[id];
  try { localStorage.setItem('na-loc', id); } catch (e) {}
  DEF = Object.assign({ caps: {} }, LOC.defaults);
  opts = loadOpts();
  SI_ROOM = 'all'; CT_ROOM = 'all'; PH_ROOM = 'all'; filters = { children: 'all', rosters: 'all' };
  if (changed) { if (sel) closeCell(); closeModal(); rebindStore(); }
  syncControls(); renderTopbar(); loadLocationData();
  if (changed && !quiet) toast('Showing ' + LOC.full + '.');
}

function renderTopbar() {
  const s = $('locSel');
  s.innerHTML = LOCATION_IDS.map(id => '<option value="' + id + '"' + (id === LOC.id ? ' selected' : '') + '>' + esc(LOCATIONS[id].full) + '</option>').join('');
  s.disabled = ME.role !== 'admin';
  document.body.classList.toggle('no-search', !canSearch());   // search lists every child, family and staff member: admins only
  s.title = ME.role === 'teacher' ? 'Your account is linked to this location' : 'Choose a location';
  const n = (ME.name || '').trim(), ini = n ? n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'NA';
  $('avatar').textContent = ini; $('avatar').title = n ? n + (ME.role === 'teacher' ? ' (staff)' : ME.role === 'admin' ? ' (admin)' : '') : '';
}
if (typeof module !== 'undefined') { module.exports = { LOCATIONS, LOCATION_IDS }; Object.assign(globalThis, module.exports); }
