/* ===== Logins and configuration ===== */
function renderConfig() {
  const c = D.settings.centre || {};
  const facts = [['Name', c.name || LOC.full], ['Licensee', LOC.licensee], ['Address', c.address || LOC.address], ['Phone', c.phone || LOC.phone], ['Email', c.email], ['Licence number', c.licence], ['Hours', c.hours], ['Supervisor', c.supervisor]];
  $('centreFacts').innerHTML = '<dl class="facts left">' + facts.map(f => '<dt>' + f[0] + '</dt><dd>' + (f[1] ? esc(f[1]) : '<span class="muted">Not set</span>') + '</dd>').join('') + '</dl>';
  const st = rows(D.staff).sort((a, b) => (a.active === false) - (b.active === false) || (a.name || '').localeCompare(b.name || ''));
  $('staffTable').innerHTML = st.length ? '<table class="list"><thead><tr><th>Name</th><th>Role</th><th>Room</th><th>Claude account</th><th>Phone</th><th>Email</th><th>Status</th></tr></thead><tbody>' + st.map(s => '<tr class="click" data-staff="' + s.id + '"><td><b>' + esc(s.name) + '</b></td><td>' + esc(s.role || '') + '</td><td>' + esc(s.room ? (roomById(s.room) || {}).name || s.room : '') + '</td><td>' + (s.userId ? '<span class="pill open">' + esc(staffName(s.userId) || 'Linked') + '</span>' : '<span class="muted">Not linked</span>') + '</td><td>' + esc(s.phone || '') + '</td><td>' + esc(s.email || '') + '</td><td>' + (s.active === false ? '<span class="pill">Inactive</span>' : '<span class="pill open">Active</span>') + '</td></tr>').join('') + '</tbody></table>'
    : '<p class="muted" style="padding:12px">No staff added yet.</p>';
  names(st.map(x => x.userId).filter(Boolean));
  $('accessLoc').textContent = LOC.full;
  setSaveNote();
}
function centreForm() {
  openForm({ title: 'Centre details', values: Object.assign({ name: LOC.full, address: LOC.address, phone: LOC.phone }, D.settings.centre || {}),
    fields: [{ k: 'name', label: 'Centre name', req: true, wide: true }, { k: 'address', label: 'Address', wide: true }, { k: 'phone', label: 'Phone', type: 'tel' }, { k: 'email', label: 'Email', type: 'email' },
      { k: 'licence', label: 'Licence number' }, { k: 'hours', label: 'Hours', ph: '7:00 am to 6:00 pm' }, { k: 'supervisor', label: 'Supervisor', wide: true }],
    onSave: v => put('settings/centre', v) });
}
/* A staff member linked to a Claude account goes straight to their main room's check-in when they open the admin */
async function staffForm(s) {
  const people = await peopleList();
  const acct = [['', 'Not linked']].concat(people.map(p => [p.id, (p.name || 'Unnamed person') + (p.guest ? ' (guest)' : '')]));
  if (s && s.userId && !people.some(p => p.id === s.userId)) acct.push([s.userId, staffName(s.userId) || 'Linked account']);
  openForm({ title: s ? 'Edit ' + s.name : 'Add a staff member', values: s || { active: true, role: 'RECE' },
    intro: people.length ? null : (ME.user ? 'To link a Claude account, first share this admin with that person from its claude.ai page. They then appear in the Claude account list.' : 'Account linking works when the admin is opened from its claude.ai page.'),
    fields: [{ k: 'name', label: 'Name', req: true }, { k: 'role', label: 'Role', type: 'select', options: ['Supervisor', 'Assistant supervisor', 'RECE', 'Educator', 'Cook', 'Office', 'Other'] },
      { k: 'room', label: 'Main room', hint: 'the room they check in', type: 'select', options: [['', 'None or floating']].concat(ROOM_OPTS()) }, { k: 'userId', label: 'Claude account', type: 'select', options: acct },
      { k: 'phone', label: 'Phone', type: 'tel' }, { k: 'email', label: 'Email', type: 'email' },
      { k: 'active', label: 'Currently working here', type: 'checkbox', wide: true }],
    onSave: v => {
      if (v.userId) { const other = staffLinkedTo(v.userId, s && s.id); if (other) { toast('That account is already linked to ' + other.name + ' at ' + LOCATIONS[other.loc].name + '. Unlink it there first.', true); return false; } }
      return put('staff/' + (s ? s.id : newId()), v);
    }, onDelete: s ? () => remove('staff/' + s.id) : null });
}
function backup() {
  const out = { exported: new Date().toISOString(), location: LOC.full, waitlist: D.waitlist, contacts: D.contacts, messages: D.messages, photos: D.photos, events: D.events, staff: D.staff, settings: D.settings, menus: D.menus, billing: D.billing };
  const note = STORE.mode === 'db' ? Promise.resolve(STORE.db.collection(fp('attendance')).get()).then(s => { out.attendance = {}; s.docs.forEach(d => out.attendance[d.id] = d.data()); return STORE.db.collection(fp('logs')).get(); }).then(s => { out.logs = {}; s.docs.forEach(d => out.logs[d.id] = d.data()); }).catch(() => {})
    : Promise.resolve().then(() => { out.attendance = localRead({ kind: 'col', path: 'attendance' }); out.logs = localRead({ kind: 'col', path: 'logs' }); });
  note.then(() => copyText(JSON.stringify(out, null, 2), 'backupMsg'));
}
