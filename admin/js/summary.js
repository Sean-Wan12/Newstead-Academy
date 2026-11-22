/* ===== Dashboard ===== */
function renderHome() {
  renderSumCharts();
  const kids = ENROLLED(), c = dayCounts(kids), m0 = F.months[0], open0 = F.rooms.reduce((s, r) => s + Math.max(0, m0.rooms[r.id].open), 0);
  const waiting = rows(D.waitlist).filter(w => w.status === 'Waiting').length, closed = closureOn(DAY);
  $('homeLead').textContent = fmtDate(DAY, true) + (DAY === todayISO() ? ' (today)' : '') + '. ' + (closed ? 'The centre is closed: ' + closed.title + '.' : isWeekend(DAY) ? 'The centre is closed on weekends.' : c.in + ' of ' + kids.length + ' children are signed in.');
  const tiles = [
    ['', 'Enrolled', kids.length, 'of ' + F.rooms.reduce((s, r) => s + r.licensed, 0) + ' licensed spaces'],
    [c.in ? 'is-open' : '', 'Signed in now', c.in, c.out ? c.out + ' already signed out' : 'Children in the building'],
    [c.absent ? 'is-wait' : '', 'Absent', c.absent, 'Marked absent'],
    ['', 'Not arrived', c.expected, isOpenDay(DAY) ? 'No sign-in yet' : 'Centre closed'],
    ['', 'Waiting list', waiting, waiting === 1 ? 'family waiting' : 'families waiting'],
    [open0 ? 'is-open' : '', 'Open spaces', open0, 'by the end of ' + m0.label]
  ];
  $('homeTiles').innerHTML = tiles.map(t => '<div class="tile ' + t[0] + '"><span class="small muted">' + esc(t[1]) + '</span><b>' + t[2] + '</b><span class="small muted">' + esc(t[3]) + '</span></div>').join('');
  const al = alertsList();
  $('homeAlertCount').textContent = al.length ? al.length + (al.length === 1 ? ' item' : ' items') : 'All clear';
  $('homeAlerts').innerHTML = al.length ? al.map(a => '<li><span class="dot ' + a.lv + '"></span><span><b>' + esc(a.t) + '</b><br><span class="muted small">' + esc(a.d) + '</span></span><a class="go" href="' + a.href + '">View</a></li>').join('') : '<li class="muted">Nothing needs attention right now.</li>';
  $('homeAtt').innerHTML = '<table class="list compact"><thead><tr><th>Room</th><th class="num">Enrolled</th><th class="num">In</th><th class="num">Absent</th><th class="num">Not arrived</th><th class="num">Staff needed</th></tr></thead><tbody>' +
    F.rooms.map(r => { const ks = kids.filter(k => k.r === r.id), rc = dayCounts(ks); return '<tr><td><a href="#actions" data-goroom="' + r.id + '">' + esc(r.name) + '</a></td><td class="num">' + ks.length + '</td><td class="num">' + rc.in + '</td><td class="num">' + rc.absent + '</td><td class="num">' + rc.expected + '</td><td class="num">' + staffNeeded(rc.in, RULES[r.lic]) + '</td></tr>'; }).join('') +
    '</tbody></table>';
  const acts = logEntries().slice(0, 6);
  $('homeActivity').innerHTML = acts.length ? acts.map(x => '<li><b>' + esc(x.type) + (x.kid ? ': ' + esc((kidById(x.kid) || {}).n || '') : '') + '</b><span>' + esc(x.text || '') + '</span><span class="meta">' + esc(x.time || '') + ' · ' + esc((roomById(x.room) || {}).name || 'All rooms') + '</span></li>').join('') : '<li class="muted">No log entries for ' + fmtDate(DAY) + '.</li>';
  const msgs = rows(D.messages).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 5);
  $('homeMsgs').innerHTML = msgs.length ? msgs.map(x => '<li><b>' + esc(x.subject || '(no subject)') + '</b><span class="meta">To ' + esc(x.toLabel || '') + ' · ' + fmtWhen(x.at) + '</span></li>').join('') : '<li class="muted">No messages yet.</li>';
  const ph = rows(D.photos).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 6);
  $('homePhotos').innerHTML = ph.length ? '<div class="thumbs">' + ph.map(p => '<a href="#photos" title="' + esc(p.caption || '') + '">' + mediaTag(p, true) + '</a>').join('') + '</div>' : '<p class="muted">No photos yet.</p>';
  const evs = rows(D.events).filter(ev => (ev.end || ev.date) >= DAY).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  $('homeEvents').innerHTML = evs.length ? evs.map(ev => '<li><b>' + esc(ev.title) + '</b><span class="meta">' + esc(ev.type) + ' · ' + fmtDate(ev.date, true) + (ev.end && ev.end !== ev.date ? ' to ' + fmtDate(ev.end, true) : '') + '</span></li>').join('') : '<li class="muted">Nothing on the calendar.</li>';
  const wk = D.menus[mondayOf(DAY)], dk = DOW[(new Date(DAY + 'T12:00').getDay() + 6) % 7], day = wk && wk.days && wk.days[dk];
  $('homeMenu').innerHTML = isWeekend(DAY) ? '<p class="muted">No menu on weekends.</p>' : day && (day.am || day.lunch || day.pm)
    ? '<dl class="facts left"><dt>Morning snack</dt><dd>' + esc(day.am || '—') + '</dd><dt>Lunch</dt><dd>' + esc(day.lunch || '—') + '</dd><dt>Afternoon snack</dt><dd>' + esc(day.pm || '—') + '</dd></dl>'
    : '<p class="muted">No menu entered for this day.</p>';
}
/* ===== Colours for age groups ===== */
const GROUP_COLOR = { Infant: '#2A78D6', Toddler: '#6250D6', Preschool: '#E87BA4', Kindergarten: '#EDA100' };
const groupKey = () => '<div class="keyrow">' + Object.keys(GROUP_COLOR).filter(hasGroup).map(g => '<span><i style="background:' + GROUP_COLOR[g] + '"></i>' + g + '</span>').join('') + '<span><i style="background:#C70A24"></i>Over the limit</span></div>';

/* ===== Daily summary charts ===== */
function renderSumCharts() {
  const kids = ENROLLED();
  const order = ['in', 'out', 'absent', 'expected'], lab = { in: 'Signed in', out: 'Signed out', absent: 'Absent', expected: 'Not arrived' };
  $('sumAtt').innerHTML = '<div class="bars">' + F.rooms.map(r => { const ks = kids.filter(k => k.r === r.id), c = dayCounts(ks), n = ks.length || 1;
    return '<div class="bar-row" data-tip="' + esc(r.name + ': ' + order.map(o => lab[o] + ' ' + c[o]).join(', ')) + '"><span>' + esc(r.name) + '</span><div class="stk">' + order.filter(o => c[o]).map(o => '<span style="width:' + (c[o] / n * 100) + '%;background:' + ATT_COLORS[o] + '"></span>').join('') + '</div><span class="v">' + c.in + ' in</span></div>'; }).join('') + '</div>' +
    '<div class="keyrow">' + order.map(o => '<span><i style="background:' + ATT_COLORS[o] + '"></i>' + lab[o] + '</span>').join('') + '</div>';
  const WLC = { Waiting: '#EDA100', Offered: '#2A78D6', Accepted: '#1BAF7A', Enrolled: '#008300', Declined: '#A3A3A3' };
  const wl = rows(D.waitlist), wparts = WL_STATUS.map(st => ({ label: st, v: wl.filter(w => w.status === st).length, color: WLC[st] }));
  $('sumWl').innerHTML = '<div class="donut sm">' + donutSvg(wparts, wl.length || 1, String(wparts[0].v), 'waiting').replace('viewBox="0 0 180 180"', 'viewBox="0 0 180 180" width="140" height="140"') +
    '<ul class="legend">' + wparts.map(x => '<li><i style="background:' + x.color + '"></i><span>' + x.label + '</span><b>' + x.v + '</b></li>').join('') + '</ul></div>';
  const mon = todayISO().slice(0, 7), bill = D.billing[mon], L = bill && bill.lines ? rows(bill.lines) : [];
  const owe = l => Math.max(0, (+l.fee || 0) - (+l.subsidy || 0));
  const coll = L.filter(l => l.paid).reduce((a, l) => a + owe(l), 0), out = L.filter(l => !l.paid).reduce((a, l) => a + owe(l), 0), sub = L.reduce((a, l) => a + (+l.subsidy || 0), 0);
  const bparts = [{ label: 'Collected', v: coll, color: '#1BAF7A' }, { label: 'Outstanding', v: out, color: '#EB6834' }, { label: 'Subsidies', v: sub, color: '#6250D6' }];
  const tot = coll + out + sub;
  $('sumBill').innerHTML = L.length ? '<div class="donut sm">' + donutSvg(bparts.map(b => Object.assign({}, b, { label: b.label + ' ' + money(b.v) })), tot || 1, tot ? Math.round(coll / (coll + out || 1) * 100) + '%' : '0%', 'collected') +
    '<ul class="legend">' + bparts.map(x => '<li><i style="background:' + x.color + '"></i><span>' + x.label + '</span><b>' + money(x.v) + '</b></li>').join('') + '</ul></div>'
    : '<p class="muted">No invoices for ' + fmtDate(mon) + ' yet.</p>';
}
