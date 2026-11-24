/* The key used to sign session cookies.
   Production: SESSION_SECRET must be set (at least 32 characters) or the server refuses to start.
   Development: a random secret is generated once and kept in app/.data/.dev-secret
   (git-ignored), so restarting the dev server does not sign everyone out. */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let cached = null;

function sessionSecret() {
  if (cached) return cached;
  const env = process.env.SESSION_SECRET;
  if (env) {
    if (env.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
    cached = env; return cached;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is required in production');
  const dir = process.env.DATA_DIR || path.join(__dirname, '..', '.data');
  const file = path.join(dir, '.dev-secret');
  try { cached = fs.readFileSync(file, 'utf8').trim(); } catch (e) { cached = ''; }
  if (cached.length < 32) {
    cached = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, cached, { mode: 0o600 });
  }
  return cached;
}

module.exports = { sessionSecret };
