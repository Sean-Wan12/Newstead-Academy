/* ===== Shared data store: the artifact database when available, this browser otherwise =====
   Pages use short paths such as 'attendance/2026-11-22'. Each location keeps its own copy:
   fp() turns a short path into 'loc/<location>/attendance/2026-11-22'. A path that already
   starts with 'loc/' is used as it is. */
const STORE = { mode: 'loading', db: null, assets: null, live: false };
const LOCAL_KEY = 'na-admin-db';
let LOCAL = {}; try { LOCAL = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') || {}; } catch (e) { LOCAL = {}; }
function saveLocal() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(LOCAL)); } catch (e) {} }
const watchers = [];
const fp = path => path.startsWith('loc/') ? path : 'loc/' + LOC.id + '/' + path;
function localRead(w) {
  const full = fp(w.path);
  if (w.kind === 'doc') return LOCAL[full] || null;
  const m = {}, pre = full + '/';
  Object.keys(LOCAL).forEach(p => { if (p.startsWith(pre) && !p.slice(pre.length).includes('/')) m[p.slice(pre.length)] = LOCAL[p]; });
  return m;
}
function attach(w) {
  if (w.dead) return;
  if (STORE.mode === 'db') {
    const full = fp(w.path), ref = w.kind === 'col' ? STORE.db.collection(full) : STORE.db.doc(full);
    w.unsub = ref.onSnapshot(snap => {
      if (w.kind === 'col') { const m = {}; snap.docs.forEach(d => { m[d.id] = d.data(); }); w.cb(m); }
      else w.cb(snap.exists ? snap.data() : null);
      if (!snap.metadata.fromCache) markLive();
    }, err => { markLive(); toast('Some saved data could not be loaded (' + (err && err.code || 'error') + ').', true); });
  } else w.cb(localRead(w));
}
function watch(kind, path, cb) {
  const w = { kind, path, cb, unsub: null, dead: false };
  watchers.push(w); if (STORE.mode !== 'loading') attach(w);
  return () => { w.dead = true; if (w.unsub) w.unsub(); const i = watchers.indexOf(w); if (i >= 0) watchers.splice(i, 1); };
}
function localNotify() { watchers.forEach(w => w.cb(localRead(w))); }
/* After a location change: detach every watcher and attach it again at the new location's paths */
function rebindStore() {
  // Forget the old location's records, so its contacts, waitlist or staff never show (or get saved) under the new one
  D.att = null; D.logs = null;
  Object.keys(D).forEach(k => { if (k !== 'att' && k !== 'logs') D[k] = {}; });
  watchers.forEach(w => { if (w.unsub) { w.unsub(); w.unsub = null; } });
  if (STORE.mode !== 'loading') watchers.slice().forEach(attach);
}
const chains = {};
function queue(path, fn) { const p = (chains[path] || Promise.resolve()).then(fn, fn); chains[path] = p.catch(() => {}); return p; }
function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
let MERGE_RECHECK_MS = 400;
/* Does document a already hold every value in b? */
function contains(a, b) { return Object.keys(b).every(k => isObj(b[k]) ? isObj(a && a[k]) && contains(a[k], b[k]) : JSON.stringify(a && a[k]) === JSON.stringify(b[k])); }
function deepMerge(a, b) { const o = Object.assign({}, a || {}); Object.keys(b).forEach(k => { o[k] = isObj(b[k]) && isObj(o[k]) ? deepMerge(o[k], b[k]) : b[k]; }); return o; }
function writeFail(e) {
  const c = e && e.code;
  toast(c === 'quota_exceeded' ? 'The database is full. Delete old entries, then try again.'
    : c === 'invalid_argument' ? 'That change was not saved. You may not have permission for this: teachers can take attendance and add log entries, and only the owner or an Editor can change staff, setup, fees and billing.'
    : 'That change was not saved. Check your connection and try again.', true);
  return false;
}
function put(path, data) {
  path = fp(path);
  if (STORE.mode !== 'db') { LOCAL[path] = JSON.parse(JSON.stringify(data)); saveLocal(); localNotify(); return Promise.resolve(true); }
  return queue(path, () => STORE.db.doc(path).set(data)).then(() => true, writeFail);
}
function merge(path, data) {
  path = fp(path);
  if (STORE.mode !== 'db') { LOCAL[path] = deepMerge(LOCAL[path], data); saveLocal(); localNotify(); return Promise.resolve(true); }
  return queue(path, async () => {
    try { await STORE.db.doc(path).update(data); }
    catch (e) {
      if (!(e && e.code === 'invalid_argument')) throw e;
      const s = await STORE.db.doc(path).get(); if (s.exists) throw e;
      // First write of the day: set() replaces the whole document, so another device creating it at the
      // same moment (two rooms checking in at 7:00) can overwrite this write. Check, and merge it again if so.
      await STORE.db.doc(path).set(data);
      await new Promise(r => setTimeout(r, MERGE_RECHECK_MS + Math.random() * MERGE_RECHECK_MS));
      const after = await STORE.db.doc(path).get();
      if (!after.exists || !contains(after.data(), data)) await STORE.db.doc(path).update(data);
    }
  }).then(() => true, writeFail);
}
function remove(path) {
  path = fp(path);
  if (STORE.mode !== 'db') { delete LOCAL[path]; saveLocal(); localNotify(); return Promise.resolve(true); }
  return queue(path, () => STORE.db.doc(path).delete()).then(() => true, writeFail);
}
let liveTimer = null;
function markLive() { STORE.live = true; if (liveTimer) { clearTimeout(liveTimer); liveTimer = null; } setSaveNote(); }
function setSaveNote() {
  const t = STORE.mode === 'loading' ? 'Connecting…' : STORE.mode === 'db' ? (STORE.live ? 'Saved for everyone' : 'Loading saved data…') : 'Saved in this browser only';
  if ($('saveNote')) $('saveNote').textContent = t;
  if ($('saveMode')) $('saveMode').textContent = STORE.mode === 'db'
    ? 'Everything entered here is saved in this admin\'s shared database, so everyone it is shared with sees the same data. Each location keeps its own records.'
    : 'Right now entries are saved in this browser only. Open the admin from its claude.ai page to save them for everyone.';
  document.querySelectorAll('[data-needs-db]').forEach(el => { el.hidden = STORE.mode === 'db'; });
}
(async function initStore() {
  let db = null, assets = null;
  try { if (window.claude && typeof window.claude.use === 'function') { [db, assets] = await Promise.all([window.claude.use('db'), window.claude.use('assets')]); } } catch (e) { db = null; }
  STORE.db = db; STORE.assets = assets || null; STORE.mode = db ? 'db' : 'local';
  if (db) liveTimer = setTimeout(() => { liveTimer = null; if (!STORE.live) toast('Saved data can\'t be reached yet. What you see may be out of date.', true); }, 10000);
  setSaveNote();
  watchers.slice().forEach(attach);
  if (typeof resolveRole === 'function') resolveRole();
  if (typeof refresh === 'function') refresh();
})();
