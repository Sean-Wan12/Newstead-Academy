function run() {
  F = forecast(DATA, { rooms: ROOMS, horizon: 24, moveAge: +opts.moveAge, leaveAge: +opts.leaveAge, caps: opts.caps });
  renderDashboard(); renderForecastHead(); renderGrid(); renderAssume(); renderChildren(); renderRosters(); renderRooms(); renderReport();
  if (sel) openCell(sel.rid, sel.mi, true);
  if (typeof refresh === 'function') refresh();
}

function facts() {
  const m0 = F.months[0];
  const open0 = F.rooms.reduce((s, r) => s + Math.max(0, m0.rooms[r.id].open), 0);
  const over0 = F.rooms.filter(r => m0.rooms[r.id].open < 0);
  let peak = { n: 0, label: '' };
  F.months.forEach(s => { const n = F.rooms.reduce((a, r) => a + (r.runsAs === 'Toddler' ? s.rooms[r.id].waiting : 0), 0); if (n > peak.n) peak = { n, label: s.label }; });
  let jump = null;
  for (let i = 1; i < F.months.length && !jump; i++) {
    const a = F.rooms.reduce((s, r) => s + Math.max(0, F.months[i].rooms[r.id].open), 0), b = F.rooms.reduce((s, r) => s + Math.max(0, F.months[i - 1].rooms[r.id].open), 0);
    if (a - b >= 5) jump = { label: F.months[i].label, n: a };
  }
  return { m0, open0, over0, peak, jump, enrolled: DATA.kids.filter(k => k.r).length, licensed: F.rooms.reduce((s, r) => s + r.licensed, 0) };
}
const statusPill = c => c.open < 0 ? '<span class="pill over">' + (-c.open) + ' over the limit</span>' : c.open === 0 ? '<span class="pill">Full</span>' : '<span class="pill open">' + c.open + ' open</span>';

function renderDashboard() {
  const f = facts(), m0 = f.m0, mon = m0.label.split(' ')[0];
  $('dashLead').textContent = f.enrolled + ' children are enrolled in ' + f.licensed + ' licensed spaces. ' + (f.open0 ? plural(f.open0, 'space is', 'spaces are') + ' open by the end of ' + mon + '.' : 'Every room is full this month.') + (f.jump ? ' The next big change is ' + f.jump.label + ', when ' + f.jump.n + ' spaces are open.' : '');
  const tiles = [
    ['', 'Licensed capacity', f.licensed, plural(ROOMS.length, 'room', 'rooms') + ' on the licence'],
    ['', 'Enrolled today', f.enrolled, rosterAsOfText()],
    ['is-open', 'Open by end of ' + mon, f.open0, f.open0 ? F.rooms.filter(r => m0.rooms[r.id].open > 0).map(r => r.name + ': ' + m0.rooms[r.id].open).join(' · ') : 'Every room is full'],
    [f.over0.length ? 'is-over' : '', 'Rooms over their limit', f.over0.length, f.over0.length ? f.over0.map(r => r.name).join(', ') : 'None'],
    [f.peak.n ? 'is-wait' : '', 'Most toddlers waiting', f.peak.n, f.peak.n ? 'In ' + f.peak.label : 'No toddler waits']
  ];
  $('tiles').innerHTML = tiles.map(t => '<div class="tile ' + t[0] + '"><span class="small muted">' + esc(t[1]) + '</span><b>' + t[2] + '</b><span class="small muted">' + esc(t[3]) + '</span></div>').join('');
  $('dashRooms').innerHTML = F.rooms.map(r => { const c = m0.rooms[r.id];
    return '<div class="card"><div class="row" style="justify-content:space-between"><h3>' + esc(r.name) + '</h3>' + statusPill(c) + '</div><div><span class="count">' + c.n + '</span> <span class="muted">of ' + c.cap + ' spaces</span></div><div class="bar' + (c.open < 0 ? ' is-over' : '') + '" aria-hidden="true"><i style="width:' + Math.min(100, Math.round(100 * c.n / Math.max(1, c.cap))) + '%"></i></div></div>'; }).join('');
  const alerts = [];
  overLicensed().forEach(x => alerts.push(['over', x.r.name + ' has ' + x.n + ' children on the roster for ' + x.r.licensed + ' licensed spaces.', 'Check the roster in Lillio for a child who has left or moved rooms without an end date, then import a fresh roster. ' + rosterAsOfText() + '.']));
  f.over0.filter(r => !overLicensed().some(x => x.r.id === r.id)).forEach(r => alerts.push(['over', r.name + ' has ' + m0.rooms[r.id].n + ' children against a limit of ' + r.cap + '.', 'Check the roster in Lillio for a child who has left or moved without an end date.']));
  const firstWait = F.months.find(s => F.rooms.some(r => s.rooms[r.id].waiting));
  if (firstWait) alerts.push(['wait', 'From ' + firstWait.label + ', toddlers reach 30 months with no preschool space to move into.', 'The backlog peaks at ' + f.peak.n + ' in ' + f.peak.label + '. Preschool rooms stay full until the school year starts.']);
  if (!alerts.length) alerts.push(['', 'Nothing needs attention.', 'Every room is within its limit and no child is waiting to move up.']);
  $('dashAlerts').innerHTML = alerts.map(a => '<li class="chk"><span class="dot ' + a[0] + '"></span><span><b>' + esc(a[1]) + '</b><br><span class="muted">' + esc(a[2]) + '</span></span></li>').join('');
  const soon = [];
  F.months.slice(0, 4).forEach(s => F.rooms.forEach(r => s.rooms[r.id].events.forEach(e => { if (e.dir === 'in' || /leaves the centre/.test(e.text)) soon.push([s.label, e.dir === 'in' ? (/starts$/.test(e.text) ? e.text + ' in ' + r.name : e.text.replace('moves in from', 'moves from') + ' to ' + r.name) : e.text, e.why.charAt(0).toUpperCase() + e.why.slice(1)]); })));
  $('dashSoon').innerHTML = soon.length ? soon.map(x => '<li><span class="pill">' + esc(x[0]) + '</span> <b>' + esc(x[1])  + '</b><br><span class="muted">' + esc(x[2]) + '</span></li>').join('') : '<li class="muted">No moves, starts or departures are recorded for the next 3 months.</li>';
}

function renderForecastHead() {
  const f = facts();
  $('fcLead').textContent = 'Open spaces in each room for the next 24 months. ' + (f.jump ? 'Little changes until ' + f.jump.label + ', when ' + f.jump.n + ' spaces open.' : '');
  const changed = +opts.moveAge !== DEF.moveAge || +opts.leaveAge !== DEF.leaveAge || Object.keys(opts.caps).length;
  $('scenarioNote').textContent = changed ? 'You are viewing a what-if, not the default forecast. The grid below has been recalculated.' : 'Change a setting and the grid below recalculates straight away.';
}

function renderGrid() {
  const ms = F.months;
  let h = '<thead><tr><th class="rowhead" scope="col">Room</th>' + ms.map(s => '<th scope="col" class="' + (s.m === 9 ? 'sep' : '') + '">' + MONTHS[s.m - 1] + '<span>' + s.y + '</span></th>').join('') + '</tr></thead><tbody>';
  GROUPS.filter(g => hasGroup(g[0])).forEach(g => {
    h += '<tr class="group"><th class="rowhead" scope="colgroup">' + g[1] + '</th><th colspan="' + ms.length + '"></th></tr>';
    F.rooms.filter(r => r.runsAs === g[0]).forEach(r => {
      h += '<tr><th class="rowhead" scope="row"><b>' + esc(r.name) + '</b><span>' + r.cap + ' spaces</span>' + (r.licName !== r.name ? '<span>Licensed as ' + esc(r.licName) + '</span>' : '') + '</th>';
      ms.forEach(s => {
        const c = s.rooms[r.id], on = sel && sel.rid === r.id && sel.mi === s.mi;
        const cls = c.open < 0 ? 'over' : c.open === 0 ? 'full' : 'open';
        const main = c.open < 0 ? '+' + (-c.open) : c.open === 0 ? 'Full' : c.open;
        const sub = c.waiting ? '<span class="w">' + c.waiting + ' waiting</span>' : c.open < 0 ? '<span>over</span>' : c.open === 0 ? '' : '<span>open</span>';
        const a = Math.round(14 + 60 * Math.min(1, c.open / c.cap));
        const aria = r.name + ', ' + s.label + ': ' + (c.open < 0 ? (-c.open) + ' over the limit' : c.open + ' open of ' + c.cap) + (c.waiting ? ', ' + c.waiting + ' waiting to move up' : '');
        h += '<td class="' + (s.m === 9 ? 'sep' : '') + '"><button type="button" class="cell ' + cls + '" style="--a:' + a + '" data-r="' + r.id + '" data-m="' + s.mi + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + esc(aria) + '"><b>' + main + '</b>' + sub + '</button></td>';
      });
      h += '</tr>';
    });
  });
  h += '<tr class="total"><th class="rowhead" scope="row"><b>Children enrolled</b><span>of ' + licensedTotal() + ' licensed</span></th>' + ms.map(s => '<td>' + s.total + '</td>').join('') + '</tr></tbody>';
  $('grid').innerHTML = ROOMS.length ? h : '<tbody><tr><td><div class="empty"><b>No rooms set up for ' + esc(LOC.full) + ' yet</b><span>Add the rooms from its licence under Classrooms, then import its Lillio roster.</span><a class="btn btn-primary" href="#rooms">Go to Classrooms</a></div></td></tr></tbody>';
}

function openCell(rid, mi, keep) {
  sel = { rid, mi };
  const r = F.rooms.find(x => x.id === rid), s = F.months[mi], c = s.rooms[rid];
  const startN = DATA.kids.filter(k => k.r === rid).length;
  let ins = 0, outs = 0; for (let i = 0; i <= mi; i++) F.months[i].rooms[rid].events.forEach(e => e.dir === 'in' ? ins++ : outs++);
  const head = c.open < 0 ? (-c.open) + ' over the limit' : c.open === 0 ? 'Full' : plural(c.open, 'open space', 'open spaces');
  const evs = c.events.length ? '<ul class="plain">' + c.events.map(e => '<li class="evt ' + e.dir + '"><span class="mk" aria-hidden="true">' + (e.dir === 'in' ? '+' : '−') + '</span><span><b>' + esc(e.text) + '</b><br><span class="muted">' + esc(e.why.charAt(0).toUpperCase() + e.why.slice(1)) + '</span></span></li>').join('') + '</ul>' : '<p class="muted">No child joins or leaves this room in ' + s.label + '.</p>';
  const checks = [
    [c.open < 0 ? 'over' : '', c.n + ' children against a limit of ' + c.cap],
    [c.young > c.youngLimit ? 'over' : '', c.youngLimit ? c.young + ' younger than the ' + r.lic.toLowerCase() + ' age range. The mixed-age limit is ' + c.youngLimit + '.' : c.young + ' younger than the kindergarten age range. Mixed-age is not modelled for this room.'],
    [c.waiting ? 'wait' : '', c.waiting ? c.flags.filter(f => f.level === 'wait').map(f => f.text).join('; ') : 'No child is past the upper age for this room'],
    ['', plural(c.staff, 'staff member', 'staff members') + ' needed at one per ' + c.ratio + ' children']
  ];
  const age = id => fmtAge(ageM(kidsById[id].b, s.y, s.m));
  $('drawer').innerHTML =
    '<div class="dhead"><div><h2>' + esc(r.name) + '</h2><p class="muted">' + s.label + '</p><p class="muted small">Licensed as ' + esc(r.licName) + ' (' + r.lic + ')</p></div><button class="btn" type="button" id="closeD">Close</button></div>' +
    '<div class="stack-s"><div><div class="big">' + head + '</div><p class="muted">' + c.n + ' of ' + c.cap + ' spaces filled at month end</p></div>' +
    '<div class="bar' + (c.open < 0 ? ' is-over' : '') + '" aria-hidden="true"><i style="width:' + Math.min(100, Math.round(100 * c.n / Math.max(1, c.cap))) + '%"></i></div></div>' +
    '<div class="stack-s"><h3>What changes in ' + s.label + '</h3>' + evs + '</div>' +
    '<div class="stack-s"><h3>How it got here</h3><p>' + startN + ' children today. Since then ' + plural(ins, 'child joins', 'children join') + ' and ' + plural(outs, 'child leaves', 'children leave') + ' this room, which gives ' + c.n + '.</p></div>' +
    '<div class="stack-s"><h3>Rule checks</h3><ul class="plain">' + checks.map(k => '<li class="chk"><span class="dot ' + k[0] + '"></span><span>' + esc(k[1]) + '</span></li>').join('') + '</ul></div>' +
    '<details><summary>Children in the room (' + c.n + ')</summary><div class="chips" style="margin-top:var(--s3)">' + c.ids.map(id => '<span class="chip">' + esc(kidsById[id].n) + ' ' + age(id) + '</span>').join('') + '</div></details>';
  $('drawer').classList.add('on'); $('drawer').setAttribute('aria-hidden', 'false');
  $('closeD').onclick = closeCell;
  document.querySelectorAll('.cell[aria-pressed="true"]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  const b = document.querySelector('.cell[data-r="' + rid + '"][data-m="' + mi + '"]'); if (b) b.setAttribute('aria-pressed', 'true');
  if (!keep) $('closeD').focus();
}
function closeCell() {
  const b = sel && document.querySelector('.cell[data-r="' + sel.rid + '"][data-m="' + sel.mi + '"]');
  sel = null; $('drawer').classList.remove('on'); $('drawer').setAttribute('aria-hidden', 'true');
  document.querySelectorAll('.cell[aria-pressed="true"]').forEach(x => x.setAttribute('aria-pressed', 'false'));
  if (b && !$('view-forecast').hidden) b.focus();
}

function renderAssume() {
  const a = [
    'No new enrolments are added, so an open space is one you can offer to a family.',
    'Children leave only on an end date recorded in Lillio, or in September of the year they turn ' + opts.leaveAge + '.',
    'A toddler moves to preschool in the first month they are ' + opts.moveAge + ' months old and a preschool room has a space. The oldest child goes first.' + (+opts.moveAge < 30 ? ' Moves before 30 months count against each preschool room’s mixed-age limit of 5.' : ''),
    hasGroup('Kindergarten') ? 'Each September, preschoolers turning 4 that year move into a kindergarten class if there is space' + (ROOMS.some(r => r.runsAs === 'Kindergarten' && r.lic !== 'Kindergarten') && ROOMS.some(r => r.lic === 'Kindergarten') ? ', and senior kindergarten children in ' + ROOMS.filter(r => r.runsAs === 'Kindergarten' && r.lic !== 'Kindergarten').map(r => r.name).join(' and ') + ' move to ' + ROOMS.filter(r => r.lic === 'Kindergarten').map(r => r.name).join(' and ') : '') + '.' : 'There is no kindergarten room at ' + LOC.name + ', so preschoolers stay until they leave for school.',
    hasGroup('Infant') ? 'An infant moves to a toddler room in the first month they are 18 months old and a toddler room has a space. The oldest child goes first.' : null,
    'Numbers are month-end snapshots for children attending five days a week. Part-time schedules and staffing levels are not included yet.',
    'Whether a child may stay in a toddler room after 30 months is for your ministry program advisor to confirm. The forecast marks those children as waiting.'
  ];
  $('assume').innerHTML = a.filter(Boolean).map(x => '<li>' + esc(x) + '</li>').join('');
  $('rulever').textContent = RULES.version;
  $('licHead').textContent = 'Licence notes: ' + LOC.full;
  $('licNotes').innerHTML = LOC.notes.map(x => '<li>' + esc(x) + '</li>').join('') + '<li>' + esc(LOC.licensee + ', ' + LOC.address + ', ' + LOC.phone + '.') + '</li>';
}

function filterButtons(which) {
  document.querySelector('[data-filter="' + which + '"]').innerHTML = [['all', 'All rooms']].concat(F.rooms.map(r => [r.id, r.name])).map(x => '<button type="button" class="btn" data-f="' + x[0] + '" data-w="' + which + '" aria-pressed="' + (filters[which] === x[0]) + '">' + esc(x[1]) + '</button>').join('');
}
function renderChildren() {
  const s0 = F.months[0]; filterButtons('children');
  const rows = DATA.kids.filter(k => k.r && (filters.children === 'all' || k.r === filters.children)).map(k => {
    const r = F.rooms.find(x => x.id === k.r), j = (F.journey[k.id] || [])[0];
    const mark = r.runsAs === 'Infant' ? '18 months in ' + monthLabel(k.b, 18) : r.runsAs === 'Toddler' ? '30 months in ' + monthLabel(k.b, 30) : r.runsAs === 'Preschool' ? 'Turns 4 in ' + (+k.b.slice(0, 4) + 4) : 'Turns ' + opts.leaveAge + ' in ' + (+k.b.slice(0, 4) + +opts.leaveAge);
    let pill = '<span class="pill">No change in 24 months</span>', sort = 999;
    if (j) { sort = j.mi; pill = '<span class="pill open">' + esc(F.months[j.mi].label) + '</span> ' + esc(j.text.replace(/ \(.*\)$/, '')); }
    let wait = '';
    if (r.runsAs === 'Toddler') {
      const b = k.b.split('-'), t30 = (+b[0] * 12 + +b[1] - 1) + 30, a0 = ym(DATA.asOf.slice(0, 7)), base = a0.y * 12 + a0.m - 1, from = Math.max(0, t30 - base), until = j ? j.mi : 25;
      if (until > from) wait = ' <span class="pill wait">waits ' + plural(until - from, 'month', 'months') + (j ? '' : ' or more') + '</span>';
    }
    return { sort, html: '<tr><td><b>' + esc(k.n) + '</b></td><td>' + fmtAge(ageM(k.b, s0.y, s0.m)) + '</td><td>' + esc(r.name) + '</td><td>' + esc(mark) + '</td><td>' + pill + wait + '</td></tr>' };
  }).sort((a, b) => a.sort - b.sort);
  $('kidTable').innerHTML = '<thead><tr><th>Child</th><th>Age now</th><th>Room now</th><th>Next milestone</th><th>Forecast</th></tr></thead><tbody>' + rows.map(r => r.html).join('') + '</tbody>';
}
function renderRosters() {
  const s0 = F.months[0]; filterButtons('rosters');
  const info = rosterInfo(), imp = info.from === 'import';
  $('rosterActs').innerHTML = ME.role === 'admin' ? '<button class="btn' + (info.from === 'none' ? ' btn-primary' : '') + '" type="button" data-act="roster-import"' + (ROOMS.length ? '' : ' disabled') + '>' + (info.from === 'none' ? 'Import Lillio roster' : 'Import a newer roster') + '</button>' : '';
  $('rosterLead').textContent = rosterAsOfText() + '. Who is in each room at ' + LOC.full + ', ' + (imp ? 'from the Lillio export imported on ' + fmtWhen(info.importedAt) : info.from === 'file' ? 'from the Lillio export built into the site' : 'once its Lillio export is imported') + '. Children are shown by first name and last-name initial.' +
    (info.skipped.length ? ' Not imported, because no room matches: ' + info.skipped.map(x => x.classroom + ' (' + x.rows + ')').join(', ') + '.' : '');
  $('rosterFlags').innerHTML = overLicensed().map(x => '<li class="chk"><span class="dot over"></span><span>' + esc(overLicensedText(x)) + '</span></li>').join('');
  const rows = DATA.kids.filter(k => k.r && (filters.rosters === 'all' || k.r === filters.rosters))
    .sort((a, b) => ROOMS.findIndex(r => r.id === a.r) - ROOMS.findIndex(r => r.id === b.r) || (a.b < b.b ? -1 : 1))
    .map(k => '<tr><td><b>' + esc(k.n) + '</b></td><td>' + esc(F.rooms.find(x => x.id === k.r).name) + '</td><td>' + monthLabel(k.b, 0) + '</td><td>' + fmtAge(ageM(k.b, s0.y, s0.m)) + '</td><td>' + monthLabel(k.s, 0) + '</td></tr>');
  $('rosterTable').innerHTML = '<thead><tr><th>Child</th><th>Room</th><th>Born</th><th>Age now</th><th>In this room since</th></tr></thead><tbody>' + rows.join('') + '</tbody>';
}
function renderRooms() {
  const s0 = F.months[0], edit = isSetupLoc() && ME.role === 'admin';
  $('roomActs').innerHTML = edit ? '<button class="btn btn-primary" type="button" data-act="room-add">Add a room</button>' : '';
  $('roomsLead').textContent = isSetupLoc()
    ? 'Rooms at ' + LOC.full + ', entered from its Ministry of Education licence. Lower a room\'s operating capacity to plan with fewer spaces than the licence allows.'
    : 'Licensed capacity comes from the Ministry of Education licence. Lower a room\'s operating capacity to plan with fewer spaces than the licence allows.';
  if (!F.rooms.length) {
    $('roomCards').innerHTML = '<div class="panel empty" style="grid-column:1/-1"><b>No rooms yet</b><span>Add each room from the Primary Capacity table on the licence: its name, age group and capacity.</span>' + (edit ? '<button class="btn btn-primary" type="button" data-act="room-add">Add a room</button>' : '<span>Only the owner or an Editor can add rooms.</span>') + '</div>';
    return;
  }
  $('roomCards').innerHTML = F.rooms.map(r => {
    const rule = RULES[r.lic], yl = Math.round(rule.youngShare * r.cap + 1e-9);
    return '<div class="card"><div class="row sb" style="align-items:flex-start"><div><h3>' + esc(r.name) + '</h3><p class="small muted">On the licence: ' + esc(r.licName) + ' (' + r.lic + ')</p></div>' + (edit ? '<button class="btn sm" type="button" data-roomedit="' + r.id + '">Edit</button>' : '') + '</div>' +
      '<dl class="facts"><dt>Licensed capacity</dt><dd>' + r.licensed + '</dd><dt>Enrolled</dt><dd>' + s0.rooms[r.id].n + '</dd><dt>Age range</dt><dd>' + AGE_TEXT[r.lic] + '</dd><dt>Staff to children</dt><dd>' + rule.ratioText + '</dd><dt>Younger children</dt><dd>' + (yl ? 'up to ' + yl : 'not modelled') + '</dd></dl>' +
      (r.licensed > rule.maxGroup ? '<p class="note">' + r.licensed + ' is more than Ontario\'s largest ' + r.lic.toLowerCase() + ' group (' + rule.maxGroup + '). Check the licence.</p>' : '') +
      '<label class="field" for="cap-' + r.id + '">Operating capacity<input type="number" id="cap-' + r.id + '" data-cap="' + r.id + '" min="0" max="' + r.licensed + '" value="' + r.cap + '"></label></div>';
  }).join('');
}
function reportRows() {
  const head = ['Room'].concat(F.months.map(s => s.label));
  return [head].concat(F.rooms.map(r => [r.name].concat(F.months.map(s => s.rooms[r.id].open)))).concat([['Children enrolled'].concat(F.months.map(s => s.total))]);
}
function renderReport() {
  const rows = reportRows();
  $('reportTable').innerHTML = '<thead><tr>' + rows[0].map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' + rows.slice(1).map(r => '<tr>' + r.map((c, i) => i ? '<td>' + c + '</td>' : '<td><b>' + esc(c) + '</b></td>').join('') + '</tr>').join('') + '</tbody>';
}
