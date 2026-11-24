/* Who may do what. Every API handler calls these before reading or writing.
   A "principal" is built for each request by api/_router.js from the session:
     { kind: 'user'|'device', role: 'owner'|'admin'|'teacher'|'device', id, name,
       locationIds: [...], roomIds: [...], actor: { id, name } | null }
   Rules:
     owner   - everything, every location
     admin   - manages their location(s): rooms, children, staff (teachers), devices, all records
     teacher - reads and writes children and entries only in their assigned room(s) at their location
     device  - a classroom tablet: same reach as a teacher for the device's room(s); writes need a
               staff member to enter their PIN first, so every record names a real person */
'use strict';
const { HttpError } = require('./http');

const deny = msg => { throw new HttpError(403, msg || 'You do not have permission to do that'); };

const isOwner = p => p.role === 'owner';
const isAdminFor = (p, locId) => isOwner(p) || (p.role === 'admin' && p.locationIds.includes(locId));
const canViewLocation = (p, locId) => isOwner(p) || p.locationIds.includes(locId);
const canUseRoom = (p, room) => !!room && canViewLocation(p, room.locationId) && (isAdminFor(p, room.locationId) || p.roomIds.includes(room.id));
const isStaffSide = p => p.role === 'teacher' || p.role === 'device';

function requireLocation(p, locId) { if (!canViewLocation(p, locId)) deny('You do not have access to that location'); }
function requireAdmin(p, locId) {
  if (locId == null ? !(isOwner(p) || p.role === 'admin') : !isAdminFor(p, locId)) deny('Only a supervisor or the owner can do that');
}
function requireOwner(p) { if (!isOwner(p)) deny('Only the owner can do that'); }
function requireRoom(p, room) { if (!canUseRoom(p, room)) deny('You do not have access to that room'); }

/* The person to record as having done a write. A tablet must have a PIN-verified staff member. */
function actorFor(p) {
  if (p.kind === 'device') {
    if (!p.actor) throw new HttpError(403, 'Enter your staff PIN on this tablet first', { code: 'pin_required' });
    return { id: p.actor.id, name: p.actor.name, via: p.id };
  }
  return { id: p.id, name: p.name };
}

/* Location ids this principal can see, given all location ids */
const visibleLocations = (p, allIds) => isOwner(p) ? allIds : allIds.filter(id => p.locationIds.includes(id));

module.exports = { isOwner, isAdminFor, canViewLocation, canUseRoom, isStaffSide, requireLocation, requireAdmin, requireOwner, requireRoom, actorFor, visibleLocations, deny };
