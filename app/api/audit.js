/* GET /api/audit?location=&limit=   admin: recent changes at a location (owner: all if no location).
   Records who did what and when: sign-ins, account changes, corrections, incidents, deletions. */
'use strict';
const { getStore } = require('../lib/storage');
const { check } = require('../lib/validate');
const { requireAdmin, isOwner } = require('../lib/permissions');
const { fail } = require('../lib/http');
const { ADMINS } = require('./_util');

async function list({ p, query }) {
  const v = check(query, { location: { type: 'id' }, limit: { type: 'int', min: 1, max: 500 } });
  if (v.location) requireAdmin(p, v.location); else if (!isOwner(p)) fail(400, 'Choose a location');
  const rows = await getStore().query('audit', a => !v.location || a.locationId === v.location);
  return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, v.limit || 100);
}

module.exports = { routes: [{ method: 'GET', path: '/api/audit', roles: ADMINS, handler: list }] };
