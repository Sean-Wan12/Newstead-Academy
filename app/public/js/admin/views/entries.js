/* Daily entries review: filter by day range, room, child and type; incidents waiting for
   review; add backdated entries; edit, delete and mark incidents reviewed.
   Hash forms: #entries, #entries/incidents, #entries/child/<id> */
import { api } from '../../shared/api.js';
import { html, set, on } from '../../shared/dom.js';
import { fmtDate, fmtTime, entrySummary, childName, addDays } from '../../shared/format.js';
import { openForm, toast, confirmBox } from '../../shared/ui.js';
import { openEntryForm } from '../../shared/entry-form.js';

export async function render(el, ctx) {
  const parts = location.hash.slice(1).split('/');
  const f = { from: ctx.meta.today, to: ctx.meta.today, room: '', child: parts[1] === 'child' ? parts[2] : '', type: '', unreviewed: parts[1] === 'incidents' };
  if (f.unreviewed) { f.from = addDays(ctx.meta.today, -60); f.type = 'incident'; }
  if (f.child) f.from = addDays(ctx.meta.today, -14);
  const types = ctx.meta.entryTypes;
  let children = [], list = [];
  const draw = async () => {
    [children, list] = await Promise.all([api.get('/api/children', { location: ctx.loc.id, status: 'all' }),
      api.get('/api/entries', { location: ctx.loc.id, from: f.from, to: f.to, room: f.room, child: f.child, type: f.type, unreviewed: f.unreviewed ? 'true' : '' })]);
    const kid = id => children.find(c => c.id === id);
    list.reverse();
    set(el, html`<div class="head-row"><h1>Daily entries · ${ctx.loc.name}</h1><button type="button" class="btn primary" data-add>Add an entry</button></div>
      <div class="filters row">
        <label class="inline">From <input type="date" id="from" value="${f.from}"></label><label class="inline">To <input type="date" id="to" value="${f.to}"></label>
        <label class="inline">Room <select id="room"><option value="">All rooms</option>${ctx.rooms.map(r => html`<option value="${r.id}"${r.id === f.room ? html` selected` : ''}>${r.name}</option>`)}</select></label>
        <label class="inline">Child <select id="child"><option value="">All children</option>${children.map(c => html`<option value="${c.id}"${c.id === f.child ? html` selected` : ''}>${childName(c)}</option>`)}</select></label>
        <label class="inline">Type <select id="type"><option value="">All types</option>${Object.entries(types).map(([k, t]) => html`<option value="${k}"${k === f.type ? html` selected` : ''}>${t.label}</option>`)}</select></label>
        <label class="inline"><input type="checkbox" id="unrev"${f.unreviewed ? html` checked` : ''}> Incidents not reviewed</label></div>
      <p class="muted">${list.length} entries</p>
      <table class="list"><thead><tr><th>When</th><th>Child</th><th>Room</th><th>Type</th><th>Details</th><th>By</th><th class="num"></th></tr></thead><tbody>
      ${list.map(e => { const c = kid(e.childId); return html`<tr><td>${fmtDate(e.date)}<br><b>${fmtTime(e.time)}</b></td><td>${c ? childName(c) : ''}</td><td>${ctx.roomName(e.roomId)}</td>
        <td>${types[e.type].label}${types[e.type].internal ? html`<br><span class="muted small">staff only</span>` : ''}</td><td>${entrySummary(types, e)}${e.review ? html`<br><span class="pill ok">Reviewed by ${e.review.by.name}</span>` : e.type === 'incident' ? html`<br><span class="pill bad">Needs review</span>` : ''}</td>
        <td>${e.createdBy ? e.createdBy.name : ''}${e.createdBy && e.createdBy.via ? html`<br><span class="muted small">on a classroom tablet</span>` : ''}${e.edits && e.edits.length ? html`<br><span class="muted small">edited</span>` : ''}</td>
        <td class="num"><div class="acts">${e.type === 'incident' && !e.review ? html`<button type="button" class="btn sm primary" data-review="${e.id}">Review</button>` : ''}<button type="button" class="btn sm" data-edit="${e.id}">Edit</button><button type="button" class="btn sm danger" data-del="${e.id}">Delete</button></div></td></tr>`; })}
      </tbody></table>${list.length ? '' : html`<p class="empty">No entries match.</p>`}`);
    const bind = (id, key, fn) => el.querySelector(id).addEventListener('change', e => { f[key] = fn ? fn(e.target) : e.target.value; draw(); });
    bind('#from', 'from'); bind('#to', 'to'); bind('#room', 'room'); bind('#child', 'child'); bind('#type', 'type'); bind('#unrev', 'unreviewed', t => t.checked);
  };
  on(el, 'click', '[data-review]', (e, b) => openForm({ title: 'Review incident', fields: [{ k: 'note', label: 'Review note', type: 'textarea', max: 1000, wide: true }],
    onSubmit: async v => { await api.post('/api/entries/' + b.dataset.review + '/review', v); toast('Marked reviewed'); draw(); } }));
  on(el, 'click', '[data-del]', async (e, b) => { if (await confirmBox('Delete this entry? It is kept in the records as deleted.', 'Delete', true)) { try { await api.del('/api/entries/' + b.dataset.del); toast('Deleted'); } catch (x) { toast(x.message, true); } draw(); } });
  on(el, 'click', '[data-edit]', (e, b) => { const en = list.find(x => x.id === b.dataset.edit);
    openEntryForm({ metaTypes: types, type: en.type, title: 'Edit ' + types[en.type].label.toLowerCase(), values: Object.assign({ __time: en.time }, en.data), now: en.time,
      save: async ({ time, data }) => { await api.patch('/api/entries/' + en.id, { time: time || undefined, data }); toast('Saved'); draw(); } }); });
  on(el, 'click', '[data-add]', () => openForm({ title: 'Add an entry', intro: 'Supervisors can add entries for past days.',
    fields: [{ k: 'childId', label: 'Child', type: 'select', required: true, options: children.filter(c => c.status !== 'withdrawn').map(c => [c.id, childName(c)]) }, { k: 'date', label: 'Day', type: 'date', required: true },
      { k: 'type', label: 'Type', type: 'select', options: Object.entries(types).map(([k, t]) => [k, t.label]) }], values: { date: f.to, childId: f.child },
    onSubmit: v => { setTimeout(() => openEntryForm({ metaTypes: types, type: v.type, title: types[v.type].label + ' for ' + childName(children.find(c => c.id === v.childId)) + ', ' + fmtDate(v.date), now: '12:00',
      save: async ({ time, data }) => { await api.post('/api/entries', { childIds: [v.childId], type: v.type, date: v.date, time: time || undefined, data }); toast('Entry added'); draw(); } }), 0); } }));
  await draw();
}
