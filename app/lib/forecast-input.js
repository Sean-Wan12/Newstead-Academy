/* Turns stored rooms, children and placements into the input the forecast engine expects
   (lib/engine.js, ported unchanged from admin/js/engine.js), and maps its numeric child ids
   back to names and ids for the response.
   - rooms: licensed age group (lic), how it runs (runsAs), licensed capacity; operating capacity becomes caps
   - each active or upcoming child with a placement today (r) and the end date of their last placement (e)
   - placements starting after today become plans (starts and moves already booked) */
'use strict';
const { getStore } = require('./storage');
const { inRange } = require('./dates');
const { forecast } = require('./engine');

async function buildForecast(locationId, asOf, opts) {
  const store = getStore();
  const rooms = (await store.query('rooms', r => r.locationId === locationId && !r.archived)).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const children = await store.query('children', c => c.locationId === locationId && !c.deleted && c.status !== 'withdrawn');
  const ens = await store.query('enrollments', e => e.locationId === locationId && !e.deleted);
  const num = new Map(), back = {};
  children.forEach((c, i) => { num.set(c.id, i + 1); back[i + 1] = { id: c.id, name: (c.preferredName || c.firstName) + ' ' + c.lastName.charAt(0) + '.', birth: c.dateOfBirth }; });
  const kids = [], plans = [];
  for (const c of children) {
    const mine = ens.filter(e => e.childId === c.id).sort((a, b) => a.startDate.localeCompare(b.startDate));
    const cur = mine.filter(e => inRange(asOf, e.startDate, e.endDate)).pop();
    const last = mine[mine.length - 1];
    kids.push({ id: num.get(c.id), n: back[num.get(c.id)].name, b: c.dateOfBirth.slice(0, 7), e: last && last.endDate && last.endDate >= asOf ? last.endDate : null, r: cur ? cur.roomId : null });
    mine.filter(e => e.startDate > asOf).forEach(e => plans.push({ id: num.get(c.id), r: e.roomId, d: e.startDate }));
  }
  const caps = {}; rooms.forEach(r => { if (r.operatingCapacity != null && r.operatingCapacity < r.licensedCapacity) caps[r.id] = r.operatingCapacity; });
  const engRooms = rooms.map(r => ({ id: r.id, name: r.name, lic: r.ageGroup, runsAs: r.runsAs || r.ageGroup, licensed: r.licensedCapacity }));
  const result = forecast({ asOf, kids, plans }, Object.assign({ rooms: engRooms, caps }, opts));
  return { asOf, rooms: result.rooms, months: result.months, journey: result.journey, opts: result.opts, children: back };
}

module.exports = { buildForecast };
