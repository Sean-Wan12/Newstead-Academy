/* Admin panel shell: checks the signed-in person is a supervisor or the owner, loads the
   locations they manage, keeps the location switcher, and shows one section at a time
   from the URL hash (#dashboard, #children, ...). Each section is a module in views/. */
import { api, meta, logout } from '../shared/api.js';
import { html, set, $, $$ } from '../shared/dom.js';
import { toast } from '../shared/ui.js';

const VIEWS = {
  dashboard: () => import('./views/dashboard.js'), children: () => import('./views/children.js'),
  attendance: () => import('./views/attendance.js'), entries: () => import('./views/entries.js'),
  rooms: () => import('./views/rooms.js'), forecast: () => import('./views/forecast.js'),
  staff: () => import('./views/staff.js'), activity: () => import('./views/activity.js'), account: () => import('./views/account.js')
};

/* Shared with every view */
export const ctx = {
  me: null, meta: null, locations: [], loc: null, rooms: [],
  roomName: id => (ctx.rooms.find(r => r.id === id) || {}).name || '',
  async loadRooms() { ctx.rooms = await api.get('/api/rooms', { location: ctx.loc.id }); return ctx.rooms; },
  rerender: () => route()
};

let seq = 0;
async function route() {
  const name = (location.hash.slice(1).split('/')[0]) || 'dashboard';
  const view = VIEWS[name] ? name : 'dashboard';
  $$('[data-nav]').forEach(a => { if (a.dataset.nav === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const el = $('#view'), my = ++seq;
  set(el, html`<p class="empty">Loading…</p>`);
  try {
    const mod = await VIEWS[view]();
    if (my !== seq) return;
    // A fresh container per visit, so event handlers from the previous section do not pile up
    const host = document.createElement('div');
    el.replaceChildren(host);
    await mod.render(host, ctx);
    document.title = ($('#view h1') ? $('#view h1').textContent + ' · ' : '') + 'Newstead Admin';
  } catch (e) {
    if (my === seq) set(el, html`<div class="panel"><p class="form-error">${e.message}</p></div>`);
  }
}

async function switchLocation(id) {
  ctx.loc = ctx.locations.find(l => l.id === id) || ctx.locations[0];
  try { localStorage.setItem('na-admin-loc', ctx.loc.id); } catch (e) { /* ignore */ }
  await ctx.loadRooms();
}

async function init() {
  ctx.me = await api.get('/api/auth/me');
  if (!ctx.me.signedIn) { location.href = '/login?next=/admin'; return; }
  if (ctx.me.role !== 'owner' && ctx.me.role !== 'admin') { location.href = '/teacher'; return; }
  ctx.meta = await meta();
  const all = await api.get('/api/locations');
  // Supervisors see the locations they manage
  ctx.locations = ctx.me.role === 'owner' ? all : all.filter(l => ctx.me.locationIds.includes(l.id));
  if (!ctx.locations.length) { set($('#view'), html`<p class="form-error">Your account has no location yet. Ask the owner to add one.</p>`); return; }
  let saved = null; try { saved = localStorage.getItem('na-admin-loc'); } catch (e) { /* ignore */ }
  await switchLocation(saved);
  const sel = $('#locSel');
  set(sel, html`${ctx.locations.map(l => html`<option value="${l.id}"${l.id === ctx.loc.id ? html` selected` : ''}>${l.fullName || l.name}</option>`)}`);
  sel.disabled = ctx.locations.length < 2;
  sel.addEventListener('change', async () => { await switchLocation(sel.value); toast('Showing ' + ctx.loc.name); route(); });
  $('#meName').textContent = ctx.me.name + (ctx.me.role === 'owner' ? ' (owner)' : ' (supervisor)');
  $('#logoutBtn').addEventListener('click', () => logout());
  window.addEventListener('hashchange', route);
  route();
}

init().catch(e => set($('#view'), html`<p class="form-error">${e.message}</p>`));
