/* Cross-site request protection for state-changing requests (POST, PUT, PATCH, DELETE).
   Together with SameSite=Strict cookies and JSON-only bodies, this stops another site
   from making a signed-in browser change data.
   Allowed: an Origin header equal to this server's own origin (from the Host header, or
   APP_ORIGIN when set, e.g. https://newstead.example.ca), or any origin in ALLOWED_ORIGINS
   (comma-separated). With no Origin header, Sec-Fetch-Site must say same-origin.
   Anything else is refused. */
'use strict';

function allowedOrigins(req) {
  const list = String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (process.env.APP_ORIGIN) list.push(process.env.APP_ORIGIN);
  else if (req.headers.host) {
    const secure = req.socket && req.socket.encrypted || (process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-proto'] === 'https');
    list.push((secure ? 'https://' : 'http://') + req.headers.host);
  }
  return list;
}

function originOk(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return true;
  const origin = req.headers.origin;
  if (origin) return allowedOrigins(req).includes(origin);
  return req.headers['sec-fetch-site'] === 'same-origin';
}

module.exports = { originOk };
