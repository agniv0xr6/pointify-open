#!/usr/bin/env node
/**
 * POINTIFY LOCAL SERVER
 * ---------------------
 * Zero-dependency static file server for running Pointify on ONE device with
 * no configuration and no network.
 *
 * WHY THIS EXISTS
 *   Browsers only allow Service Workers (offline mode) and "Add to Home Screen"
 *   on a *secure context*: https://... or http://localhost. Opening the app as
 *   http://192.168.x.x/ silently disables everything Phase 4 built.
 *
 *   Serving from 127.0.0.1 gets you a secure context with NO certificate, NO
 *   domain and NO configuration.
 *
 * USAGE
 *   node server.js
 *   then open  http://localhost:8080
 *
 *   Use a different port:   PORT=3000 node server.js
 *
 * FIRST RUN
 *   1. Open http://localhost:8080 and log in.
 *   2. The service worker installs and precaches the whole app.
 *   3. From then on the app works with the network switched off.
 *
 * SECURITY
 *   - Binds to 127.0.0.1 only: not reachable from other machines.
 *   - Refuses to serve docs/ or any *.md, so the historical audit reports
 *     (which once contained a default password) can never be fetched.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '127.0.0.1';

// ES modules are REJECTED by the browser unless the MIME type is a JavaScript
// type, so these must be exact. This is the single most common way a static
// server "breaks" a module-based app.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};

// Never served, regardless of what is in the folder.
const BLOCKED_DIRS = ['docs', 'node_modules', '.git'];
const BLOCKED_EXT = ['.md'];

function isBlocked(relPath) {
  const parts = relPath.split(path.sep);
  if (parts.some(p => BLOCKED_DIRS.includes(p))) return true;
  if (BLOCKED_EXT.includes(path.extname(relPath).toLowerCase())) return true;
  return false;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, Object.assign({ 'X-Content-Type-Options': 'nosniff' }, headers));
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { 'Content-Type': 'text/plain' });
  }

  let pathname;
  try {
    // decodeURIComponent throws on a malformed escape like %zz
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    return send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain' });
  }

  // Resolve and confirm the result is still inside ROOT (blocks ../ traversal).
  const resolved = path.resolve(ROOT, '.' + pathname);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
    return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });
  }

  let relPath = path.relative(ROOT, resolved);
  if (isBlocked(relPath)) {
    return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain' });
  }

  // Directory -> index.html
  let target = resolved;
  try {
    if (fs.statSync(target).isDirectory()) {
      target = path.join(target, 'index.html');
      relPath = path.relative(ROOT, target);
      if (isBlocked(relPath)) return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain' });
    }
  } catch (e) {
    return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain' });
  }

  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) {
      return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain' });
    }

    // The manifest is fetched as application/manifest+json per its spec.
    // application/json is tolerated by Chrome but is not the correct type.
    const type = path.basename(target) === 'manifest.json'
      ? 'application/manifest+json; charset=utf-8'
      : (MIME[path.extname(target).toLowerCase()] || 'application/octet-stream');

    // no-cache = "store it, but always revalidate". The service worker's
    // precache uses fetch(), which reads the HTTP cache by default - without
    // this, an updated sw.js could re-download STALE js files and pin them into
    // the new offline cache. no-cache (not no-store) still lets the Cache API
    // store them.
    const headers = {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
      'Content-Length': stat.size,
      'X-Content-Type-Options': 'nosniff'
    };

    // sw.js must be revalidated or the browser never discovers an update.
    if (path.basename(target) === 'sw.js') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    }

    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      return res.end();
    }

    res.writeHead(200, headers);
    fs.createReadStream(target).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log('');
  console.log('  POINTIFY is running.');
  console.log('');
  console.log('    Open:   ' + url);
  console.log('    Stop:   Ctrl+C');
  console.log('');
  console.log('  First open: log in, then the app precaches itself.');
  console.log('  After that it works with the network switched off.');
  console.log('');
  console.log('  Bound to ' + HOST + ' only - not reachable from other devices.');
  console.log('  Never served: docs/, *.md');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use. Try:  PORT=3000 node server.js\n`);
  } else {
    console.error('\n  Server failed:', err.message, '\n');
  }
  process.exit(1);
});
