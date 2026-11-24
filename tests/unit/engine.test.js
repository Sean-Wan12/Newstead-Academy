const test = require('node:test');
const assert = require('node:assert/strict');
const { forecast, RULES, RH_ROOMS } = require('./load.js');

const room = (id, lic, licensed, runsAs) => ({ id, name: id, licName: id, lic, runsAs: runsAs || lic, licensed });
let nextId = 1;
const kid = (r, b, extra) => Object.assign({ id: nextId++, n: 'Child ' + nextId, b, r, s: '2026-01' }, extra || {});
const fill = (r, n, b) => Array.from({ length: n }, () => kid(r, b));
const at = (f, key) => f.months.find(s => s.key === key);
const roomOf = (f, key, id) => { const s = at(f, key); return Object.keys(s.rooms).find(r => s.rooms[r].ids.includes(id)) || null; };

test('25 monthly snapshots from the roster month, across the year boundary', () => {
  const f = forecast({ asOf: '2026-12-01', kids: [], plans: [] }, { rooms: [room('T', 'Toddler', 15)] });
  assert.equal(f.months.length, 25);
  assert.equal(f.months[0].label, 'Dec 2026'); assert.equal(f.months[1].label, 'Jan 2027'); assert.equal(f.months[24].key, '2028-12');
});

test('empty location: no rooms and no children does not throw', () => {
  const f = forecast({ asOf: '2026-11-16', kids: [], plans: [] }, { rooms: [] });
  assert.equal(f.months.length, 25); assert.equal(f.months[0].total, 0);
});

test('toddler moves to preschool in the first month they are 30 months old', () => {
  const T = room('T', 'Toddler', 15), P = room('P', 'Preschool', 24);
  const t = kid('T', '2024-06');                       // 29 months in Nov 2026, 30 in Dec
  const f = forecast({ asOf: '2026-11-16', kids: [t, ...fill('P', 23, '2023-01')], plans: [] }, { rooms: [T, P] });
  assert.equal(roomOf(f, '2026-11', t.id), 'T');
  assert.equal(roomOf(f, '2026-12', t.id), 'P');
  assert.match(at(f, '2026-12').rooms.P.events.find(e => e.id === t.id).why, /30 months/);
});

test('a toddler with no preschool space waits and is flagged', () => {
  const T = room('T', 'Toddler', 15), P = room('P', 'Preschool', 24);
  const t = kid('T', '2024-05');                       // 30 months in Nov 2026
  const f = forecast({ asOf: '2026-11-16', kids: [t, ...fill('P', 24, '2023-06')], plans: [] }, { rooms: [T, P] });
  const c = at(f, '2026-11').rooms.T;
  assert.equal(c.waiting, 1); assert.ok(c.flags.some(x => x.level === 'wait'));
});

test('early move (28 months) respects the 20% mixed-age limit of the preschool room', () => {
  const T = room('T', 'Toddler', 15), P = room('P', 'Preschool', 24);
  const t = kid('T', '2024-07');                       // 28 months in Nov 2026
  const young = fill('P', 5, '2024-06');               // already 5 under-30-month children (limit for 24 is 5)
  const f = forecast({ asOf: '2026-11-16', kids: [t, ...young, ...fill('P', 10, '2023-01')], plans: [] }, { rooms: [T, P], moveAge: 28 });
  assert.equal(roomOf(f, '2026-11', t.id), 'T', 'no early move while 5 younger children are already in the room');
  const f2 = forecast({ asOf: '2026-11-16', kids: [t, ...fill('P', 4, '2024-06'), ...fill('P', 10, '2023-01')], plans: [] }, { rooms: [T, P], moveAge: 28 });
  assert.equal(roomOf(f2, '2026-11', t.id), 'P');
  assert.match(at(f2, '2026-11').rooms.P.events.find(e => e.id === t.id).why, /mixed-age/);
});

test('mixed-age over the limit is flagged', () => {
  const P = room('P', 'Preschool', 24);
  const f = forecast({ asOf: '2026-11-16', kids: fill('P', 6, '2024-08'), plans: [] }, { rooms: [P] });
  const c = at(f, '2026-11').rooms.P;
  assert.equal(c.young, 6); assert.equal(c.youngLimit, 5);
  assert.ok(c.flags.some(x => x.level === 'over' && /mixed-age limit is 5/.test(x.text)));
});

test('infant moves to a toddler room at 18 months; infant staff at 3 to 10', () => {
  const I = room('I', 'Infant', 10), T = room('T', 'Toddler', 15);
  const i = kid('I', '2025-06');                       // 17 months in Nov, 18 in Dec
  const f = forecast({ asOf: '2026-11-16', kids: [i, ...fill('I', 3, '2026-01')], plans: [] }, { rooms: [I, T] });
  assert.equal(roomOf(f, '2026-11', i.id), 'I');
  assert.equal(at(f, '2026-11').rooms.I.staff, 2, '4 infants need 2 staff');
  assert.equal(roomOf(f, '2026-12', i.id), 'T');
  assert.equal(at(f, '2026-12').rooms.I.staff, 1, '3 infants need 1 staff');
});

test('September: children turning 6 leave for school; kindergarten moves', () => {
  const rooms = RH_ROOMS.filter(r => ['P1', 'K2', 'K1'].includes(r.id));
  const leaver = kid('K1', '2021-03'), senior = kid('K2', '2022-02'), junior = kid('P1', '2023-05'), stay = kid('P1', '2024-01');
  const f = forecast({ asOf: '2026-11-16', kids: [leaver, senior, junior, stay], plans: [] }, { rooms });
  assert.equal(roomOf(f, '2027-08', leaver.id), 'K1');
  assert.equal(roomOf(f, '2027-09', leaver.id), null, 'turns 6 in 2027, leaves in September');
  assert.equal(roomOf(f, '2027-09', senior.id), 'K1', 'turns 5: senior kindergarten');
  assert.equal(roomOf(f, '2027-09', junior.id), 'K2', 'turns 4: junior kindergarten class');
  assert.equal(roomOf(f, '2027-09', stay.id), 'P1', 'turns 3: stays in preschool');
  assert.equal(roomOf(f, '2027-08', junior.id), 'P1', 'no move before September');
});

test('leave age 4 (Markham: no kindergarten room) leaves in September of the year they turn 4', () => {
  const P = room('P', 'Preschool', 24), k = kid('P', '2023-02');
  const f = forecast({ asOf: '2026-11-16', kids: [k], plans: [] }, { rooms: [P], leaveAge: 4 });
  assert.equal(roomOf(f, '2027-08', k.id), 'P'); assert.equal(roomOf(f, '2027-09', k.id), null);
});

test('a child reaching 6 in a preschool-licensed kindergarten class moves to the kindergarten-licensed room', () => {
  const rooms = RH_ROOMS.filter(r => ['K2', 'K1'].includes(r.id));
  const k = kid('K2', '2021-01');                      // 72 months in Jan 2027
  const f = forecast({ asOf: '2026-11-16', kids: [k], plans: [] }, { rooms });
  assert.equal(roomOf(f, '2026-12', k.id), 'K2'); assert.equal(roomOf(f, '2027-01', k.id), 'K1');
});

test('end date recorded in Lillio: the child leaves in that month', () => {
  const T = room('T', 'Toddler', 15), k = kid('T', '2025-01', { e: '2027-02-14' });
  const f = forecast({ asOf: '2026-11-16', kids: [k], plans: [] }, { rooms: [T] });
  assert.equal(roomOf(f, '2027-01', k.id), 'T'); assert.equal(roomOf(f, '2027-02', k.id), null);
  assert.equal(at(f, '2027-02').rooms.T.open, 15);
});

test('future start: counted from its start month only', () => {
  const T = room('T', 'Toddler', 15), k = kid(null, '2025-03');
  const f = forecast({ asOf: '2026-11-16', kids: [k], plans: [{ id: k.id, r: 'T', d: '2027-01-04' }] }, { rooms: [T] });
  assert.equal(at(f, '2026-12').rooms.T.n, 0); assert.equal(at(f, '2027-01').rooms.T.n, 1);
});

test('a start in a room that no longer exists is ignored', () => {
  const T = room('T', 'Toddler', 15), k = kid(null, '2025-03');
  const f = forecast({ asOf: '2026-11-16', kids: [k], plans: [{ id: k.id, r: 'GONE', d: '2027-01-04' }] }, { rooms: [T] });
  assert.equal(f.months.every(s => s.total === 0), true);
});

test('operating capacity caps the room and can never exceed the licence', () => {
  const P = room('P', 'Preschool', 24);
  const f = forecast({ asOf: '2026-11-16', kids: fill('P', 22, '2023-01'), plans: [] }, { rooms: [P], caps: { P: 20 } });
  const c = at(f, '2026-11').rooms.P;
  assert.equal(c.cap, 20); assert.equal(c.open, -2); assert.ok(c.flags.some(x => x.level === 'over'));
  const g = forecast({ asOf: '2026-11-16', kids: [], plans: [] }, { rooms: [P], caps: { P: 40 } });
  assert.equal(g.rooms[0].cap, 24);
});

test('a full toddler room blocks the infant move-up', () => {
  const I = room('I', 'Infant', 10), T = room('T', 'Toddler', 15);
  const i = kid('I', '2025-05');                       // 18 months in Nov
  const f = forecast({ asOf: '2026-11-16', kids: [i, ...fill('T', 15, '2025-01')], plans: [] }, { rooms: [I, T] });
  assert.equal(roomOf(f, '2026-11', i.id), 'I');
  assert.equal(at(f, '2026-11').rooms.I.waiting, 1);
});

test('the kindergarten room over its licence is flagged (the 27/26 case)', () => {
  const K1 = RH_ROOMS.find(r => r.id === 'K1');
  const f = forecast({ asOf: '2026-11-16', kids: fill('K1', 27, '2022-01'), plans: [] }, { rooms: [K1] });
  const c = at(f, '2026-11').rooms.K1;
  assert.equal(c.n, 27); assert.equal(c.open, -1); assert.equal(c.staff, 3);
});
