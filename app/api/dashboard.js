/* Room status for a day: children placed, scheduled, checked in, out, absent, not arrived,
   staff in the room, and the Ontario ratio check (lib/rules.js ratioStatus).
   GET /api/dashboard?location=&date=   admin: every room plus totals and unreviewed incidents
   GET /api/rooms/:id/status?date=      any staff with access to the room (the teacher's live ratio) */
'use strict';
const { getStore } = require('../lib/storage');
const { check } = require('../lib/validate');
const { todayISO } = require('../lib/dates');
const { RULES, ratioStatus } = require('../lib/rules');
const { requireAdmin, requireRoom, isAdminFor } = require('../lib/permissions');
const { fail } = require('../lib/http');
const { mustGet, childrenInRoom } = require('../lib/records');
const { ADMINS, STAFF } = require('./_util');

async function roomStatus(room, date) {
  const store = getStore();
  const placed = await childrenInRoom(room.id, date);
  // By child, not by the room stored on the record: a child checked in and then moved to this room
  // from today counts here, where they are placed, and not in neither room
  const ids = new Set(placed.map(x => x.child.id));
  const att = await store.query('attendance', a => a.date === date && ids.has(a.childId));
  const byChild = Object.fromEntries(att.map(a => [a.childId, a]));
  const c = { placed: placed.length, scheduled: 0, in: 0, out: 0, absent: 0, notArrived: 0 };
  for (const { child, scheduled } of placed) {
    const a = byChild[child.id], s = a && a.status;
    if (scheduled) c.scheduled++;
    if (s === 'in') c.in++; else if (s === 'out') c.out++; else if (s === 'absent') c.absent++; else if (scheduled) c.notArrived++;
  }
  const shifts = await store.query('staffShifts', s => s.roomId === room.id && s.date === date && !s.out);
  const ratio = ratioStatus(room.ageGroup, c.in, shifts.length, room.licensedCapacity);
  const rule = RULES[room.ageGroup];
  return {
    room: { id: room.id, name: room.name, code: room.code, ageGroup: room.ageGroup, runsAs: room.runsAs, licensedCapacity: room.licensedCapacity, operatingCapacity: room.operatingCapacity, placeholder: !!room.placeholder },
    counts: c, staff: shifts.map(s => ({ userId: s.userId, name: s.userName, since: s.in })), ratio,
    // More children placed than the licence allows is a data problem to fix, never shown silently
    capacity: { placed: c.placed, operating: room.operatingCapacity, licensed: room.licensedCapacity, open: room.operatingCapacity - c.placed, maxGroup: rule ? rule.maxGroup : null, overLicensed: c.placed > room.licensedCapacity }
  };
}

async function dashboard({ p, query }) {
  const v = check(query, { location: { type: 'id', required: true }, date: { type: 'date' } });
  requireAdmin(p, v.location);
  const date = v.date || todayISO(), store = getStore();
  const loc = await mustGet('locations', v.location, 'Location');
  const rooms = (await store.query('rooms', r => r.locationId === v.location && !r.archived)).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const out = [];
  for (const r of rooms) out.push(await roomStatus(r, date));
  const sum = k => out.reduce((s, r) => s + r.counts[k], 0);
  const incidents = await store.query('entries', e => e.locationId === v.location && e.type === 'incident' && !e.deleted && !e.review);
  return {
    location: { id: loc.id, name: loc.name, fullName: loc.fullName }, date, rooms: out,
    totals: { placed: sum('placed'), scheduled: sum('scheduled'), in: sum('in'), out: sum('out'), absent: sum('absent'), notArrived: sum('notArrived'),
      staffIn: out.reduce((s, r) => s + r.staff.length, 0), licensed: rooms.reduce((s, r) => s + r.licensedCapacity, 0), roomsShort: out.filter(r => r.ratio.level === 'short' || r.ratio.level === 'over').length },
    unreviewedIncidents: incidents.length
  };
}

async function oneRoom({ p, params, query }) {
  const v = check(query, { date: { type: 'date' } });
  const room = await mustGet('rooms', params.id, 'Room');
  requireRoom(p, room);
  const date = v.date || todayISO();
  if (!isAdminFor(p, room.locationId) && date !== todayISO()) fail(403, 'Teachers can see today only');
  return roomStatus(room, date);
}

module.exports = { roomStatus, routes: [
  { method: 'GET', path: '/api/dashboard', roles: ADMINS, handler: dashboard },
  { method: 'GET', path: '/api/rooms/:id/status', roles: STAFF, handler: oneRoom }
] };
