/* Test-only clock for the app server and seed: node -r tests/app/fake_clock.js app/server.js
   FAKE_CLOCK_FILE names a file holding a millisecond offset from the real clock. The tests write
   to it to move the server's time (midnight, DST, PIN auto-lock) without restarting. */
'use strict';
const fs = require('fs');
const file = process.env.FAKE_CLOCK_FILE;
if (file) {
  const RealDate = Date, realNow = RealDate.now.bind(RealDate);
  let offset = 0, lastRead = -1e9;
  const off = () => { const r = realNow(); if (r - lastRead > 20) { lastRead = r; try { offset = +fs.readFileSync(file, 'utf8') || 0; } catch (e) {} } return offset; };
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(realNow() + off()); }
    static now() { return realNow() + off(); }
  }
  globalThis.Date = FakeDate;
}
