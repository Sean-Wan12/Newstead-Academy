/* The app's forecast engine (app/lib/engine.js) must give the same answer as the admin's
   (admin/js/engine.js) on the same input. Random rosters, rooms, end dates, plans and settings. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const APP = process.env.NA_APP || path.join(ROOT, 'app');
const appEngine = require(path.join(APP, 'lib', 'engine.js'));
const adminRules = require(path.join(ROOT, 'admin', 'js', 'rules.js'));
Object.assign(globalThis, adminRules);
const adminEngine = require(path.join(ROOT, 'admin', 'js', 'engine.js'));

let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = a => a[Math.floor(rnd() * a.length)];
const ym = (y, m) => y + '-' + String(m).padStart(2, '0');

function scenario() {
  const groups = [['Infant', 'Infant', 10], ['Toddler', 'Toddler', 15], ['Preschool', 'Preschool', 24], ['Preschool', 'Kindergarten', 24], ['Kindergarten', 'Kindergarten', 26]];
  const rooms = [];
  groups.forEach(([lic, runsAs, max], gi) => { for (let i = 0; i < int(0, 2); i++) rooms.push({ id: 'R' + gi + i, name: lic + ' ' + i, lic, runsAs, licensed: int(Math.ceil(max / 2), max) }); });
  if (!rooms.length) rooms.push({ id: 'R10', name: 'Toddler 0', lic: 'Toddler', runsAs: 'Toddler', licensed: 15 });
  const kids = [], plans = [];
  const n = int(0, 90);
  for (let id = 1; id <= n; id++) {
    const age = int(3, 80), idx = 2026 * 12 + 10 - age, b = ym(Math.floor(idx / 12), idx % 12 + 1);
    const r = rnd() < 0.85 ? pick(rooms).id : null;
    const k = { id, n: 'Child ' + id, b, r };
    if (rnd() < 0.15) k.e = ym(2026 + int(0, 2), int(1, 12)) + '-15';
    kids.push(k);
    if (rnd() < 0.15) plans.push({ id, r: pick(rooms).id, d: ym(2026 + int(0, 2), int(1, 12)) + '-01' });
  }
  const caps = {}; rooms.forEach(r => { if (rnd() < 0.2) caps[r.id] = int(0, r.licensed); });
  return { data: { asOf: '2026-11-23', kids, plans }, opts: { rooms, caps, horizon: int(1, 36), moveAge: pick([27, 28, 29, 30, 31]), leaveAge: pick([4, 5, 6]) } };
}
const norm = f => JSON.parse(JSON.stringify(f).replace(/recorded in (Lillio|enrollment)/g, 'recorded'));

test('app forecast equals the admin forecast on 300 random rosters', () => {
  for (let i = 0; i < 300; i++) {
    const s = scenario();
    const a = norm(appEngine.forecast(JSON.parse(JSON.stringify(s.data)), JSON.parse(JSON.stringify(s.opts))));
    const b = norm(adminEngine.forecast(JSON.parse(JSON.stringify(s.data)), JSON.parse(JSON.stringify(s.opts))));
    assert.deepEqual(a, b, 'scenario ' + i);
  }
});

test('app rules match the admin rules', () => {
  const appRules = require(path.join(APP, 'lib', 'rules.js'));
  for (const g of adminRules.AGE_GROUPS) assert.deepEqual(appRules.RULES[g], adminRules.RULES[g], g);
  for (let n = 0; n <= 30; n++) for (const g of adminRules.AGE_GROUPS) assert.equal(appRules.staffNeeded(n, appRules.RULES[g]), adminRules.staffNeeded(n, adminRules.RULES[g]));
  assert.equal(appRules.staffNeeded(10, appRules.RULES.Infant), 3);
  assert.equal(appRules.staffNeeded(4, appRules.RULES.Infant), 2);
});

test('ratioStatus: in ratio, short, over capacity and empty', () => {
  const { ratioStatus } = require(path.join(APP, 'lib', 'rules.js'));
  assert.equal(ratioStatus('Infant', 10, 3, 10).level, 'ok');
  assert.equal(ratioStatus('Infant', 10, 2, 10).level, 'short');
  assert.equal(ratioStatus('Toddler', 16, 4, 15).level, 'over');
  assert.equal(ratioStatus('Preschool', 0, 0, 24).level, 'empty');
  assert.equal(ratioStatus('Kindergarten', 26, 2, 26).level, 'ok');
  assert.equal(ratioStatus('Kindergarten', 27, 2, 30).level, 'short');
});
