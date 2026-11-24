/* My account: change password, set my tablet PIN, location details (owner can edit) */
import { api } from '../../shared/api.js';
import { html, set, on } from '../../shared/dom.js';
import { openForm, toast } from '../../shared/ui.js';

export async function render(el, ctx) {
  const me = await api.get('/api/auth/me'), loc = ctx.loc;
  set(el, html`<h1>My account</h1>
    <div class="panel"><p><b>${me.name}</b> · ${me.email} · ${me.role === 'owner' ? 'Owner' : 'Supervisor'}</p>
      <div class="row"><button type="button" class="btn" data-pw>Change password</button><button type="button" class="btn" data-pin>${me.hasPin ? 'Change' : 'Set'} my tablet PIN</button></div></div>
    <div class="panel"><h2>${loc.fullName || loc.name}</h2>
      <dl class="facts"><dt>Licensee</dt><dd>${loc.licensee || ''}</dd><dt>Address</dt><dd>${loc.address || ''}</dd><dt>Phone</dt><dd>${loc.phone || ''}</dd>
      <dt>Licence number</dt><dd>${loc.licenceNumber || html`<span class="muted">Not set</span>`}</dd><dt>Hours</dt><dd>${loc.hours || html`<span class="muted">Not set</span>`}</dd></dl>
      ${me.role === 'owner' ? html`<button type="button" class="btn" data-loc>Edit location details</button>` : ''}</div>`);
  on(el, 'click', '[data-pw]', () => openForm({ title: 'Change password', fields: [
      { k: 'currentPassword', label: 'Current password', type: 'password', required: true, autocomplete: 'current-password' },
      { k: 'newPassword', label: 'New password (10+ characters)', type: 'password', required: true, autocomplete: 'new-password' },
      { k: 'confirm', label: 'New password again', type: 'password', required: true, autocomplete: 'new-password' }],
    onSubmit: async v => { if (v.newPassword !== v.confirm) throw new Error('The new passwords do not match'); await api.post('/api/auth/password', { currentPassword: v.currentPassword, newPassword: v.newPassword }); toast('Password changed. Other devices were signed out.'); } }));
  on(el, 'click', '[data-pin]', () => openForm({ title: 'My tablet PIN', fields: [
      { k: 'currentPassword', label: 'Your password', type: 'password', required: true, autocomplete: 'current-password' },
      { k: 'pin', label: 'PIN (4 digits)', type: 'password', required: true, inputmode: 'numeric', pattern: '[0-9]{4}', max: 4, autocomplete: 'off' }],
    onSubmit: async v => { await api.put('/api/auth/pin', v); toast('PIN saved'); ctx.rerender(); } }));
  on(el, 'click', '[data-loc]', () => openForm({ title: 'Location details', values: loc, fields: [
      { k: 'name', label: 'Short name', required: true, max: 80 }, { k: 'fullName', label: 'Full name', max: 160, wide: true }, { k: 'address', label: 'Address', max: 200, wide: true },
      { k: 'phone', label: 'Phone', max: 40 }, { k: 'licenceNumber', label: 'Licence number', max: 60 }, { k: 'hours', label: 'Hours', max: 80 }],
    onSubmit: async v => { const upd = await api.patch('/api/locations/' + loc.id, v); Object.assign(loc, upd); toast('Saved'); ctx.rerender(); } }));
}
