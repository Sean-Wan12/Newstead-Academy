/* GET /api/forecast?location=&horizon=&moveAge=&leaveAge=   admin
   The month-by-month capacity forecast (rules only, no estimates) from children's birth
   months and booked placements. Defaults come from the location (leaveAge 6 for Richmond Hill,
   4 for Markham, which has no kindergarten room). */
'use strict';
const { check } = require('../lib/validate');
const { todayISO } = require('../lib/dates');
const { requireAdmin } = require('../lib/permissions');
const { mustGet } = require('../lib/records');
const { buildForecast } = require('../lib/forecast-input');
const { ADMINS } = require('./_util');

async function get({ p, query }) {
  const v = check(query, { location: { type: 'id', required: true }, horizon: { type: 'int', min: 1, max: 36 }, moveAge: { type: 'int', min: 18, max: 36 }, leaveAge: { type: 'int', min: 3, max: 7 } });
  requireAdmin(p, v.location);
  const loc = await mustGet('locations', v.location, 'Location');
  const d = loc.forecastDefaults || {};
  return buildForecast(loc.id, todayISO(), { horizon: v.horizon || 24, moveAge: v.moveAge || d.moveAge || 30, leaveAge: v.leaveAge || d.leaveAge || 6 });
}

module.exports = { routes: [{ method: 'GET', path: '/api/forecast', roles: ADMINS, handler: get }] };
