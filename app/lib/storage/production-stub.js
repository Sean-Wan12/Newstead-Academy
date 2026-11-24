/* ======================================================================
   PRODUCTION DATABASE ADAPTER: NOT IMPLEMENTED (deliberately).
   ======================================================================
   The owner has not chosen a database or host yet. Real children's records must
   not be sent to any hosted service until they do, so this adapter refuses to run.

   To implement one, export an object with the same async methods as json-file.js:
     get(collection, id)       -> record or null
     list(collection)          -> [records]
     query(collection, where)  -> [records]; where is an object of equal fields or a function
     put(collection, record)   -> record (insert or replace by record.id)
     delete(collection, id)    -> true if something was removed
     update(collection, id, fn) -> fn(record) changes the current record in place, atomically
                                  (a transaction or conditional write); null if it does not exist
   Things the choice must cover (see app/README.md, "Decisions for the owner"):
     - data residency in Canada, encryption at rest, backups, and access logs
     - a privacy review under Ontario's child care and privacy obligations
     - a sessions table with expiry (or another session store)
   ====================================================================== */
'use strict';

function createProductionStore() {
  throw new Error('No production database adapter is configured. Set STORAGE=json for local development. ' +
    'See app/lib/storage/production-stub.js and the README before storing real records anywhere.');
}

module.exports = { createProductionStore };
