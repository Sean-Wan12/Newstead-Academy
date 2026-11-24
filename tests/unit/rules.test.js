const test = require('node:test');
const assert = require('node:assert/strict');
const { RULES, staffNeeded, youngLimit, ageM, fmtAge, rhRoomsFromSite } = require('./load.js');

test('Schedule 1 ratios and maximum group sizes', () => {
  assert.equal(RULES.Infant.ratioText, '3 to 10'); assert.equal(RULES.Infant.maxGroup, 10);
  assert.equal(RULES.Toddler.ratio, 5); assert.equal(RULES.Toddler.maxGroup, 15);
  assert.equal(RULES.Preschool.ratio, 8); assert.equal(RULES.Preschool.maxGroup, 24);
  assert.equal(RULES.Kindergarten.ratio, 13); assert.equal(RULES.Kindergarten.maxGroup, 26);
});

test('age ranges: infant <18m, toddler 18-30m, preschool 30m-6y, kindergarten 44m-7y', () => {
  assert.deepEqual([RULES.Infant.minM, RULES.Infant.maxM], [0, 18]);
  assert.deepEqual([RULES.Toddler.minM, RULES.Toddler.maxM], [18, 30]);
  assert.deepEqual([RULES.Preschool.minM, RULES.Preschool.maxM], [30, 72]);
  assert.deepEqual([RULES.Kindergarten.minM, RULES.Kindergarten.maxM], [44, 84]);
});

test('staff needed: infant 3 to 10 (rounds up, no floating point slip)', () => {
  const cases = [[0, 0], [1, 1], [3, 1], [4, 2], [6, 2], [7, 3], [9, 3], [10, 3]];
  cases.forEach(([n, s]) => assert.equal(staffNeeded(n, RULES.Infant), s, n + ' infants'));
});

test('staff needed: toddler 1:5, preschool 1:8, kindergarten 1:13', () => {
  assert.equal(staffNeeded(15, RULES.Toddler), 3); assert.equal(staffNeeded(16, RULES.Toddler), 4); assert.equal(staffNeeded(5, RULES.Toddler), 1);
  assert.equal(staffNeeded(24, RULES.Preschool), 3); assert.equal(staffNeeded(25, RULES.Preschool), 4); assert.equal(staffNeeded(8, RULES.Preschool), 1);
  assert.equal(staffNeeded(26, RULES.Kindergarten), 2); assert.equal(staffNeeded(27, RULES.Kindergarten), 3); assert.equal(staffNeeded(13, RULES.Kindergarten), 1);
});

test('mixed-age limit is 20% of capacity for toddler and preschool rooms, none for infant and kindergarten', () => {
  assert.equal(youngLimit({ lic: 'Toddler' }, 15), 3);
  assert.equal(youngLimit({ lic: 'Preschool' }, 24), 5);   // 4.8 rounds to 5
  assert.equal(youngLimit({ lic: 'Preschool' }, 10), 2);
  assert.equal(youngLimit({ lic: 'Infant' }, 10), 0);
  assert.equal(youngLimit({ lic: 'Kindergarten' }, 26), 0);
});

test('ageM counts whole months across year boundaries', () => {
  assert.equal(ageM('2024-05', 2026, 11), 30);
  assert.equal(ageM('2024-12', 2025, 1), 1);
  assert.equal(ageM('2025-05', 2026, 11), 18);
  assert.equal(fmtAge(30), '2y 6m'); assert.equal(fmtAge(7), '7m');
});

test('Richmond Hill rooms match the licence (167 spaces; Kindergarten 2 is licensed as Preschool 4)', () => {
  const rooms = rhRoomsFromSite();
  assert.equal(rooms.reduce((s, r) => s + r.licensed, 0), 167);
  const k2 = rooms.find(r => r.name === 'Kindergarten 2');
  assert.equal(k2.licName, 'Preschool 4'); assert.equal(k2.lic, 'Preschool'); assert.equal(k2.licensed, 24);
  rooms.forEach(r => assert.ok(r.licensed <= RULES[r.lic].maxGroup, r.name + ' within the largest group size'));
});
