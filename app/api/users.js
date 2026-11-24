/* Staff accounts and their room assignments.
   Supervisors (admin) manage teachers at their own location(s); only the owner creates or
   changes supervisors and owners. No email is sent: a new account or a reset gets a
   temporary password shown once to the supervisor, and the person must change it at first sign-in.
   GET    /api/users?location=           admin: staff at a location (owner: all if no location)
   POST   /api/users                     admin: add a staff account
   PATCH  /api/users/:id                 admin: name, email, rooms, active (owner also: role, locations)
   POST   /api/users/:id/reset-password  admin: issue a temporary password, sign them out everywhere
   PUT    /api/users/:id/pin             admin: set a staff member's tablet PIN
   DELETE /api/users/:id/pin             admin: clear it */
'use strict';
const { getStore } = require('../lib/storage');
const { fail } = require('../lib/http');
const { check } = require('../lib/validate');
const { hashSecret, passwordProblem, pinProblem, tempPassword } = require('../lib/passwords');
const { destroySessionsFor, clearActingUser } = require('../lib/sessions');
const { requireAdmin, isOwner, isAdminFor, deny } = require('../lib/permissions');
const { newId, mustGet, publicUser, audit } = require('../lib/records');
const { ADMINS, created } = require('./_util');

const ROLES = ['owner', 'admin', 'teacher'];
const SCHEMA = {
  name: { type: 'string', max: 80, required: true, label: 'Name' },
  email: { type: 'email', required: true, label: 'Email' },
  role: { type: 'enum', values: ROLES, required: true, label: 'Role' },
  title: { type: 'string', max: 60, label: 'Job title' },
  locationIds: { type: 'array', of: { type: 'id' }, max: 10, unique: true, default: () => [], label: 'Locations' },
  roomIds: { type: 'array', of: { type: 'id' }, max: 20, unique: true, default: () => [], label: 'Rooms' },
  phone: { type: 'string', max: 30, label: 'Phone' },
  active: { type: 'bool', default: true, label: 'Active' }
};

/* May p manage account u? Owners manage all; supervisors manage teachers who work only at their locations. */
function canManage(p, u) {
  if (isOwner(p)) return true;
  if (p.role !== 'admin' || u.role !== 'teacher') return false;
  return (u.locationIds || []).length > 0 && u.locationIds.every(l => p.locationIds.includes(l));
}

/* Checks role, locations and rooms make sense and that p may grant them */
async function checkAssignment(p, v) {
  if (v.role !== 'teacher' && !isOwner(p)) deny('Only the owner can create or change supervisor and owner accounts');
  if (v.role === 'owner') { v.locationIds = []; v.roomIds = []; return; }
  if (!v.locationIds.length) fail(400, 'Choose at least one location');
  for (const l of v.locationIds) { await mustGet('locations', l, 'Location'); if (!isAdminFor(p, l)) deny('You cannot assign staff to that location'); }
  if (v.role === 'admin') v.roomIds = [];
  for (const r of v.roomIds) {
    const room = await mustGet('rooms', r, 'Room');
    if (!v.locationIds.includes(room.locationId)) fail(400, 'Room ' + room.name + ' is not at the chosen location(s)');
  }
}

async function emailTaken(email, exceptId) {
  return (await getStore().query('users', u => u.email === email && u.id !== exceptId && !u.deleted)).length > 0;
}

async function list({ p, query }) {
  const v = check(query, { location: { type: 'id' } });
  if (v.location) requireAdmin(p, v.location); else if (!isOwner(p)) fail(400, 'Choose a location');
  const users = await getStore().query('users', u => !u.deleted && (!v.location || u.role === 'owner' || (u.locationIds || []).includes(v.location)));
  return users.filter(u => isOwner(p) || u.role !== 'owner').map(publicUser).sort((a, b) => a.name.localeCompare(b.name));
}

async function create({ p, body }) {
  const v = check(body, SCHEMA);
  await checkAssignment(p, v);
  if (await emailTaken(v.email)) fail(409, 'Another account already uses that email');
  let temp = null, pw = body.password;
  if (pw != null) { const prob = passwordProblem(pw); if (prob) fail(400, prob); } else { temp = tempPassword(); pw = temp; }
  const u = Object.assign({ id: newId(), createdAt: new Date().toISOString(), createdBy: p.actor, mustChangePassword: true, passwordHash: await hashSecret(pw), pinHash: null }, v);
  await getStore().put('users', u);
  await audit(p.actor, 'create', 'users', u.id, 'Added ' + u.role + ' ' + u.name, u.locationIds[0] || null);
  return created({ user: publicUser(u), temporaryPassword: temp });
}

async function update({ p, params, body }) {
  const store = getStore(), u = await mustGet('users', params.id, 'Account');
  if (!canManage(p, u)) deny('You cannot change that account');
  const v = check(body, SCHEMA, { partial: true });
  const next = Object.assign({}, u, v);
  if (v.role || v.locationIds || v.roomIds) await checkAssignment(p, next);
  if (v.email && await emailTaken(v.email, u.id)) fail(409, 'Another account already uses that email');
  if (u.id === p.id && (next.active === false || next.role !== u.role)) fail(400, 'You cannot deactivate or change the role of your own account');
  if (u.role === 'owner' && (next.role !== 'owner' || next.active === false)) {
    const owners = await store.query('users', x => x.role === 'owner' && x.active && !x.deleted);
    if (owners.length < 2) fail(400, 'There must always be at least one active owner');
  }
  Object.assign(u, next, { updatedAt: new Date().toISOString(), updatedBy: p.actor });
  await store.put('users', u);
  if (v.active === false || v.role || v.locationIds) { await destroySessionsFor('user', u.id); await clearActingUser(u.id); }
  else if (v.roomIds) await clearActingUser(u.id);   // no longer recording on the tablet of a room they left
  await audit(p.actor, 'update', 'users', u.id, 'Edited ' + Object.keys(v).join(', '), (u.locationIds || [])[0] || null);
  return publicUser(u);
}

async function resetPassword({ p, params }) {
  const store = getStore(), u = await mustGet('users', params.id, 'Account');
  if (!canManage(p, u) || u.id === p.id) deny('You cannot reset that password here');
  const temp = tempPassword();
  const hash = await hashSecret(temp);
  await store.update('users', u.id, x => { x.passwordHash = hash; x.mustChangePassword = true; x.updatedAt = new Date().toISOString(); });
  await destroySessionsFor('user', u.id);
  await audit(p.actor, 'reset_password', 'users', u.id, 'Issued a temporary password for ' + u.name, (u.locationIds || [])[0] || null);
  return { temporaryPassword: temp };
}

async function setPin({ p, params, body }) {
  const store = getStore(), u = await mustGet('users', params.id, 'Account');
  if (!canManage(p, u) && u.id !== p.id) deny('You cannot set that PIN');
  check(body, { pin: { type: 'string', required: true, max: 4 } });
  const prob = pinProblem(body.pin); if (prob) fail(400, prob);
  const hash = await hashSecret(body.pin);
  await store.update('users', u.id, x => { x.pinHash = hash; });
  await clearActingUser(u.id);
  await audit(p.actor, 'pin_set', 'users', u.id, 'Set PIN for ' + u.name, (u.locationIds || [])[0] || null);
  return { ok: true };
}

async function clearPin({ p, params }) {
  const store = getStore(), u = await mustGet('users', params.id, 'Account');
  if (!canManage(p, u) && u.id !== p.id) deny('You cannot clear that PIN');
  await store.update('users', u.id, x => { x.pinHash = null; });
  await clearActingUser(u.id);
  await audit(p.actor, 'pin_cleared', 'users', u.id, 'Cleared PIN for ' + u.name, (u.locationIds || [])[0] || null);
  return { ok: true };
}

module.exports = { routes: [
  { method: 'GET', path: '/api/users', roles: ADMINS, handler: list },
  { method: 'POST', path: '/api/users', roles: ADMINS, handler: create },
  { method: 'PATCH', path: '/api/users/:id', roles: ADMINS, handler: update },
  { method: 'POST', path: '/api/users/:id/reset-password', roles: ADMINS, handler: resetPassword },
  { method: 'PUT', path: '/api/users/:id/pin', roles: ADMINS, handler: setPin },
  { method: 'DELETE', path: '/api/users/:id/pin', roles: ADMINS, handler: clearPin }
] };
