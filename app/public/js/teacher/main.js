/* Teacher panel (tablet-first). Loads the signed-in person or classroom tablet, their room(s),
   and keeps the room's cards and live ratio up to date (refreshes every 30 seconds and after
   every action). Supervisors can open it too and pick any room at their locations. */
import { api, meta, logout } from '../shared/api.js';
import { html, set, $, $$, on } from '../shared/dom.js';
import { fmtDate, plural } from '../shared/format.js';
import { toast, openForm } from '../shared/ui.js';
import { S, isDevice, actor } from './state.js';
import { cardsHtml, visibleChildren } from './cards.js';
import { runBulk, runOne, runEntry, setHooks, withPin } from './actions.js';
import { pinUnlock } from './pin.js';
import { openTimeline } from './timeline.js';

async function refreshMe() {
  S.me = await api.get('/api/auth/me');
  if (!S.me.signedIn) { location.href = '/login'; return; }
  renderWho();
}

async function loadRooms() {
  const lists = await Promise.all(S.me.locationIds.map(l => api.get('/api/rooms', { location: l }).then(rs => rs.map(r => Object.assign(r, { locName: l })))));
  S.rooms = lists.flat();
  const locs = await api.get('/api/locations');
  const locName = Object.fromEntries(locs.map(l => [l.id, l.name]));
  let saved = null; try { saved = localStorage.getItem('na-teacher-room'); } catch (e) { /* ignore */ }
  S.room = S.rooms.find(r => r.id === saved) || S.rooms[0] || null;
  const sel = $('#roomSel');
  sel.hidden = S.rooms.length < 2;
  set(sel, html`${S.me.locationIds.map(l => html`<optgroup label="${locName[l] || l}">${S.rooms.filter(r => r.locationId === l).map(r => html`<option value="${r.id}"${S.room && r.id === S.room.id ? html` selected` : ''}>${r.name}</option>`)}</optgroup>`)}`);
}

async function loadRoom() {
  if (!S.room) return;
  const r = S.room, q = { location: r.locationId, room: r.id };
  const [children, att, entries, status] = await Promise.all([
    api.get('/api/children', q), api.get('/api/attendance', q), api.get('/api/entries', q), api.get('/api/rooms/' + r.id + '/status')]);
  S.children = children; S.att = Object.fromEntries(att.map(a => [a.childId, a])); S.entries = entries; S.status = status;
  const ids = new Set(children.map(c => c.id));
  S.selected.forEach(id => { if (!ids.has(id)) S.selected.delete(id); });
  render();
}

function renderWho() {
  const a = actor(), dev = isDevice();
  $('#actorLine').textContent = dev ? (a ? 'Recording as ' + a.name : 'Tablet locked: enter a PIN to record') : S.me.name;
  $('#switchBtn').hidden = !dev; $('#switchBtn').textContent = a ? 'Switch staff' : 'Enter PIN';
  $('#lockBtn').hidden = !dev || !a;
  $('#adminLink').hidden = !(S.me.role === 'owner' || S.me.role === 'admin');
  $('#accountBtn').hidden = dev;
  const inRoom = S.status && a && S.status.staff.some(s => s.userId === a.id);
  $('#clockBtn').textContent = inRoom ? 'Leave room' : 'Join room';
  $('#clockBtn').hidden = dev && !a;
}

function renderRatio() {
  const st = S.status; if (!st) return;
  const r = st.ratio, lvl = { ok: 'ok', short: 'bad', over: 'bad', empty: '', unknown: 'warn' }[r.level];
  set($('#ratio'), html`<span class="pill ${lvl}">${r.text}</span>
    <span><b>${st.counts.in}</b> here · <b>${st.staff.length}</b> staff · need <b>${r.needed}</b> <span class="muted">(${r.ratioText})</span></span>
    <span class="muted small">${st.staff.map(s => s.name).join(', ') || 'No staff clocked in'}</span>`);
}

function render() {
  const r = S.room;
  $('#roomName').textContent = r ? r.name : 'No room';
  $('#dateLine').textContent = fmtDate(S.meta.today, true) + (r ? ' · ' + r.ageGroup + ' licence, ' + r.licensedCapacity + ' spaces' : '');
  renderRatio(); renderWho();
  set($('#cards'), r ? cardsHtml() : html`<p class="empty">You are not assigned to a room yet. Ask your supervisor to assign you in Staff and logins.</p>`);
  const n = S.selected.size;
  $('#selCount').textContent = n ? plural(n, 'child', 'children') + ' selected' : 'No children selected';
  $$('#bulkActions .act').forEach(b => { b.disabled = !n; });
  // Entry types not on a button, limited to the ones this room's age group may use
  const shown = new Set(['meal', 'nap', 'toileting', 'activity', 'note']);
  set($('#moreEntry'), html`<option value="">More entries…</option>${Object.entries(S.meta.entryTypes).filter(([k, t]) => !shown.has(k) && (!t.onlyFor || (r && t.onlyFor.includes(r.ageGroup)))).map(([k, t]) => html`<option value="${k}">${t.label}</option>`)}`);
  $$('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === S.filter)));
}

async function clock() {
  const a = actor();
  try {
    const inRoom = S.status.staff.some(s => a && s.userId === a.id);
    await withPin(() => inRoom ? api.post('/api/staff-attendance/clock-out', {}) : api.post('/api/staff-attendance/clock-in', { roomId: S.room.id }));
    toast(inRoom ? 'You left ' + S.room.name : 'You joined ' + S.room.name);
  } catch (e) { toast(e.message, true); }
  await loadRoom();
}

function pinForm() {
  openForm({ title: 'My tablet PIN', intro: 'Your 4-digit PIN unlocks classroom tablets so entries are recorded under your name. ' + (S.me.hasPin ? 'You have a PIN; this replaces it.' : 'You do not have one yet.'),
    fields: [{ k: 'currentPassword', label: 'Your password', type: 'password', required: true, autocomplete: 'current-password' }, { k: 'pin', label: 'New PIN (4 digits)', type: 'password', required: true, inputmode: 'numeric', pattern: '[0-9]{4}', max: 4, autocomplete: 'off' }],
    onSubmit: async v => { await api.put('/api/auth/pin', v); toast('PIN saved'); await refreshMe(); } });
}

function bind() {
  on(document.body, 'change', '[data-select]', (e, el) => { el.checked ? S.selected.add(el.dataset.select) : S.selected.delete(el.dataset.select); render(); });
  on(document.body, 'click', '[data-open]', (e, el) => openTimeline(el.dataset.open, withPin, loadRoom));
  on(document.body, 'click', '[data-one]', (e, el) => runOne(el.dataset.one, el.dataset.id));
  on(document.body, 'click', '[data-bulk]', (e, el) => runBulk(el.dataset.bulk));
  on(document.body, 'click', '[data-entry]', (e, el) => runEntry(el.dataset.entry));
  $('#moreEntry').addEventListener('change', e => { const t = e.target.value; e.target.value = ''; if (t) runEntry(t); });
  on(document.body, 'click', '[data-filter]', (e, el) => { S.filter = el.dataset.filter; render(); });
  $('#selAll').addEventListener('click', () => { visibleChildren().forEach(c => S.selected.add(c.id)); render(); });
  $('#selNone').addEventListener('click', () => { S.selected.clear(); render(); });
  $('#roomSel').addEventListener('change', e => { S.room = S.rooms.find(r => r.id === e.target.value); S.selected.clear(); try { localStorage.setItem('na-teacher-room', S.room.id); } catch (x) { /* ignore */ } loadRoom(); });
  $('#logoutBtn').addEventListener('click', () => logout());
  $('#switchBtn').addEventListener('click', async () => { await pinUnlock(); await refreshMe(); await loadRoom(); });
  $('#lockBtn').addEventListener('click', async () => { await api.post('/api/auth/pin-lock'); await refreshMe(); toast('Tablet locked'); });
  $('#clockBtn').addEventListener('click', clock);
  $('#accountBtn').addEventListener('click', pinForm);
}

async function init() {
  S.meta = await meta();
  await refreshMe();
  if (!S.me.signedIn) return;
  await loadRooms();
  bind();
  await loadRoom();
  if (!S.room) render();
  setHooks({ reload: loadRoom, refreshMe });
  // Keep the ratio and cards current, and notice when a tablet PIN times out
  setInterval(async () => {
    const d = document.getElementById('modal');
    if (d && d.open) return;
    try {
      // After midnight the header must show the new day (the server already records on it)
      const m = await api.get('/api/meta'); S.meta.today = m.today;
      await refreshMe(); await loadRoom();
    } catch (e) { /* next time */ }
  }, 30000);
}

init().catch(e => { set($('#cards'), html`<p class="form-error">${e.message}</p>`); });
