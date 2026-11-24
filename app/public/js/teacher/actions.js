/* What the teacher's buttons do: attendance (one child or all selected), sleep start/end,
   and quick daily entries for the selected children. On a tablet, any write that needs a
   PIN opens the PIN pad and then retries. */
import { api } from '../shared/api.js';
import { openForm, toast } from '../shared/ui.js';
import { openEntryForm } from '../shared/entry-form.js';
import { childName, plural, nowHM } from '../shared/format.js';
import { S, statusOf, openNap, isDevice } from './state.js';
import { pinUnlock } from './pin.js';

let hooks = { reload: async () => {}, refreshMe: async () => {} };
export function setHooks(h) { hooks = h; }

/* Runs fn; if the tablet needs a PIN first, asks for it and runs fn again */
export async function withPin(fn) {
  try { return await fn(); }
  catch (e) {
    if (e.code !== 'pin_required' || !isDevice()) throw e;
    const who = await pinUnlock();
    await hooks.refreshMe();
    if (!who) throw new Error('Cancelled: enter your PIN to record on this tablet');
    return fn();
  }
}

/* On a tablet with nobody unlocked, ask for a PIN before opening a form */
async function ensureActor() {
  if (!isDevice() || S.me.actor) return true;
  const who = await pinUnlock();
  await hooks.refreshMe();
  return !!who;
}


const names = ids => ids.map(id => { const c = S.children.find(x => x.id === id); return c ? childName(c) : 'child'; });

function report(res, verb) {
  const ok = res.results.filter(r => r.ok).length, bad = res.results.filter(r => !r.ok);
  if (bad.length) toast((ok ? plural(ok, 'child', 'children') + ' ' + verb + '. ' : '') + bad.map(b => b.error).join(' '), true);
  else toast(plural(ok, 'child', 'children') + ' ' + verb);
}

async function attendance(kind, ids) {
  const path = { 'check-in': '/api/attendance/check-in', 'check-out': '/api/attendance/check-out' }[kind];
  const res = await withPin(() => api.post(path, { childIds: ids }));
  report(res, kind === 'check-in' ? 'checked in' : 'checked out');
}

function absentForm(ids) {
  openForm({ title: 'Mark absent', intro: names(ids).join(', '),
    fields: [{ k: 'reason', label: 'Reason', type: 'select', required: true, options: S.meta.absentReasons.map(r => [r.value, r.label]) }, { k: 'note', label: 'Note', max: 300, wide: true }],
    values: { reason: 'sick' }, submit: 'Mark absent',
    onSubmit: async v => { const res = await withPin(() => api.post('/api/attendance/absent', { childIds: ids, reason: v.reason, note: v.note })); report(res, 'marked absent'); clearAndReload(); } });
}

async function napStart(ids) {
  const here = ids.filter(id => statusOf(id) === 'in' && !openNap(id));
  if (!here.length) return toast('Choose children who are here and not already sleeping', true);
  await withPin(() => api.post('/api/entries', { childIds: here, type: 'nap', data: { start: nowHM() } }));
  toast(plural(here.length, 'child', 'children') + ' sleeping from now');
}
async function napEnd(ids) {
  const sleeping = ids.filter(id => openNap(id));
  if (!sleeping.length) return toast('None of the selected children are sleeping', true);
  const res = await withPin(() => api.post('/api/entries/nap-end', { childIds: sleeping }));
  report(res, 'woke up');
}
/* Records a sleep check on every selected child who is asleep (Lillio: every 15/30/60 minutes) */
async function sleepCheck(ids) {
  const naps = ids.map(id => openNap(id)).filter(Boolean);
  if (!naps.length) return toast('None of the selected children are sleeping', true);
  const time = nowHM();
  for (const n of naps) await withPin(() => api.post('/api/entries/' + n.id + '/sleep-check', { time }));
  toast('Sleep check recorded for ' + plural(naps.length, 'child', 'children'));
}
async function undo(id) {
  await withPin(() => api.post('/api/attendance/undo', { childId: id }));
  toast('Undone');
}

function entry(type, ids) {
  const def = S.meta.entryTypes[type];
  openEntryForm({ metaTypes: S.meta.entryTypes, type, title: def.label + ' for ' + plural(ids.length, 'child', 'children'), intro: names(ids).join(', '), now: nowHM(),
    save: async ({ time, data }) => {
      await withPin(() => api.post('/api/entries', { childIds: ids, type, time: time || undefined, data }));
      toast(def.label + ' saved for ' + plural(ids.length, 'child', 'children'));
      clearAndReload();
    } });
}

async function clearAndReload() { S.selected.clear(); await hooks.reload(); }

/* Entry points from the page */
export async function runBulk(kind) {
  const ids = Array.from(S.selected);
  if (!ids.length) return toast('Select one or more children first', true);
  try {
    if (kind === 'absent') { if (await ensureActor()) absentForm(ids); return; }
    if (kind === 'check-in' || kind === 'check-out') await attendance(kind, ids);
    else if (kind === 'nap-start') await napStart(ids);
    else if (kind === 'nap-end') await napEnd(ids);
    else if (kind === 'sleep-check') await sleepCheck(ids);
    await clearAndReload();
  } catch (e) { toast(e.message, true); hooks.reload(); }
}
export async function runOne(kind, id) {
  try {
    if (kind === 'undo') await undo(id);
    else if (kind === 'nap-end') await napEnd([id]);
    else if (kind === 'absent') { if (await ensureActor()) absentForm([id]); return; }
    else await attendance(kind, [id]);
    await hooks.reload();
  } catch (e) { toast(e.message, true); hooks.reload(); }
}
export async function runEntry(type) {
  const ids = Array.from(S.selected);
  if (!ids.length) return toast('Select one or more children first', true);
  if (await ensureActor()) entry(type, ids);
}
