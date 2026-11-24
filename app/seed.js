/* Creates FAKE demo data for local development: node app/seed.js [--reset] [--quiet-day]
   Every child, guardian and staff name here is invented ("Clover Demo-014"); phone numbers use
   the fictional 555-01xx range and emails use example.test. Nothing is copied from admin/data
   or any export. Richmond Hill uses its real licensed room list and capacities; Markham's rooms
   are placeholders until its licence details are entered.
   --reset      wipe app/.data first (required if data already exists)
   --quiet-day  do not create today's sample attendance, staff shifts and entries */
'use strict';
const { getStore } = require('./lib/storage');
const { hashSecret } = require('./lib/passwords');
const { LOCATIONS, RH_ROOMS, MK_PLACEHOLDER_ROOMS } = require('./lib/locations');
const { todayISO, addDays, weekdayKey } = require('./lib/dates');

if (process.env.NODE_ENV === 'production' || (process.env.STORAGE && process.env.STORAGE !== 'json')) {
  console.error('seed.js only runs against local JSON storage, never production.'); process.exit(1);
}

// Deterministic random numbers so every seed gives the same demo data
let s = 20261123;
const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n, w) => String(n).padStart(w, '0');
let idn = 0;
const id = prefix => prefix + pad(++idn, 5);

const FIRST = ['Acorn', 'Bramble', 'Clover', 'Dune', 'Ember', 'Fable', 'Gale', 'Hazel', 'Indigo', 'Juniper', 'Kestrel', 'Lark', 'Moss', 'Nimbus', 'Opal', 'Pebble', 'Quill', 'Rowan', 'Sorrel', 'Thistle', 'Umber', 'Vale', 'Wren', 'Yarrow', 'Zephyr', 'Aster', 'Briar', 'Cobble', 'Dandelion', 'Fennel'];

const DEMO = {
  owner: { email: 'owner@demo.newstead.test', password: 'Owner-demo-2026', name: 'Demo Owner' },
  admins: [
    { email: 'super.rh@demo.newstead.test', password: 'Super-demo-2026', name: 'Demo Supervisor (Richmond Hill)', loc: 'rh' },
    { email: 'super.mk@demo.newstead.test', password: 'Super-demo-2026', name: 'Demo Supervisor (Markham)', loc: 'mk' }
  ],
  teacherPassword: 'Teacher-demo-2026',
  devicePassword: 'Tablet-demo-2026'
};

/* Age in months for a new child placed in a room of this kind */
function ageRange(room) {
  if (room.ageGroup === 'Infant') return [5, 17];
  if (room.ageGroup === 'Toddler') return [18, 29];
  if (room.runsAs === 'Kindergarten' && room.ageGroup === 'Preschool') return [45, 58];
  if (room.ageGroup === 'Kindergarten') return [50, 68];
  return [30, 46];
}
function dobForAge(today, months) {
  const [y, m] = today.split('-').map(Number), idx = (y * 12 + m - 1) - months;
  return Math.floor(idx / 12) + '-' + pad(idx % 12 + 1, 2) + '-' + pad(int(1, 28), 2);
}

async function main() {
  const store = getStore(), reset = process.argv.includes('--reset'), quiet = process.argv.includes('--quiet-day');
  const existing = await store.list('users');
  if (existing.length && !reset) { console.error('Demo data already exists. Run with --reset to wipe app/.data and start again.'); process.exit(1); }
  if (reset) await store.clearAll();
  const today = todayISO(), now = new Date().toISOString();

  for (const [i, l] of LOCATIONS.entries()) await store.put('locations', Object.assign({ createdAt: now, sort: i + 1 }, l));

  const rooms = { rh: [], mk: [] };
  let sort = 0;
  for (const [loc, list] of [['rh', RH_ROOMS], ['mk', MK_PLACEHOLDER_ROOMS]]) {
    for (const r of list) {
      const room = Object.assign({ id: loc + '-' + r.code.toLowerCase(), locationId: loc, operatingCapacity: r.licensedCapacity, mixedAgeApproved: loc === 'rh', archived: false, sort: ++sort, createdAt: now }, r);
      await store.put('rooms', room); rooms[loc].push(room);
    }
  }

  // Accounts
  const users = [];
  const addUser = async (u, pw) => { const rec = Object.assign({ active: true, mustChangePassword: false, createdAt: now, pinHash: null, locationIds: [], roomIds: [] }, u, { passwordHash: await hashSecret(pw) }); await store.put('users', rec); users.push(rec); return rec; };
  await addUser({ id: 'u-owner', email: DEMO.owner.email, name: DEMO.owner.name, role: 'owner', title: 'Owner' }, DEMO.owner.password);
  for (const a of DEMO.admins) await addUser({ id: 'u-super-' + a.loc, email: a.email, name: a.name, role: 'admin', title: 'Supervisor', locationIds: [a.loc], pinHash: await hashSecret(a.loc === 'rh' ? '7391' : '7392') }, a.password);
  const teachers = [], assistants = [];
  let pinN = 2580;
  for (const loc of ['rh', 'mk']) {
    for (const r of rooms[loc]) {
      const code = r.code.toLowerCase(), pin = String(pinN++);
      const t = await addUser({ id: 'u-t-' + loc + '-' + code, email: 'teacher.' + loc + '.' + code + '@demo.newstead.test', name: 'Demo Teacher ' + r.name + (loc === 'mk' ? ' (MK)' : ''), role: 'teacher', title: 'RECE',
        locationIds: [loc], roomIds: [r.id], pinHash: await hashSecret(pin) }, DEMO.teacherPassword);
      teachers.push({ user: t, room: r, pin });
      // A second educator per room, so the ratio check has someone to count
      const pin2 = String(+pin + 100);
      const t2 = await addUser({ id: 'u-t-' + loc + '-' + code + 'b', email: 'teacher.' + loc + '.' + code + 'b@demo.newstead.test', name: 'Demo Assistant ' + r.name + (loc === 'mk' ? ' (MK)' : ''), role: 'teacher', title: 'Educator',
        locationIds: [loc], roomIds: [r.id], pinHash: await hashSecret(pin2) }, DEMO.teacherPassword);
      assistants.push({ user: t2, room: r, pin: pin2 });
    }
  }
  // A floater who covers two rooms
  const floater = await addUser({ id: 'u-t-rh-float', email: 'teacher.rh.float@demo.newstead.test', name: 'Demo Floater (Richmond Hill)', role: 'teacher', title: 'Educator', locationIds: ['rh'], roomIds: ['rh-p1', 'rh-p2'], pinHash: await hashSecret('2468') }, DEMO.teacherPassword);

  // Classroom tablet logins: one per room, like Lillio's classroom logins
  const devices = [];
  for (const loc of ['rh', 'mk']) for (const r of rooms[loc]) {
    const d = { id: 'd-' + r.id, locationId: loc, name: r.name + ' tablet', username: loc + '-' + r.name.toLowerCase().replace(/\s+/g, '-'), roomIds: [r.id], active: true, createdAt: now, passwordHash: await hashSecret(DEMO.devicePassword) };
    await store.put('devices', d); devices.push(d);
  }

  // Children, placements and guardians
  let childN = 0;
  const allKids = [];
  for (const loc of ['rh', 'mk']) {
    for (const r of rooms[loc]) {
      const n = Math.max(1, Math.round(r.licensedCapacity * (loc === 'rh' ? 0.6 + rnd() * 0.3 : 0.5 + rnd() * 0.3)));
      for (let i = 0; i < n; i++) {
        childN++;
        const [lo, hi] = ageRange(r), age = int(lo, hi);
        const child = { id: id('c'), locationId: loc, firstName: pick(FIRST), lastName: 'Demo-' + pad(childN, 3), preferredName: '', dateOfBirth: dobForAge(today, age), status: 'active',
          allergies: rnd() < 0.12 ? pick(['Peanuts (demo)', 'Dairy (demo)', 'Eggs (demo)']) : '', medicalNotes: '', dietaryNotes: rnd() < 0.08 ? 'Vegetarian (demo)' : '', notes: '', photoPermission: rnd() < 0.8, createdAt: now };
        await store.put('children', child);
        const part = rnd() < 0.15;
        const en = { id: id('e'), childId: child.id, roomId: r.id, locationId: loc, startDate: addDays(today, -int(20, 300)), endDate: null, days: part ? ['mon', 'wed', 'fri'] : ['mon', 'tue', 'wed', 'thu', 'fri'], notes: '', createdAt: now };
        await store.put('enrollments', en);
        allKids.push({ child, room: r, en });
        const g = { id: id('g'), locationId: loc, childIds: [child.id], firstName: pick(['Demo', 'Sample', 'Test']), lastName: 'Parent-' + pad(childN, 3), relationship: pick(['Parent', 'Mother', 'Father', 'Guardian']),
          phone: '(555) 01' + pad(childN % 100, 2) + '-' + pad(int(0, 9999), 4), email: 'guardian' + pad(childN, 3) + '@example.test', isGuardian: true, authorizedPickup: true, emergencyContact: true, notes: '', createdAt: now };
        await store.put('contacts', g);
        if (rnd() < 0.4) await store.put('contacts', { id: id('g'), locationId: loc, childIds: [child.id], firstName: 'Demo', lastName: 'Grandparent-' + pad(childN, 3), relationship: 'Grandparent', phone: '(555) 0199-' + pad(int(0, 9999), 4), email: null, isGuardian: false, authorizedPickup: true, emergencyContact: true, notes: '', createdAt: now });
      }
    }
  }
  // A few upcoming starts and one booked room move, so the forecast has plans
  for (let i = 0; i < 4; i++) {
    childN++;
    const r = rooms.rh[i % 3];
    const c = { id: id('c'), locationId: 'rh', firstName: pick(FIRST), lastName: 'Demo-' + pad(childN, 3), preferredName: '', dateOfBirth: dobForAge(today, int(16, 20)), status: 'upcoming', allergies: '', medicalNotes: '', dietaryNotes: '', notes: 'Upcoming start (demo)', photoPermission: true, createdAt: now };
    await store.put('children', c);
    await store.put('enrollments', { id: id('e'), childId: c.id, roomId: r.id, locationId: 'rh', startDate: addDays(today, 30 * (i + 1)), endDate: null, days: ['mon', 'tue', 'wed', 'thu', 'fri'], notes: '', createdAt: now });
  }
  // One child with a booked leaving date (shows in the forecast)
  const w = allKids.find(k => k.room.id === 'rh-p3');
  if (w) { w.en.endDate = addDays(today, 45); await store.put('enrollments', w.en); }

  // Today's sample activity
  if (!quiet && !['sat', 'sun'].includes(weekdayKey(today))) {
    const t = (h, m) => pad(h, 2) + ':' + pad(m, 2);
    for (const { child, room, en } of allKids) {
      if (!en.days.includes(weekdayKey(today))) continue;
      const roll = rnd(), teacher = teachers.find(x => x.room.id === room.id).user, by = { id: teacher.id, name: teacher.name };
      if (roll < 0.08) {
        await store.put('attendance', { id: today + '_' + child.id, childId: child.id, locationId: child.locationId, roomId: room.id, date: today, status: 'absent', checkIn: null, checkOut: null, absent: { reason: pick(['sick', 'vacation', 'no_reason']), note: '', by, at: now }, history: [] });
      } else if (roll < 0.8) {
        const inT = t(7 + int(0, 1), int(0, 59));
        await store.put('attendance', { id: today + '_' + child.id, childId: child.id, locationId: child.locationId, roomId: room.id, date: today, status: 'in', checkIn: { time: inT, by, at: now, person: 'Demo parent' }, checkOut: null, absent: null, history: [] });
        if (rnd() < 0.5) await store.put('entries', { id: id('n'), type: 'meal', childId: child.id, roomId: room.id, locationId: child.locationId, date: today, time: '09:30', data: { meal: 'am_snack', amount: pick(['all', 'most', 'some']), items: 'Apple slices and crackers (demo)' }, groupId: null, createdBy: by, createdAt: now });
      }
    }
    // Staff in rooms: most rooms have enough, a couple are short so the dashboard shows both
    // Lead educators are all in; assistants are in except in Toddler 2 and Preschool 3, which show as short
    for (const { user, room } of teachers.concat(assistants.filter(a => !['rh-t2', 'rh-p3'].includes(a.room.id)))) {
      await store.put('staffShifts', { id: id('s'), userId: user.id, userName: user.name, locationId: room.locationId, roomId: room.id, date: today, in: '07:00', out: null, inBy: { id: user.id, name: user.name }, createdAt: now });
    }
    await store.put('staffShifts', { id: id('s'), userId: floater.id, userName: floater.name, locationId: 'rh', roomId: 'rh-p1', date: today, in: '08:00', out: null, inBy: { id: floater.id, name: floater.name }, createdAt: now });
    const inc = allKids.find(x => x.room.id === 'rh-t1');
    if (inc) await store.put('entries', { id: id('n'), type: 'incident', childId: inc.child.id, roomId: 'rh-t1', locationId: 'rh', date: today, time: '10:15', data: { kind: 'injury', description: 'Demo: bumped knee on the slide. No swelling.', actionTaken: 'Ice pack for 5 minutes (demo).', parentNotified: false, notifiedAt: null }, groupId: null, createdBy: { id: 'u-t-rh-t1', name: 'Demo Teacher Toddler 1' }, createdAt: now });
  }

  console.log('Seeded demo data in app/.data for ' + today + ': ' + allKids.length + ' children, ' + users.length + ' staff accounts, ' + devices.length + ' classroom tablets.');
  console.log('Owner:       ' + DEMO.owner.email + ' / ' + DEMO.owner.password);
  DEMO.admins.forEach(a => console.log('Supervisor:  ' + a.email + ' / ' + a.password));
  console.log('Teachers:    teacher.<loc>.<room code>@demo.newstead.test / ' + DEMO.teacherPassword + '   e.g. teacher.rh.t1@demo.newstead.test (PIN ' + teachers[0].pin + ')');
  console.log('Tablets:     ' + devices[0].username + ', ' + devices[3].username + ', ... / ' + DEMO.devicePassword);
  console.log('Teacher PINs: ' + teachers.map(x => x.room.id + '=' + x.pin).join(' ') + ' floater=2468; supervisors rh=7391 mk=7392');
  console.log('Assistant PINs (emails end in "b@"): ' + assistants.map(x => x.room.id + '=' + x.pin).join(' '));
}

main().catch(e => { console.error(e); process.exit(1); });
