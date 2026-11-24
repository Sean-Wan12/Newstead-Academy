/* Small HTTP helpers shared by the dev server and the API handlers:
   errors with status codes, JSON responses, body reading with a size limit,
   cookie parsing, and the security headers sent with every response. */
'use strict';

class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}
const fail = (status, message, details) => { throw new HttpError(status, message, details); };

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Only our own files; no inline scripts or styles, no third-party anything
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
};

function setSecurityHeaders(res) { for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v); }

function sendJson(res, status, body, extraHeaders) {
  const data = JSON.stringify(body === undefined ? null : body);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extraHeaders || {}));
  res.end(data);
}

const MAX_BODY = 100 * 1024;
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return resolve({});
    let size = 0, tooBig = Number(req.headers['content-length']) > MAX_BODY; const chunks = [];
    // Past the limit, keep reading and discard, so the 413 reaches the client instead of a reset connection
    // (the server's requestTimeout still bounds how long a sender can keep going)
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) tooBig = true;
      if (!tooBig) chunks.push(c);
    });
    req.on('end', () => {
      if (tooBig) return reject(new HttpError(413, 'Request body is too large'));
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolve({});
      const type = String(req.headers['content-type'] || '');
      if (!type.startsWith('application/json')) return reject(new HttpError(415, 'Send JSON (Content-Type: application/json)'));
      try {
        const v = JSON.parse(text);
        if (!v || typeof v !== 'object' || Array.isArray(v)) return reject(new HttpError(400, 'The request body must be a JSON object'));
        resolve(v);
      } catch (e) { reject(new HttpError(400, 'The request body is not valid JSON')); }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('='); if (i < 0) return;
    const k = p.slice(0, i).trim(), v = p.slice(i + 1).trim();
    if (k && !(k in out)) { try { out[k] = decodeURIComponent(v); } catch (e) { out[k] = v; } }
  });
  return out;
}

/* The client's address, for rate limiting. Trust X-Forwarded-For only when told to (behind a proxy such as Vercel). */
function clientIp(req) {
  if (process.env.TRUST_PROXY === '1') {
    const f = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (f) return f;
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = { HttpError, fail, setSecurityHeaders, sendJson, readJsonBody, parseCookies, clientIp, SECURITY_HEADERS };
