/* Guardians and other contacts (emergency contacts, authorized pickups). A contact can be
   linked to several children (siblings).
   GET    /api/contacts?child=   contacts for a child (teachers: a child in their room today)
   GET    /api/contacts?location= admin: everyone at the location
   POST   /api/contacts          admin
   PATCH  /api/contacts/:id      admin
   DELETE /api/contacts/:id      admin (soft delete) */
'use strict';
const { getStore } = require('../lib/storage');
const { fail } = require('../lib/http');
const { check } = require('../lib/validate');
const { todayISO } = require('../lib/dates');
const { requireAdmin, requireLocation } = require('../lib/permissions');
const { newId, mustGet, requireChildAccess, audit } = require('../lib/records');
const { ADMINS, created } = require('./_util');

const SCHEMA = {
  childIds: { type: 'array', of: { type: 'id' }, min: 1, max: 10, unique: true, required: true, label: 'Children' },
  firstName: { type: 'string', max: 60, required: true, label: 'First name' },
  lastName: { type: 'string', max: 60, required: true, label: 'Last name' },
  relationship: { type: 'string', max: 40, label: 'Relationship' },
  phone: { type: 'string', max: 30, pattern: /^[0-9 +().x-]+$/, patternText: 'can use digits, spaces and + ( ) - x', label: 'Phone' },
  email: { type: 'email', nullable: true, label: 'Email' },
  isGuardian: { type: 'bool', default: false, label: 'Parent or guardian' },
  authorizedPickup: { type: 'bool', default: false, label: 'Authorized for pickup' },
  emergencyContact: { type: 'bool', default: false, label: 'Emergency contact' },
  notes: { type: 'string', max: 500, label: 'Notes' }
};

async function checkChildren(p, ids) {
  let loc = null;
  for (const id of ids) {
    const c = await mustGet('children', id, 'Child');
    requireAdmin(p, c.locationId);
    if (loc && loc !== c.locationId) fail(400, 'Children in one contact must be at the same location');
    loc = c.locationId;
  }
  return loc;
}

async function list({ p, query }) {
  const v = check(query, { child: { type: 'id' }, location: { type: 'id' } });
  const store = getStore();
  if (v.child) {
    const c = await mustGet('children', v.child, 'Child');
    requireLocation(p, c.locationId);
    await requireChildAccess(p, c, todayISO());
    return store.query('contacts', x => !x.deleted && (x.childIds || []).includes(c.id));
  }
  if (!v.location) fail(400, 'Give child or location');
  requireAdmin(p, v.location);
  return store.query('contacts', x => !x.deleted && x.locationId === v.location);
}

async function create({ p, body }) {
  const v = check(body, SCHEMA);
  const locationId = await checkChildren(p, v.childIds);
  const c = Object.assign({ id: newId(), locationId, createdAt: new Date().toISOString(), createdBy: p.actor }, v);
  await getStore().put('contacts', c);
  await audit(p.actor, 'create', 'contacts', c.id, 'Added contact ' + c.firstName + ' ' + c.lastName, locationId);
  return created(c);
}

async function update({ p, params, body }) {
  const c = await mustGet('contacts', params.id, 'Contact');
  requireAdmin(p, c.locationId);
  const v = check(body, SCHEMA, { partial: true });
  if (v.childIds) { const loc = await checkChildren(p, v.childIds); if (loc !== c.locationId) fail(400, 'Children must be at the contact\'s location'); }
  Object.assign(c, v, { updatedAt: new Date().toISOString(), updatedBy: p.actor });
  await getStore().put('contacts', c);
  await audit(p.actor, 'update', 'contacts', c.id, 'Edited contact', c.locationId);
  return c;
}

async function remove({ p, params }) {
  const c = await mustGet('contacts', params.id, 'Contact');
  requireAdmin(p, c.locationId);
  c.deleted = true; c.deletedAt = new Date().toISOString();
  await getStore().put('contacts', c);
  await audit(p.actor, 'delete', 'contacts', c.id, 'Removed contact', c.locationId);
  return { ok: true };
}

module.exports = { routes: [
  { method: 'GET', path: '/api/contacts', handler: list },
  { method: 'POST', path: '/api/contacts', roles: ADMINS, handler: create },
  { method: 'PATCH', path: '/api/contacts/:id', roles: ADMINS, handler: update },
  { method: 'DELETE', path: '/api/contacts/:id', roles: ADMINS, handler: remove }
] };
