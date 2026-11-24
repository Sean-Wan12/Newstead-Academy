/* Daily entries: meals, sleep, diaper/toilet, activities, notes, health checks, incidents.
   One record per child; a group entry for several children creates one record each with a
   shared groupId. Entries are never hard-deleted: delete marks them deleted with who and when.
   GET    /api/entries?location=&date=&room=&child=&type=   (teachers/tablets: their rooms)
   POST   /api/entries                { childIds, type, data, date?, time? }
   PATCH  /api/entries/:id            { time?, data? }  (teachers: today, their rooms)
   DELETE /api/entries/:id
   POST   /api/entries/nap-end        { childIds, time? }  ends each child's open sleep entry
   POST   /api/entries/:id/sleep-check { time?, note? }   records a check on a sleeping child
   POST   /api/entries/:id/review     admin: mark an incident reviewed { note? } */
'use strict';
const { getStore } = require('../lib/storage');
const { fail } = require('../lib/http');
const { check } = require('../lib/validate');
const { todayISO, nowHM } = require('../lib/dates');
const { ENTRY_TYPES, TYPE_KEYS } = require('../lib/entry-types');
const { requireLocation, requireRoom, canUseRoom, isAdminFor, actorFor, requireAdmin } = require('../lib/permissions');
const { newId, mustGet, requireChildAccess, audit, displayName } = require('../lib/records');
const { STAFF, ADMINS, created, checkDateAllowed } = require('./_util');

function checkData(type, data, partial) {
  const def = ENTRY_TYPES[type];
  const v = check(data || {}, def.fields, { partial });
  if (type === 'nap' && v.end && v.start && v.end < v.start) fail(400, 'Woke up time is before fell asleep time');
  return v;
}

async function list({ p, query }) {
  const v = check(query, { location: { type: 'id', required: true }, date: { type: 'date' }, from: { type: 'date' }, to: { type: 'date' },
    room: { type: 'id' }, child: { type: 'id' }, type: { type: 'enum', values: TYPE_KEYS }, unreviewed: { type: 'bool' } });
  requireLocation(p, v.location);
  const store = getStore();
  const from = v.date || v.from || todayISO(), to = v.date || v.to || from;
  if (to < from) fail(400, 'to is before from');
  if (v.room) requireRoom(p, await mustGet('rooms', v.room, 'Room'));
  const admin = isAdminFor(p, v.location);
  if (!admin && (from !== todayISO() || to !== todayISO())) fail(403, 'Teachers can see today\'s entries. Ask a supervisor for earlier days.');
  const rooms = Object.fromEntries((await store.query('rooms', { locationId: v.location })).map(r => [r.id, r]));
  const out = await store.query('entries', e => e.locationId === v.location && !e.deleted && e.date >= from && e.date <= to &&
    (!v.room || e.roomId === v.room) && (!v.child || e.childId === v.child) && (!v.type || e.type === v.type) &&
    (!v.unreviewed || (e.type === 'incident' && !e.review)) && (admin || canUseRoom(p, rooms[e.roomId])));
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.createdAt.localeCompare(b.createdAt));
}

async function create({ p, body }) {
  const v = check(body, {
    childIds: { type: 'array', of: { type: 'id' }, min: 1, max: 60, unique: true, required: true, label: 'Children' },
    type: { type: 'enum', values: TYPE_KEYS, required: true, label: 'Type' },
    date: { type: 'date' }, time: { type: 'time' }, data: { type: 'object', schema: {}, label: 'Details' }
  });
  const data = checkData(v.type, body.data);
  const who = actorFor(p), date = v.date || todayISO(), time = v.time || (v.type === 'nap' ? data.start : null) || nowHM();
  const store = getStore(), groupId = v.childIds.length > 1 ? newId() : null, made = [];
  // Check every child first, so a group entry is all-or-nothing
  const placed = [];
  for (const id of v.childIds) {
    const child = await mustGet('children', id, 'Child');
    checkDateAllowed(p, child.locationId, date);
    const en = await requireChildAccess(p, child, date);
    if (!en) fail(400, displayName(child) + ' has no room placement on ' + date);
    if (v.type === 'nap' && !data.end) {
      const open = await store.query('entries', e => e.childId === id && e.date === date && e.type === 'nap' && !e.deleted && !e.data.end);
      if (open.length) fail(409, displayName(child) + ' already has a sleep in progress');
    }
    const room = await mustGet('rooms', en.roomId, 'Room'), only = ENTRY_TYPES[v.type].onlyFor;
    if (only && !only.includes(room.ageGroup)) fail(400, ENTRY_TYPES[v.type].label + ' entries are for ' + only.join(', ').toLowerCase() + ' rooms only');
    placed.push({ child, en });
  }
  for (const { child, en } of placed) {
    const e = { id: newId(), type: v.type, childId: child.id, roomId: en.roomId, locationId: child.locationId, date, time, data: Object.assign({}, data), groupId,
      createdBy: who, createdAt: new Date().toISOString(), checks: v.type === 'nap' ? [] : undefined };
    await store.put('entries', e);
    made.push(e);
  }
  if (v.type === 'incident') await audit(who, 'create', 'entries', made[0].id, 'Incident recorded for ' + made.length + ' child(ren)', made[0].locationId);
  return created(made);
}

async function loadForWrite(p, id) {
  const e = await mustGet('entries', id, 'Entry');
  const child = await mustGet('children', e.childId, 'Child');
  checkDateAllowed(p, e.locationId, e.date);
  if (!isAdminFor(p, e.locationId)) requireRoom(p, await mustGet('rooms', e.roomId, 'Room'));
  await requireChildAccess(p, child, e.date);
  return e;
}

async function update({ p, params, body }) {
  const e = await loadForWrite(p, params.id), who = actorFor(p);
  const v = check(body, { time: { type: 'time' }, data: { type: 'object', schema: {} } }, { partial: true });
  const before = { time: e.time, data: e.data };   // kept, so an edited incident report still shows what it said first
  if (body.data) e.data = checkData(e.type, Object.assign({}, e.data, body.data));
  if (v.time) e.time = v.time;
  (e.edits = e.edits || []).push({ at: new Date().toISOString(), by: who, before });
  e.updatedBy = who; e.updatedAt = new Date().toISOString();
  await getStore().put('entries', e);
  return e;
}

async function remove({ p, params }) {
  const e = await loadForWrite(p, params.id), who = actorFor(p);
  e.deleted = true; e.deletedBy = who; e.deletedAt = new Date().toISOString();
  await getStore().put('entries', e);
  await audit(who, 'delete', 'entries', e.id, 'Deleted ' + e.type + ' entry', e.locationId);
  return { ok: true };
}

async function napEnd({ p, body }) {
  const v = check(body, { childIds: { type: 'array', of: { type: 'id' }, min: 1, max: 60, unique: true, required: true }, time: { type: 'time' } });
  const who = actorFor(p), date = todayISO(), time = v.time || nowHM(), store = getStore(), results = [];
  for (const id of v.childIds) {
    const open = (await store.query('entries', e => e.childId === id && e.date === date && e.type === 'nap' && !e.deleted && !e.data.end))[0];
    if (!open) { results.push({ childId: id, ok: false, error: 'No sleep in progress' }); continue; }
    const e = await loadForWrite(p, open.id);
    if (time < e.data.start) { results.push({ childId: id, ok: false, error: 'Woke up time is before fell asleep time' }); continue; }
    e.data.end = time; e.updatedBy = who; e.updatedAt = new Date().toISOString();
    await store.put('entries', e);
    results.push({ childId: id, ok: true, record: e });
  }
  return { results, ok: results.every(r => r.ok) };
}

async function sleepCheck({ p, params, body }) {
  const e = await loadForWrite(p, params.id), who = actorFor(p);
  if (e.type !== 'nap') fail(400, 'Sleep checks are for sleep entries');
  const v = check(body, { time: { type: 'time' }, note: { type: 'string', max: 200 } });
  (e.checks = e.checks || []).push({ time: v.time || nowHM(), note: v.note || '', by: who, at: new Date().toISOString() });
  await getStore().put('entries', e);
  return e;
}

async function review({ p, params, body }) {
  const e = await mustGet('entries', params.id, 'Entry');
  requireAdmin(p, e.locationId);
  if (e.type !== 'incident') fail(400, 'Only incidents are reviewed');
  const v = check(body, { note: { type: 'text', max: 1000 } });
  e.review = { by: actorFor(p), at: new Date().toISOString(), note: v.note || '' };
  await getStore().put('entries', e);
  await audit(p.actor, 'review', 'entries', e.id, 'Reviewed incident', e.locationId);
  return e;
}

module.exports = { routes: [
  { method: 'GET', path: '/api/entries', roles: STAFF, handler: list },
  { method: 'POST', path: '/api/entries', roles: STAFF, handler: create },
  { method: 'POST', path: '/api/entries/nap-end', roles: STAFF, handler: napEnd },
  { method: 'PATCH', path: '/api/entries/:id', roles: STAFF, handler: update },
  { method: 'DELETE', path: '/api/entries/:id', roles: STAFF, handler: remove },
  { method: 'POST', path: '/api/entries/:id/sleep-check', roles: STAFF, handler: sleepCheck },
  { method: 'POST', path: '/api/entries/:id/review', roles: ADMINS, handler: review }
] };
