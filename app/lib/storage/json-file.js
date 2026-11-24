/* JSON-file storage adapter for local development.
   Each collection is one file in app/.data/<collection>.json holding { id: record }.
   Files are cached in memory, and writes go to a temporary file that is renamed into
   place, one write at a time per collection. Single process only: do not use this
   in production or with more than one server process. */
'use strict';
const fs = require('fs');
const path = require('path');

const NAME_RE = /^[a-z][a-zA-Z0-9_-]{0,40}$/;

function createJsonFileStore(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const cache = new Map();      // collection -> Map(id -> record)
  const queues = new Map();     // collection -> Promise of the last write

  function file(coll) {
    if (!NAME_RE.test(coll)) throw new Error('Bad collection name: ' + coll);
    return path.join(dir, coll + '.json');
  }
  function load(coll) {
    if (cache.has(coll)) return cache.get(coll);
    let obj = {};
    try { obj = JSON.parse(fs.readFileSync(file(coll), 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const m = new Map(Object.entries(obj));
    cache.set(coll, m);
    return m;
  }
  function persist(coll) {
    const prev = queues.get(coll) || Promise.resolve();
    const next = prev.then(async () => {
      const target = file(coll), tmp = target + '.' + process.pid + '.tmp';
      const data = JSON.stringify(Object.fromEntries(load(coll)), null, 1);
      await fs.promises.writeFile(tmp, data, { mode: 0o600 });
      await fs.promises.rename(tmp, target);
    });
    queues.set(coll, next.catch(() => {}));
    return next;
  }
  const clone = r => (r == null ? null : JSON.parse(JSON.stringify(r)));

  return {
    name: 'json-file',
    async get(coll, id) { return clone(load(coll).get(String(id))); },
    async list(coll) { return Array.from(load(coll).values()).map(clone); },
    /* where: a function(record) => bool, or an object of field: value pairs that must all match */
    async query(coll, where) {
      const test = typeof where === 'function' ? where
        : r => Object.keys(where || {}).every(k => r[k] === where[k]);
      return Array.from(load(coll).values()).filter(test).map(clone);
    },
    async put(coll, record) {
      if (!record || !record.id) throw new Error('put() needs a record with an id');
      load(coll).set(String(record.id), clone(record));
      await persist(coll);
      return clone(record);
    },
    /* Change one record atomically: fn gets the current record and edits it in place. Nothing
       else runs between the read and the write, so slow work (password hashing) done before the
       call can no longer overwrite a change made meanwhile (for example, deactivating an account). */
    async update(coll, id, fn) {
      const m = load(coll), cur = m.get(String(id));
      if (!cur) return null;
      const next = clone(cur); fn(next);
      m.set(String(id), clone(next));
      await persist(coll);
      return clone(next);
    },
    async delete(coll, id) {
      const had = load(coll).delete(String(id));
      if (had) await persist(coll);
      return had;
    },
    /* Used by seed.js only */
    async clearAll() {
      cache.clear();
      for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) fs.unlinkSync(path.join(dir, f));
    }
  };
}

module.exports = { createJsonFileStore };
