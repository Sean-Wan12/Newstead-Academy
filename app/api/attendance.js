/* Child attendance: one record per child per day, id "<date>_<childId>".
   status: 'in' (checked in), 'out' (checked out), 'absent'. No record means not arrived yet.
   Every change records who did it and when; corrections keep a history with a reason.
   GET   /api/attendance?location=&date=&room=   records for a day (teachers/tablets: their rooms)
   POST  /api/attendance/check-in    { childIds, time?, date?, person? }   person = who dropped off
   POST  /api/attendance/check-out   { childIds, time?, date?, person? }   person = who picked up
   POST  /api/attendance/absent      { childIds, reason, note?, date? }
   POST  /api/attendance/undo        { childId, date? }   steps back one: out -> in, in/absent -> not arrived
   PATCH /api/attendance/:id         correct times, status or reason; needs { reason } */
'use strict';
const { getStore } = require('../lib/storage');
const { fail } = require('../lib/http');
const { check } = require('../lib/validate');
const { todayISO, nowHM, inRange } = require('../lib/dates');
const { ABSENT_REASONS } = require('../lib/entry-types');
const { requireLocation, canUseRoom, isAdminFor, actorFor, requireRoom } = require('../lib/permissions');
const { mustGet, requireChildAccess, audit, displayName } = require('../lib/records');
const { STAFF, checkDateAllowed, checkReadDate } = require('./_util');

const recId = (date, childId) => date + '_' + childId;
const BULK = { childIds: { type: 'array', of: { type: 'id' }, min: 1, max: 60, unique: true, required: true, label: 'Children' }, date: { type: 'date' }, time: { type: 'time' } };

async function list({ p, query }) {
  const v = check(query, { location: { type: 'id', required: true }, date: { type: 'date' }, room: { type: 'id' } });
  requireLocation(p, v.location);
  const date = v.date || todayISO(), store = getStore();
  checkReadDate(p, v.location, date);
  if (v.room) requireRoom(p, await mustGet('rooms', v.room, 'Room'));
  const rooms = Object.fromEntries((await store.query('rooms', { locationId: v.location })).map(r => [r.id, r]));
  // The room a child is placed in on that date wins over the room stored at check-in, so a child
  // moved to another room from today shows in the new room's list
  const placedIn = {};
  (await store.query('enrollments', e => e.locationId === v.location && !e.deleted && inRange(date, e.startDate, e.endDate)))
    .sort((a, b) => a.startDate.localeCompare(b.startDate)).forEach(e => { placedIn[e.childId] = e.roomId; });
  const roomOf = a => placedIn[a.childId] || a.roomId;
  return store.query('attendance', a => a.locationId === v.location && a.date === date && (!v.room || roomOf(a) === v.room) && (isAdminFor(p, v.location) || canUseRoom(p, rooms[roomOf(a)])));
}

/* Runs fn for each child the principal may record for, collecting per-child results */
async function eachChild(p, ids, date, fn) {
  const store = getStore(), results = [];
  for (const id of ids) {
    try {
      const child = await mustGet('children', id, 'Child');
      checkDateAllowed(p, child.locationId, date);
      const en = await requireChildAccess(p, child, date);
      if (!en) fail(400, displayName(child) + ' has no room placement on ' + date);
      const prev = await store.get('attendance', recId(date, id));
      const rec = await fn(child, en, prev);
      await store.put('attendance', rec);
      results.push({ childId: id, ok: true, record: rec });
    } catch (e) {
      if (!e.status) throw e;
      if (e.status === 403 && e.details && e.details.code === 'pin_required') throw e;
      results.push({ childId: id, ok: false, error: e.message });
    }
  }
  return { results, ok: results.every(r => r.ok) };
}

const blank = (child, en, date) => ({ id: recId(date, child.id), childId: child.id, locationId: child.locationId, roomId: en.roomId, date, status: null, checkIn: null, checkOut: null, absent: null, history: [] });
const stamp = (who, time, person) => ({ time, by: who, at: new Date().toISOString(), person: person || '' });

async function checkIn({ p, body }) {
  const v = check(body, Object.assign({ person: { type: 'string', max: 80, label: 'Dropped off by' } }, BULK));
  const who = actorFor(p), date = v.date || todayISO(), time = v.time || nowHM();
  return eachChild(p, v.childIds, date, async (child, en, prev) => {
    if (prev && prev.status === 'in') fail(409, displayName(child) + ' is already checked in');
    if (prev && prev.status === 'out') fail(409, displayName(child) + ' was already checked out today. Undo the check-out instead.');
    const rec = prev || blank(child, en, date);
    rec.status = 'in'; rec.checkIn = stamp(who, time, v.person); rec.absent = null; rec.roomId = en.roomId;
    return rec;
  });
}

async function checkOut({ p, body }) {
  const v = check(body, Object.assign({ person: { type: 'string', max: 80, label: 'Picked up by' } }, BULK));
  const who = actorFor(p), date = v.date || todayISO(), time = v.time || nowHM();
  return eachChild(p, v.childIds, date, async (child, en, prev) => {
    if (!prev || prev.status !== 'in') fail(409, displayName(child) + ' is not checked in');
    if (time < prev.checkIn.time) fail(400, 'Check-out time is before the check-in time (' + prev.checkIn.time + ')');
    prev.status = 'out'; prev.checkOut = stamp(who, time, v.person);
    return prev;
  });
}

async function absent({ p, body }) {
  const v = check(body, Object.assign({ reason: { type: 'enum', values: ABSENT_REASONS, required: true, label: 'Reason' }, note: { type: 'string', max: 300 } }, BULK));
  const who = actorFor(p), date = v.date || todayISO();
  return eachChild(p, v.childIds, date, async (child, en, prev) => {
    if (prev && (prev.status === 'in' || prev.status === 'out')) fail(409, displayName(child) + ' was checked in today, so cannot be marked absent');
    const rec = prev || blank(child, en, date);
    rec.status = 'absent'; rec.absent = { reason: v.reason, note: v.note || '', by: who, at: new Date().toISOString() };
    return rec;
  });
}

async function undo({ p, body }) {
  const v = check(body, { childId: { type: 'id', required: true }, date: { type: 'date' } });
  const who = actorFor(p), date = v.date || todayISO(), store = getStore();
  const child = await mustGet('children', v.childId, 'Child');
  checkDateAllowed(p, child.locationId, date);
  await requireChildAccess(p, child, date);
  const rec = await store.get('attendance', recId(date, child.id));
  if (!rec || !rec.status) fail(409, 'Nothing to undo');
  const before = rec.status;
  rec.history.push({ at: new Date().toISOString(), by: who, change: 'undo ' + before, before: { status: rec.status, checkIn: rec.checkIn, checkOut: rec.checkOut, absent: rec.absent } });
  if (before === 'out') { rec.status = 'in'; rec.checkOut = null; }
  else { rec.status = null; rec.checkIn = null; rec.absent = null; }
  await store.put('attendance', rec);
  return rec;
}

async function correct({ p, params, body }) {
  const store = getStore(), rec = await store.get('attendance', params.id);
  if (!rec) fail(404, 'Attendance record not found');
  const child = await mustGet('children', rec.childId, 'Child');
  checkDateAllowed(p, rec.locationId, rec.date);
  await requireChildAccess(p, child, rec.date);
  const v = check(body, {
    reason: { type: 'string', max: 300, required: true, label: 'Reason for the correction' },
    status: { type: 'enum', values: ['in', 'out', 'absent', 'none'] },
    checkInTime: { type: 'time', nullable: true }, checkOutTime: { type: 'time', nullable: true },
    droppedOffBy: { type: 'string', max: 80 }, pickedUpBy: { type: 'string', max: 80 },
    absentReason: { type: 'enum', values: ABSENT_REASONS }, absentNote: { type: 'string', max: 300 }
  }, { partial: true });
  if (!v.reason) fail(400, 'Give a reason for the correction');
  const who = actorFor(p), before = { status: rec.status, checkIn: rec.checkIn, checkOut: rec.checkOut, absent: rec.absent };
  const status = v.status === 'none' ? null : (v.status || rec.status);
  if (status === 'in' || status === 'out') {
    const inT = v.checkInTime !== undefined ? v.checkInTime : rec.checkIn && rec.checkIn.time;
    if (!inT) fail(400, 'A check-in time is needed');
    rec.checkIn = Object.assign({}, rec.checkIn || stamp(who, inT), { time: inT, person: v.droppedOffBy != null ? v.droppedOffBy : (rec.checkIn && rec.checkIn.person) || '' });
    if (status === 'out') {
      const outT = v.checkOutTime !== undefined ? v.checkOutTime : rec.checkOut && rec.checkOut.time;
      if (!outT) fail(400, 'A check-out time is needed');
      if (outT < inT) fail(400, 'Check-out time is before check-in time');
      rec.checkOut = Object.assign({}, rec.checkOut || stamp(who, outT), { time: outT, person: v.pickedUpBy != null ? v.pickedUpBy : (rec.checkOut && rec.checkOut.person) || '' });
    } else rec.checkOut = null;
    rec.absent = null;
  } else if (status === 'absent') {
    rec.checkIn = null; rec.checkOut = null;
    rec.absent = Object.assign({}, rec.absent || { by: who, at: new Date().toISOString() }, { reason: v.absentReason || (rec.absent && rec.absent.reason) || 'no_reason', note: v.absentNote != null ? v.absentNote : (rec.absent && rec.absent.note) || '' });
  } else { rec.checkIn = null; rec.checkOut = null; rec.absent = null; }
  rec.status = status;
  rec.history.push({ at: new Date().toISOString(), by: who, change: 'correction', reason: v.reason, before });
  await store.put('attendance', rec);
  await audit(who, 'correct', 'attendance', rec.id, 'Corrected attendance: ' + v.reason, rec.locationId);
  return rec;
}

module.exports = { routes: [
  { method: 'GET', path: '/api/attendance', roles: STAFF, handler: list },
  { method: 'POST', path: '/api/attendance/check-in', roles: STAFF, handler: checkIn },
  { method: 'POST', path: '/api/attendance/check-out', roles: STAFF, handler: checkOut },
  { method: 'POST', path: '/api/attendance/absent', roles: STAFF, handler: absent },
  { method: 'POST', path: '/api/attendance/undo', roles: STAFF, handler: undo },
  { method: 'PATCH', path: '/api/attendance/:id', roles: STAFF, handler: correct }
] };
