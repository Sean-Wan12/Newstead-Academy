/* Counts failed sign-in attempts in memory and blocks a key after too many.
   Used for password logins (by IP and by email), classroom logins and PINs.
   In memory only: a restart clears it, and on serverless hosting each instance has its own
   counts, so production needs a shared store (noted in the README). */
'use strict';

function createLimiter({ max, windowMs, lockMs }) {
  const hits = new Map();   // key -> { count, first, lockedUntil }
  function entry(key) {
    const now = Date.now(); let e = hits.get(key);
    if (e && now - e.first > windowMs && now > (e.lockedUntil || 0)) { hits.delete(key); e = null; }
    return e;
  }
  return {
    /* Seconds until the key may try again, or 0 if it may try now */
    retryAfter(key) { const e = entry(key), now = Date.now(); return e && e.lockedUntil > now ? Math.ceil((e.lockedUntil - now) / 1000) : 0; },
    fail(key) {
      const now = Date.now(); let e = entry(key);
      if (!e) { e = { count: 0, first: now, lockedUntil: 0 }; hits.set(key, e); }
      e.count++;
      if (e.count >= max) e.lockedUntil = now + lockMs;
    },
    reset(key) { hits.delete(key); },
    _clear() { hits.clear(); }
  };
}

// 5 wrong passwords for one email in 15 minutes locks it for 15 minutes; 20 from one address locks that address
const loginByAccount = createLimiter({ max: 5, windowMs: 15 * 60e3, lockMs: 15 * 60e3 });
const loginByIp = createLimiter({ max: 20, windowMs: 15 * 60e3, lockMs: 15 * 60e3 });
// 5 wrong PINs on one tablet locks PIN entry on it for 5 minutes
const pinByDevice = createLimiter({ max: 5, windowMs: 10 * 60e3, lockMs: 5 * 60e3 });

module.exports = { createLimiter, loginByAccount, loginByIp, pinByDevice };
