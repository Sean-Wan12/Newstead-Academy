/* Enrollments: a child's placement in a room from a start date to an optional end date,
   on given weekdays. A new placement that starts while another is open ends the old one the
   day before (a room move). Placements drive rosters, attendance and the forecast.
   GET    /api/enrollments?child=  or  ?location=&room=   admin
   POST   /api/enrollments          admin: place a child in a room
   PATCH  /api/enrollments/:id      admin: change dates or days
   DELETE /api/enrollments/:id      admin: remove a placement made in error */
'use strict';
const { getStore } = require('../lib/storage');
const { fail } = require('../lib/http');
const { check } = require('../lib/validate');
const { addDays, DAY_KEYS } = require('../lib/dates');
const { requireAdmin, isAdminFor, deny } = require('../lib/permissions');
const { newId, mustGet, enrollmentsOf, audit } = require('../lib/records');
const { ADMINS, created } = require('./_util');

const WEEKDAYS = DAY_KEYS.filter(d => d !== 'sun' && d !== 'sat');
const ENROLL_SCHEMA = {
  roomId: { type: 'id', required: true, label: 'Room' },
  startDate: { type: 'date', required: true, label: 'Start date' },
  endDate: { type: 'date', nullable: true, label: 'End date' },
  days: { type: 'array', of: { type: 'enum', values: DAY_KEYS }, max: 7, unique: true, default: () => WEEKDAYS.slice(), label: 'Days' },
  notes: { type: 'string', max: 300, label: 'Notes' }
};

/* Used by POST here and by POST /api/children for a first placement */
async function createEnrollment(p, v) {
  const store = getStore();
  const child = await mustGet('children', v.childId, 'Child');
  const room = await mustGet('rooms', v.roomId, 'Room');
  requireAdmin(p, child.locationId);
  if (room.locationId !== child.locationId) fail(400, 'That room is at a different location from the child');
  if (room.archived) fail(400, 'That room is archived');
  if (v.endDate && v.endDate < v.startDate) fail(400, 'End date is before the start date');
  const existing = await enrollmentsOf(child.id);
  const clash = existing.find(e => e.startDate >= v.startDate);
  if (clash) fail(409, 'This child already has a placement starting ' + clash.startDate + '. Edit or remove that one first.');
  for (const e of existing) {
    if (!e.endDate || e.endDate >= v.startDate) {                 // still open on the new start date: end it the day before
      e.endDate = addDays(v.startDate, -1); e.updatedAt = new Date().toISOString(); e.endedBy = 'move';
      await store.put('enrollments', e);
    }
  }
  const en = { id: newId(), childId: child.id, roomId: room.id, locationId: room.locationId, startDate: v.startDate, endDate: v.endDate || null,
    days: v.days && v.days.length ? v.days : WEEKDAYS.slice(), notes: v.notes || '', createdAt: new Date().toISOString(), createdBy: p.actor };
  await store.put('enrollments', en);
  await audit(p.actor, 'create', 'enrollments', en.id, 'Placed ' + child.firstName + ' in ' + room.name + ' from ' + en.startDate, child.locationId);
  return en;
}

async function list({ p, query }) {
  const v = check(query, { child: { type: 'id' }, location: { type: 'id' }, room: { type: 'id' } });
  const store = getStore();
  if (v.child) {
    const c = await mustGet('children', v.child, 'Child');
    requireAdmin(p, c.locationId);
    return enrollmentsOf(c.id);
  }
  if (!v.location) fail(400, 'Give child or location');
  requireAdmin(p, v.location);
  return store.query('enrollments', e => e.locationId === v.location && !e.deleted && (!v.room || e.roomId === v.room));
}

async function create({ p, body }) {
  const v = check(body, Object.assign({ childId: { type: 'id', required: true, label: 'Child' } }, ENROLL_SCHEMA));
  return created(await createEnrollment(p, v));
}

async function update({ p, params, body }) {
  const en = await mustGet('enrollments', params.id, 'Placement');
  requireAdmin(p, en.locationId);
  const v = check(body, { startDate: ENROLL_SCHEMA.startDate, endDate: ENROLL_SCHEMA.endDate, days: ENROLL_SCHEMA.days, notes: ENROLL_SCHEMA.notes }, { partial: true });
  const next = Object.assign({}, en, v);
  if (next.endDate && next.endDate < next.startDate) fail(400, 'End date is before the start date');
  const others = (await enrollmentsOf(en.childId)).filter(e => e.id !== en.id);
  const overlap = others.find(e => (!e.endDate || e.endDate >= next.startDate) && (!next.endDate || next.endDate >= e.startDate));
  if (overlap) fail(409, 'Those dates overlap another placement (' + overlap.startDate + ' to ' + (overlap.endDate || 'open') + ')');
  Object.assign(en, v, { updatedAt: new Date().toISOString(), updatedBy: p.actor });
  await getStore().put('enrollments', en);
  await audit(p.actor, 'update', 'enrollments', en.id, 'Edited placement ' + Object.keys(v).join(', '), en.locationId);
  return en;
}

async function remove({ p, params }) {
  const en = await mustGet('enrollments', params.id, 'Placement');
  if (!isAdminFor(p, en.locationId)) deny();
  en.deleted = true; en.deletedAt = new Date().toISOString();
  await getStore().put('enrollments', en);
  await audit(p.actor, 'delete', 'enrollments', en.id, 'Removed placement', en.locationId);
  return { ok: true };
}

module.exports = { ENROLL_SCHEMA, WEEKDAYS, createEnrollment, routes: [
  { method: 'GET', path: '/api/enrollments', roles: ADMINS, handler: list },
  { method: 'POST', path: '/api/enrollments', roles: ADMINS, handler: create },
  { method: 'PATCH', path: '/api/enrollments/:id', roles: ADMINS, handler: update },
  { method: 'DELETE', path: '/api/enrollments/:id', roles: ADMINS, handler: remove }
] };
