// Trade-Disk — the front door (solo mode): serves the static apps and routes
// the /api/… calls to their service. Zero external dependencies (Node built-ins
// only). In hosted mode this same routing sits at the edge with the API behind
// it (FRONT-DOOR.md); here it is one process on the box.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { openDb } from './lib/db.mjs';
import * as journal from './api/journal.mjs';

const PORT = process.env.PORT || 8787;
const WEB = join(import.meta.dirname, 'web');
const db = openDb();

const TYPES = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
  '.mjs':'text/javascript', '.json':'application/json', '.svg':'image/svg+xml',
  '.png':'image/png', '.ico':'image/x-icon', '.webmanifest':'application/manifest+json' };

const json = (res, body, code = 200) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

// the API, routed by product (here: the Journal)
function api(req, res, url) {
  const p = url.pathname;
  try {
    if (p === '/api/health') return json(res, { ok: true, service: 'trade-disk', ts: Date.now() });
    if (p === '/api/journal/bundle') return json(res, journal.bundle(db));   // everything the view needs, one call
    if (p === '/api/journal/trades') return json(res, journal.trades(db));
    if (p === '/api/journal/accounts') return json(res, journal.accounts(db));
    if (p === '/api/journal/setups') return json(res, journal.setups(db));
    if (p === '/api/journal/day-notes') return json(res, journal.dayNotes(db));
    return json(res, { error: 'not found', path: p }, 404);
  } catch (e) {
    return json(res, { error: String(e && e.message || e) }, 500);
  }
}

// static files for the apps; a bare directory serves its index.html
async function serveStatic(res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const path = normalize(join(WEB, rel));
  if (!path.startsWith(WEB)) return json(res, { error: 'forbidden' }, 403); // no path escape
  try {
    const s = await stat(path);
    const file = s.isDirectory() ? join(path, 'index.html') : path;
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    json(res, { error: 'not found', path: rel }, 404);
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  return serveStatic(res, url);
});

server.listen(PORT, () => console.log(`Trade-Disk (solo) on http://localhost:${PORT}`));
