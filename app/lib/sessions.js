/* Sessions in signed cookies.
   The cookie holds a random token plus an HMAC-SHA256 signature of it (key from lib/secret.js).
   The server keeps a session record keyed by the SHA-256 of the token, so a copy of the
   database alone cannot be used to sign in, and logging out or revoking really ends it.
   Cookies are HttpOnly, SameSite=Strict, Path=/, and Secure in production.
   Two kinds: 'user' (a person signed in with email and password) and 'device'
   (a shared classroom tablet signed in with the classroom login). */
'use strict';
const crypto = require('crypto');
const { getStore } = require('./storage');
const { sessionSecret } = require('./secret');
const { parseCookies } = require('./http');

const SECURE = process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === '1';
const COOKIE = SECURE ? '__Host-na_sid' : 'na_sid';
const LIFETIME = { user: 12 * 3600e3, device: 30 * 24 * 3600e3 };   // absolute
const IDLE = { user: 4 * 3600e3, device: 7 * 24 * 3600e3 };          // since last request
const COLL = 'sessions';

const b64url = b => b.toString('base64url');
const sign = token => b64url(crypto.createHmac('sha256', sessionSecret()).update(token).digest());
const keyOf = token => crypto.createHash('sha256').update(token).digest('hex');

function cookieHeader(value, maxAgeSec) {
  return [COOKIE + '=' + value, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=' + maxAgeSec].concat(SECURE ? ['Secure'] : []).join('; ');
}

async function createSession(res, kind, subjectId, extra) {
  const token = b64url(crypto.randomBytes(32)), now = Date.now();
  const rec = Object.assign({ id: keyOf(token), kind, subjectId, createdAt: now, lastSeenAt: now, expiresAt: now + LIFETIME[kind] }, extra || {});
  await getStore().put(COLL, rec);
  res.setHeader('Set-Cookie', cookieHeader(token + '.' + sign(token), Math.floor(LIFETIME[kind] / 1000)));
  return rec;
}

/* Returns the session record for this request, or null. Expired sessions are removed. */
async function loadSession(req) {
  const raw = parseCookies(req)[COOKIE];
  if (!raw || raw.length > 200) return null;
  const dot = raw.lastIndexOf('.'); if (dot < 1) return null;
  const token = raw.slice(0, dot), sig = Buffer.from(raw.slice(dot + 1)), good = Buffer.from(sign(token));
  if (sig.length !== good.length || !crypto.timingSafeEqual(sig, good)) return null;
  const store = getStore(), rec = await store.get(COLL, keyOf(token));
  if (!rec) return null;
  const now = Date.now();
  if (now > rec.expiresAt || now - rec.lastSeenAt > IDLE[rec.kind]) { await store.delete(COLL, rec.id); return null; }
  if (now - rec.lastSeenAt > 60e3) { rec.lastSeenAt = now; await store.put(COLL, rec); }
  return rec;
}

async function saveSession(rec) { return getStore().put(COLL, rec); }

async function destroySession(req, res, rec) {
  if (rec) await getStore().delete(COLL, rec.id);
  res.setHeader('Set-Cookie', cookieHeader('', 0));
}

/* End every session of a user or device (password reset, deactivation, revoked tablet) */
async function destroySessionsFor(kind, subjectId) {
  const store = getStore(), list = await store.query(COLL, { kind, subjectId });
  for (const s of list) await store.delete(COLL, s.id);
  return list.length;
}
/* Also stop a user acting on any classroom tablet */
async function clearActingUser(userId) {
  const store = getStore(), list = await store.query(COLL, s => s.actingUserId === userId);
  for (const s of list) { s.actingUserId = null; s.actingUntil = 0; await store.put(COLL, s); }
}

async function purgeExpired() {
  const store = getStore(), now = Date.now();
  const old = await store.query(COLL, s => now > s.expiresAt || now - s.lastSeenAt > IDLE[s.kind]);
  for (const s of old) await store.delete(COLL, s.id);
}

module.exports = { createSession, loadSession, saveSession, destroySession, destroySessionsFor, clearActingUser, purgeExpired, COOKIE };
