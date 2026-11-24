/* Sign-in and session endpoints.
   POST /api/auth/login          staff email + password
   POST /api/auth/device-login   classroom tablet login (username + password set by a supervisor)
   POST /api/auth/logout         ends this session
   GET  /api/auth/me             who is signed in (or { signedIn: false })
   POST /api/auth/password       change own password (also clears a temporary password)
   PUT  /api/auth/pin            set own 4-digit PIN for classroom tablets
   GET  /api/auth/device-staff   on a tablet: staff who may unlock it with a PIN
   POST /api/auth/pin-unlock     on a tablet: a staff member enters their PIN to record as themselves
   POST /api/auth/pin-lock       on a tablet: stop recording as that person */
'use strict';
const { getStore } = require('../lib/storage');
const { fail } = require('../lib/http');
const { check } = require('../lib/validate');
const { hashSecret, verifySecret, passwordProblem, pinProblem } = require('../lib/passwords');
const { createSession, destroySession, destroySessionsFor, saveSession } = require('../lib/sessions');
const { loginByAccount, loginByIp, pinByDevice } = require('../lib/rate-limit');
const { clientIp } = require('../lib/http');
const { publicUser, publicDevice, audit } = require('../lib/records');
const { PEOPLE } = require('./_util');

const ACTING_IDLE = 10 * 60e3;
const tooMany = secs => fail(429, 'Too many attempts. Try again in ' + Math.ceil(secs / 60) + ' minute' + (secs > 60 ? 's' : '') + '.', { retryAfter: secs });

/* Shared by both password logins: rate limit, look up, verify */
async function passwordLogin(req, key, findRecord, password) {
  const ip = clientIp(req);
  const wait = Math.max(loginByIp.retryAfter(ip), loginByAccount.retryAfter(key));
  if (wait) tooMany(wait);
  const rec = await findRecord();
  const ok = await verifySecret(password, rec && rec.active && !rec.deleted ? rec.passwordHash : null);
  if (!ok) {
    loginByIp.fail(ip); loginByAccount.fail(key);
    await audit(null, 'login_failed', 'auth', null, key);
    fail(401, 'That email or password is not right');
  }
  loginByAccount.reset(key);
  return rec;
}

/* Changing your password or PIN asks for the current password; wrong guesses count toward the
   same per-account lock as sign-in, so a borrowed session cannot be used to guess the password */
async function checkCurrentPassword(u, given, message) {
  const key = 'user:' + u.email, wait = loginByAccount.retryAfter(key);
  if (wait) tooMany(wait);
  if (!(await verifySecret(given, u.passwordHash))) { loginByAccount.fail(key); fail(400, message); }
}

async function login({ req, res, body, session }) {
  const v = check(body, { email: { type: 'email', required: true }, password: { type: 'string', required: true, max: 200 } });
  const store = getStore();
  const user = await passwordLogin(req, 'user:' + v.email, async () => (await store.query('users', u => u.email === v.email && !u.deleted))[0], body.password);
  if (session) await destroySession(req, res, session);
  await createSession(res, 'user', user.id);
  // Only the sign-in time changes: writing back the copy read before the slow password check
  // would undo anything changed meanwhile, such as a supervisor deactivating the account
  await store.update('users', user.id, u => { u.lastLoginAt = new Date().toISOString(); });
  await audit({ id: user.id, name: user.name }, 'login', 'users', user.id, 'Signed in', null);
  return { user: publicUser(user), mustChangePassword: !!user.mustChangePassword };
}

async function deviceLogin({ req, res, body, session }) {
  const v = check(body, { username: { type: 'string', required: true, max: 60 }, password: { type: 'string', required: true, max: 200 } });
  const store = getStore(), username = v.username.toLowerCase();
  const device = await passwordLogin(req, 'device:' + username, async () => (await store.query('devices', d => d.username === username && !d.deleted))[0], body.password);
  if (session) await destroySession(req, res, session);
  await createSession(res, 'device', device.id, { actingUserId: null, actingUntil: 0 });
  await store.update('devices', device.id, d => { d.lastLoginAt = new Date().toISOString(); });
  await audit({ id: device.id, name: device.name }, 'device_login', 'devices', device.id, 'Classroom tablet signed in', device.locationId);
  return { device: publicDevice(device) };
}

async function logout({ req, res, session, p }) {
  if (session) await destroySession(req, res, session);
  else await destroySession(req, res, null);
  if (p) await audit(p.actor || { id: p.id, name: p.name }, 'logout', 'auth', p.id, 'Signed out', null);
  return { ok: true };
}

async function me({ p }) {
  if (!p) return { signedIn: false };
  const out = { signedIn: true, kind: p.kind, role: p.role, id: p.id, name: p.name, locationIds: p.locationIds, roomIds: p.roomIds, mustChangePassword: !!p.mustChangePassword };
  if (p.kind === 'user') {
    const u = await getStore().get('users', p.id);
    out.email = u.email; out.hasPin = !!u.pinHash;
  } else {
    out.actor = p.actor; out.actingUntil = p.actingUntil || 0;
  }
  return out;
}

async function changePassword({ res, body, p }) {
  check(body, { currentPassword: { type: 'string', required: true, max: 200 }, newPassword: { type: 'string', required: true, max: 200 } });
  const store = getStore(), u = await store.get('users', p.id);
  await checkCurrentPassword(u, body.currentPassword, 'Your current password is not right');
  const problem = passwordProblem(body.newPassword); if (problem) fail(400, problem);
  if (body.newPassword === body.currentPassword) fail(400, 'Choose a password different from the current one');
  const hash = await hashSecret(body.newPassword);
  await store.update('users', u.id, x => { x.passwordHash = hash; x.mustChangePassword = false; x.passwordChangedAt = new Date().toISOString(); });
  await destroySessionsFor('user', u.id);           // sign out everywhere else
  await createSession(res, 'user', u.id);
  await audit({ id: u.id, name: u.name }, 'password_changed', 'users', u.id, 'Changed own password', null);
  return { ok: true };
}

async function setOwnPin({ body, p }) {
  check(body, { currentPassword: { type: 'string', required: true, max: 200 }, pin: { type: 'string', required: true, max: 4 } });
  const store = getStore(), u = await store.get('users', p.id);
  await checkCurrentPassword(u, body.currentPassword, 'Your password is not right');
  const problem = pinProblem(body.pin); if (problem) fail(400, problem);
  const hash = await hashSecret(body.pin);
  await store.update('users', u.id, x => { x.pinHash = hash; });
  await audit({ id: u.id, name: u.name }, 'pin_set', 'users', u.id, 'Set own PIN', null);
  return { ok: true };
}

/* Staff who may act on this tablet: teachers assigned to one of its rooms, and supervisors of its location */
async function eligibleStaff(device) {
  const users = await getStore().query('users', u => u.active && !u.deleted && u.pinHash);
  return users.filter(u => u.role === 'owner' || (u.role === 'admin' && (u.locationIds || []).includes(device.locationId)) ||
    (u.role === 'teacher' && (u.locationIds || []).includes(device.locationId) && (u.roomIds || []).some(r => (device.roomIds || []).includes(r))));
}

async function deviceStaff({ p }) {
  const device = await getStore().get('devices', p.id);
  return (await eligibleStaff(device)).filter(u => u.role !== 'owner').map(u => ({ id: u.id, name: u.name, role: u.role })).sort((a, b) => a.name.localeCompare(b.name));
}

async function pinUnlock({ body, p, session }) {
  const v = check(body, { userId: { type: 'id', required: true }, pin: { type: 'string', required: true, max: 4 } });
  const key = 'dev:' + p.id, wait = pinByDevice.retryAfter(key);
  if (wait) tooMany(wait);
  const device = await getStore().get('devices', p.id);
  const u = (await eligibleStaff(device)).find(x => x.id === v.userId);
  const ok = await verifySecret(v.pin, u ? u.pinHash : null);
  // A correct PIN does not clear the tablet's count of wrong ones: otherwise anyone who knows their
  // own PIN could keep guessing someone else's without ever being locked out
  if (!ok) { pinByDevice.fail(key); fail(401, 'That PIN is not right'); }
  session.actingUserId = u.id; session.actingUntil = Date.now() + ACTING_IDLE;
  await saveSession(session);
  await audit({ id: u.id, name: u.name, via: p.id }, 'pin_unlock', 'devices', p.id, 'Unlocked ' + device.name, device.locationId);
  return { actor: { id: u.id, name: u.name }, actingUntil: session.actingUntil };
}

async function pinLock({ session }) {
  session.actingUserId = null; session.actingUntil = 0;
  await saveSession(session);
  return { ok: true };
}

const routes = [
  { method: 'POST', path: '/api/auth/login', public: true, handler: login },
  { method: 'POST', path: '/api/auth/device-login', public: true, handler: deviceLogin },
  { method: 'POST', path: '/api/auth/logout', public: true, handler: logout },
  { method: 'GET', path: '/api/auth/me', public: true, handler: me },
  { method: 'POST', path: '/api/auth/password', roles: PEOPLE, allowWithTempPassword: true, handler: changePassword },
  { method: 'PUT', path: '/api/auth/pin', roles: PEOPLE, handler: setOwnPin },
  { method: 'GET', path: '/api/auth/device-staff', roles: ['device'], handler: deviceStaff },
  { method: 'POST', path: '/api/auth/pin-unlock', roles: ['device'], handler: pinUnlock },
  { method: 'POST', path: '/api/auth/pin-lock', roles: ['device'], handler: pinLock }
];

module.exports = { routes, eligibleStaff };
