/* A stand-in for claude.ai's window.claude, following the documented contract:
   - user: isOwner(), canEdit(), id(), me(), profiles(), search() all return promises
   - db: doc()/collection() with get, set (full replace), update (deep merge, rejects
     invalid_argument when the document does not exist), delete and onSnapshot; snapshot
     data is frozen. The store lives in sessionStorage so a reload keeps it.
   Configure with window.__MOCK = { user, db, seed, people, snapshotDelay, race } before this runs. */
(() => {
  const C = window.__MOCK; if (!C) return;
  const KEY = 'mock-db';
  let store; try { store = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { store = null; }
  if (!store) store = JSON.parse(JSON.stringify(C.seed || {}));
  const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
  persist();
  window.__mockStore = () => JSON.parse(JSON.stringify(store));
  window.__mockLog = [];
  const listeners = [];
  const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  const freeze = o => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const deep = (a, b) => { const o = Object.assign({}, a); Object.keys(b).forEach(k => { o[k] = isObj(b[k]) && isObj(o[k]) ? deep(o[k], b[k]) : clone(b[k]); }); return o; };
  const err = code => Object.assign(new Error(code), { code });
  const tick = fn => new Promise((res, rej) => setTimeout(() => { try { res(fn()); } catch (e) { rej(e); } }, C.latency || 0));
  const meta = { fromCache: false, hasPendingWrites: false };
  const docSnap = path => { const d = store[path]; return Object.freeze({ id: path.split('/').pop(), exists: d !== undefined, data: () => freeze(clone(d)), metadata: meta }); };
  const colSnap = path => { const pre = path + '/'; const docs = Object.keys(store).filter(p => p.startsWith(pre) && !p.slice(pre.length).includes('/')).sort().map(docSnap); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: meta }; };
  const notify = () => { persist(); listeners.slice().forEach(l => setTimeout(() => { if (!l.dead) l.fire(); }, C.snapshotDelay || 0)); };
  const check = (p, even) => {
    const segs = p.split('/');
    if ((segs.length % 2 === 0) !== even) throw new TypeError('wrong segment count for ' + (even ? 'a document' : 'a collection') + ': ' + p);
    if (segs.some(s => !/^[A-Za-z0-9_\-.~:@+]+$/.test(s) || s === '.' || s === '..')) throw new TypeError('bad path segment: ' + p);
  };
  const listen = (fire) => { const l = { fire, dead: false }; listeners.push(l); setTimeout(() => { if (!l.dead) l.fire(); }, C.snapshotDelay || 0); return () => { l.dead = true; const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); }; };
  const race = C.race ? { re: new RegExp(C.race.path), used: false, data: C.race.data } : null;
  const doc = path => {
    check(path, true);
    return Object.freeze({
      id: path.split('/').pop(), path,
      get: () => tick(() => docSnap(path)),
      set: data => tick(() => {
        if (!isObj(data)) throw err('invalid_argument');
        store[path] = clone(data); window.__mockLog.push('set ' + path);
        // Another device creates the same document a moment later and replaces this write (last writer wins)
        if (race && !race.used && race.re.test(path)) { race.used = true; store[path] = clone(race.data); window.__mockLog.push('other device set ' + path); }
        notify();
      }),
      update: data => tick(() => { if (store[path] === undefined) throw err('invalid_argument'); store[path] = deep(store[path], data); window.__mockLog.push('update ' + path); notify(); }),
      delete: () => tick(() => { delete store[path]; notify(); }),
      onSnapshot: (next) => listen(() => next(docSnap(path))),
      collection: sub => collection(path + '/' + sub)
    });
  };
  const collection = path => {
    check(path, false);
    return Object.freeze({ path, doc: id => doc(path + '/' + (id || Math.random().toString(36).slice(2))), get: () => tick(() => colSnap(path)), onSnapshot: (next) => listen(() => next(colSnap(path))) });
  };
  const db = Object.freeze({ doc, collection });
  const U = C.user, people = C.people || [];
  const prof = id => { const p = people.find(x => x.id === id); return { id, name: (p && p.name) || '', avatarUrl: 'data:,', color: '#888', email: null, isMe: U && id === U.id, guest: !!(p && p.guest), roles: null }; };
  const user = U && Object.freeze({
    isOwner: async () => !!U.owner, canEdit: async () => !!U.edit, can: async () => null,
    id: async () => U.id || null, name: async () => U.name || '',
    me: async () => ({ id: U.id || null, name: U.name || '', avatarUrl: 'data:,', color: '#888', email: null, isOwner: !!U.owner, canEdit: !!U.edit }),
    profiles: async ids => Object.fromEntries([].concat(ids).map(id => [id, prof(id)])),
    // search('') is the "default set": you plus people already resolved; any other text searches the organization
    search: async q => q === '' ? people.filter(p => p.id === U.id || p.seen).map(p => prof(p.id)) : people.filter(p => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8).map(p => prof(p.id))
  });
  // Like the platform, use() resolves later, never during the page's first script run
  window.claude = Object.freeze({ use: name => new Promise(r => setTimeout(() => r(name === 'db' ? (C.db ? db : null) : name === 'user' ? (user || null) : null), C.useDelay || 30)) });
})();
