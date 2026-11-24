/* Children: list with room, age, schedule and status; add a child with a first placement;
   open a child to edit the profile, manage room placements (moves, end dates, days) and contacts. */
import { api } from '../../shared/api.js';
import { html, set, on } from '../../shared/dom.js';
import { fmtDate, fmtAge, childName, DAY_LABELS } from '../../shared/format.js';
import { openForm, toast, confirmBox } from '../../shared/ui.js';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const STATUS = [['active', 'Active'], ['upcoming', 'Upcoming'], ['withdrawn', 'Withdrawn']];
const PROFILE = [
  { k: 'firstName', label: 'First name', required: true, max: 60 }, { k: 'lastName', label: 'Last name', required: true, max: 60 },
  { k: 'preferredName', label: 'Preferred name', max: 60 }, { k: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true },
  { k: 'status', label: 'Status', type: 'select', options: STATUS },
  { k: 'photoPermission', label: 'May appear in group photos and videos', type: 'checkbox' },
  { k: 'allergies', label: 'Allergies', max: 500, wide: true }, { k: 'dietaryNotes', label: 'Dietary notes', max: 500, wide: true },
  { k: 'medicalNotes', label: 'Medical notes', type: 'textarea', max: 2000, wide: true }, { k: 'notes', label: 'Profile notes', type: 'textarea', max: 2000, wide: true }];
const CONTACT = [
  { k: 'firstName', label: 'First name', required: true, max: 60 }, { k: 'lastName', label: 'Last name', required: true, max: 60 },
  { k: 'relationship', label: 'Relationship', max: 40 }, { k: 'phone', label: 'Phone', type: 'tel', max: 30 }, { k: 'email', label: 'Email', type: 'email', max: 254, wide: true },
  { k: 'isGuardian', label: 'Parent or guardian', type: 'checkbox' }, { k: 'authorizedPickup', label: 'Authorized for pickup', type: 'checkbox' },
  { k: 'emergencyContact', label: 'Emergency contact', type: 'checkbox' }, { k: 'notes', label: 'Notes', max: 500, wide: true }];

const daysText = days => (days || []).length === 5 && !days.includes('sat') && !days.includes('sun') ? 'Mon–Fri' : (days || []).map(d => DAY_LABELS[d]).join(' ');

export async function render(el, ctx) {
  let status = 'active', room = '', q = '';
  const roomOpts = () => ctx.rooms.map(r => [r.id, r.name]);
  const draw = async () => {
    const list = await api.get('/api/children', { location: ctx.loc.id, status: status === 'all' ? 'all' : status });
    const needle = q.trim().toLowerCase();
    const rows = list.filter(c => (!room || c.roomId === room || (room === 'none' && !c.roomId)) && (!needle || childName(c).toLowerCase().includes(needle) || c.firstName.toLowerCase().includes(needle)));
    set(el, html`<div class="head-row"><h1>Children · ${ctx.loc.name}</h1><button type="button" class="btn primary" data-add>Add a child</button></div>
      <div class="filters row">
        <label class="inline">Search <input type="search" id="q" value="${q}" placeholder="Name"></label>
        <label class="inline">Room <select id="room"><option value="">All rooms</option>${roomOpts().map(([v, l]) => html`<option value="${v}"${v === room ? html` selected` : ''}>${l}</option>`)}<option value="none"${room === 'none' ? html` selected` : ''}>No room today</option></select></label>
        <label class="inline">Status <select id="status">${STATUS.concat([['all', 'All']]).map(([v, l]) => html`<option value="${v}"${v === status ? html` selected` : ''}>${l}</option>`)}</select></label>
        <span class="muted">${rows.length} shown</span></div>
      <table class="list"><thead><tr><th>Name</th><th>Age</th><th>Born</th><th>Room today</th><th>Days</th><th>Status</th><th>Allergies</th></tr></thead>
      <tbody>${rows.map(c => html`<tr class="click" data-child="${c.id}" tabindex="0"><td><b>${childName(c)}</b></td><td>${fmtAge(c.ageMonths)}</td><td>${fmtDate(c.dateOfBirth)}</td>
        <td>${c.roomId ? ctx.roomName(c.roomId) : html`<span class="muted">${c.nextEnrollment ? 'Starts ' + fmtDate(c.nextEnrollment.startDate) + ' in ' + ctx.roomName(c.nextEnrollment.roomId) : 'None'}</span>`}${c.enrollment && c.enrollment.endDate ? html`<br><span class="muted small">until ${fmtDate(c.enrollment.endDate)}</span>` : ''}</td>
        <td>${c.enrollment ? daysText(c.enrollment.days) : ''}</td><td><span class="pill ${c.status === 'active' ? 'ok' : c.status === 'upcoming' ? 'info' : ''}">${c.status}</span></td><td>${c.allergies ? html`<span class="pill bad">${c.allergies}</span>` : ''}</td></tr>`)}</tbody></table>
      ${rows.length ? '' : html`<p class="empty">No children match.</p>`}`);
    el.querySelector('#q').addEventListener('input', e => { q = e.target.value; clearTimeout(el._t); el._t = setTimeout(() => draw().then(() => { const i = el.querySelector('#q'); i.focus(); i.setSelectionRange(q.length, q.length); }), 250); });
    el.querySelector('#room').addEventListener('change', e => { room = e.target.value; draw(); });
    el.querySelector('#status').addEventListener('change', e => { status = e.target.value; draw(); });
  };
  const addChild = () => openForm({ title: 'Add a child', intro: 'Profile, then the first room placement.',
    fields: PROFILE.concat([{ k: 'roomId', label: 'Room', type: 'select', options: [['', 'No placement yet']].concat(roomOpts()) }, { k: 'startDate', label: 'Start date', type: 'date' },
      { k: 'days', label: 'Days', type: 'checkboxes', options: DAYS.map(d => [d, DAY_LABELS[d]]), wide: true }]),
    values: { status: 'active', photoPermission: false, startDate: ctx.meta.today, days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
    onSubmit: async v => {
      const { roomId, startDate, days, ...profile } = v;
      const body = Object.assign({ locationId: ctx.loc.id }, profile);
      if (roomId) { if (!startDate) throw new Error('Choose a start date for the placement'); body.enrollment = { roomId, startDate, days }; }
      await api.post('/api/children', body); toast('Child added'); draw();
    } });
  on(el, 'click', '[data-add]', addChild);
  on(el, 'click', '[data-child]', (e, tr) => openChild(tr.dataset.child, ctx, draw));
  on(el, 'keydown', '[data-child]', (e, tr) => { if (e.key === 'Enter') openChild(tr.dataset.child, ctx, draw); });
  await draw();
}

/* The child's page in a dialog: profile, placements, contacts */
async function openChild(id, ctx, refreshList) {
  const c = await api.get('/api/children/' + id);
  let d = document.getElementById('modal');
  if (!d) { d = document.createElement('dialog'); d.id = 'modal'; d.setAttribute('aria-labelledby', 'modal-title'); document.body.appendChild(d); }
  const again = () => openChild(id, ctx, refreshList).then(refreshList);
  set(d, html`<div class="modal-form wide-modal"><header><h2 id="modal-title">${childName(c)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">&times;</button></header>
    <p class="muted">${fmtAge(c.ageMonths)} · born ${fmtDate(c.dateOfBirth)} · ${c.status}${c.roomId ? ' · in ' + ctx.roomName(c.roomId) + ' today' : ''}</p>
    ${c.allergies ? html`<p><span class="pill bad">Allergies: ${c.allergies}</span></p>` : ''}
    <div class="row"><button type="button" class="btn" data-edit>Edit profile</button><button type="button" class="btn" data-move>Place in a room / move</button>
      <button type="button" class="btn" data-contact>Add contact</button><a class="btn" href="#entries/child/${c.id}">Daily entries</a><span class="spacer"></span><button type="button" class="btn danger" data-remove>Remove record</button></div>
    <h3>Room placements</h3>
    <table class="list"><thead><tr><th>Room</th><th>From</th><th>To</th><th>Days</th><th></th></tr></thead><tbody>
    ${c.enrollments.map(e => html`<tr><td>${ctx.roomName(e.roomId) || 'Other room'}</td><td>${fmtDate(e.startDate)}</td><td>${e.endDate ? fmtDate(e.endDate) : 'Open'}</td><td>${daysText(e.days)}</td>
      <td class="num"><button type="button" class="btn sm" data-en="${e.id}">Edit</button></td></tr>`)}</tbody></table>
    ${c.enrollments.length ? '' : html`<p class="muted">No placements. Place the child in a room so they appear on attendance.</p>`}
    <h3>Contacts</h3>
    <table class="list"><thead><tr><th>Name</th><th>Relationship</th><th>Phone</th><th>Email</th><th>Roles</th><th></th></tr></thead><tbody>
    ${c.contacts.map(k => html`<tr><td>${k.firstName} ${k.lastName}</td><td>${k.relationship}</td><td>${k.phone}</td><td>${k.email || ''}</td>
      <td>${k.isGuardian ? html`<span class="pill info">Guardian</span> ` : ''}${k.authorizedPickup ? html`<span class="pill ok">Pickup</span> ` : ''}${k.emergencyContact ? html`<span class="pill warn">Emergency</span>` : ''}</td>
      <td class="num"><button type="button" class="btn sm" data-ct="${k.id}">Edit</button></td></tr>`)}</tbody></table>
    ${c.medicalNotes ? html`<h3>Medical notes</h3><p>${c.medicalNotes}</p>` : ''}${c.notes ? html`<h3>Notes</h3><p>${c.notes}</p>` : ''}
    <footer><span class="spacer"></span><button type="button" class="btn primary" data-close>Done</button></footer></div>`);
  d.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => d.close(); });
  d.querySelector('[data-edit]').onclick = () => openForm({ title: 'Edit ' + childName(c), fields: PROFILE, values: c, actions: [{ label: 'Back', onClick: () => { again(); return false; } }],
    onSubmit: async v => { await api.patch('/api/children/' + c.id, v); toast('Saved'); again(); return false; } });
  d.querySelector('[data-move]').onclick = () => openForm({ title: 'Place ' + childName(c) + ' in a room', intro: 'If the child has an open placement, it ends the day before the new start date.',
    fields: [{ k: 'roomId', label: 'Room', type: 'select', required: true, options: ctx.rooms.map(r => [r.id, r.name + ' (' + r.ageGroup + ')']) }, { k: 'startDate', label: 'Start date', type: 'date', required: true },
      { k: 'endDate', label: 'End date (optional)', type: 'date' }, { k: 'days', label: 'Days', type: 'checkboxes', options: DAYS.map(x => [x, DAY_LABELS[x]]), wide: true }],
    values: { startDate: ctx.meta.today, days: (c.enrollment && c.enrollment.days) || ['mon', 'tue', 'wed', 'thu', 'fri'] },
    onSubmit: async v => { await api.post('/api/enrollments', Object.assign({ childId: c.id }, v, { endDate: v.endDate || null })); toast('Placement saved'); again(); return false; } });
  d.querySelectorAll('[data-en]').forEach(b => { b.onclick = () => { const e = c.enrollments.find(x => x.id === b.dataset.en); openForm({ title: 'Edit placement in ' + ctx.roomName(e.roomId),
    fields: [{ k: 'startDate', label: 'Start date', type: 'date', required: true }, { k: 'endDate', label: 'End date', type: 'date', hint: 'Leave empty if open' }, { k: 'days', label: 'Days', type: 'checkboxes', options: DAYS.map(x => [x, DAY_LABELS[x]]), wide: true }],
    values: e, actions: [{ label: 'Delete placement', danger: true, onClick: async () => { if (await confirmBox('Delete this placement? Use this only for a placement entered in error.', 'Delete', true)) { await api.del('/api/enrollments/' + e.id); toast('Deleted'); } again(); return false; } }],
    onSubmit: async v => { await api.patch('/api/enrollments/' + e.id, Object.assign(v, { endDate: v.endDate || null })); toast('Saved'); again(); return false; } }); }; });
  const contactForm = k => openForm({ title: k ? 'Edit contact' : 'Add a contact for ' + childName(c), fields: CONTACT, values: k || { isGuardian: true, authorizedPickup: true, emergencyContact: true },
    actions: k ? [{ label: 'Remove', danger: true, onClick: async () => { await api.del('/api/contacts/' + k.id); toast('Removed'); again(); return false; } }] : [],
    onSubmit: async v => { const body = Object.assign(v, { email: v.email || null }); if (k) await api.patch('/api/contacts/' + k.id, body); else await api.post('/api/contacts', Object.assign(body, { childIds: [c.id] })); toast('Saved'); again(); return false; } });
  d.querySelector('[data-contact]').onclick = () => contactForm(null);
  d.querySelectorAll('[data-ct]').forEach(b => { b.onclick = () => contactForm(c.contacts.find(x => x.id === b.dataset.ct)); });
  d.querySelector('[data-remove]').onclick = async () => {
    if (!(await confirmBox('Remove ' + childName(c) + ' from all lists? Attendance and entries are kept. To record that a child left, set their status to Withdrawn and end the placement instead.', 'Remove', true))) return again();
    await api.del('/api/children/' + c.id); toast('Removed'); refreshList();
  };
  if (!d.open) d.showModal();
}
