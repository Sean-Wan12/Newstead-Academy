/* ===== Attendance helpers ===== */
const attRec = id => (D.att && D.att.kids && D.att.kids[id]) || null;
function attStatus(id) { const r = attRec(id); if (!r) return 'expected'; if (r.absent) return 'absent'; if (r.in && r.out) return 'out'; if (r.in) return 'in'; return 'expected'; }
function closureOn(iso) { return rows(D.events).find(ev => (ev.type === 'Closure' || ev.type === 'Holiday') && ev.date <= iso && (ev.end || ev.date) >= iso); }
const isOpenDay = iso => !isWeekend(iso) && !closureOn(iso);
function dayCounts(kids) {
  const c = { in: 0, out: 0, absent: 0, expected: 0 };
  kids.forEach(k => c[attStatus(k.id)]++);
  return c;
}
const ST_TEXT = { in: 'Signed in', out: 'Signed out', absent: 'Absent', expected: 'Not arrived' };
const ST_PILL = { in: 'open', out: '', absent: 'wait', expected: '' };
function stPill(id) { const s = attStatus(id), r = attRec(id); return '<span class="pill ' + ST_PILL[s] + '">' + ST_TEXT[s] + esc(s === 'in' ? ' ' + r.in : s === 'out' ? ' ' + r.out : '') + '</span>'; }
const logEntries = () => rows(D.logs && D.logs.entries).filter(x => !x.deleted).sort((a, b) => (b.time || '').localeCompare(a.time || '') || (b.at || 0) - (a.at || 0));
/* ===== Classroom actions ===== */
function renderActions() {
  roomButtons('actRooms', ACT_ROOM, 'actroom', false);
  if (!roomById(ACT_ROOM)) { $('actTiles').innerHTML = ''; $('actLog').innerHTML = ''; $('actTable').innerHTML = noRoomsHtml(); return; }
  const r = roomById(ACT_ROOM), ks = ENROLLED().filter(k => k.r === ACT_ROOM).sort((a, b) => a.n.localeCompare(b.n)), c = dayCounts(ks), rule = RULES[r.lic];
  const closed = closureOn(DAY);
  $('actTiles').innerHTML = [['is-open', 'Signed in', c.in], ['', 'Signed out', c.out], ['is-wait', 'Absent', c.absent], ['', 'Not arrived', c.expected], ['', 'Staff needed now', staffNeeded(c.in, rule), rule.ratioText]]
    .map(t => '<div class="tile ' + (t[2] ? t[0] : '') + '"><span class="small muted">' + t[1] + '</span><b>' + t[2] + '</b>' + (t[3] ? '<span class="small muted">' + t[3] + '</span>' : '') + '</div>').join('');
  $('actTable').innerHTML = (closed || isWeekend(DAY) ? '<p class="note" style="margin:12px">' + (closed ? 'The centre is closed on this day: ' + esc(closed.title) + '.' : 'This day is a weekend.') + '</p>' : '') +
    '<table class="list"><thead><tr><th>Child</th><th>Age</th><th>Status</th><th>In</th><th>Out</th><th class="num">Actions</th></tr></thead><tbody>' +
    ks.map(k => { const s = attStatus(k.id), rec = attRec(k.id) || {}, p = DAY.split('-').map(Number);
      const btns = s === 'expected' ? '<button class="btn sm btn-primary" data-att="in" data-kid="' + k.id + '">Check in</button><button class="btn sm" data-att="absent" data-kid="' + k.id + '">Absent</button>'
        : s === 'in' ? '<button class="btn sm btn-primary" data-att="out" data-kid="' + k.id + '">Check out</button>' : '';
      return '<tr><td><b>' + esc(k.n) + '</b></td><td>' + fmtAge(ageM(k.b, p[0], p[1])) + '</td><td>' + stPill(k.id) + '</td><td>' + esc(rec.in || '') + (rec.byIn ? '<br><span class="muted small">' + esc(rec.byIn) + '</span>' : '') + staffBy(rec.staffIn) + '</td><td>' + esc(rec.out || '') + (rec.byOut ? '<br><span class="muted small">' + esc(rec.byOut) + '</span>' : '') + staffBy(rec.staffOut) + '</td><td><div class="acts">' + btns + '<button class="btn sm" data-att="edit" data-kid="' + k.id + '">Edit</button></div></td></tr>'; }).join('') + '</tbody></table>';
  const ents = logEntries().filter(x => x.room === ACT_ROOM || !x.room);
  $('actLog').innerHTML = ents.length ? ents.map(x => '<li class="click" data-log="' + x.id + '"><b>' + esc(x.time || '') + ' · ' + esc(x.type) + (x.kid ? ': ' + esc((kidById(x.kid) || {}).n || '') : x.room ? ' (whole room)' : ' (all rooms)') + '</b><span>' + esc(x.text || '') + '</span>' + (x.by ? '<span class="meta">By ' + esc(x.by) + '</span>' : '') + '</li>').join('') : '<li class="muted">No entries for ' + esc(r.name) + ' on ' + fmtDate(DAY) + '. Add meals, naps, activities, notes or incidents.</li>';
}
function setAtt(kid, patch) { return merge('attendance/' + DAY, { date: DAY, kids: { [kid]: patch } }); }
function attForm(kid) {
  const k = kidById(kid), rec = attRec(kid) || {};
  openForm({ title: 'Attendance for ' + k.n + ', ' + fmtDate(DAY), values: rec,
    fields: [{ k: 'in', label: 'Checked in', type: 'time' }, { k: 'byIn', label: 'Dropped off by' }, { k: 'out', label: 'Checked out', type: 'time' }, { k: 'byOut', label: 'Picked up by' },
      { k: 'absent', label: 'Absent today', type: 'checkbox', wide: true }, { k: 'note', label: 'Note', type: 'textarea', rows: 2, wide: true }],
    onSave: v => setAtt(kid, v.absent ? Object.assign(v, { in: '', out: '', staffIn: ME.id || '' }) : v),
    onDelete: () => setAtt(kid, { in: '', out: '', absent: false, byIn: '', byOut: '', note: '' }), deleteLabel: 'Clear attendance' });
}
function logForm(entry) {
  if (!entry && !roomById(ACT_ROOM)) { toast('Add the rooms first, under Classrooms.', true); return; }
  const ks = ENROLLED().filter(k => k.r === (entry ? entry.room : ACT_ROOM));
  openForm({ title: entry ? 'Edit log entry' : 'Add a log entry for ' + roomById(ACT_ROOM).name, values: entry || { time: nowHM(), type: 'Activity', kid: '' },
    fields: [{ k: 'time', label: 'Time', type: 'time', req: true }, { k: 'type', label: 'Type', type: 'select', options: ['Activity', 'Meal', 'Nap', 'Toileting', 'Note', 'Incident'] },
      { k: 'kid', label: 'Who', type: 'select', options: [['', 'Whole room']].concat(ks.map(k => [String(k.id), k.n])), wide: true },
      { k: 'text', label: 'What happened', type: 'textarea', rows: 3, wide: true, req: true }, { k: 'by', label: 'Recorded by' }],
    onSave: v => { const id = entry ? entry.id : newId(); return merge('logs/' + DAY, { date: DAY, entries: { [id]: Object.assign({}, v, { kid: v.kid ? +v.kid : null, room: entry ? entry.room : ACT_ROOM, at: entry ? entry.at : Date.now() }) } }); },
    onDelete: entry ? () => merge('logs/' + DAY, { entries: { [entry.id]: { deleted: true } } }) : null });
}

/* ===== Parent sign-in ===== */
function renderSignin() {
  roomButtons('siRooms', SI_ROOM, 'siroom', true);
  const letters = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  const q = letters($('siSearch').value);
  const ks = ENROLLED().filter(k => (SI_ROOM === 'all' || k.r === SI_ROOM) && (!q || letters(k.n).includes(q))).sort((a, b) => ROOMS.findIndex(r => r.id === a.r) - ROOMS.findIndex(r => r.id === b.r) || a.n.localeCompare(b.n));
  const c = dayCounts(ENROLLED());
  $('siLead').textContent = fmtDate(DAY, true) + (DAY !== todayISO() ? ' (not today: change the date on the Dashboard)' : '') + '. ' + c.in + ' signed in, ' + c.out + ' signed out. Tap a child to sign them in or out.';
  $('siGrid').innerHTML = ks.length ? ks.map(k => { const s = attStatus(k.id), rec = attRec(k.id) || {};
    return '<button type="button" class="kid ' + s + '" data-si="' + k.id + '"><b>' + esc(k.n) + '</b><span class="small muted">' + esc(roomById(k.r).name) + '</span><span class="st">' + esc(s === 'in' ? 'In since ' + rec.in : s === 'out' ? 'Left at ' + rec.out : s === 'absent' ? 'Absent' : 'Not here yet') + '</span></button>'; }).join('') : '<p class="muted">No child matches that search.</p>';
}
function signForm(kid) {
  const k = kidById(kid), s = attStatus(kid);
  if (s === 'absent') { toast(k.n + ' is marked absent today. Change it in Classroom actions.'); return; }
  const out = s === 'in', done = s === 'out';
  if (done) { toast(k.n + ' has already been signed out today.'); return; }
  openForm({ title: (out ? 'Sign out ' : 'Sign in ') + k.n, intro: roomById(k.r).name + ' · ' + fmtDate(DAY, true), values: { time: nowHM() }, submit: out ? 'Sign out' : 'Sign in',
    fields: [{ k: 'by', label: out ? 'Picked up by' : 'Dropped off by', req: true, ph: 'Your name' }, { k: 'time', label: 'Time', type: 'time', req: true }],
    onSave: v => setAtt(kid, out ? { out: v.time, byOut: v.by } : { in: v.time, byIn: v.by, absent: false }).then(ok => { if (ok) toast(k.n + (out ? ' signed out at ' : ' signed in at ') + v.time + '.'); return ok; }) });
}
