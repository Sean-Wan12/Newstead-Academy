/* GET /api/children/:id/timeline?date=   One child's day in time order: check-in, every
   entry (sleep shows its start, checks and end), check-out or absence.
   Teachers and tablets: a child in their room, today. Admins: any date. */
'use strict';
const { getStore } = require('../lib/storage');
const { check } = require('../lib/validate');
const { todayISO } = require('../lib/dates');
const { requireLocation, isAdminFor } = require('../lib/permissions');
const { fail } = require('../lib/http');
const { mustGet, requireChildAccess, displayName } = require('../lib/records');
const { STAFF } = require('./_util');

async function timeline({ p, params, query }) {
  const v = check(query, { date: { type: 'date' } });
  const date = v.date || todayISO();
  const child = await mustGet('children', params.id, 'Child');
  requireLocation(p, child.locationId);
  if (!isAdminFor(p, child.locationId) && date !== todayISO()) fail(403, 'Teachers can see today\'s timeline only');
  const en = await requireChildAccess(p, child, date);
  const store = getStore();
  const att = await store.get('attendance', date + '_' + child.id);
  const entries = (await store.query('entries', e => e.childId === child.id && e.date === date && !e.deleted));
  const events = [];
  if (att && att.checkIn) events.push({ time: att.checkIn.time, kind: 'check_in', by: att.checkIn.by, person: att.checkIn.person });
  if (att && att.checkOut) events.push({ time: att.checkOut.time, kind: 'check_out', by: att.checkOut.by, person: att.checkOut.person });
  if (att && att.status === 'absent') events.push({ time: '00:00', kind: 'absent', by: att.absent.by, reason: att.absent.reason, note: att.absent.note });
  for (const e of entries) {
    events.push({ time: e.time, kind: 'entry', type: e.type, entryId: e.id, data: e.data, by: e.createdBy, review: e.review || null, groupId: e.groupId });
    (e.checks || []).forEach(c => events.push({ time: c.time, kind: 'sleep_check', entryId: e.id, note: c.note, by: c.by }));
    if (e.type === 'nap' && e.data.end) events.push({ time: e.data.end, kind: 'nap_end', entryId: e.id, by: e.updatedBy || e.createdBy });
  }
  const order = { absent: 0, check_in: 1, entry: 2, sleep_check: 3, nap_end: 4, check_out: 9 };
  events.sort((a, b) => a.time.localeCompare(b.time) || order[a.kind] - order[b.kind]);
  return { child: { id: child.id, name: displayName(child), allergies: child.allergies || '', dateOfBirth: child.dateOfBirth }, date, roomId: en ? en.roomId : null, status: att ? att.status : null, events };
}

module.exports = { routes: [{ method: 'GET', path: '/api/children/:id/timeline', roles: STAFF, handler: timeline }] };
