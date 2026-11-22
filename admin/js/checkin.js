/* ===== Classroom check-in =====
   One card per child in a room, with big buttons for the educator in the room.
   Teachers see only their main room; admins can switch rooms. Each check-in records
   the time and which staff account did it. */
function noRoomsHtml() {
  return '<div class="empty"><b>No rooms set up for ' + esc(LOC.full) + ' yet</b><span>Add the rooms from its licence under Classrooms, then import its roster.</span>' + (ME.role === 'admin' ? '<a class="btn btn-primary" href="#rooms">Go to Classrooms</a>' : '') + '</div>';
}
function renderCheckin() {
  const teacher = ME.role === 'teacher';
  if (teacher && ME.staff && ME.staff.room) CI_ROOM = ME.staff.room;
  const r = roomById(CI_ROOM);
  $('ciRooms').hidden = teacher;
  if (!teacher) roomButtons('ciRooms', CI_ROOM, 'ciroom', false);
  if (!r) {
    $('ciTitle').textContent = 'Classroom check-in';
    $('ciLead').textContent = teacher ? 'Your staff record has no main room yet. Ask your supervisor to set one in Logins and configuration.' : '';
    $('ciTiles').innerHTML = ''; $('ciBulk').innerHTML = '';
    $('ciGrid').innerHTML = teacher ? '' : '<div class="panel">' + noRoomsHtml() + '</div>';
    return;
  }
  const ks = ENROLLED().filter(k => k.r === r.id).sort((a, b) => a.n.localeCompare(b.n)), c = dayCounts(ks), rule = RULES[r.lic];
  const closed = closureOn(DAY), today = DAY === todayISO();
  $('ciTitle').textContent = r.name + ' check-in';
  $('ciLead').textContent = LOC.full + ' · ' + fmtDate(DAY, true) + (today ? ' (today)' : ' (not today)') + (closed ? '. The centre is closed: ' + closed.title + '.' : isWeekend(DAY) ? '. This day is a weekend.' : '. Tap a button to check a child in or out.');
  $('ciTiles').innerHTML = [['is-open', 'Checked in', c.in, 'in the room now'], ['', 'Not arrived', c.expected, 'of ' + ks.length + ' enrolled'], ['is-wait', 'Absent', c.absent, 'marked absent'], ['', 'Checked out', c.out, 'gone home'],
    [staffNeeded(c.in, rule) ? 'is-wait' : '', 'Staff needed now', staffNeeded(c.in, rule), 'ratio ' + rule.ratioText]]
    .map(t => '<div class="tile ' + t[0] + '"><span class="small muted">' + t[1] + '</span><b>' + t[2] + '</b><span class="small muted">' + t[3] + '</span></div>').join('');
  $('ciBulk').innerHTML = c.expected && !closed && !isWeekend(DAY) ? '<button class="btn danger" type="button" data-act="ci-absent-rest">Mark the ' + plural(c.expected, 'child', 'children') + ' not arrived as absent</button>' : '';
  if (!today) $('ciBulk').innerHTML += '<span class="muted small">You are changing ' + fmtDate(DAY) + ', not today. Times are recorded as the current time.</span>';
  const p = DAY.split('-').map(Number);
  $('ciGrid').innerHTML = ks.length ? ks.map(k => {
    const s = attStatus(k.id), rec = attRec(k.id) || {};
    const btns = s === 'expected' ? '<button class="btn btn-primary" type="button" data-att="in" data-kid="' + k.id + '">Check in</button><button class="btn" type="button" data-att="absent" data-kid="' + k.id + '">Absent</button>'
      : s === 'in' ? '<button class="btn btn-primary" type="button" data-att="out" data-kid="' + k.id + '">Check out</button>'
      : s === 'out' ? '<button class="btn" type="button" data-att="undo-out" data-kid="' + k.id + '">Undo check-out</button>'
      : '<button class="btn" type="button" data-att="undo-absent" data-kid="' + k.id + '">Not absent</button>';
    const who = s === 'in' ? staffName(rec.staffIn) : s === 'out' ? staffName(rec.staffOut) : s === 'absent' ? staffName(rec.staffIn) : '';
    names([rec.staffIn, rec.staffOut].filter(Boolean));
    const line = s === 'in' ? 'In at ' + rec.in : s === 'out' ? 'In ' + (rec.in || '—') + ', out ' + rec.out : s === 'absent' ? 'Absent today' : 'Not here yet';
    return '<div class="cikid ' + s + '"><div class="row sb"><b>' + esc(k.n) + '</b>' + stPill(k.id) + '</div><span class="muted small">' + fmtAge(ageM(k.b, p[0], p[1])) + '</span>' +
      '<span class="small">' + esc(line) + (who ? ' · by ' + esc(who) : '') + '</span>' + (rec.note ? '<span class="muted small">' + esc(rec.note) + '</span>' : '') +
      '<div class="row">' + btns + '<button class="btn sm" type="button" data-att="edit" data-kid="' + k.id + '" aria-label="Edit attendance for ' + esc(k.n) + '">Edit</button></div></div>';
  }).join('') : '<div class="panel empty"><b>No children in ' + esc(r.name) + '</b><span>Children appear here from the roster.</span></div>';
}
function markRestAbsent(b) {
  if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Click again to mark them absent'; return; }
  const ks = ENROLLED().filter(k => k.r === CI_ROOM && attStatus(k.id) === 'expected'), kids = {};
  ks.forEach(k => { kids[k.id] = { absent: true, in: '', out: '', staffIn: ME.id || '' }; });
  merge('attendance/' + DAY, { date: DAY, kids }).then(ok => { if (ok) toast(plural(ks.length, 'child', 'children') + ' marked absent.'); });
}
