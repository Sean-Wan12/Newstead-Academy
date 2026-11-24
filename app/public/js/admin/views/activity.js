/* Activity log: recent sign-ins, account and room changes, corrections, incidents and deletions */
import { api } from '../../shared/api.js';
import { html, set } from '../../shared/dom.js';
import { fmtStamp } from '../../shared/format.js';

export async function render(el, ctx) {
  const rows = await api.get('/api/audit', { location: ctx.loc.id, limit: 200 });
  set(el, html`<h1>Activity log · ${ctx.loc.name}</h1><p class="muted">The last ${rows.length} recorded actions at this location.</p>
    <table class="list"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>What</th></tr></thead><tbody>
    ${rows.map(a => html`<tr><td>${fmtStamp(a.at)}</td><td>${a.actorName || 'Unknown'}${a.via ? html`<br><span class="muted small">on a classroom tablet</span>` : ''}</td><td>${a.action.replace(/_/g, ' ')}</td><td>${a.summary}</td></tr>`)}
    </tbody></table>`);
}
