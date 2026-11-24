/* Password and PIN hashing with crypto.scrypt and a random salt per user.
   Stored format: scrypt$N$r$p$saltBase64$hashBase64, so parameters can change later
   without breaking existing hashes. Comparison is constant-time. */
'use strict';
const crypto = require('crypto');

const N = 16384, R = 8, P = 1, KEYLEN = 32;
const MIN_PASSWORD = 10;

function scrypt(secret, salt, n, r, p) {
  return new Promise((resolve, reject) => crypto.scrypt(secret, salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (e, k) => e ? reject(e) : resolve(k)));
}

async function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(secret), salt, N, R, P);
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

async function verifySecret(secret, stored) {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt$')) {
    // Spend the same time as a real check so a missing account looks like a wrong password
    await scrypt(String(secret || ''), 'timing-equaliser', N, R, P);
    return false;
  }
  const [, n, r, p, salt, hash] = stored.split('$');
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(String(secret), Buffer.from(salt, 'base64'), +n, +r, +p);
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < MIN_PASSWORD) return 'Password must be at least ' + MIN_PASSWORD + ' characters';
  if (pw.length > 200) return 'Password is too long';
  return null;
}
function pinProblem(pin) {
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return 'PIN must be exactly 4 digits';
  if (/^(\d)\1{3}$/.test(pin) || ['1234', '4321', '0123', '9876'].includes(pin)) return 'Choose a less obvious PIN';
  return null;
}

/* A readable temporary password for admin-issued resets, e.g. "plum-river-4827-otter" */
const WORDS = ['maple', 'river', 'otter', 'cedar', 'plum', 'birch', 'heron', 'amber', 'lake', 'fern', 'pine', 'robin', 'stone', 'cloud', 'meadow', 'willow'];
function tempPassword() {
  const w = () => WORDS[crypto.randomInt(WORDS.length)];
  return w() + '-' + w() + '-' + String(crypto.randomInt(1000, 10000)) + '-' + w();
}

module.exports = { hashSecret, verifySecret, passwordProblem, pinProblem, tempPassword, MIN_PASSWORD };
