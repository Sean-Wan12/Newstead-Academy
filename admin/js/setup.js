/* ===== Setting up a location from the site (Markham) =====
   Rooms come from the licence's Primary Capacity table. The roster comes from Lillio's
   Enrollment (csv) report, read in the browser: only first name, last-name initial, birth month,
   room and dates
   are kept, never full last names. Both are saved in the shared database for that location. */
LOCATION_IDS.filter(l => LOCATIONS[l].source === 'setup').forEach(l => {
  watch('doc', 'loc/' + l + '/setup/rooms', v => {
    SETUP[l].rooms = v && Array.isArray(v.rooms) ? v.rooms.filter(r => RULES[r.lic]).map(r => ({ id: r.id, name: r.name, licName: r.licName || r.name, lic: r.lic, runsAs: r.lic, licensed: +r.licensed || 0 })) : [];
    SETUP[l].loaded.rooms = true;
    if (LOC.id === l && APP_READY) { loadLocationData(); renderSetupNote(); }
  });
  watch('doc', 'loc/' + l + '/setup/roster', v => {
    SETUP[l].roster = v && Array.isArray(v.kids) ? { asOf: v.asOf, kids: v.kids, plans: v.plans || [], importedAt: v.importedAt, skipped: v.skipped || [] } : null;
    SETUP[l].loaded.roster = true;
    if (LOC.id === l && APP_READY) { loadLocationData(); renderSetupNote(); }
  });
});

function renderSetupNote() {
  const el = $('setupNote');
  const show = isSetupLoc() && ME.role === 'admin' && !['help', 'welcome', 'loading', 'rooms'].includes(CUR) && (!ROOMS.length || !SETUP[LOC.id].roster);
  el.hidden = !show; if (!show) return;
  const hasRooms = ROOMS.length > 0, hasRoster = !!SETUP[LOC.id].roster;
  el.innerHTML = '<div class="row sb"><b>' + esc(LOC.full) + ' isn\'t fully set up yet</b><span class="muted small">Until it is, its pages show no children.</span></div>' +
    '<ol class="setup-steps">' +
    '<li class="' + (hasRooms ? 'done' : '') + '"><span><b>Add its rooms</b> from the Primary Capacity table on the licence. ' + (hasRooms ? plural(ROOMS.length, 'room', 'rooms') + ' added.' : 'None yet.') + '</span><a class="btn' + (hasRooms ? '' : ' btn-primary') + '" href="#rooms">' + (hasRooms ? 'Review rooms' : 'Add rooms') + '</a></li>' +
    '<li class="' + (hasRoster ? 'done' : '') + '"><span><b>Import its roster:</b> in Lillio, choose this centre, open Reports and download <b>Enrollment (csv)</b>. ' + (hasRoster ? 'Imported.' : 'Not imported yet.') + '</span><button class="btn' + (hasRooms && !hasRoster ? ' btn-primary' : '') + '" type="button" data-act="roster-import"' + (hasRooms ? '' : ' disabled') + '>Import roster</button></li>' +
    '</ol>';
}

function roomForm(r) {
  if (!isSetupLoc() || ME.role !== 'admin') return;
  const inRoom = r ? ENROLLED().filter(k => k.r === r.id).length : 0;
  openForm({ title: r ? 'Edit ' + r.name : 'Add a room at ' + LOC.name, values: r || { lic: 'Toddler' },
    intro: 'Copy these from the Primary Capacity table on the licence. The largest groups Ontario allows are infant 10, toddler 15, preschool 24 and kindergarten 26.',
    fields: [{ k: 'name', label: 'Room name', hint: 'as your staff call it', req: true }, { k: 'licName', label: 'Name on the licence', hint: 'if different' },
      { k: 'lic', label: 'Licensed age group', type: 'select', options: AGE_GROUPS.map(g => [g, g + ' (' + AGE_TEXT[g].toLowerCase() + ')']) },
      { k: 'licensed', label: 'Licensed capacity', type: 'number', min: 1, step: '1', req: true }],
    onSave: v => {
      if (!(v.licensed > 0)) { toast('Enter the licensed capacity, a number above 0.', true); return false; }
      const name = v.name.trim(), clash = ROOMS.find(x => x.name.toLowerCase() === name.toLowerCase() && (!r || x.id !== r.id));
      if (clash) { toast('There is already a room called ' + clash.name + '.', true); return false; }
      const room = { id: r ? r.id : 'R' + newId(), name, licName: v.licName || name, lic: v.lic, licensed: Math.round(v.licensed) };
      const list = (SETUP[LOC.id].rooms || []).filter(x => x.id !== room.id).concat([room]);
      list.sort((a, b) => AGE_GROUPS.indexOf(a.lic) - AGE_GROUPS.indexOf(b.lic) || a.name.localeCompare(b.name, undefined, { numeric: true }));
      return put('setup/rooms', { rooms: list, updated: Date.now() });
    },
    onDelete: r ? () => put('setup/rooms', { rooms: (SETUP[LOC.id].rooms || []).filter(x => x.id !== r.id), updated: Date.now() }) : null,
    deleteLabel: inRoom ? 'Delete room (' + plural(inRoom, 'child', 'children') + ' in it)' : 'Delete room' });
}

/* CSV with quoted fields, as Lillio exports it */
function parseCsv(text) {
  const out = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); out.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); out.push(row); }
  return out.filter(r => r.some(x => x.trim()));
}
const usDate = s => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s || '').trim()); return m ? m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0') : null; };
/* First name as Lillio has it, plus the last-name initial: 'Emma L.' */
const displayName = (f, l, letters) => { const first = (f || '').trim().split(/\s+/).join(' '), last = (l || '').trim(), part = last.slice(0, letters || 1); return (first + (last ? ' ' + part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() + '.' : '')).trim() || 'Unnamed child'; };
/* Two children with the same first name and initial get more letters of the last name: 'Ethan Wa.', 'Ethan We.' */
function makeUnique(kids, full) {
  for (let round = 0; round < 12; round++) {
    const seen = {}; kids.forEach(k => { (seen[k.n] = seen[k.n] || []).push(k); });
    const clashes = Object.values(seen).filter(g => g.length > 1); if (!clashes.length) return;
    clashes.forEach(g => g.forEach(k => { const f = full[k.id], letters = k.n.includes(' ') ? k.n.split(' ').pop().replace('.', '').length + 1 : 1; k.n = displayName(f[0], f[1], letters); }));
  }
}

/* Turn Lillio's export into the roster the forecast uses */
function rosterFromCsv(text, rooms, today) {
  const t = parseCsv(text); if (t.length < 2) throw new Error('That file has no rows.');
  const head = t[0].map(h => h.trim().toLowerCase()), col = n => head.indexOf(n);
  const need = ['first name', 'last name', 'dob', 'classroom', 'enroll date', 'grad date'], miss = need.filter(n => col(n) < 0);
  if (miss.length) throw new Error('This doesn\'t look like Lillio\'s Enrollment (csv) report. It needs these columns: First name, Last name, DOB, Classroom, Enroll date, Grad date.');
  const byName = {}; rooms.forEach(r => { byName[r.name.toLowerCase()] = r.id; byName[r.licName.toLowerCase()] = r.id; });
  const kids = [], plans = [], key = {}, skipped = {}, full = {};
  t.slice(1).forEach(c => {
    const get = n => (c[col(n)] || '').trim(), first = get('first name'), last = get('last name');
    if (/test/i.test(first + ' ' + last)) return;
    const dob = usDate(get('dob')), en = usDate(get('enroll date')), gr = usDate(get('grad date')), cls = get('classroom');
    if (!dob || !en) return;
    const rid = byName[cls.toLowerCase()];
    if (!rid) { skipped[cls || '(no classroom)'] = (skipped[cls || '(no classroom)'] || 0) + 1; return; }
    const k = first.toLowerCase() + '|' + last.toLowerCase() + '|' + dob;
    if (en <= today && (!gr || gr >= today)) {
      const kid = { id: kids.length + 1, n: displayName(first, last), b: dob.slice(0, 7), r: rid, s: en.slice(0, 7) };
      if (gr) kid.e = gr;
      kids.push(kid); key[k] = kid.id; full[kid.id] = [first, last];
    } else if (en > today) {
      plans.push({ k, f: [first, last], n: displayName(first, last), b: dob.slice(0, 7), r: rid, d: en });
    }
  });
  const fin = plans.map(p => {
    let id = key[p.k];
    if (!id) { id = kids.length + 1; kids.push({ id, n: p.n, b: p.b, r: null, s: p.d.slice(0, 7) }); key[p.k] = id; full[id] = p.f; }
    return { id, r: p.r, d: p.d };
  });
  makeUnique(kids, full);
  return { asOf: today, kids, plans: fin, skipped: Object.keys(skipped).map(n => ({ classroom: n, rows: skipped[n] })) };
}

function rosterImportForm() {
  if (!isSetupLoc() || ME.role !== 'admin') return;
  if (!ROOMS.length) { toast('Add the rooms first, so children can be matched to them.', true); return; }
  openForm({ title: 'Import the ' + LOC.name + ' roster', submit: 'Import',
    intro: 'In Lillio, choose ' + LOC.full + ', open Reports and download Enrollment (csv) with a wide date range. Children are matched to rooms by classroom name. Only first names, last-name initials, birth month, room and dates are kept.',
    fields: [{ k: 'file', label: 'Enrollment (csv) file', type: 'file', accept: '.csv,text/csv', req: true, wide: true }],
    onSave: async v => {
      if (!v.file) { toast('Choose the file first.', true); return false; }
      let r; try { r = rosterFromCsv(await v.file.text(), ROOMS, todayISO()); } catch (e) { toast(e.message, true); return false; }
      if (!r.kids.length) { toast('No current children matched these rooms. Check that the room names match Lillio\'s classroom names.', true); return false; }
      const ok = await put('setup/roster', Object.assign(r, { importedAt: Date.now() }));
      if (ok) toast('Imported ' + plural(r.kids.filter(k => k.r).length, 'child', 'children') + (r.skipped.length ? '. Skipped classrooms with no matching room: ' + r.skipped.map(s => s.classroom).join(', ') : '') + '.', !!r.skipped.length);
      return ok;
    } });
}
if (typeof module !== 'undefined') module.exports = { parseCsv, rosterFromCsv };
