/* Loads the browser scripts from admin/js into Node for unit tests.
   rules.js and engine.js export themselves; setup.js needs a few page globals stubbed. */
const path = require('path');
const JS = path.join(process.env.NA_ADMIN || path.join(__dirname, '..', '..', 'admin'), 'js');   // NA_ADMIN: test another copy of the site
const rules = require(path.join(JS, 'rules.js'));
Object.assign(globalThis, rules);
const { forecast } = require(path.join(JS, 'engine.js'));
globalThis.LOCATION_IDS = []; globalThis.LOCATIONS = {}; globalThis.watch = () => () => {};
const setup = require(path.join(JS, 'setup.js'));
const RH_ROOMS = [
  { id: 'T1', name: 'Toddler 1', licName: 'Toddler 1', lic: 'Toddler', runsAs: 'Toddler', licensed: 15 },
  { id: 'T2', name: 'Toddler 2', licName: 'Toddler 2', lic: 'Toddler', runsAs: 'Toddler', licensed: 15 },
  { id: 'T3', name: 'Toddler 3', licName: 'Toddler 3', lic: 'Toddler', runsAs: 'Toddler', licensed: 15 },
  { id: 'P1', name: 'Preschool 1', licName: 'Preschool 1', lic: 'Preschool', runsAs: 'Preschool', licensed: 24 },
  { id: 'P2', name: 'Preschool 2', licName: 'Preschool 2', lic: 'Preschool', runsAs: 'Preschool', licensed: 24 },
  { id: 'P3', name: 'Preschool 3', licName: 'Preschool 3', lic: 'Preschool', runsAs: 'Preschool', licensed: 24 },
  { id: 'K2', name: 'Kindergarten 2', licName: 'Preschool 4', lic: 'Preschool', runsAs: 'Kindergarten', licensed: 24 },
  { id: 'K1', name: 'Kindergarten 1', licName: 'Kindergarten 1', lic: 'Kindergarten', runsAs: 'Kindergarten', licensed: 26 }
];
/* Read RH rooms from locations.js itself, so the tests break if the licence rooms change */
function rhRoomsFromSite() {
  const fs = require('fs'), vm = require('vm');
  const src = fs.readFileSync(path.join(JS, 'locations.js'), 'utf8');
  const ctx = { window: {}, todayISO: () => '2026-11-23', module: { exports: {} } };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return ctx.module.exports.LOCATIONS.rh.rooms;
}
module.exports = Object.assign({ forecast, RH_ROOMS, rhRoomsFromSite }, rules, setup);
