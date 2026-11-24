/* Staff in rooms: who is counted toward a room's ratio right now.
   A shift record { userId, roomId, date, in, out } is opened by clock-in and closed by clock-out;
   clocking in to another room closes the open shift first (a room switch).
   GET  /api/staff-attendance?location=&date=   shifts for a day (teachers/tablets: their rooms)
   POST /api/staff-attendance/clock-in   { roomId, userId?, time? }  userId: admins may clock in someone else
   POST /api/staff-attendance/clock-out  { userId?, time? }
   On a tablet, the person is the staff member who entered their PIN. */
'use strict';
const { getStore } = require('../lib/storage');
const { fail } = require('../lib/http');
const { check } = require('../lib/validate');
const { todayISO, nowHM } = require('../lib/dates');
const { requireLocation, requireRoom, canUseRoom, isAdminFor, actorFor, deny } = require('../lib/permissions');
const { newId, mustGet, audit } = require('../lib/records');
const { STAFF, checkDateAllowed, checkReadDate } = require('./_util');

async function list({ p, query }) {
  const v = check(query, { location: { type: 'id', required: true }, date: { type: 'date' } });
  requireLocation(p, v.location);
  const store = getStore(), date = v.date || todayISO();
  checkReadDate(p, v.location, date);
  const rooms = Object.fromEntries((await store.query('rooms', { locationId: v.location })).map(r => [r.id, r]));
  return store.query('staffShifts', s => s.locationId === v.location && s.date === date && (isAdminFor(p, v.location) || canUseRoom(p, rooms[s.roomId])));
}

/* Who is being clocked: yourself, the PIN-verified person on a tablet, or (admins) anyone at the location */
async function subject(p, userId, locationId) {
  const who = actorFor(p);
  if (!userId || userId === who.id) return { who, user: await mustGet('users', who.id, 'Account') };
  if (!isAdminFor(p, locationId)) deny('You can only clock yourself in or out');
  const user = await mustGet('users', userId, 'Account');
  if (user.role !== 'owner' && !(user.locationIds || []).includes(locationId)) fail(400, user.name + ' does not work at this location');
  return { who, user };
}

async function openShift(userId, date) { return (await getStore().query('staffShifts', s => s.userId === userId && s.date === date && !s.out))[0] || null; }

async function clockIn({ p, body }) {
  const v = check(body, { roomId: { type: 'id', required: true }, userId: { type: 'id' }, time: { type: 'time' } });
  const room = await mustGet('rooms', v.roomId, 'Room');
  requireRoom(p, room);
  const date = todayISO(), time = v.time || nowHM();
  checkDateAllowed(p, room.locationId, date);
  const { who, user } = await subject(p, v.userId, room.locationId);
  if (user.role === 'teacher' && !(user.roomIds || []).includes(room.id) && !isAdminFor(p, room.locationId) && p.kind !== 'device') deny('You are not assigned to that room');
  const store = getStore(), open = await openShift(user.id, date);
  if (open && open.roomId === room.id) fail(409, user.name + ' is already in ' + room.name);
  if (open) { open.out = time; open.outBy = who; await store.put('staffShifts', open); }
  const s = { id: newId(), userId: user.id, userName: user.name, locationId: room.locationId, roomId: room.id, date, in: time, out: null, inBy: who, createdAt: new Date().toISOString() };
  await store.put('staffShifts', s);
  await audit(who, 'clock_in', 'staffShifts', s.id, user.name + ' in ' + room.name + ' at ' + time, room.locationId);
  return s;
}

async function clockOut({ p, body }) {
  const v = check(body, { userId: { type: 'id' }, time: { type: 'time' }, locationId: { type: 'id' } });
  const date = todayISO(), time = v.time || nowHM();
  const target = v.userId || actorFor(p).id;
  const open = await openShift(target, date);
  if (!open) fail(409, 'Not clocked in to a room');
  const room = await mustGet('rooms', open.roomId, 'Room');
  const { who } = await subject(p, v.userId, room.locationId);
  if (time < open.in) fail(400, 'Clock-out time is before clock-in time');
  open.out = time; open.outBy = who;
  await getStore().put('staffShifts', open);
  await audit(who, 'clock_out', 'staffShifts', open.id, open.userName + ' out of ' + room.name + ' at ' + time, room.locationId);
  return open;
}

module.exports = { routes: [
  { method: 'GET', path: '/api/staff-attendance', roles: STAFF, handler: list },
  { method: 'POST', path: '/api/staff-attendance/clock-in', roles: STAFF, handler: clockIn },
  { method: 'POST', path: '/api/staff-attendance/clock-out', roles: STAFF, handler: clockOut }
] };
