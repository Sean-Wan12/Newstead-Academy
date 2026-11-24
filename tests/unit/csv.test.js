const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { parseCsv, rosterFromCsv, displayName, usDate, RH_ROOMS, forecast } = require('./load.js');

const HEAD = 'First name,Last name,DOB,Age,Classroom,Status,Enroll date,Grad date,Rotation,Schedule';
const row = (f, l, dob, cls, en, gr) => [f, l, dob, '', cls, 'Active', en, gr || '', '', 'MTWRF'].map(v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(',');
const csv = rows => [HEAD].concat(rows).join('\n');
const TODAY = '2026-11-23';
const roomCount = (r, id) => r.kids.filter(k => k.r === id).length;

test('parseCsv: quoted fields, escaped quotes, commas and newlines inside quotes, CRLF', () => {
  const t = parseCsv('a,b,c\r\n"x, y","say ""hi""","two\nlines"\r\n1,2,3\r\n');
  assert.deepEqual(t, [['a', 'b', 'c'], ['x, y', 'say "hi"', 'two\nlines'], ['1', '2', '3']]);
});

test('parseCsv: blank lines and a last line without a newline', () => {
  assert.deepEqual(parseCsv('a,b\n\n1,2'), [['a', 'b'], ['1', '2']]);
});

test('usDate reads M/D/YYYY and rejects anything else', () => {
  assert.equal(usDate('1/4/2027'), '2027-01-04'); assert.equal(usDate(' 11/23/2026 '), '2026-11-23');
  assert.equal(usDate(''), null); assert.equal(usDate('2026-11-23'), null);
});

test('CRLF export with a byte-order mark imports', () => {
  const text = '﻿' + csv([row('Ava', 'Brown', '03/14/2024', 'Toddler 1', '09/01/2026')]).replace(/\n/g, '\r\n') + '\r\n';
  const r = rosterFromCsv(text, RH_ROOMS, TODAY);
  assert.equal(r.kids.length, 1); assert.equal(r.kids[0].r, 'T1'); assert.equal(r.kids[0].b, '2024-03');
});

test('missing columns give a clear error', () => {
  assert.throws(() => rosterFromCsv('First name,Last name,DOB\nA,B,01/01/2024', RH_ROOMS, TODAY), /needs these columns/);
  assert.throws(() => rosterFromCsv(HEAD + '\n', RH_ROOMS, TODAY), /no rows/);
});

test('only first name and last-name initial are stored, never the full last name or birth day', () => {
  const r = rosterFromCsv(csv([row('Mary Ann', 'Fitzgerald', '03/14/2024', 'Toddler 1', '09/01/2026'), row('Jo', 'Zhang', '05/02/2023', 'Preschool 2', '01/04/2027')]), RH_ROOMS, TODAY);
  const stored = JSON.stringify(r);
  assert.ok(!/Fitzgerald|Zhang|Fitz/.test(stored), 'no last names');
  assert.ok(!/2024-03-14|03\/14/.test(stored), 'no birth day');
  assert.deepEqual(r.kids.map(k => k.n).sort(), ['Jo Z.', 'Mary Ann F.']);
  r.kids.forEach(k => assert.deepEqual(Object.keys(k).filter(x => !['id', 'n', 'b', 'r', 's', 'e'].includes(x)), []));
});

test('accented names are kept as Lillio has them', () => {
  const r = rosterFromCsv(csv([row('Zoé', 'Émond', '03/14/2024', 'Toddler 1', '09/01/2026'), row('Seán', 'Ó Briain', '03/14/2024', 'Toddler 2', '09/01/2026')]), RH_ROOMS, TODAY);
  assert.deepEqual(r.kids.map(k => k.n).sort(), ['Seán Ó.', 'Zoé É.']);
  assert.equal(displayName('  Zoé   Anne ', 'émond'), 'Zoé Anne É.');
});

test('children with the same first name and initial get more letters of the last name', () => {
  const r = rosterFromCsv(csv([row('Milo', 'Wallis', '01/01/2024', 'Toddler 1', '09/01/2026'), row('Milo', 'Wendt', '02/01/2024', 'Toddler 2', '09/01/2026'), row('Milo', 'Lark', '02/01/2024', 'Toddler 3', '09/01/2026')]), RH_ROOMS, TODAY);
  assert.deepEqual(r.kids.map(k => k.n).sort(), ['Milo L.', 'Milo Wa.', 'Milo We.']);
});

test('future starts become plans; a room move keeps one child', () => {
  const r = rosterFromCsv(csv([
    row('Liam', 'Park', '05/01/2024', 'Toddler 1', '09/01/2026', '01/03/2027'),
    row('Liam', 'Park', '05/01/2024', 'Preschool 1', '01/04/2027'),
    row('Noah', 'King', '01/01/2025', 'Toddler 3', '01/04/2027')
  ]), RH_ROOMS, TODAY);
  assert.equal(r.kids.length, 2);
  const liam = r.kids.find(k => k.n === 'Liam P.'), noah = r.kids.find(k => k.n === 'Noah K.');
  assert.equal(liam.r, 'T1'); assert.equal(liam.e, '2027-01-03'); assert.equal(noah.r, null);
  assert.deepEqual(r.plans.sort((a, b) => a.id - b.id), [{ id: liam.id, r: 'P1', d: '2027-01-04' }, { id: noah.id, r: 'T3', d: '2027-01-04' }].sort((a, b) => a.id - b.id));
});

test('a start dated today counts today; an end dated today still counts today', () => {
  const r = rosterFromCsv(csv([row('Ada', 'Hill', '01/01/2023', 'Preschool 2', '11/23/2026'), row('Ben', 'Hill', '01/01/2023', 'Preschool 2', '09/01/2026', '11/23/2026'), row('Cy', 'Hill', '01/01/2023', 'Preschool 2', '09/01/2026', '11/22/2026')]), RH_ROOMS, TODAY);
  assert.equal(roomCount(r, 'P2'), 2);
});

test('REGRESSION same child current in two rooms (moved without an end date) is counted once, in the newer room', () => {
  const r = rosterFromCsv(csv([row('Mia', 'Ross', '04/01/2024', 'Toddler 2', '09/01/2025'), row('Mia', 'Ross', '04/01/2024', 'Preschool 2', '11/23/2026')]), RH_ROOMS, TODAY);
  assert.equal(r.kids.length, 1); assert.equal(r.kids[0].r, 'P2'); assert.equal(r.kids[0].s, '2026-11');
});

test('unmatched classrooms are reported, not silently dropped', () => {
  const r = rosterFromCsv(csv([row('Ava', 'Brown', '03/14/2024', 'Toddler 1', '09/01/2026'), row('Eli', 'Gray', '03/14/2021', 'School Age', '09/01/2026'), row('Ivy', 'Gray', '03/14/2021', 'School Age', '09/01/2026'), row('Max', 'Gray', '03/14/2021', '', '09/01/2026')]), RH_ROOMS, TODAY);
  assert.equal(r.kids.length, 1);
  assert.deepEqual(r.skipped, [{ classroom: 'School Age', rows: 2 }, { classroom: '(no classroom)', rows: 1 }]);
});

test('Lillio classroom names match the Richmond Hill rooms, including Kindergarten 2 (licensed as Preschool 4)', () => {
  const names = ['Toddler 1', 'Toddler 2', 'Toddler 3', 'Preschool 1', 'Preschool 2', 'Preschool 3', 'Kindergarten 1', 'Kindergarten 2', 'Preschool 4'];
  const r = rosterFromCsv(csv(names.map((c, i) => row('Kid' + i, 'Lane', '01/0' + (i % 9 + 1) + '/2022', c, '09/01/2026'))), RH_ROOMS, TODAY);
  assert.deepEqual(r.skipped, []);
  assert.deepEqual(r.kids.map(k => k.r), ['T1', 'T2', 'T3', 'P1', 'P2', 'P3', 'K1', 'K2', 'K2']);
});

test("Lillio's 'Test' rows are skipped", () => {
  const r = rosterFromCsv(csv([row('Test', 'Child', '01/01/2024', 'Toddler 1', '09/01/2026'), row('Ava', 'TEST', '01/01/2024', 'Toddler 1', '09/01/2026'), row('Ava', 'Brown', '01/01/2024', 'Toddler 1', '09/01/2026')]), RH_ROOMS, TODAY);
  assert.equal(r.kids.length, 1);
});

test("REGRESSION a real name containing 'test' (Testa, Celestine Contestabile) is not dropped", () => {
  const r = rosterFromCsv(csv([row('Luca', 'Testa', '01/01/2024', 'Toddler 1', '09/01/2026'), row('Celeste', 'Contestabile', '01/01/2023', 'Preschool 1', '09/01/2026')]), RH_ROOMS, TODAY);
  assert.equal(r.kids.length, 2);
});

test('rows with no birth date or enrol date are left out', () => {
  const r = rosterFromCsv(csv([row('Ava', 'Brown', '', 'Toddler 1', '09/01/2026'), row('Ben', 'Brown', '01/01/2024', 'Toddler 1', '')]), RH_ROOMS, TODAY);
  assert.equal(r.kids.length, 0);
});

test('REGRESSION re-importing keeps each child on the same id (contacts, attendance and invoices stay with the right child)', () => {
  const first = rosterFromCsv(csv([row('Ava', 'Brown', '03/14/2024', 'Toddler 1', '09/01/2026'), row('Ben', 'Cole', '03/14/2023', 'Preschool 1', '09/01/2026'), row('Cal', 'Dunn', '03/14/2022', 'Kindergarten 1', '09/01/2026')]), RH_ROOMS, '2026-11-16');
  // Newer export: a new child sorts first, Ben has left, Cal is unchanged, Ava now shares her name with a new Ava B.
  const next = rosterFromCsv(csv([row('Ava', 'Bell', '06/01/2025', 'Toddler 2', '11/18/2026'), row('Zed', 'Ames', '01/01/2025', 'Toddler 3', '11/18/2026'), row('Ava', 'Brown', '03/14/2024', 'Toddler 1', '09/01/2026'), row('Ben', 'Cole', '03/14/2023', 'Preschool 1', '09/01/2026', '11/20/2026'), row('Cal', 'Dunn', '03/14/2022', 'Kindergarten 1', '09/01/2026')]), RH_ROOMS, TODAY, first);
  const id = (r, n) => (r.kids.find(k => k.n === n) || {}).id;
  assert.equal(id(next, 'Cal D.'), id(first, 'Cal D.'));
  assert.equal(id(next, 'Ava Br.'), id(first, 'Ava B.'), 'longer name after a namesake joins keeps the id');
  const used = new Set(first.kids.map(k => k.id));
  assert.ok(!used.has(id(next, 'Zed A.')) && !used.has(id(next, 'Ava Be.')), 'new children never reuse an old id');
  assert.equal(new Set(next.kids.map(k => k.id)).size, next.kids.length, 'ids are unique');
});

test('re-import maps future-start plans to the new ids', () => {
  const first = rosterFromCsv(csv([row('Ava', 'Brown', '03/14/2024', 'Toddler 1', '09/01/2026')]), RH_ROOMS, TODAY);
  const next = rosterFromCsv(csv([row('Noah', 'King', '01/01/2025', 'Toddler 3', '01/04/2027'), row('Ava', 'Brown', '03/14/2024', 'Toddler 1', '09/01/2026')]), RH_ROOMS, TODAY, first);
  const noah = next.kids.find(k => k.n === 'Noah K.');
  assert.deepEqual(next.plans, [{ id: noah.id, r: 'T3', d: '2027-01-04' }]);
});

/* The count of children per room on a date must follow the export's own rule:
   enrolled on or before the date, and no grad date or a grad date on or after it. */
const mdy = s => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s || '').trim()); return m ? m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0') : null; };   // independent of the code under test
function csvCounts(text, date, rooms) {
  const t = parseCsv(text), h = t[0].map(x => x.trim().toLowerCase()), c = n => h.indexOf(n), byName = {};
  rooms.forEach(r => { byName[r.name.toLowerCase()] = r.id; });
  const out = {}, seen = new Set();
  t.slice(1).forEach(row => {
    const f = row[c('first name')], l = row[c('last name')];
    if (/\btest\b/i.test(f + ' ' + l)) return;
    const en = mdy(row[c('enroll date')]), gr = mdy(row[c('grad date')]), id = byName[(row[c('classroom')] || '').trim().toLowerCase()];
    if (!id || !en || !mdy(row[c('dob')])) return;
    if (en <= date && (!gr || gr >= date)) { const k = (f + '|' + l + '|' + row[c('dob')]).toLowerCase(); if (seen.has(k)) out.dupes = (out.dupes || 0) + 1; seen.add(k); out[id] = (out[id] || 0) + 1; }
  });
  return out;
}
const total = (o, rooms) => rooms.reduce((s, r) => s + (o[r.id] || 0), 0);

test('room counts on a date match the enroll/grad date rule (synthetic export)', () => {
  const rows = [];
  for (let i = 0; i < 40; i++) rows.push(row('N' + i, 'S' + i, '0' + (i % 9 + 1) + '/15/202' + (2 + i % 3), ['Toddler 1', 'Preschool 2', 'Kindergarten 1', 'Kindergarten 2'][i % 4], (i % 12 + 1) + '/01/2026', i % 5 === 0 ? '11/' + (10 + i % 20) + '/2026' : ''));
  const text = csv(rows);
  ['2026-11-01', '2026-11-16', '2026-11-23', '2026-12-31'].forEach(d => {
    const r = rosterFromCsv(text, RH_ROOMS, d), want = csvCounts(text, d, RH_ROOMS);
    RH_ROOMS.forEach(room => assert.equal(roomCount(r, room.id), want[room.id] || 0, room.name + ' on ' + d));
  });
});

/* The real Lillio export, when it is on this machine. Counts only: no names are printed. */
const EXPORT = '/mnt/user-data/uploads/9c4dc711-enrollment-47353.csv';
test('real Nov 16 export: room counts match the date rule, and Kindergarten 1 really lists 27 current children', { skip: !fs.existsSync(EXPORT) && 'export not on this machine' }, () => {
  const text = fs.readFileSync(EXPORT, 'utf8');
  ['2026-11-16', '2026-11-23'].forEach(d => {
    const r = rosterFromCsv(text, RH_ROOMS, d), want = csvCounts(text, d, RH_ROOMS);
    assert.deepEqual(r.skipped, []);
    // A child moving rooms on the day is current in two rows of the export; the import counts them once
    assert.equal(r.kids.filter(k => k.r).length, total(want, RH_ROOMS) - (want.dupes || 0), 'children on ' + d);
    if (!want.dupes) RH_ROOMS.forEach(room => assert.equal(roomCount(r, room.id), want[room.id] || 0, room.name + ' on ' + d));
    assert.equal(roomCount(r, 'K1'), 27, 'Kindergarten 1 on ' + d);
  });
  const r = rosterFromCsv(text, RH_ROOMS, '2026-11-23');
  const f = forecast(r, { rooms: RH_ROOMS });
  assert.equal(f.months[0].rooms.K1.open, -1);
});
