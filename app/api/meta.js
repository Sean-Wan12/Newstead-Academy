/* GET /api/meta: reference data for the front-end (any signed-in user or tablet):
   Ontario rules, daily entry types and their fields, absence reasons, today's date and
   the time in the centres' time zone. */
'use strict';
const { RULES, AGE_GROUPS } = require('../lib/rules');
const { entryTypesForClient, ABSENT_REASONS, ABSENT_LABELS } = require('../lib/entry-types');
const { todayISO, nowHM, TZ } = require('../lib/dates');

async function meta() {
  return { rules: RULES, ageGroups: AGE_GROUPS, entryTypes: entryTypesForClient(), absentReasons: ABSENT_REASONS.map((v, i) => ({ value: v, label: ABSENT_LABELS[i] })), today: todayISO(), now: nowHM(), timeZone: TZ };
}

module.exports = { routes: [{ method: 'GET', path: '/api/meta', handler: meta }] };
