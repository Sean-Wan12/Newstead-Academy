/* ===== Waitlist matching ===== */
const WL_STATUS = ['Waiting', 'Offered', 'Accepted', 'Enrolled', 'Declined'];
function natural(ageMonths) { if (ageMonths < 18) return hasGroup('Infant') ? 'Infant' : null; if (ageMonths < 30) return 'Toddler'; if (ageMonths < 48 || !hasGroup('Kindergarten')) return 'Preschool'; return 'Kindergarten'; }
function ageAt(dob, y, m) { const p = dob.split('-').map(Number); return (y - p[0]) * 12 + (m - p[1]) - ((p[2] || 1) > 1 ? 1 : 0); }
function earliestSpace(w) {
  if (!w.dob || !F) return null;
  const from = w.start || F.months[0].key;
  for (const s of F.months) {
    if (s.key < from) continue;
    const a = ageAt(w.dob, s.y, s.m), g = natural(a);
    if (!g) continue;
    const room = F.rooms.find(r => r.runsAs === g && a >= RULES[r.lic].minM && a < RULES[r.lic].maxM && s.rooms[r.id].open > 0);
    if (room) return { label: s.label, key: s.key, room: room.name };
  }
  return null;
}
function groupAtStart(w) {
  if (!w.dob) return '';
  const st = (w.start || todayISO().slice(0, 7)).split('-').map(Number), a = ageAt(w.dob, st[0], st[1]), g = natural(a);
  return g ? g + ' (' + fmtAge(Math.max(0, a)) + ')' : 'Under 18 months (' + fmtAge(Math.max(0, a)) + ')';
}
/* ===== Registration and waitlist ===== */
let WL_FILTER = 'active';
function renderWaitlist() {
  const wl = rows(D.waitlist);
  $('wlCounters').innerHTML = WL_STATUS.map(s => '<div><b>' + wl.filter(w => w.status === s).length + '</b><span>' + s + '</span></div>').join('');
  $('wlFilter').innerHTML = [['active', 'Waiting and offered'], ['all', 'All']].concat(WL_STATUS.map(s => [s, s])).map(o => '<button type="button" class="btn sm" data-wlf="' + o[0] + '" aria-pressed="' + (WL_FILTER === o[0]) + '">' + o[1] + '</button>').join('');
  const shown = wl.filter(w => WL_FILTER === 'all' || (WL_FILTER === 'active' ? (w.status === 'Waiting' || w.status === 'Offered') : w.status === WL_FILTER))
    .sort((a, b) => (a.priority && a.priority !== 'None' ? 0 : 1) - (b.priority && b.priority !== 'None' ? 0 : 1) || (a.added || 0) - (b.added || 0));
  if (!wl.length) { $('wlTable').innerHTML = '<div class="empty"><b>No families on the waitlist yet</b><span>Add a family to see when a space for their child opens up.</span><button class="btn btn-primary" type="button" data-act="wl-add">Add family</button></div>'; return; }
  if (!shown.length) { $('wlTable').innerHTML = '<div class="empty"><b>No families with this status</b></div>'; return; }
  $('wlTable').innerHTML = '<table class="list"><thead><tr><th>#</th><th>Child</th><th>Born</th><th>Age group at start</th><th>Wanted start</th><th>Parent</th><th>Status</th><th>Earliest space</th></tr></thead><tbody>' +
    shown.map((w, i) => { const e = w.status === 'Waiting' || w.status === 'Offered' ? earliestSpace(w) : null;
      return '<tr class="click" data-wl="' + w.id + '"><td>' + (i + 1) + '</td><td><b>' + esc(w.child) + '</b>' + (w.priority && w.priority !== 'None' ? ' <span class="pill">' + esc(w.priority) + '</span>' : '') + '</td><td>' + fmtDate(w.dob) + '</td><td>' + esc(groupAtStart(w)) + '</td><td>' + fmtDate(w.start) + '</td><td>' + esc(w.parent || '') + (w.phone ? '<br><span class="muted small">' + esc(w.phone) + '</span>' : '') + '</td><td><span class="pill ' + ({ Waiting: 'wait', Offered: 'open', Accepted: 'open', Declined: 'over' }[w.status] || '') + '">' + esc(w.status) + '</span></td><td>' + (e ? esc(e.label) + '<br><span class="muted small">' + esc(e.room) + '</span>' : w.status === 'Waiting' || w.status === 'Offered' ? '<span class="muted">None in 24 months</span>' : '') + '</td></tr>'; }).join('') + '</tbody></table>';
}
function waitlistForm(w) {
  openForm({ title: w ? 'Edit ' + w.child : 'Add a family to the waitlist', values: w || { status: 'Waiting', priority: 'None', start: todayISO().slice(0, 7) },
    fields: [
      { type: 'heading', label: 'Child' },
      { k: 'child', label: 'Child\'s name', req: true }, { k: 'dob', label: 'Date of birth', type: 'date', req: true },
      { k: 'start', label: 'Wanted start', type: 'month', req: true }, { k: 'days', label: 'Days needed', type: 'select', options: ['Full time (5 days)', '4 days', '3 days', '2 days', 'Flexible'] },
      { type: 'heading', label: 'Family' },
      { k: 'parent', label: 'Parent or guardian', req: true }, { k: 'phone', label: 'Phone', type: 'tel' },
      { k: 'email', label: 'Email', type: 'email', wide: true },
      { type: 'heading', label: 'Status' },
      { k: 'status', label: 'Status', type: 'select', options: WL_STATUS }, { k: 'priority', label: 'Priority', type: 'select', options: ['None', 'Sibling enrolled', 'Staff child', 'Transfer', 'Other'] },
      { k: 'notes', label: 'Notes', type: 'textarea', rows: 3, wide: true }
    ],
    onSave: v => { const id = w ? w.id : newId(); return put('waitlist/' + id, Object.assign({}, v, { added: w ? (w.added || Date.now()) : Date.now(), updated: Date.now() })); },
    onDelete: w ? () => remove('waitlist/' + w.id) : null, deleteLabel: 'Remove from waitlist'
  });
}
