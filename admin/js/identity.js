/* ===== Who is using the admin =====
   The owner and Editors are admins and see every page. A staff member whose Claude account
   is linked in the staff directory is a teacher: they see their main room's check-in.
   Anyone else the admin is shared with sees a welcome page until a supervisor links them.
   This decides what each person's screen shows. It is not a security boundary: anyone the
   admin is shared with can read its saved data. */
const ME = { user: null, id: null, name: '', admin: false, role: 'admin', staff: null, decided: false, resolved: false };
const STAFF_ALL = {}, STAFF_LOADED = {};
LOCATION_IDS.forEach(l => {
  STAFF_ALL[l] = {}; STAFF_LOADED[l] = false;
  watch('col', 'loc/' + l + '/staff', m => { STAFF_ALL[l] = m || {}; STAFF_LOADED[l] = true; resolveRole(); });
});

(async function initIdentity() {
  let u = null;
  try { if (window.claude && typeof window.claude.use === 'function') u = await window.claude.use('user'); } catch (e) { u = null; }
  ME.user = u;
  if (u) {
    // isOwner() and canEdit() resolve promises: a bare call is always truthy and made everyone an admin
    try { ME.admin = !!((await u.isOwner()) || (await u.canEdit())); } catch (e) { ME.admin = false; }
    try { ME.id = await u.id(); } catch (e) { ME.id = null; }
    try { const p = await u.me(); ME.name = (p && p.name) || ''; } catch (e) {}
  }
  ME.resolved = true;
  resolveRole();
  setTimeout(() => { if (!ME.decided) { LOCATION_IDS.forEach(l => { STAFF_LOADED[l] = true; }); resolveRole(); } }, 10000);
})();

function resolveRole() {
  if (!ME.resolved || STORE.mode === 'loading') return;
  const before = ME.role + '|' + (ME.staff && ME.staff.loc + ME.staff.id + ME.staff.room) + '|' + ME.decided;
  let found = null;
  if (ME.id) LOCATION_IDS.forEach(l => rows(STAFF_ALL[l]).forEach(s => { if (!found && s.userId === ME.id && s.active !== false) found = Object.assign({ loc: l }, s); }));
  ME.staff = found;
  if (!ME.user) { ME.role = STORE.mode === 'db' ? 'none' : 'admin'; ME.decided = true; }   // no account info: a local preview gets everything
  else if (ME.admin) { ME.role = 'admin'; ME.decided = true; }
  else if (found) { ME.role = 'teacher'; ME.decided = true; }
  else { ME.role = 'none'; ME.decided = LOCATION_IDS.every(l => STAFF_LOADED[l]); }
  const after = ME.role + '|' + (found && found.loc + found.id + found.room) + '|' + ME.decided;
  if (!APP_READY || before === after) return;
  applyRole();
}
/* Put the page in the right shape for this person: teachers move to their location and room */
function applyRole() {
  if (ME.role === 'teacher' && ME.staff) {
    if (LOC.id !== ME.staff.loc) applyLocation(ME.staff.loc, true);
    if (ME.staff.room) CI_ROOM = ME.staff.room;
  }
  renderTopbar(); route();
}

/* Names for account ids, looked up when shown and kept for the visit */
const NAMES = {};
function names(ids) {
  if (!ME.user || !ME.user.profiles) return;
  const need = Array.from(new Set(ids)).filter(id => id && !(id in NAMES));
  if (!need.length) return;
  need.forEach(id => { NAMES[id] = ''; });
  Promise.resolve(ME.user.profiles(need)).then(ps => { need.forEach(id => { NAMES[id] = (ps && ps[id] && ps[id].name) || ''; }); refresh(); }, () => {});
}
const staffName = id => (id && NAMES[id]) || (id && id === ME.id ? ME.name : '');
const staffBy = id => id ? (names([id]), '<br><span class="muted small">by ' + esc(staffName(id) || 'staff') + '</span>') : '';

/* People this admin is shared with, for linking staff records to accounts */
/* search('') only returns people this page has already seen, so also search the organization by the staff member's name */
async function peopleList(q) {
  if (!ME.user || !ME.user.search) return [];
  const one = async t => { try { const r = await ME.user.search(t); return Array.isArray(r) ? r : (r && (r.results || r.people || r.hits)) || []; } catch (e) { return []; } };
  const seen = {}, out = [];
  (await Promise.all([one('')].concat(q && q.trim() ? [one(q.trim())] : []))).flat().forEach(p => { if (p && p.id && !seen[p.id]) { seen[p.id] = 1; out.push(p); if (p.name) NAMES[p.id] = p.name; } });
  return out;
}
function staffLinkedTo(userId, exceptId) {
  let hit = null;
  LOCATION_IDS.forEach(l => rows(STAFF_ALL[l]).forEach(s => { if (!hit && s.userId === userId && !(l === LOC.id && s.id === exceptId)) hit = Object.assign({ loc: l }, s); }));
  return hit;
}

function renderWelcome() {
  $('wName').textContent = ME.name ? ', ' + ME.name.split(/\s+/)[0] : '';
  $('wLead').textContent = ME.user ? 'You can open the Newstead admin, but your account isn\'t linked to a classroom yet.' : 'Sign in to claude.ai and open the admin from there to take attendance.';
}
