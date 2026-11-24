/* Development server: node app/server.js
   Serves app/public/ as static files and sends /api/* to api/_router.js.
   Listens on 127.0.0.1:3000 by default (HOST and PORT change it). No dependencies.
   On Vercel, public/ would be served as static files and the API wrapped as functions,
   so nothing here is needed in production. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleApi } = require('./api/_router');
const { setSecurityHeaders } = require('./lib/http');
const { getStore } = require('./lib/storage');
const { purgeExpired } = require('./lib/sessions');
const { sessionSecret } = require('./lib/secret');

const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
// Clean page URLs
const PAGES = { '/': '/index.html', '/login': '/login.html', '/admin': '/admin.html', '/teacher': '/teacher.html' };

function serveStatic(req, res) {
  setSecurityHeaders(res);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (e) { res.writeHead(400); return res.end('Bad request'); }
  p = PAGES[p] || p;
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep) || p.includes('\0')) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': type.startsWith('text/html') ? 'no-store' : 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

async function start() {
  const store = getStore();
  sessionSecret();   // fail fast if production is missing SESSION_SECRET
  const users = await store.list('users');
  if (!users.length) console.warn('No accounts yet. Run "node app/seed.js" to create the demo data and logins.');
  await purgeExpired();
  setInterval(() => purgeExpired().catch(() => {}), 3600e3).unref();

  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) handleApi(req, res);
    else serveStatic(req, res);
  });
  server.headersTimeout = 20e3; server.requestTimeout = 30e3;
  const port = +process.env.PORT || 3000, host = process.env.HOST || '127.0.0.1';
  server.listen(port, host, () => console.log('Newstead app running at http://' + (host === '0.0.0.0' ? 'localhost' : host) + ':' + port + ' (storage: ' + store.name + ')'));
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}

start().catch(e => { console.error(e.message); process.exit(1); });
