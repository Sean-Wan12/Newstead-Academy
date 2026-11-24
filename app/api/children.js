/* Children.
   GET    /api/children?location=&room=&date=&status=   admins: everyone at the location;
                                                       teachers/tablets: children placed in their rooms on the date
   GET    /api/children/:id      profile, placements and contacts (teachers: only a child in their room today)
   POST   /api/children          admin: add a child, optionally with a first room placement
   PATCH  /api/children/:id      admin: edit profile or status
   DELETE /api/children/:id      admin: remove from lists (soft delete; records are kept) */
'use strict';
const { getStore } = require('../lib/storage');
const { check } = require('../lib/validate');
const { todayISO, inRange } = require('../lib/dates');
const { ageMonthsOn } = require('../lib/rules');
const { requireLocation, requireAdmin, isAdminFor, canUseRoom, requireRoom } = require('../lib/permissions');
const { fail } = require('../lib/http');
const { newId, mustGet, enrollmentsOf, requireChildAccess, audit } = require('../lib/records');
const { ADMINS, created, checkReadDate } = require('./_util');
const { createEnrollment, ENROLL_SCHEMA } = require('./enrollments');

const STATUSES = ['active', 'upcoming', 'withdrawn'];
const SCHEMA = {
  firstName: { type: 'string', max: 60, required: true, label: 'First name' },
  lastName: { type: 'string', max: 60, required: true, label: 'Last name' },
  preferredName: { type: 'string', max: 60, label: 'Preferred name' },
  dateOfBirth: { type: 'date', required: true, label: 'Date of birth' },
  status: { type: 'enum', values: STATUSES, default: 'active', label: 'Status' },
  allergies: { type: 'string', max: 500, label: 'Allergies' },
  medicalNotes: { type: 'text', max: 2000, label: 'Medical notes' },
  dietaryNotes: { type: 'string', max: 500, label: 'Dietary notes' },
  notes: { type: 'text', max: 2000, label: 'Notes' },
  photoPermission: { type: 'bool', default: false, label: 'Photo permission' }
};

function withAge(c, date) { return Object.assign({}, c, { ageMonths: ageMonthsOn(c.dateOfBirth, date) }); }

async function list({ p, query }) {
  const v = check(query, { location: { type: 'id', required: true }, room: { type: 'id' }, date: { type: 'date' }, status: { type: 'enum', values: STATUSES.concat('all') } });
  requireLocation(p, v.location);
  const date = v.date || todayISO(), store = getStore();
  checkReadDate(p, v.location, date);
  const rooms = Object.fromEntries((await store.query('rooms', { locationId: v.location })).map(r => [r.id, r]));
  if (v.room) requireRoom(p, rooms[v.room]);
  const admin = isAdminFor(p, v.location);
  const want = admin ? (v.status || 'all') : 'active';   // teachers only see children currently attending
  const children = await store.query('children', c => c.locationId === v.location && !c.deleted && (want === 'all' || c.status === want));
  const ens = await store.query('enrollments', e => e.locationId === v.location && !e.deleted);
  const out = [];
  for (const c of children) {
    const mine = ens.filter(e => e.childId === c.id).sort((a, b) => a.startDate.localeCompare(b.startDate));
    const cur = mine.filter(e => inRange(date, e.startDate, e.endDate)).pop() || null;
    const next = mine.find(e => e.startDate > date) || null;
    const roomId = cur ? cur.roomId : null;
    if (!admin && !(roomId && canUseRoom(p, rooms[roomId]))) continue;
    if (v.room && roomId !== v.room) continue;
    out.push(Object.assign(withAge(c, date), { roomId, enrollment: cur, nextEnrollment: admin ? next : null }));
  }
  return out.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
}

async function one({ p, params }) {
  const c = await mustGet('children', params.id, 'Child');
  requireLocation(p, c.locationId);
  const date = todayISO();
  const en = await requireChildAccess(p, c, date);
  const contacts = (await getStore().query('contacts', x => !x.deleted && (x.childIds || []).includes(c.id)));
  const admin = isAdminFor(p, c.locationId);
  return Object.assign(withAge(c, date), { roomId: en ? en.roomId : null, enrollment: en, enrollments: admin ? await enrollmentsOf(c.id) : (en ? [en] : []), contacts });
}

async function create({ p, body }) {
  const v = check(body, Object.assign({ locationId: { type: 'id', required: true } }, SCHEMA));
  requireAdmin(p, v.locationId);
  await mustGet('locations', v.locationId, 'Location');
  if (v.dateOfBirth > todayISO()) fail(400, 'Date of birth cannot be in the future');
  const c = Object.assign({ id: newId(), createdAt: new Date().toISOString(), createdBy: p.actor }, v);
  // Validate the first placement before saving anything
  let first = null;
  if (body.enrollment) {
    first = check(body.enrollment, ENROLL_SCHEMA);
    const room = await mustGet('rooms', first.roomId, 'Room');
    if (room.locationId !== c.locationId) fail(400, 'That room is at a different location from the child');
    if (room.archived) fail(400, 'That room is archived');
    if (first.endDate && first.endDate < first.startDate) fail(400, 'End date is before the start date');
  }
  await getStore().put('children', c);
  await audit(p.actor, 'create', 'children', c.id, 'Added child ' + c.firstName + ' ' + c.lastName, c.locationId);
  if (first) await createEnrollment(p, Object.assign({}, first, { childId: c.id }));
  return created(c);
}

async function update({ p, params, body }) {
  const c = await mustGet('children', params.id, 'Child');
  requireAdmin(p, c.locationId);
  const v = check(body, SCHEMA, { partial: true });
  if (v.dateOfBirth && v.dateOfBirth > todayISO()) fail(400, 'Date of birth cannot be in the future');
  Object.assign(c, v, { updatedAt: new Date().toISOString(), updatedBy: p.actor });
  await getStore().put('children', c);
  await audit(p.actor, 'update', 'children', c.id, 'Edited ' + Object.keys(v).join(', '), c.locationId);
  return c;
}

async function remove({ p, params }) {
  const c = await mustGet('children', params.id, 'Child');
  requireAdmin(p, c.locationId);
  c.deleted = true; c.deletedAt = new Date().toISOString(); c.deletedBy = p.actor;
  await getStore().put('children', c);
  await audit(p.actor, 'delete', 'children', c.id, 'Removed child record', c.locationId);
  return { ok: true };
}

module.exports = { routes: [
  { method: 'GET', path: '/api/children', handler: list },
  { method: 'GET', path: '/api/children/:id', handler: one },
  { method: 'POST', path: '/api/children', roles: ADMINS, handler: create },
  { method: 'PATCH', path: '/api/children/:id', roles: ADMINS, handler: update },
  { method: 'DELETE', path: '/api/children/:id', roles: ADMINS, handler: remove }
] };
