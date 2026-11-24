/* The room's children as large cards: selection checkbox, name (opens the day timeline),
   age, allergy flag, status with time, sleep in progress, and one-tap attendance buttons. */
import { html } from '../shared/dom.js';
import { fmtTime, fmtAge, childName, initials, todayKey } from '../shared/format.js';
import { S, statusOf, openNap } from './state.js';

const STATUS_TEXT = { expected: 'Not arrived', in: 'Here', out: 'Gone home', absent: 'Absent' };
const STATUS_PILL = { expected: '', in: 'ok', out: 'info', absent: 'warn' };

function statusLine(c) {
  const a = S.att[c.id], s = statusOf(c.id);
  if (s === 'in') return 'In at ' + fmtTime(a.checkIn.time);
  if (s === 'out') return 'In ' + fmtTime(a.checkIn.time) + ' · out ' + fmtTime(a.checkOut.time);
  if (s === 'absent') { const r = (S.meta.absentReasons.find(x => x.value === a.absent.reason) || {}).label; return 'Absent' + (r ? ': ' + r : ''); }
  const en = c.enrollment;
  return en && en.days && !en.days.includes(todayKey()) ? 'Not scheduled today' : 'Not here yet';
}

function buttons(c) {
  const s = statusOf(c.id), n = childName(c);
  if (s === 'expected') return html`<button type="button" class="btn primary" data-one="check-in" data-id="${c.id}" aria-label="Check in ${n}">Check in</button><button type="button" class="btn" data-one="absent" data-id="${c.id}" aria-label="Mark ${n} absent">Absent</button>`;
  if (s === 'in') return html`<button type="button" class="btn primary" data-one="check-out" data-id="${c.id}" aria-label="Check out ${n}">Check out</button>${openNap(c.id) ? html`<button type="button" class="btn" data-one="nap-end" data-id="${c.id}" aria-label="${n} woke up">Woke up</button>` : ''}`;
  return html`<button type="button" class="btn" data-one="undo" data-id="${c.id}" aria-label="Undo for ${n}">Undo</button>`;
}

export function visibleChildren() {
  return S.children.filter(c => {
    const s = statusOf(c.id);
    if (S.filter === 'all') return true;
    if (S.filter === 'sleeping') return !!openNap(c.id);
    return s === S.filter;
  });
}

export function cardsHtml() {
  const list = visibleChildren();
  if (!S.children.length) return html`<p class="empty">No children are placed in this room today.</p>`;
  if (!list.length) return html`<p class="empty">No children match this filter.</p>`;
  return html`${list.map(c => {
    const s = statusOf(c.id), nap = openNap(c.id), sel = S.selected.has(c.id), n = childName(c);
    const counts = S.entries.filter(e => e.childId === c.id).length;
    return html`<article class="card ${s}${sel ? ' selected' : ''}" data-card="${c.id}">
      <label class="pick"><input type="checkbox" data-select="${c.id}"${sel ? html` checked` : ''}><span class="sr-only">Select ${n}</span></label>
      <button type="button" class="card-main" data-open="${c.id}" aria-label="Open ${n}'s day">
        <span class="avatar" aria-hidden="true">${initials(n)}</span>
        <span class="card-text"><b class="name">${n}</b><span class="muted small">${fmtAge(c.ageMonths)}${counts ? ' · ' + counts + ' entr' + (counts === 1 ? 'y' : 'ies') + ' today' : ''}</span></span>
      </button>
      <div class="tags">
        <span class="pill ${STATUS_PILL[s]}">${STATUS_TEXT[s]}</span>
        ${nap ? html`<span class="pill info">Sleeping since ${fmtTime(nap.data.start)}</span>` : ''}
        ${c.allergies ? html`<span class="pill bad" title="Allergies">Allergy: ${c.allergies}</span>` : ''}
      </div>
      <p class="small status-line">${statusLine(c)}</p>
      <div class="card-btns">${buttons(c)}</div>
    </article>`;
  })}`;
}
