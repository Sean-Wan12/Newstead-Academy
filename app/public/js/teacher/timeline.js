/* A child's day: allergies and authorized pickups at the top, then every event in time order
   (check-in, meals, sleep with checks, toileting, activities, notes, check-out). Entries can be
   edited or deleted, open sleeps get a sleep check, and today's attendance can be corrected. */
import { api } from '../shared/api.js';
import { html, set } from '../shared/dom.js';
import { fmtTime, entrySummary, childName } from '../shared/format.js';
import { openEntryForm } from '../shared/entry-form.js';
import { openForm, toast, confirmBox } from '../shared/ui.js';
import { S } from './state.js';

const KIND_LABEL = { check_in: 'Checked in', check_out: 'Checked out', absent: 'Absent', sleep_check: 'Sleep check', nap_end: 'Woke up' };

function eventHtml(ev) {
  const by = ev.by ? html`<span class="by">by ${ev.by.name}</span>` : '';
  if (ev.kind === 'entry') {
    const label = S.meta.entryTypes[ev.type].label, e = S.entries.find(x => x.id === ev.entryId) || { type: ev.type, data: ev.data, checks: [] };
    return html`<li class="ev ev-${ev.type}"><time>${fmtTime(ev.time)}</time><div><b>${label}</b> ${entrySummary(S.meta.entryTypes, e)} ${by}
      ${ev.review ? html`<span class="pill ok">Reviewed</span>` : ''}
      <div class="row ev-acts">${ev.type === 'nap' && !ev.data.end ? html`<button type="button" class="btn sm" data-check="${ev.entryId}">Sleep check</button>` : ''}
      <button type="button" class="btn sm" data-edit="${ev.entryId}">Edit</button><button type="button" class="btn sm danger" data-del="${ev.entryId}">Delete</button></div></div></li>`;
  }
  const extra = ev.kind === 'absent' ? (S.meta.absentReasons.find(r => r.value === ev.reason) || {}).label + (ev.note ? ': ' + ev.note : '')
    : ev.person ? (ev.kind === 'check_in' ? 'Dropped off by ' : 'Picked up by ') + ev.person : ev.note || '';
  return html`<li class="ev ev-${ev.kind}"><time>${ev.kind === 'absent' ? '' : fmtTime(ev.time)}</time><div><b>${KIND_LABEL[ev.kind]}</b> ${extra} ${by}</div></li>`;
}

export async function openTimeline(childId, withPin, reload) {
  let d = document.getElementById('modal');
  if (!d) { d = document.createElement('dialog'); d.id = 'modal'; d.setAttribute('aria-labelledby', 'modal-title'); document.body.appendChild(d); }
  const draw = async () => {
    let t, profile;
    try { [t, profile] = await Promise.all([api.get('/api/children/' + childId + '/timeline'), api.get('/api/children/' + childId)]); }
    catch (e) { toast(e.message, true); if (d.open) d.close(); return; }
    const pickups = (profile.contacts || []).filter(c => c.authorizedPickup);
    const att = S.att[childId];
    set(d, html`<div class="modal-form timeline"><header><h2 id="modal-title">${t.child.name}'s day</h2><button type="button" class="icon-btn" data-close aria-label="Close">&times;</button></header>
      ${profile.allergies ? html`<p class="pill bad">Allergies: ${profile.allergies}</p>` : ''}
      ${profile.medicalNotes ? html`<p class="small"><b>Medical:</b> ${profile.medicalNotes}</p>` : ''}
      ${profile.dietaryNotes ? html`<p class="small"><b>Diet:</b> ${profile.dietaryNotes}</p>` : ''}
      <details class="small"><summary>Authorized pickups (${pickups.length})</summary><ul>${pickups.map(c => html`<li>${c.firstName} ${c.lastName}${c.relationship ? ' (' + c.relationship + ')' : ''}${c.phone ? ' · ' + c.phone : ''}</li>`)}</ul></details>
      ${t.events.length ? html`<ol class="events">${t.events.map(eventHtml)}</ol>` : html`<p class="empty">Nothing recorded yet today.</p>`}
      <footer>${att ? html`<button type="button" class="btn" data-fix>Correct attendance</button>` : ''}<span class="spacer"></span><button type="button" class="btn primary" data-close>Done</button></footer></div>`);
    d.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => d.close(); });
    d.querySelectorAll('[data-edit]').forEach(b => { b.onclick = () => editEntry(b.dataset.edit); });
    d.querySelectorAll('[data-del]').forEach(b => { b.onclick = () => delEntry(b.dataset.del); });
    d.querySelectorAll('[data-check]').forEach(b => { b.onclick = () => withPin(() => api.post('/api/entries/' + b.dataset.check + '/sleep-check', {})).then(() => { toast('Sleep check recorded'); after(); }).catch(e => toast(e.message, true)); });
    const fix = d.querySelector('[data-fix]'); if (fix) fix.onclick = () => correct(att);
    if (!d.open) d.showModal();
  };
  const after = async () => { await reload(); await draw(); };
  const editEntry = id => {
    const e = S.entries.find(x => x.id === id); if (!e) return;
    openEntryForm({ metaTypes: S.meta.entryTypes, type: e.type, title: 'Edit ' + S.meta.entryTypes[e.type].label.toLowerCase(), values: Object.assign({ __time: e.time }, e.data), now: e.time,
      save: async ({ time, data }) => { await withPin(() => api.patch('/api/entries/' + id, { time: time || undefined, data })); toast('Saved'); after(); } });
  };
  const delEntry = async id => {
    if (!(await confirmBox('Delete this entry? It stays in the records as deleted.', 'Delete', true))) return draw();
    try { await withPin(() => api.del('/api/entries/' + id)); toast('Deleted'); } catch (e) { toast(e.message, true); }
    after();
  };
  const correct = att => {
    const child = S.children.find(c => c.id === childId);
    openForm({ title: 'Correct attendance for ' + (child ? childName(child) : 'child'), intro: 'Corrections are kept with your name and reason.',
      values: { status: att.status || 'none', checkInTime: att.checkIn && att.checkIn.time, checkOutTime: att.checkOut && att.checkOut.time, droppedOffBy: att.checkIn && att.checkIn.person, pickedUpBy: att.checkOut && att.checkOut.person, absentReason: att.absent && att.absent.reason },
      fields: [
        { k: 'status', label: 'Status', type: 'select', options: [['in', 'Here'], ['out', 'Gone home'], ['absent', 'Absent'], ['none', 'Not arrived']] },
        { k: 'checkInTime', label: 'Check-in time', type: 'time' }, { k: 'droppedOffBy', label: 'Dropped off by', max: 80 },
        { k: 'checkOutTime', label: 'Check-out time', type: 'time' }, { k: 'pickedUpBy', label: 'Picked up by', max: 80 },
        { k: 'absentReason', label: 'Absence reason', type: 'select', options: S.meta.absentReasons.map(r => [r.value, r.label]) },
        { k: 'reason', label: 'Reason for the correction', required: true, wide: true, max: 300 }],
      onSubmit: async v => {
        const body = { reason: v.reason, status: v.status };
        if (v.status === 'in' || v.status === 'out') { body.checkInTime = v.checkInTime || null; body.droppedOffBy = v.droppedOffBy; }
        if (v.status === 'out') { body.checkOutTime = v.checkOutTime || null; body.pickedUpBy = v.pickedUpBy; }
        if (v.status === 'absent') body.absentReason = v.absentReason;
        await withPin(() => api.patch('/api/attendance/' + att.id, body));
        toast('Attendance corrected'); after();
      } });
  };
  await draw();
}
