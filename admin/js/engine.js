/* Capacity forecast engine. Rules only, no estimates.
   forecast(data, opts) steps through each month and moves children between rooms
   using the age rules in rules.js and the rooms of the selected location.
   opts: { rooms, horizon, moveAge, leaveAge, caps: { roomId: n } } */
if (typeof module !== 'undefined' && typeof RULES === 'undefined') Object.assign(globalThis, require('./rules.js'));

function forecast(data, opts) {
  const o = Object.assign({ horizon: 24, moveAge: 30, leaveAge: 6, caps: {} }, opts || {});
  const rooms = (o.rooms || []).map(r => Object.assign({}, r, { cap: Math.min(r.licensed, o.caps[r.id] != null ? o.caps[r.id] : r.licensed) }));
  const byId = {}; rooms.forEach(r => byId[r.id] = r);
  const ofType = t => rooms.filter(r => r.runsAs === t);
  const juniorK = ofType('Kindergarten').filter(r => r.lic !== 'Kindergarten');   // run as kindergarten, licensed as preschool
  const seniorK = ofType('Kindergarten').filter(r => r.lic === 'Kindergarten');
  const kids = {}; data.kids.forEach(k => kids[k.id] = k);
  const where = {};                       // child id -> room id (absent = not enrolled)
  data.kids.forEach(k => { if (k.r && byId[k.r]) where[k.id] = k.r; });
  const start = ym(data.asOf.slice(0, 7));
  const out = [];
  const journey = {};                     // child id -> [{mi, text}]
  const note = (id, mi, text) => { (journey[id] = journey[id] || []).push({ mi, text }); };
  const inRoom = rid => Object.keys(where).filter(id => where[id] === rid).map(Number);
  const count = rid => inRoom(rid).length;
  const hasSpace = r => count(r.id) < r.cap;
  const oldest = (a, b) => kids[a].b < kids[b].b ? -1 : kids[a].b > kids[b].b ? 1 : a - b;

  for (let mi = 0; mi <= o.horizon; mi++) {
    const idx = start.m - 1 + mi, y = start.y + Math.floor(idx / 12), m = idx % 12 + 1;
    const label = MONTHS[m - 1] + ' ' + y, key = y + '-' + String(m).padStart(2, '0');
    const ev = {}; rooms.forEach(r => ev[r.id] = []);
    const age = id => ageM(kids[id].b, y, m);
    const tag = id => kids[id].n + ' (' + fmtAge(age(id)) + ')';
    const move = (id, to, why) => {
      const from = where[id];
      if (from) ev[from].push({ dir: 'out', id, text: tag(id) + ' moves to ' + byId[to].name, why });
      ev[to].push({ dir: 'in', id, text: tag(id) + (from ? ' moves in from ' + byId[from].name : ' starts'), why });
      where[id] = to;
      note(id, mi, (from ? 'Moves to ' : 'Starts in ') + byId[to].name + ' (' + why + ')');
    };
    const leave = (id, why) => {
      ev[where[id]].push({ dir: 'out', id, text: tag(id) + ' leaves the centre', why });
      note(id, mi, 'Leaves the centre (' + why + ')');
      delete where[id];
    };
    // Move each child, oldest first, to the room with the most space that passes ok()
    const moveUp = (ids, targets, ok, why) => ids.sort(oldest).forEach(id => {
      const options = targets.filter(r => hasSpace(r) && ok(r, id)).sort((a, b) => (b.cap - count(b.id)) - (a.cap - count(a.id)));
      if (options.length) move(id, options[0].id, why(id));
    });

    // 1. End dates recorded in the roster
    Object.keys(where).map(Number).forEach(id => {
      const e = kids[id].e; if (e && e.slice(0, 7) === key) leave(id, 'end date recorded in Lillio');
    });
    // 2. September: school leavers, then kindergarten moves
    if (m === 9) {
      Object.keys(where).map(Number).forEach(id => {
        if (ym(kids[id].b).y <= y - o.leaveAge) leave(id, 'turns ' + o.leaveAge + ' in ' + y + ', starts school in September');
      });
      // senior kindergarten children in a junior kindergarten class consolidate into the senior class where there is room
      juniorK.flatMap(r => inRoom(r.id)).filter(id => ym(kids[id].b).y <= y - 5).sort(oldest).forEach(id => {
        const to = seniorK.find(hasSpace);
        if (to) move(id, to.id, 'turns 5 in ' + y + ', senior kindergarten');
      });
      // preschoolers turning 4 this year move to a kindergarten class
      ofType('Preschool').flatMap(r => inRoom(r.id)).filter(id => ym(kids[id].b).y <= y - 4).sort(oldest).forEach(id => {
        const to = juniorK.find(hasSpace) || seniorK.find(r => hasSpace(r) && age(id) >= RULES.Kindergarten.minM);
        if (to) move(id, to.id, 'turns 4 in ' + y + ', kindergarten class starts in September');
      });
    }
    // 3. Starts and moves already recorded in the roster
    data.plans.forEach(p => { if (p.d.slice(0, 7) === key && byId[p.r]) move(p.id, p.r, 'start date recorded in Lillio'); });
    // 4. A child reaching 6 cannot stay in a preschool-licensed room
    rooms.filter(r => r.lic === 'Preschool').flatMap(r => inRoom(r.id)).forEach(id => {
      const to = seniorK.find(hasSpace);
      if (age(id) >= RULES.Preschool.maxM && to) move(id, to.id, 'reaches 6 years, the upper limit of a preschool licence');
    });
    // 5. Toddlers move up to preschool, oldest first, where the rules allow
    moveUp(ofType('Toddler').flatMap(r => inRoom(r.id)).filter(id => age(id) >= o.moveAge), ofType('Preschool'),
      (r, id) => age(id) >= RULES.Preschool.minM || inRoom(r.id).filter(c => age(c) < RULES.Preschool.minM).length < youngLimit(r, r.cap),
      id => age(id) < RULES.Preschool.minM ? 'early move at ' + age(id) + ' months under mixed-age approval' : 'reached 30 months, preschool age');
    // 6. Infants move up to a toddler room at 18 months
    moveUp(ofType('Infant').flatMap(r => inRoom(r.id)).filter(id => age(id) >= RULES.Infant.maxM), ofType('Toddler'), () => true, () => 'reached 18 months, toddler age');

    // Snapshot at month end
    const snap = { mi, y, m, label, key, rooms: {} };
    rooms.forEach(r => {
      const ids = inRoom(r.id), rule = RULES[r.lic], flags = [];
      const young = ids.filter(id => age(id) < rule.minM), old = ids.filter(id => age(id) >= rule.maxM);
      const yl = youngLimit(r, r.cap);
      if (ids.length > r.cap) flags.push({ level: 'over', text: (ids.length - r.cap) + ' more than the room allows' });
      if (old.length) flags.push({ level: 'wait', text: old.length + (old.length === 1 ? ' child is ' : ' children are ') + (r.lic === 'Toddler' ? '30 months or older and waiting for a preschool space' : r.lic === 'Infant' ? '18 months or older and waiting for a toddler space' : 'past the upper age of this licence and waiting for a space'), ids: old });
      if (young.length > yl) flags.push({ level: 'over', text: young.length + ' children younger than the licence age range; the mixed-age limit is ' + yl });
      snap.rooms[r.id] = {
        ids: ids.sort((a, b) => kids[a].b < kids[b].b ? -1 : 1), n: ids.length, cap: r.cap, open: r.cap - ids.length,
        young: young.length, youngLimit: yl, waiting: old.length,
        staff: staffNeeded(ids.length, rule), ratio: rule.ratio, ratioText: rule.ratioText, flags, events: ev[r.id]
      };
    });
    snap.total = rooms.reduce((s, r) => s + snap.rooms[r.id].n, 0);
    out.push(snap);
  }
  return { months: out, rooms, journey, opts: o };
}
if (typeof module !== 'undefined') module.exports = { forecast };
