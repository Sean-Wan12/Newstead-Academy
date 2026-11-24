/* Picks the storage adapter. STORAGE=json (default) uses app/.data/ on this machine;
   STORAGE=production is reserved for a real database adapter, which is a stub for now.
   DATA_DIR overrides the folder (the tests and seed can point it somewhere else). */
'use strict';
const path = require('path');
const { createJsonFileStore } = require('./json-file');
const { createProductionStore } = require('./production-stub');

let store = null;

function getStore() {
  if (store) return store;
  const kind = process.env.STORAGE || 'json';
  if (kind === 'json') store = createJsonFileStore(process.env.DATA_DIR || path.join(__dirname, '..', '..', '.data'));
  else if (kind === 'production') store = createProductionStore();
  else throw new Error('Unknown STORAGE value: ' + kind);
  return store;
}

/* For tests: use a given store object instead */
function setStore(s) { store = s; }

module.exports = { getStore, setStore };
