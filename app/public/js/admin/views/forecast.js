/* Capacity forecast (ported engine): rooms down the side, months across, open spaces in each
   cell. Click a cell to see the children, moves, starts and leavers behind the number.
   Works from birth months and booked placements only; no estimates. */
import { api } from '../../shared/api.js';
import { html, set, on } from '../../shared/dom.js';
import { fmtAge } from '../../shared/format.js';

export async function render(el, ctx) {
  const d0 = ctx.loc.forecastDefaults || {};
  const o = { horizon: 18, moveAge: d0.moveAge || 30, leaveAge: d0.leaveAge || 6 };
  let F = null, sel = null;
  const draw = async () => {
    F = await api.get('/api/forecast', Object.assign({ location: ctx.loc.id }, o));
    const months = F.months;
    const cell = (m, r) => { const s = m.rooms[r.id], cls = s.open < 0 || s.flags.some(f => f.level === 'over') ? 'bad' : s.open === 0 ? 'full' : s.waiting ? 'warn' : 'ok';
      return html`<td class="fc ${cls}${sel && sel.mi === m.mi && sel.r === r.id ? ' sel' : ''}"><button type="button" data-cell="${m.mi}|${r.id}" aria-label="${r.name}, ${m.label}: ${s.open} open of ${s.cap}">${s.open}${s.events.length ? html`<sup>•</sup>` : ''}</button></td>`; };
    set(el, html`<div class="head-row"><h1>Capacity forecast · ${ctx.loc.name}</h1></div>
      <p class="muted">Open spaces at the end of each month, by Ontario's age rules (O. Reg. 137/15). Children move up when they reach the room's age, oldest first, where there is space. Starts and moves come from booked placements.</p>
      <div class="filters row">
        <label class="inline">Months <select id="horizon">${[12, 18, 24, 36].map(n => html`<option${n === o.horizon ? html` selected` : ''}>${n}</option>`)}</select></label>
        <label class="inline">Toddlers move up at <select id="moveAge">${[24, 27, 30, 33, 36].map(n => html`<option value="${n}"${n === o.moveAge ? html` selected` : ''}>${n} months</option>`)}</select></label>
        <label class="inline">Leave in September of the year they turn <select id="leaveAge">${[4, 5, 6].map(n => html`<option value="${n}"${n === o.leaveAge ? html` selected` : ''}>${n}</option>`)}</select></label>
        <span class="legend"><span class="fc ok">open</span><span class="fc full">full</span><span class="fc warn">children waiting</span><span class="fc bad">over</span></span></div>
      <div class="scroll"><table class="list forecast"><thead><tr><th>Room</th>${months.map(m => html`<th class="num">${m.label}</th>`)}</tr></thead><tbody>
        ${F.rooms.map(r => html`<tr><th scope="row">${r.name}<br><span class="muted small">${r.lic}, ${r.cap}</span></th>${months.map(m => cell(m, r))}</tr>`)}
        <tr class="total"><th scope="row">Children enrolled</th>${months.map(m => html`<td class="num">${m.total}</td>`)}</tr></tbody></table></div>
      <div id="detail" class="panel" aria-live="polite">${detail()}</div>`);
    const bind = id => el.querySelector('#' + id).addEventListener('change', e => { o[id] = +e.target.value; draw(); });
    bind('horizon'); bind('moveAge'); bind('leaveAge');
  };
  const detail = () => {
    if (!sel) return html`<p class="muted">Choose a cell to see who is in the room and what changes that month.</p>`;
    const m = F.months[sel.mi], s = m.rooms[sel.r], room = F.rooms.find(r => r.id === sel.r), kid = id => F.children[id] || { name: '?' };
    const age = id => { const b = kid(id).birth.split('-').map(Number); return (m.y - b[0]) * 12 + (m.m - b[1]); };
    return html`<h2>${room.name}, ${m.label}</h2><p>${s.n} of ${s.cap} places filled, ${s.open} open. Staff needed for these children: ${s.staff} (${s.ratioText}).${s.youngLimit ? ' Mixed-age limit for younger children: ' + s.youngLimit + ' (' + s.young + ' now).' : ''}</p>
      ${s.flags.map(f => html`<p><span class="pill ${f.level === 'over' ? 'bad' : 'warn'}">${f.text}</span></p>`)}
      ${s.events.length ? html`<h3>Changes this month</h3><ul>${s.events.map(e => html`<li>${e.dir === 'in' ? '+ ' : '− '}${e.text} <span class="muted">(${e.why})</span></li>`)}</ul>` : ''}
      <h3>Children</h3><p class="small">${s.ids.map(id => kid(id).name + ' (' + fmtAge(age(id)) + ')').join(', ') || 'None'}</p>`;
  };
  on(el, 'click', '[data-cell]', (e, b) => { const [mi, r] = b.dataset.cell.split('|'); sel = { mi: +mi, r }; el.querySelectorAll('td.fc.sel').forEach(td => td.classList.remove('sel')); b.parentElement.classList.add('sel'); set(el.querySelector('#detail'), detail()); });
  await draw();
}
