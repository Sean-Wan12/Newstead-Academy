/* Print the capacity forecast as a table in the terminal, to check the engine.
   Usage: node tools/check_forecast.js [rh] [moveAge] [leaveAge]
   Needs admin/data/richmond-hill.js (build it with tools/make_roster.py). */
const path = require('path');
const { forecast } = require(path.join(__dirname, '..', 'admin', 'js', 'engine.js'));
global.window = {}; global.todayISO = () => new Date().toISOString().slice(0, 10);
require(path.join(__dirname, '..', 'admin', 'js', 'locations.js'));
const [, , loc = 'rh', moveAge = 30, leaveAge] = process.argv;
try { require(path.join(__dirname, '..', 'admin', 'data', 'richmond-hill.js')); } catch (e) { console.error('No roster file: run tools/make_roster.py first.'); process.exit(1); }
const L = LOCATIONS[loc], f = forecast(window.RH_DATA, { rooms: L.rooms, moveAge: +moveAge, leaveAge: +(leaveAge || L.defaults.leaveAge) });
console.log('Open spaces at month end, ' + L.full + ' (negative = over the limit)');
console.log('Month     ' + f.rooms.map(r => r.id.padStart(5)).join('') + '  Total');
f.months.forEach(s => console.log(s.label.padEnd(10) + f.rooms.map(r => String(s.rooms[r.id].open).padStart(5)).join('') + String(s.total).padStart(7)));
