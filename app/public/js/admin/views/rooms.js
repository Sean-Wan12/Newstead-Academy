/* Rooms: licensed age group and capacity (from the licence), how the room runs, the operating
   capacity the centre chooses, mixed-age approval, and how many children are placed today. */
import { api } from '../../shared/api.js';
import { html, set, on } from '../../shared/dom.js';
import { openForm, toast, confirmBox } from '../../shared/ui.js';

export async function render(el, ctx) {
  const groups = ctx.meta.ageGroups, rules = ctx.meta.rules;
  const fields = [
    { k: 'name', label: 'Room name', required: true, max: 60 }, { k: 'code', label: 'Short code', max: 8, hint: 'Letters, numbers, dashes' },
    { k: 'licName', label: 'Name on the licence', max: 60 }, { k: 'ageGroup', label: 'Licensed age group', type: 'select', required: true, options: groups.map(g => [g, g]) },
    { k: 'runsAs', label: 'Runs as', type: 'select', options: groups.map(g => [g, g]), hint: 'e.g. a preschool-licensed room run as kindergarten' },
    { k: 'licensedCapacity', label: 'Licensed capacity', type: 'number', required: true, min: 1, max: 100 },
    { k: 'operatingCapacity', label: 'Operating capacity', type: 'number', min: 0, max: 100, hint: 'Your chosen limit; not above licensed' },
    { k: 'mixedAgeApproved', label: 'Mixed-age grouping approved (O. Reg. 137/15 s. 8)', type: 'checkbox', wide: true },
    { k: 'placeholder', label: 'Placeholder: capacity not yet confirmed from the licence', type: 'checkbox', wide: true }];
  const draw = async () => {
    await ctx.loadRooms();
    const dash = await api.get('/api/dashboard', { location: ctx.loc.id });
    const placed = Object.fromEntries(dash.rooms.map(r => [r.room.id, r.capacity.placed]));
    const total = ctx.rooms.reduce((s, r) => s + r.licensedCapacity, 0);
    set(el, html`<div class="head-row"><h1>Rooms · ${ctx.loc.name}</h1><button type="button" class="btn primary" data-add>Add a room</button></div>
      <p class="muted">Total licensed capacity ${total}. ${(ctx.loc.notes || []).join(' ')}</p>
      <table class="list"><thead><tr><th>Room</th><th>Licence name</th><th>Licensed group</th><th>Runs as</th><th>Ratio · max group</th><th class="num">Licensed</th><th class="num">Operating</th><th class="num">Placed today</th><th>Mixed age</th></tr></thead><tbody>
      ${ctx.rooms.map(r => { const rule = rules[r.ageGroup]; return html`<tr class="click" data-room="${r.id}" tabindex="0"><td><b>${r.name}</b>${r.placeholder ? html` <span class="pill warn">placeholder</span>` : ''}</td><td>${r.licName || ''}</td><td>${r.ageGroup}</td><td>${r.runsAs}</td>
        <td>${rule.ratioText} · ${rule.maxGroup}</td><td class="num">${r.licensedCapacity}</td><td class="num">${r.operatingCapacity}</td>
        <td class="num">${placed[r.id] || 0}${(placed[r.id] || 0) > r.licensedCapacity ? html` <span class="pill bad">over licence</span>` : ''}</td><td>${r.mixedAgeApproved ? 'Approved' : 'No'}</td></tr>`; })}
      </tbody></table>${ctx.rooms.length ? '' : html`<p class="empty">No rooms yet. Add each room from the Primary Capacity table on the licence.</p>`}`);
  };
  const form = r => openForm({ title: r ? 'Edit ' + r.name : 'Add a room', fields, values: r || { ageGroup: groups[1], mixedAgeApproved: false },
    actions: r ? [{ label: 'Archive room', danger: true, onClick: async () => { if (!(await confirmBox('Archive ' + r.name + '? This only works when no children are placed in it.', 'Archive', true))) return; try { await api.del('/api/rooms/' + r.id); toast('Archived'); } catch (e) { toast(e.message, true); } draw(); } }] : [],
    onSubmit: async v => {
      const body = Object.assign({}, v, { runsAs: v.runsAs || v.ageGroup, code: v.code || undefined });
      const res = r ? await api.patch('/api/rooms/' + r.id, body) : await api.post('/api/rooms', Object.assign({ locationId: ctx.loc.id }, body));
      toast((res.warnings || []).join(' ') || 'Saved', !!(res.warnings || []).length); draw();
    } });
  on(el, 'click', '[data-add]', () => form(null));
  on(el, 'click', '[data-room]', (e, tr) => form(ctx.rooms.find(r => r.id === tr.dataset.room)));
  on(el, 'keydown', '[data-room]', (e, tr) => { if (e.key === 'Enter') form(ctx.rooms.find(r => r.id === tr.dataset.room)); });
  await draw();
}
