/* Data helpers shared by the API handlers: loading records that must exist (404 otherwise),
   which room a child is in on a date, who is enrolled in a room, the audit log, and the
   "public" shapes of users and devices that never include password or PIN hashes. */
'use strict';
const crypto = require('crypto');
const { getStore } = require('./storage');
const { fail } = require('./http');
const { inRange, weekdayKey } = require('./dates');
const { canUseRoom, isAdminFor, deny } = require('./permissions');

const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 20);

async function mustGet(coll, id, what) {
  const rec = id ? await getStore().get(coll, id) : null;
  if (!rec || rec.deleted) fail(404, (what || 'Record') + ' not found');
  return rec;
}

/* Enrollments are room placements: { childId, roomId, locationId, startDate, endDate|null, days: ['mon',...] } */
async function enrollmentsOf(childId) {
  return (await getStore().query('enrollments', { childId })).filter(e => !e.deleted).sort((a, b) => a.startDate.localeCompare(b.startDate));
}
async function enrollmentOn(childId, date) {
  return (await enrollmentsOf(childId)).filter(e => inRange(date, e.startDate, e.endDate)).pop() || null;
}
/* Children placed in a room on a date, with their enrollment. Withdrawn children are excluded. */
async function childrenInRoom(roomId, date) {
  const store = getStore();
  const ens = (await store.query('enrollments', e => e.roomId === roomId && !e.deleted && inRange(date, e.startDate, e.endDate)));
  const out = [];
  for (const e of ens) {
    const c = await store.get('children', e.childId);
    if (c && !c.deleted && c.status === 'active') out.push({ child: c, enrollment: e, scheduled: !e.days || !e.days.length || e.days.includes(weekdayKey(date)) });
  }
  return out.sort((a, b) => displayName(a.child).localeCompare(displayName(b.child)));
}
const displayName = c => (c.preferredName || c.firstName) + ' ' + c.lastName;

/* Throws unless the principal may see this child on this date. Admins: the child's location.
   Teachers and tablets: the child must be placed in one of their rooms on that date. */
async function requireChildAccess(p, child, date) {
  if (isAdminFor(p, child.locationId)) return await enrollmentOn(child.id, date);
  const en = await enrollmentOn(child.id, date);
  const room = en ? await getStore().get('rooms', en.roomId) : null;
  if (!room || !canUseRoom(p, room)) deny('That child is not in your room');
  return en;
}

async function audit(actor, action, coll, recordId, summary, locationId) {
  await getStore().put('audit', { id: newId(), at: new Date().toISOString(), actorId: actor && actor.id, actorName: actor && actor.name, via: actor && actor.via || null, action, collection: coll, recordId, summary: String(summary || '').slice(0, 300), locationId: locationId || null });
}

function publicUser(u) {
  if (!u) return null;
  const { passwordHash, pinHash, ...rest } = u;
  return Object.assign(rest, { hasPin: !!pinHash });
}
function publicDevice(d) {
  if (!d) return null;
  const { passwordHash, ...rest } = d;
  return rest;
}

module.exports = { newId, mustGet, enrollmentsOf, enrollmentOn, childrenInRoom, displayName, requireChildAccess, audit, publicUser, publicDevice };
