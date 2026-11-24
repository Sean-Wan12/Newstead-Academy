/* Calls the JSON API. Cookies are sent automatically (same origin). A 401 sends the browser
   to the sign-in page; other errors throw ApiError with the server's message. */

export class ApiError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details || {}; }
  get code() { return this.details && this.details.code; }
}

async function call(method, path, body, query) {
  let url = path;
  if (query) {
    const q = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, v); });
    const s = q.toString(); if (s) url += '?' + s;
  }
  const opts = { method, headers: { Accept: 'application/json' }, credentials: 'same-origin' };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(url, opts); } catch (e) { throw new ApiError(0, 'Cannot reach the server. Check the connection and try again.'); }
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (res.status === 401 && !path.startsWith('/api/auth/')) { location.href = '/login?next=' + encodeURIComponent(location.pathname + location.hash); throw new ApiError(401, 'Please sign in'); }
  if (res.status === 403 && data && data.details && data.details.code === 'password_change_required') { location.href = '/login?change=1'; throw new ApiError(403, data.error, data.details); }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || 'Request failed (' + res.status + ')', data && data.details);
  return data;
}

export const api = {
  get: (path, query) => call('GET', path, undefined, query),
  post: (path, body) => call('POST', path, body || {}),
  patch: (path, body) => call('PATCH', path, body || {}),
  put: (path, body) => call('PUT', path, body || {}),
  del: path => call('DELETE', path)
};

let metaPromise = null;
/* Reference data from /api/meta (rules, entry types, today's date), loaded once */
export const meta = () => (metaPromise = metaPromise || api.get('/api/meta'));

export async function logout() {
  try { await api.post('/api/auth/logout'); } catch (e) { /* signed out anyway */ }
  location.href = '/login';
}
