/* Attendance overview and corrections for any day: every child placed that day with status,
   times and who recorded them; check in/out or mark absent on someone's behalf (with a time);
   correct a record with a reason (kept in its history). Also staff in rooms for the day. */
import { api } from '../../shared/api.js';
import { html, set, on } from '../../shared/dom.js';
import { fmtDate, fmtTime, childName, nowHM } from '../../shared/format.js';
import { openForm, toast } from '../../shared/ui.js';

const ST = { in: ['ok', 'Here'], out: ['info', 'Gone home'], absent: ['warn', 'Absent'], none: ['', 'Not arrived'] };

export async function render(el, ctx) {
  let date = ctx.meta.today, room = '';
  const reasons = ctx.meta.absentReasons, reasonLabel = v => (reasons.find(r => r.value === v) || {}).label || v;
  let kids = [], att = {}, shifts = [];
  const draw = async () => {
    const [k, a, s] = await Promise.all([api.get('/api/children', { location: ctx.loc.id, date, status: 'all' }), api.get('/api/attendance', { location: ctx.loc.id, date }), api.get('/api/staff-attendance', { location: ctx.loc.id, date })]);
    kids = k.filter(c => c.roomId && (!room || c.roomId === room)); att = Object.fromEntries(a.map(x => [x.childId, x])); shifts = s;
    kids.sort((x, y) => ctx.rooms.findIndex(r => r.id === x.roomId) - ctx.rooms.findIndex(r => r.id === y.roomId) || childName(x).localeCompare(childName(y)));
    set(el, html`<div class="head-row"><h1>Attendance · ${ctx.loc.name}</h1></div>
      <div class="filters row"><label class="inline">Day <input type="date" id="day" value="${date}"></label>
        <label class="inline">Room <select id="room"><option value="">All rooms</option>${ctx.rooms.map(r => html`<option value="${r.id}"${r.id === room ? html` selected` : ''}>${r.name}</option>`)}</select></label>
        <span class="muted">${fmtDate(date, true)} · ${kids.length} children placed</span></div>
      <table class="list"><thead><tr><th>Child</th><th>Room</th><th>Status</th><th>In</th><th>Out</th><th>Notes</th><th class="num">Actions</th></tr></thead><tbody>
      ${kids.map(c => { const r = att[c.id], s = (r && r.status) || 'none', [cls, txt] = ST[s];
        const stamp = (x, who) => x ? html`${fmtTime(x.time)}<br><span class="muted small">${x.person ? who + ' ' + x.person + ' · ' : ''}by ${x.by ? x.by.name : '?'}</span>` : '';
        return html`<tr><td><b>${childName(c)}</b></td><td>${ctx.roomName(c.roomId)}</td><td><span class="pill ${cls}">${txt}</span></td>
          <td>${r && stamp(r.checkIn, 'from')}</td><td>${r && stamp(r.checkOut, 'to')}</td>
          <td>${r && r.absent ? reasonLabel(r.absent.reason) + (r.absent.note ? ': ' + r.absent.note : '') : ''}${r && r.history && r.history.length ? html`<br><span class="muted small">${r.history.length} change(s)</span>` : ''}</td>
          <td class="num"><div class="acts">${s === 'none' ? html`<button type="button" class="btn sm" data-act="in" data-id="${c.id}">Check in</button><button type="button" class="btn sm" data-act="absent" data-id="${c.id}">Absent</button>` : ''}
            ${s === 'in' ? html`<button type="button" class="btn sm" data-act="out" data-id="${c.id}">Check out</button>` : ''}
            ${r && r.status ? html`<button type="button" class="btn sm" data-act="fix" data-id="${c.id}">Correct</button>` : ''}</div></td></tr>`; })}
      </tbody></table>${kids.length ? '' : html`<p class="empty">No children placed on this day.</p>`}
      <h2 class="section">Staff in rooms</h2>
      <table class="list"><thead><tr><th>Staff</th><th>Room</th><th>In</th><th>Out</th></tr></thead><tbody>
      ${shifts.filter(x => !room || x.roomId === room).sort((a, b) => a.in.localeCompare(b.in)).map(x => html`<tr><td>${x.userName}</td><td>${ctx.roomName(x.roomId)}</td><td>${fmtTime(x.in)}</td><td>${x.out ? fmtTime(x.out) : html`<span class="pill ok">in room</span> <button type="button" class="btn sm" data-out="${x.userId}">Clock out</button>`}</td></tr>`)}
      </tbody></table>${shifts.length ? '' : html`<p class="empty">No staff clocked in to rooms on this day.</p>`}`);
    el.querySelector('#day').addEventListener('change', e => { if (e.target.value) { date = e.target.value; draw(); } });
    el.querySelector('#room').addEventListener('change', e => { room = e.target.value; draw(); });
  };
  const name = id => childName(kids.find(c => c.id === id));
  const results = res => { const bad = res.results.filter(r => !r.ok); if (bad.length) toast(bad.map(b => b.error).join(' '), true); else toast('Saved'); };
  on(el, 'click', '[data-out]', async (e, b) => { try { await api.post('/api/staff-attendance/clock-out', { userId: b.dataset.out }); toast('Clocked out'); } catch (x) { toast(x.message, true); } draw(); });
  on(el, 'click', '[data-act]', (e, b) => {
    const id = b.dataset.id, act = b.dataset.act;
    if (act === 'in' || act === 'out') return openForm({ title: (act === 'in' ? 'Check in ' : 'Check out ') + name(id), intro: fmtDate(date, true),
      fields: [{ k: 'time', label: 'Time', type: 'time', required: true }, { k: 'person', label: act === 'in' ? 'Dropped off by' : 'Picked up by', max: 80 }], values: { time: nowHM() },
      onSubmit: async v => { results(await api.post('/api/attendance/' + (act === 'in' ? 'check-in' : 'check-out'), { childIds: [id], date, time: v.time, person: v.person })); draw(); } });
    if (act === 'absent') return openForm({ title: 'Mark ' + name(id) + ' absent', intro: fmtDate(date, true),
      fields: [{ k: 'reason', label: 'Reason', type: 'select', required: true, options: reasons.map(r => [r.value, r.label]) }, { k: 'note', label: 'Note', max: 300, wide: true }],
      onSubmit: async v => { results(await api.post('/api/attendance/absent', { childIds: [id], date, reason: v.reason, note: v.note })); draw(); } });
    const r = att[id];
    openForm({ title: 'Correct attendance for ' + name(id), intro: fmtDate(date, true) + '. The change and your reason are kept with the record.',
      values: { status: r.status || 'none', checkInTime: r.checkIn && r.checkIn.time, checkOutTime: r.checkOut && r.checkOut.time, droppedOffBy: r.checkIn && r.checkIn.person, pickedUpBy: r.checkOut && r.checkOut.person, absentReason: r.absent && r.absent.reason, absentNote: r.absent && r.absent.note },
      fields: [{ k: 'status', label: 'Status', type: 'select', options: [['in', 'Here'], ['out', 'Gone home'], ['absent', 'Absent'], ['none', 'Not arrived (clear)']] },
        { k: 'checkInTime', label: 'Check-in time', type: 'time' }, { k: 'droppedOffBy', label: 'Dropped off by', max: 80 },
        { k: 'checkOutTime', label: 'Check-out time', type: 'time' }, { k: 'pickedUpBy', label: 'Picked up by', max: 80 },
        { k: 'absentReason', label: 'Absence reason', type: 'select', options: reasons.map(x => [x.value, x.label]) }, { k: 'absentNote', label: 'Absence note', max: 300 },
        { k: 'reason', label: 'Reason for the correction', required: true, max: 300, wide: true }],
      onSubmit: async v => {
        const body = { reason: v.reason, status: v.status };
        if (v.status === 'in' || v.status === 'out') Object.assign(body, { checkInTime: v.checkInTime || null, droppedOffBy: v.droppedOffBy });
        if (v.status === 'out') Object.assign(body, { checkOutTime: v.checkOutTime || null, pickedUpBy: v.pickedUpBy });
        if (v.status === 'absent') Object.assign(body, { absentReason: v.absentReason, absentNote: v.absentNote });
        await api.patch('/api/attendance/' + r.id, body); toast('Corrected'); draw();
      } });
  });
  await draw();
}
