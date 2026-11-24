/* Dashboard: today's (or a chosen day's) attendance and Ontario ratio status per room,
   with totals, unreviewed incidents and capacity warnings. Refreshes every 30 seconds. */
import { api } from '../../shared/api.js';
import { html, set } from '../../shared/dom.js';
import { fmtDate } from '../../shared/format.js';

const LEVEL = { ok: ['ok', 'In ratio'], short: ['bad', 'Out of ratio'], over: ['bad', 'Over capacity'], empty: ['', 'No children in'], unknown: ['warn', 'No age group'] };
let timer = null;

export async function render(el, ctx) {
  clearInterval(timer);
  let date = ctx.meta.today;
  const draw = async () => {
    const d = await api.get('/api/dashboard', { location: ctx.loc.id, date });
    const t = d.totals;
    set(el, html`<div class="head-row"><h1>Dashboard · ${ctx.loc.name}</h1>
        <label class="inline">Day <input type="date" id="dashDate" value="${date}"></label></div>
      <p class="muted">${fmtDate(date, true)}${date === ctx.meta.today ? ' (today)' : ''}. Ratios use O. Reg. 137/15 for each room's licensed age group.</p>
      <div class="tiles">
        <div class="tile"><span>Scheduled</span><b>${t.scheduled}</b><small>of ${t.placed} placed</small></div>
        <div class="tile ok"><span>Checked in</span><b>${t.in}</b><small>in the centre now</small></div>
        <div class="tile"><span>Not arrived</span><b>${t.notArrived}</b><small>scheduled, no record</small></div>
        <div class="tile warn"><span>Absent</span><b>${t.absent}</b></div>
        <div class="tile"><span>Checked out</span><b>${t.out}</b></div>
        <div class="tile ${t.roomsShort ? 'bad' : 'ok'}"><span>Rooms out of ratio</span><b>${t.roomsShort}</b><small>${t.staffIn} staff in rooms</small></div>
        <a class="tile ${d.unreviewedIncidents ? 'bad' : ''}" href="#entries/incidents"><span>Incidents to review</span><b>${d.unreviewedIncidents}</b></a>
      </div>
      <table class="list"><thead><tr><th>Room</th><th>Licence</th><th class="num">Placed / operating / licensed</th><th class="num">In</th><th class="num">Absent</th><th class="num">Not arrived</th><th class="num">Out</th><th>Staff in room</th><th>Ratio</th></tr></thead>
      <tbody>${d.rooms.map(r => { const [cls, txt] = LEVEL[r.ratio.level] || ['', r.ratio.level]; return html`<tr>
        <td><b>${r.room.name}</b>${r.room.placeholder ? html` <span class="pill warn" title="Capacity not confirmed from the licence">placeholder</span>` : ''}</td>
        <td>${r.room.ageGroup}${r.room.runsAs !== r.room.ageGroup ? html`<br><span class="muted small">runs as ${r.room.runsAs}</span>` : ''}</td>
        <td class="num">${r.capacity.placed} / ${r.capacity.operating} / ${r.capacity.licensed}${r.capacity.overLicensed ? html`<br><span class="pill bad">over licensed capacity</span>` : ''}</td>
        <td class="num"><b>${r.counts.in}</b></td><td class="num">${r.counts.absent}</td><td class="num">${r.counts.notArrived}</td><td class="num">${r.counts.out}</td>
        <td>${r.staff.length} of ${r.ratio.needed} needed<br><span class="muted small">${r.staff.map(s => s.name).join(', ')}</span></td>
        <td><span class="pill ${cls}">${txt}</span><br><span class="muted small">${r.ratio.ratioText}${r.ratio.level === 'short' ? ' · ' + r.ratio.text : ''}</span></td></tr>`; })}</tbody></table>
      ${d.rooms.length ? '' : html`<p class="empty">No rooms yet. <a href="#rooms">Add the rooms from the licence.</a></p>`}`);
    el.querySelector('#dashDate').addEventListener('change', e => { if (e.target.value) { date = e.target.value; draw(); } });
  };
  await draw();
  timer = setInterval(() => { if (location.hash.slice(1).split('/')[0] === 'dashboard' || !location.hash) { if (!document.querySelector('dialog[open]')) draw().catch(() => {}); } else clearInterval(timer); }, 30000);
}
