/* Locations (the two centres).
   GET   /api/locations      the locations this user can see
   GET   /api/locations/:id  one location
   PATCH /api/locations/:id  owner: edit name, address, phone, notes */
'use strict';
const { getStore } = require('../lib/storage');
const { check } = require('../lib/validate');
const { requireLocation, requireOwner, visibleLocations } = require('../lib/permissions');
const { mustGet, audit } = require('../lib/records');

async function list({ p }) {
  const all = await getStore().list('locations'), ids = visibleLocations(p, all.map(l => l.id));
  return all.filter(l => ids.includes(l.id)).sort((a, b) => (a.sort || 99) - (b.sort || 99) || a.name.localeCompare(b.name));
}
async function one({ p, params }) {
  requireLocation(p, params.id);
  return mustGet('locations', params.id, 'Location');
}
async function update({ p, params, body }) {
  requireOwner(p);
  const loc = await mustGet('locations', params.id, 'Location');
  const v = check(body, {
    name: { type: 'string', max: 80, required: true }, fullName: { type: 'string', max: 160 }, address: { type: 'string', max: 200 },
    phone: { type: 'string', max: 40 }, licenceNumber: { type: 'string', max: 60 }, hours: { type: 'string', max: 80 },
    notes: { type: 'array', max: 20, of: { type: 'string', max: 400 } }
  }, { partial: true });
  Object.assign(loc, v, { updatedAt: new Date().toISOString() });
  await getStore().put('locations', loc);
  await audit(p.actor, 'update', 'locations', loc.id, 'Edited location details', loc.id);
  return loc;
}

module.exports = { routes: [
  { method: 'GET', path: '/api/locations', handler: list },
  { method: 'GET', path: '/api/locations/:id', handler: one },
  { method: 'PATCH', path: '/api/locations/:id', roles: ['owner'], handler: update }
] };
