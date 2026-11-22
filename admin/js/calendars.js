/* ===== Menus and calendars ===== */
const DOW = ['mon', 'tue', 'wed', 'thu', 'fri'], DOW_NAME = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], MEALS = [['am', 'Morning snack'], ['lunch', 'Lunch'], ['pm', 'Afternoon snack']];
let WEEK = mondayOf(todayISO());
function renderCalendars() {
  $('wkLabel').textContent = 'Week of ' + fmtDate(WEEK);
  const wk = D.menus[WEEK];
  $('wkTable').innerHTML = '<table class="list"><thead><tr><th>Day</th>' + MEALS.map(m => '<th>' + m[1] + '</th>').join('') + '</tr></thead><tbody>' +
    DOW.map((d, i) => { const day = wk && wk.days && wk.days[d] || {}; const date = addDays(WEEK, i), cl = closureOn(date);
      return '<tr><td><b>' + DOW_NAME[i] + '</b><br><span class="muted small">' + fmtDate(date) + '</span></td>' + (cl ? '<td colspan="3"><span class="pill">Closed: ' + esc(cl.title) + '</span></td>' : MEALS.map(m => '<td style="white-space:normal">' + (day[m[0]] ? esc(day[m[0]]) : '<span class="muted">—</span>') + '</td>').join('')) + '</tr>'; }).join('') + '</tbody></table>';
  const today = todayISO(), evs = rows(D.events).sort((a, b) => a.date.localeCompare(b.date));
  const up = evs.filter(e => (e.end || e.date) >= today), past = evs.filter(e => (e.end || e.date) < today).reverse();
  const evRow = e => '<tr class="click" data-ev="' + e.id + '"><td>' + fmtDate(e.date, true) + (e.end && e.end !== e.date ? ' to ' + fmtDate(e.end, true) : '') + '</td><td><b>' + esc(e.title) + '</b>' + (e.notes ? '<br><span class="muted small">' + esc(e.notes) + '</span>' : '') + '</td><td><span class="pill ' + (e.type === 'Closure' || e.type === 'Holiday' ? 'wait' : '') + '">' + esc(e.type) + '</span></td></tr>';
  $('evList').innerHTML = (up.length ? '<div class="tablebox flat"><table class="list"><thead><tr><th>Date</th><th>Event</th><th>Type</th></tr></thead><tbody>' + up.map(evRow).join('') + '</tbody></table></div>' : '<p class="muted">No upcoming events. Add holidays, closures, PA days and family events.</p>') +
    (past.length ? '<details><summary>Past events (' + past.length + ')</summary><div class="tablebox flat" style="margin-top:8px"><table class="list"><tbody>' + past.map(evRow).join('') + '</tbody></table></div></details>' : '');
}
function menuForm() {
  const wk = D.menus[WEEK], vals = {};
  DOW.forEach(d => MEALS.forEach(m => { vals[d + '_' + m[0]] = wk && wk.days && wk.days[d] && wk.days[d][m[0]] || ''; }));
  openForm({ title: 'Menu for the week of ' + fmtDate(WEEK), values: vals,
    fields: DOW.flatMap((d, i) => [{ type: 'heading', label: DOW_NAME[i] }].concat(MEALS.map(m => ({ k: d + '_' + m[0], label: m[1], wide: m[0] === 'lunch' })))),
    onSave: v => { const days = {}; DOW.forEach(d => { days[d] = {}; MEALS.forEach(m => { days[d][m[0]] = v[d + '_' + m[0]] || ''; }); }); return put('menus/' + WEEK, { week: WEEK, days, updated: Date.now() }); } });
}
function eventForm(e) {
  openForm({ title: e ? 'Edit event' : 'Add an event', values: e || { date: todayISO(), type: 'Event' },
    fields: [{ k: 'title', label: 'Title', req: true, wide: true }, { k: 'type', label: 'Type', type: 'select', options: ['Event', 'Closure', 'Holiday', 'PA day', 'Staff training', 'Field trip'] }, { k: 'date', label: 'Date', type: 'date', req: true },
      { k: 'end', label: 'End date', type: 'date', hint: 'optional' }, { k: 'notes', label: 'Notes', type: 'textarea', rows: 2, wide: true }],
    onSave: v => { if (v.end && v.end < v.date) { toast('The end date is before the start date.', true); return false; } return put('events/' + (e ? e.id : newId()), v); },
    onDelete: e ? () => remove('events/' + e.id) : null });
}
