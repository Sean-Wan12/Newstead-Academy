/* Shared bits for the API handlers: role lists, a 201 response, and the rule that
   teachers and classroom tablets only record for today while supervisors may correct any date. */
'use strict';
const { fail } = require('../lib/http');
const { todayISO } = require('../lib/dates');
const { isAdminFor } = require('../lib/permissions');

const ADMINS = ['owner', 'admin'];
const STAFF = ['owner', 'admin', 'teacher', 'device'];
const PEOPLE = ['owner', 'admin', 'teacher'];

const created = body => ({ __status: 201, body });

/* Teachers and tablets work on today only; admins of the location may use any date */
function checkDateAllowed(p, locationId, date) {
  if (!isAdminFor(p, locationId) && date !== todayISO()) fail(403, 'Teachers can only record for today. Ask a supervisor to correct other days.');
}

/* Reads: teachers and tablets see today only; admins of the location may look at any date */
function checkReadDate(p, locationId, date) {
  if (!isAdminFor(p, locationId) && date !== todayISO()) fail(403, 'Teachers can see today only. Ask a supervisor for other days.');
}

module.exports = { ADMINS, STAFF, PEOPLE, created, checkDateAllowed, checkReadDate };
