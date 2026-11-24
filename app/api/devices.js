/* Classroom tablet logins, managed by supervisors. Lillio gives each classroom its own login
   for the shared tablet; we do the same, and add per-staff PINs on top so every record names
   the person who made it. A tablet login reaches only its room(s).
   GET    /api/devices?location=             admin
   POST   /api/devices                       admin: create; returns the password once
   PATCH  /api/devices/:id                   admin: rename, change rooms, deactivate
   POST   /api/devices/:id/reset-password    admin: new password, signs the tablet out
   DELETE /api/devices/:id                   admin: remove and sign the tablet out */
'use strict';
const { getStore } = require('../lib/storage');
const { fail } = require('../lib/http');
const { check } = require('../lib/validate');
const { hashSecret, tempPassword } = require('../lib/passwords');
const { destroySessionsFor } = require('../lib/sessions');
const { requireAdmin } = require('../lib/permissions');
const { newId, mustGet, publicDevice, audit } = require('../lib/records');
const { ADMINS, created } = require('./_util');

const SCHEMA = {
  name: { type: 'string', max: 60, required: true, label: 'Name' },
  roomIds: { type: 'array', of: { type: 'id' }, min: 1, max: 10, unique: true, required: true, label: 'Rooms' },
  active: { type: 'bool', default: true, label: 'Active' }
};
const USERNAME = { type: 'string', max: 40, min: 4, pattern: /^[a-z0-9][a-z0-9-]+$/, patternText: 'can use lowercase letters, numbers and dashes', label: 'Username' };

async function checkRooms(locationId, roomIds) {
  for (const r of roomIds) {
    const room = await mustGet('rooms', r, 'Room');
    if (room.locationId !== locationId) fail(400, room.name + ' is at a different location');
  }
}

async function list({ p, query }) {
  const v = check(query, { location: { type: 'id', required: true } });
  requireAdmin(p, v.location);
  return (await getStore().query('devices', d => d.locationId === v.location && !d.deleted)).map(publicDevice).sort((a, b) => a.name.localeCompare(b.name));
}

async function create({ p, body }) {
  const v = check(body, Object.assign({ locationId: { type: 'id', required: true }, username: Object.assign({ required: true }, USERNAME) }, SCHEMA));
  requireAdmin(p, v.locationId);
  await checkRooms(v.locationId, v.roomIds);
  v.username = v.username.toLowerCase();
  if ((await getStore().query('devices', d => d.username === v.username && !d.deleted)).length) fail(409, 'That username is taken');
  const password = tempPassword();
  const d = Object.assign({ id: newId(), createdAt: new Date().toISOString(), createdBy: p.actor, passwordHash: await hashSecret(password) }, v);
  await getStore().put('devices', d);
  await audit(p.actor, 'create', 'devices', d.id, 'Created classroom login ' + d.username, d.locationId);
  return created({ device: publicDevice(d), password });
}

async function update({ p, params, body }) {
  const d = await mustGet('devices', params.id, 'Classroom login');
  requireAdmin(p, d.locationId);
  const v = check(body, SCHEMA, { partial: true });
  if (v.roomIds) await checkRooms(d.locationId, v.roomIds);
  Object.assign(d, v, { updatedAt: new Date().toISOString() });
  await getStore().put('devices', d);
  if (v.active === false || v.roomIds) await destroySessionsFor('device', d.id);
  await audit(p.actor, 'update', 'devices', d.id, 'Edited classroom login ' + d.username, d.locationId);
  return publicDevice(d);
}

async function resetPassword({ p, params }) {
  const d = await mustGet('devices', params.id, 'Classroom login');
  requireAdmin(p, d.locationId);
  const password = tempPassword();
  const hash = await hashSecret(password);
  await getStore().update('devices', d.id, x => { x.passwordHash = hash; x.updatedAt = new Date().toISOString(); });
  await destroySessionsFor('device', d.id);
  await audit(p.actor, 'reset_password', 'devices', d.id, 'New password for ' + d.username, d.locationId);
  return { password };
}

async function remove({ p, params }) {
  const d = await mustGet('devices', params.id, 'Classroom login');
  requireAdmin(p, d.locationId);
  d.deleted = true; d.active = false; d.deletedAt = new Date().toISOString();
  await getStore().put('devices', d);
  await destroySessionsFor('device', d.id);
  await audit(p.actor, 'delete', 'devices', d.id, 'Removed classroom login ' + d.username, d.locationId);
  return { ok: true };
}

module.exports = { routes: [
  { method: 'GET', path: '/api/devices', roles: ADMINS, handler: list },
  { method: 'POST', path: '/api/devices', roles: ADMINS, handler: create },
  { method: 'PATCH', path: '/api/devices/:id', roles: ADMINS, handler: update },
  { method: 'POST', path: '/api/devices/:id/reset-password', roles: ADMINS, handler: resetPassword },
  { method: 'DELETE', path: '/api/devices/:id', roles: ADMINS, handler: remove }
] };
