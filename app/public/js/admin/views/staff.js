/* Staff and logins: staff accounts (role, rooms, PIN, active), temporary passwords and PINs
   issued by a supervisor, and classroom tablet logins (one per room, like Lillio's classroom
   logins; staff unlock them with their PIN so every entry names a person). */
import { api } from '../../shared/api.js';
import { html, set, on } from '../../shared/dom.js';
import { fmtStamp } from '../../shared/format.js';
import { openForm, toast, showSecret, confirmBox } from '../../shared/ui.js';

export async function render(el, ctx) {
  const owner = ctx.me.role === 'owner';
  let users = [], devices = [];
  const roomOpts = () => ctx.rooms.map(r => [r.id, r.name]);
  const draw = async () => {
    [users, devices] = await Promise.all([api.get('/api/users', { location: ctx.loc.id }), api.get('/api/devices', { location: ctx.loc.id })]);
    users.sort((a, b) => (a.active === false) - (b.active === false) || ['owner', 'admin', 'teacher'].indexOf(a.role) - ['owner', 'admin', 'teacher'].indexOf(b.role) || a.name.localeCompare(b.name));
    set(el, html`<div class="head-row"><h1>Staff and logins · ${ctx.loc.name}</h1><button type="button" class="btn primary" data-add-user>Add staff</button></div>
      <p class="muted">Supervisors manage educators at their location. Only the owner adds supervisors. No emails are sent: new accounts and resets get a temporary password to pass on in person.</p>
      <table class="list"><thead><tr><th>Name</th><th>Role</th><th>Rooms</th><th>Email</th><th>Tablet PIN</th><th>Last sign-in</th><th>Status</th></tr></thead><tbody>
      ${users.map(u => html`<tr class="click" data-user="${u.id}" tabindex="0"><td><b>${u.name}</b>${u.title ? html`<br><span class="muted small">${u.title}</span>` : ''}</td>
        <td>${{ owner: 'Owner', admin: 'Supervisor', teacher: 'Educator' }[u.role]}</td><td>${u.role === 'teacher' ? (u.roomIds || []).map(ctx.roomName).filter(Boolean).join(', ') || html`<span class="pill warn">none</span>` : 'All'}</td>
        <td>${u.email}</td><td>${u.hasPin ? html`<span class="pill ok">set</span>` : html`<span class="pill">none</span>`}</td><td>${u.lastLoginAt ? fmtStamp(u.lastLoginAt) : html`<span class="muted">never</span>`}</td>
        <td>${u.active ? html`<span class="pill ok">Active</span>` : html`<span class="pill">Inactive</span>`}${u.mustChangePassword ? html`<br><span class="muted small">temporary password</span>` : ''}</td></tr>`)}
      </tbody></table>
      <div class="head-row section"><h2>Classroom tablets</h2><button type="button" class="btn" data-add-device>Add a classroom login</button></div>
      <p class="muted">Sign a room's shared tablet in once with its classroom login. Staff then tap their name and enter their 4-digit PIN to record; the tablet locks again after 10 minutes without use.</p>
      <table class="list"><thead><tr><th>Name</th><th>Username</th><th>Rooms</th><th>Last sign-in</th><th>Status</th></tr></thead><tbody>
      ${devices.map(d => html`<tr class="click" data-device="${d.id}" tabindex="0"><td><b>${d.name}</b></td><td><code>${d.username}</code></td><td>${d.roomIds.map(ctx.roomName).join(', ')}</td>
        <td>${d.lastLoginAt ? fmtStamp(d.lastLoginAt) : html`<span class="muted">never</span>`}</td><td>${d.active ? html`<span class="pill ok">Active</span>` : html`<span class="pill">Off</span>`}</td></tr>`)}
      </tbody></table>${devices.length ? '' : html`<p class="empty">No classroom logins yet.</p>`}`);
  };

  const userFields = u => {
    const roles = owner ? [['teacher', 'Educator'], ['admin', 'Supervisor'], ['owner', 'Owner']] : [['teacher', 'Educator']];
    const f = [{ k: 'name', label: 'Name', required: true, max: 80 }, { k: 'email', label: 'Email (used to sign in)', type: 'email', required: true, max: 254 },
      { k: 'title', label: 'Job title', max: 60, placeholder: 'RECE, Educator, Cook…' }, { k: 'phone', label: 'Phone', type: 'tel', max: 30 },
      { k: 'role', label: 'Role', type: 'select', options: roles }, { k: 'roomIds', label: 'Rooms (educators)', type: 'checkboxes', options: roomOpts(), wide: true }];
    if (u) f.push({ k: 'active', label: 'Active (can sign in)', type: 'checkbox', wide: true });
    return f;
  };
  const userForm = u => openForm({ title: u ? 'Edit ' + u.name : 'Add staff', fields: userFields(u),
    intro: u ? null : 'A temporary password is shown once after saving. They choose their own at first sign-in.',
    values: u || { role: 'teacher', roomIds: [] },
    actions: u && u.id !== ctx.me.id ? [
      { label: 'Issue temporary password', onClick: async () => { if (!(await confirmBox('Issue a new temporary password for ' + u.name + '? They are signed out everywhere.', 'Issue'))) return; const r = await api.post('/api/users/' + u.id + '/reset-password'); showSecret('Temporary password', 'For ' + u.name + ' (' + u.email + '):', r.temporaryPassword); draw(); return false; } },
      { label: u.hasPin ? 'Change PIN' : 'Set PIN', onClick: () => { setTimeout(() => pinForm(u), 0); } }] : [],
    onSubmit: async v => {
      const body = { name: v.name, email: v.email, title: v.title, phone: v.phone, role: v.role, roomIds: v.role === 'teacher' ? v.roomIds : [] };
      if (v.role !== 'owner') body.locationIds = u && u.locationIds && u.locationIds.length ? Array.from(new Set(u.locationIds.concat(ctx.loc.id))) : [ctx.loc.id];
      if (u) { body.active = v.active; await api.patch('/api/users/' + u.id, body); toast('Saved'); draw(); return; }
      const r = await api.post('/api/users', body);
      draw(); setTimeout(() => showSecret('Account created', 'Temporary password for ' + r.user.name + ' (' + r.user.email + '):', r.temporaryPassword), 0);
    } });
  const pinForm = u => openForm({ title: 'Tablet PIN for ' + u.name, intro: '4 digits. Pass it on in person. Staff can also set their own under My account.',
    fields: [{ k: 'pin', label: 'PIN', type: 'password', required: true, inputmode: 'numeric', pattern: '[0-9]{4}', max: 4, autocomplete: 'off' }],
    actions: u.hasPin ? [{ label: 'Clear PIN', danger: true, onClick: async () => { await api.del('/api/users/' + u.id + '/pin'); toast('PIN cleared'); draw(); } }] : [],
    onSubmit: async v => { await api.put('/api/users/' + u.id + '/pin', v); toast('PIN saved'); draw(); } });

  const deviceForm = d => openForm({ title: d ? 'Edit ' + d.name : 'Add a classroom login', fields: [
      { k: 'name', label: 'Name', required: true, max: 60, placeholder: 'Toddler 1 tablet' },
      ...(d ? [] : [{ k: 'username', label: 'Username', required: true, max: 40, hint: 'Lowercase letters, numbers and dashes, e.g. rh-toddler-1' }]),
      { k: 'roomIds', label: 'Rooms this tablet can see', type: 'checkboxes', options: roomOpts(), wide: true },
      ...(d ? [{ k: 'active', label: 'Active', type: 'checkbox' }] : [])],
    values: d || { roomIds: [] },
    actions: d ? [
      { label: 'New password', onClick: async () => { if (!(await confirmBox('Make a new password for ' + d.username + '? The tablet is signed out.', 'Make password'))) return; const r = await api.post('/api/devices/' + d.id + '/reset-password'); showSecret('New classroom password', d.username + ':', r.password); draw(); return false; } },
      { label: 'Remove', danger: true, onClick: async () => { if (!(await confirmBox('Remove ' + d.name + '? The tablet is signed out.', 'Remove', true))) return; await api.del('/api/devices/' + d.id); toast('Removed'); draw(); } }] : [],
    onSubmit: async v => {
      if (d) { await api.patch('/api/devices/' + d.id, v); toast('Saved'); draw(); return; }
      const r = await api.post('/api/devices', Object.assign({ locationId: ctx.loc.id }, v));
      draw(); setTimeout(() => showSecret('Classroom login created', 'Username ' + r.device.username + ', password:', r.password), 0);
    } });

  on(el, 'click', '[data-add-user]', () => userForm(null));
  on(el, 'click', '[data-user]', (e, tr) => { const u = users.find(x => x.id === tr.dataset.user); if (u.role === 'owner' && !owner) return; if (u.role === 'admin' && !owner) return toast('Only the owner can change supervisor accounts', true); userForm(u); });
  on(el, 'click', '[data-add-device]', () => deviceForm(null));
  on(el, 'click', '[data-device]', (e, tr) => deviceForm(devices.find(x => x.id === tr.dataset.device)));
  on(el, 'keydown', '[data-user],[data-device]', (e, tr) => { if (e.key === 'Enter') tr.click(); });
  await draw();
}
