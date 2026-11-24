/* Rooms (classrooms). Each has a licensed age group and capacity from the licence, and an
   operating capacity the centre chooses (never above licensed).
   GET    /api/rooms?location=   rooms at a location (teachers and tablets: their rooms only)
   GET    /api/rooms/:id         one room
   POST   /api/rooms             admin of the location: add a room
   PATCH  /api/rooms/:id         admin: edit
   DELETE /api/rooms/:id         admin: archive (refused while children are placed in it) */
'use strict';
const { getStore } = require('../lib/storage');
const { fail } = require('../lib/http');
const { check } = require('../lib/validate');
const { RULES, AGE_GROUPS } = require('../lib/rules');
const { todayISO } = require('../lib/dates');
const { requireLocation, requireAdmin, requireRoom, canUseRoom } = require('../lib/permissions');
const { newId, mustGet, audit } = require('../lib/records');
const { ADMINS, created } = require('./_util');

const SCHEMA = {
  name: { type: 'string', max: 60, required: true, label: 'Room name' },
  code: { type: 'string', max: 8, pattern: /^[A-Za-z0-9-]+$/, patternText: 'can use letters, numbers and dashes only', label: 'Short code' },
  licName: { type: 'string', max: 60, label: 'Name on the licence' },
  ageGroup: { type: 'enum', values: AGE_GROUPS, required: true, label: 'Licensed age group' },
  runsAs: { type: 'enum', values: AGE_GROUPS, label: 'Runs as' },
  licensedCapacity: { type: 'int', min: 1, max: 100, required: true, label: 'Licensed capacity' },
  operatingCapacity: { type: 'int', min: 0, max: 100, nullable: true, label: 'Operating capacity' },
  mixedAgeApproved: { type: 'bool', label: 'Mixed-age approval', default: false },
  placeholder: { type: 'bool', label: 'Placeholder' }
};

function finish(room) {
  if (!room.runsAs) room.runsAs = room.ageGroup;
  if (room.operatingCapacity == null) room.operatingCapacity = room.licensedCapacity;
  if (room.operatingCapacity > room.licensedCapacity) fail(400, 'Operating capacity cannot be more than licensed capacity');
  const warnings = [];
  if (room.licensedCapacity > RULES[room.ageGroup].maxGroup) warnings.push('Licensed capacity is above the ' + room.ageGroup.toLowerCase() + ' maximum group size of ' + RULES[room.ageGroup].maxGroup + '. Check the licence.');
  return warnings;
}

async function list({ p, query }) {
  const v = check(query, { location: { type: 'id', required: true } });
  requireLocation(p, v.location);
  const rooms = await getStore().query('rooms', r => r.locationId === v.location && !r.archived);
  return rooms.filter(r => canUseRoom(p, r)).sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.name.localeCompare(b.name));
}
async function one({ p, params }) {
  const room = await mustGet('rooms', params.id, 'Room');
  requireRoom(p, room);
  return room;
}
async function create({ p, body }) {
  const v = check(body, Object.assign({ locationId: { type: 'id', required: true } }, SCHEMA));
  requireAdmin(p, v.locationId);
  await mustGet('locations', v.locationId, 'Location');
  const room = Object.assign({ id: newId(), createdAt: new Date().toISOString(), archived: false, sort: Date.now() }, v);
  const warnings = finish(room);
  await getStore().put('rooms', room);
  await audit(p.actor, 'create', 'rooms', room.id, 'Added room ' + room.name, room.locationId);
  return created(Object.assign({}, room, { warnings }));
}
async function update({ p, params, body }) {
  const room = await mustGet('rooms', params.id, 'Room');
  requireAdmin(p, room.locationId);
  const v = check(body, SCHEMA, { partial: true });
  Object.assign(room, v, { updatedAt: new Date().toISOString() });
  const warnings = finish(room);
  await getStore().put('rooms', room);
  await audit(p.actor, 'update', 'rooms', room.id, 'Edited room ' + room.name, room.locationId);
  return Object.assign({}, room, { warnings });
}
async function archive({ p, params }) {
  const room = await mustGet('rooms', params.id, 'Room');
  requireAdmin(p, room.locationId);
  const today = todayISO();
  const busy = await getStore().query('enrollments', e => e.roomId === room.id && !e.deleted && (!e.endDate || e.endDate >= today));
  if (busy.length) fail(409, busy.length + ' current or future placement(s) use this room. Move those children first.');
  room.archived = true; room.archivedAt = new Date().toISOString();
  await getStore().put('rooms', room);
  await audit(p.actor, 'archive', 'rooms', room.id, 'Archived room ' + room.name, room.locationId);
  return { ok: true };
}

module.exports = { routes: [
  { method: 'GET', path: '/api/rooms', handler: list },
  { method: 'GET', path: '/api/rooms/:id', handler: one },
  { method: 'POST', path: '/api/rooms', roles: ADMINS, handler: create },
  { method: 'PATCH', path: '/api/rooms/:id', roles: ADMINS, handler: update },
  { method: 'DELETE', path: '/api/rooms/:id', roles: ADMINS, handler: archive }
] };
