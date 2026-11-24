/* The API entry point. handleApi(req, res) is used by server.js in development and can be
   wrapped as a single Vercel serverless function later (api/[...path].js calling it), or each
   resource file can become its own function, since handlers only take a context object.
   For every request it: checks the origin of state-changing requests, reads the JSON body,
   loads the session, builds the "principal" (who is asking and what they may reach),
   enforces the route's role list, runs the handler and sends JSON. */
'use strict';
const { getStore } = require('../lib/storage');
const { HttpError, sendJson, readJsonBody, setSecurityHeaders } = require('../lib/http');
const { loadSession, saveSession, destroySession } = require('../lib/sessions');
const { originOk } = require('../lib/origin');

const ROUTES = [].concat(
  require('./auth').routes, require('./meta').routes, require('./locations').routes, require('./rooms').routes,
  require('./children').routes, require('./enrollments').routes, require('./contacts').routes,
  require('./users').routes, require('./devices').routes, require('./attendance').routes,
  require('./staff-attendance').routes, require('./entries').routes, require('./timeline').routes,
  require('./dashboard').routes, require('./forecast').routes, require('./audit').routes
).map(r => Object.assign({}, r, { re: new RegExp('^' + r.path.replace(/:(\w+)/g, '(?<$1>[A-Za-z0-9_-]{1,64})') + '/?$') }));

const ACTING_IDLE = 10 * 60e3;   // a PIN unlock on a tablet lasts 10 minutes after the last change made

/* Who is asking. Returns null if not signed in or the account is no longer active. */
async function buildPrincipal(session, method) {
  if (!session) return null;
  const store = getStore();
  const allLocs = (await store.list('locations')).map(l => l.id);
  if (session.kind === 'user') {
    const u = await store.get('users', session.subjectId);
    if (!u || !u.active || u.deleted) return null;
    return { kind: 'user', role: u.role, id: u.id, name: u.name, email: u.email, mustChangePassword: !!u.mustChangePassword,
      locationIds: u.role === 'owner' ? allLocs : (u.locationIds || []), roomIds: u.roomIds || [], actor: { id: u.id, name: u.name }, session };
  }
  if (session.kind === 'device') {
    const d = await store.get('devices', session.subjectId);
    if (!d || !d.active || d.deleted) return null;
    let actor = null;
    if (session.actingUserId && session.actingUntil > Date.now()) {
      const u = await store.get('users', session.actingUserId);
      if (u && u.active && !u.deleted) {
        actor = { id: u.id, name: u.name };
        // Only writes count as use: the panel's background refresh must not keep a PIN unlocked forever
        const write = method && method !== 'GET' && method !== 'HEAD';
        if (write && session.actingUntil - Date.now() < ACTING_IDLE - 60e3) { session.actingUntil = Date.now() + ACTING_IDLE; await saveSession(session); }
      }
    }
    return { kind: 'device', role: 'device', id: d.id, name: d.name, locationIds: [d.locationId], roomIds: d.roomIds || [], actor, actingUntil: actor ? session.actingUntil : 0, session };
  }
  return null;
}

async function handleApi(req, res) {
  setSecurityHeaders(res);
  try {
    const url = new URL(req.url, 'http://localhost');
    let route = null, params = {};
    const pathMatches = ROUTES.filter(r => r.re.test(url.pathname));
    for (const r of pathMatches) if (r.method === req.method) { route = r; params = Object.assign({}, url.pathname.match(r.re).groups); break; }
    if (!route) throw new HttpError(pathMatches.length ? 405 : 404, pathMatches.length ? 'Method not allowed' : 'No such API endpoint');
    if (!originOk(req)) throw new HttpError(403, 'Cross-site request refused');

    const body = await readJsonBody(req);
    const session = await loadSession(req);
    const p = await buildPrincipal(session, req.method);
    if (session && !p) await destroySession(req, res, session);
    if (!route.public) {
      if (!p) throw new HttpError(401, 'Please sign in');
      if (p.mustChangePassword && !route.allowWithTempPassword) throw new HttpError(403, 'Choose a new password first', { code: 'password_change_required' });
      if (route.roles && !route.roles.includes(p.role)) throw new HttpError(403, 'You do not have permission to do that');
    }
    const query = Object.fromEntries(url.searchParams.entries());
    const result = await route.handler({ req, res, params, query, body, p, session });
    if (!res.headersSent) {
      if (result && result.__status) sendJson(res, result.__status, result.body);
      else sendJson(res, 200, result === undefined ? { ok: true } : result);
    }
  } catch (e) {
    if (res.headersSent) return;
    if (e instanceof HttpError) {
      const headers = e.details && e.details.retryAfter ? { 'Retry-After': String(e.details.retryAfter) } : undefined;
      sendJson(res, e.status, { error: e.message, details: e.details || null }, headers);
    } else {
      console.error('API error', req.method, req.url, e);
      sendJson(res, 500, { error: 'Something went wrong on the server' });
    }
  }
}

/* Route list for the README and tests */
const routeTable = () => ROUTES.map(r => ({ method: r.method, path: r.path, roles: r.public ? 'public' : (r.roles || ['any signed-in']).join(', ') }));

module.exports = { handleApi, routeTable, buildPrincipal };
