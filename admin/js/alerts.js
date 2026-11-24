/* ===== Notifications ===== */
function alertsList() {
  const out = [], m0 = F.months[0], today = todayISO(), isToday = DAY === today;
  overLicensed().forEach(x => out.push({ lv: 'over', t: x.r.name + ' has ' + x.n + ' children for ' + x.r.licensed + ' licensed spaces: check the roster in Lillio', d: 'A child may have left or moved rooms without an end date. ' + rosterAsOfText() + '.', href: '#rosters' }));
  F.rooms.filter(r => m0.rooms[r.id].open < 0 && !overLicensed().some(x => x.r.id === r.id)).forEach(r => out.push({ lv: 'over', t: r.name + ' has ' + m0.rooms[r.id].n + ' children for ' + r.cap + (r.cap < r.licensed ? ' operating' : ' licensed') + ' spaces by the end of ' + m0.label, d: 'Check Lillio for a child who has left or moved without an end date.', href: '#rosters' }));
  const inc = logEntries().filter(x => x.type === 'Incident');
  if (inc.length) out.push({ lv: 'over', t: inc.length + (inc.length === 1 ? ' incident report' : ' incident reports') + ' on ' + fmtDate(DAY), d: 'Make sure families have been told and any serious occurrence is reported.', href: '#actions' });
  if (isToday && isOpenDay(DAY)) {
    const notStarted = F.rooms.filter(r => ENROLLED().some(k => k.r === r.id) && !ENROLLED().some(k => k.r === r.id && attRec(k.id)));
    if (notStarted.length) out.push({ lv: 'wait', t: 'Attendance not started in ' + notStarted.length + (notStarted.length === 1 ? ' room' : ' rooms'), d: notStarted.map(r => r.name).join(', '), href: '#actions' });
    const h = +nowHM().slice(0, 2), still = ENROLLED().filter(k => attStatus(k.id) === 'in').length;
    if (h >= 18 && still) out.push({ lv: 'over', t: still + (still === 1 ? ' child is' : ' children are') + ' still signed in after 6 pm', d: 'Sign them out or check they have been picked up.', href: '#signin' });
  }
  const wl = rows(D.waitlist), offered = wl.filter(w => w.status === 'Offered');
  if (offered.length) out.push({ lv: 'wait', t: offered.length + (offered.length === 1 ? ' family has' : ' families have') + ' an offer waiting for an answer', d: offered.map(w => w.child).join(', '), href: '#waitlist' });
  const matchable = wl.filter(w => w.status === 'Waiting').filter(w => { const e = earliestSpace(w); return e && e.key <= F.months[1].key; });
  if (matchable.length) out.push({ lv: 'info', t: matchable.length + (matchable.length === 1 ? ' waiting family' : ' waiting families') + ' could be offered a space now', d: 'The forecast shows an opening for their child\'s age this month or next.', href: '#waitlist' });
  const firstWait = F.months.find(s => F.rooms.some(r => s.rooms[r.id].waiting));
  if (firstWait) out.push({ lv: 'wait', t: 'Toddlers start waiting for preschool spaces in ' + firstWait.label, d: 'They reach 30 months with no preschool space to move into.', href: '#forecast' });
  const mon = today.slice(0, 7), bill = D.billing[mon];
  if (bill && bill.lines) {
    const unpaid = rows(bill.lines).filter(l => !l.paid), owed = unpaid.reduce((s, l) => s + Math.max(0, (+l.fee || 0) - (+l.subsidy || 0)), 0);
    if (unpaid.length) out.push({ lv: 'wait', t: unpaid.length + ' unpaid ' + (unpaid.length === 1 ? 'invoice' : 'invoices') + ' for ' + fmtDate(mon), d: money(owed) + ' still owed by families.', href: '#billing' });
  } else out.push({ lv: 'info', t: 'Invoices for ' + fmtDate(mon) + ' have not been created', d: 'Set your fees, then create the month\'s invoices.', href: '#billing' });
  const noContact = ENROLLED().filter(k => { const c = D.contacts['c' + k.id]; return !c || !(c.g1name || c.ename); });
  if (noContact.length) out.push({ lv: 'info', t: noContact.length + ' of ' + ENROLLED().length + ' children have no contacts on file', d: 'Add parents and an emergency contact for each child.', href: '#contacts' });
  const soon = rows(D.events).filter(ev => (ev.type === 'Closure' || ev.type === 'Holiday') && (ev.end || ev.date) >= today && ev.date <= addDays(today, 14));
  soon.forEach(ev => out.push({ lv: 'info', t: (ev.type === 'Closure' ? 'Centre closed: ' : 'Holiday: ') + ev.title, d: fmtDate(ev.date, true) + (ev.end && ev.end !== ev.date ? ' to ' + fmtDate(ev.end, true) : ''), href: '#calendars' }));
  if (!D.menus[mondayOf(today)]) out.push({ lv: 'info', t: 'No menu for this week', d: 'Add the week\'s snacks and lunches.', href: '#calendars' });
  return out;
}
