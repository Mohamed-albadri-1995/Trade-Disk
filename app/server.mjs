// Trade-Disk — the front door (solo mode): serves the built static app and routes
// /api/… to the service that owns the data. Zero external dependencies (Node
// built-ins only). In hosted mode this routing sits at the edge with the API
// behind it (FRONT-DOOR.md); here it is one process on the box.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { openDb } from './lib/db.mjs';
import * as journal from './api/journal.mjs';

const PORT = process.env.PORT || 8787;
const WEB = join(import.meta.dirname, 'web');
const db = openDb();

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };

const json = (res, body, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 5e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

// the API, routed by product (here: the Journal)
async function api(req, res, url) {
  const p = url.pathname, m = req.method;
  const seg = p.split('/').filter(Boolean); // ['api','journal',...]
  try {
    if (p === '/api/health') return json(res, { ok: true, service: 'trade-disk', ts: Date.now() });

    if (seg[1] === 'journal') {
      const sub = seg[2];
      if (m === 'GET') {
        if (sub === 'bundle') return json(res, journal.bundle(db));
        if (sub === 'trades') return json(res, journal.trades(db));
        if (sub === 'accounts') return json(res, journal.accounts(db));
        if (sub === 'setups') return json(res, journal.setups(db));
        if (sub === 'day-notes') return json(res, journal.dayNotes(db));
        if (sub === 'reviews') return json(res, journal.reviews(db));
      }
      if (m === 'POST') {
        const body = await readBody(req);
        if (sub === 'trades') return json(res, journal.addTrade(db, body), 201);
        if (sub === 'reviews') return json(res, journal.addReview(db, body), 201);
        if (sub === 'import') return json(res, journal.importTrades(db, body.trades || body), 201);
        if (sub === 'reset') return json(res, journal.reset(db));
      }
      if (m === 'PATCH' && sub === 'trades' && seg[3]) {
        const r = journal.updateTrade(db, decodeURIComponent(seg[3]), await readBody(req));
        return r ? json(res, r) : json(res, { error: 'not found' }, 404);
      }
      if (m === 'PUT' && sub === 'day-notes' && seg[3]) {
        const body = await readBody(req);
        return json(res, journal.saveDayNote(db, decodeURIComponent(seg[3]), body.note || ''));
      }
      if (m === 'DELETE' && sub === 'reviews' && seg[3]) return json(res, journal.deleteReview(db, decodeURIComponent(seg[3])));
    }
    return json(res, { error: 'not found', path: p, method: m }, 404);
  } catch (e) {
    return json(res, { error: String(e && e.message || e) }, 500);
  }
}

// static files; a bare directory serves its index.html; unknown non-file paths
// fall back to index.html (SPA client routing, though this app routes in-memory)
async function serveStatic(res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const path = normalize(join(WEB, rel));
  if (!path.startsWith(WEB)) return json(res, { error: 'forbidden' }, 403);
  try {
    const s = await stat(path);
    const file = s.isDirectory() ? join(path, 'index.html') : path;
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    try {
      const body = await readFile(join(WEB, 'index.html'));
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(body);
    } catch { json(res, { error: 'not found', path: rel }, 404); }
  }
}

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  return serveStatic(res, url);
}).listen(PORT, () => console.log(`Trade-Disk (solo) on http://localhost:${PORT}`));
