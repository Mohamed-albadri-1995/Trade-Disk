// Trade-Disk — the front door (solo mode): serves the built static app and routes
// /api/… to the service that owns the data. Zero external dependencies (Node
// built-ins only). In hosted mode this routing sits at the edge with the API
// behind it (FRONT-DOOR.md); here it is one process on the box.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import * as journal from './api/journal.mjs';
import * as radar from './api/radar.mjs';
import * as sources from './core/sources.mjs';
import { userClient } from './lib/supabase.mjs';

const PORT = process.env.PORT || 8787;
const WEB = join(import.meta.dirname, 'web');

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

// The signed-in user for this request, from the login JWT the front end sends.
// The uid is read from the token payload for stamping owner_id on writes; the
// database is the real gatekeeper — row-level security rejects any row whose
// owner_id is not the verified auth.uid(), so a forged uid cannot write.
function authCtx(req) {
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  let uid = null;
  try { uid = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub; } catch { /* malformed */ }
  if (!uid) return null;
  return { sb: userClient(token), uid };
}

// the API, routed by product
async function api(req, res, url) {
  const p = url.pathname, m = req.method;
  const seg = p.split('/').filter(Boolean); // ['api','journal',...]
  try {
    if (p === '/api/health') return json(res, { ok: true, service: 'trade-disk', ts: Date.now() });

    if (seg[1] === 'journal') {
      const ctx = authCtx(req);
      if (!ctx) return json(res, { error: 'unauthorized' }, 401);
      const { sb, uid } = ctx;
      const sub = seg[2];
      if (m === 'GET') {
        if (sub === 'bundle') return json(res, await journal.bundle(sb));
        if (sub === 'trades') return json(res, await journal.trades(sb));
        if (sub === 'accounts') return json(res, await journal.accounts(sb));
        if (sub === 'setups') return json(res, await journal.setups(sb));
        if (sub === 'day-notes') return json(res, await journal.dayNotes(sb));
        if (sub === 'reviews') return json(res, await journal.reviews(sb));
      }
      if (m === 'POST') {
        const body = await readBody(req);
        if (sub === 'trades') return json(res, await journal.addTrade(sb, uid, body), 201);
        if (sub === 'reviews') return json(res, await journal.addReview(sb, uid, body), 201);
        if (sub === 'import') return json(res, await journal.importTrades(sb, uid, body.trades || body), 201);
        if (sub === 'reset') return json(res, await journal.reset(sb, uid));
      }
      if (m === 'PATCH' && sub === 'trades' && seg[3]) {
        const r = await journal.updateTrade(sb, decodeURIComponent(seg[3]), await readBody(req));
        return r ? json(res, r) : json(res, { error: 'not found' }, 404);
      }
      if (m === 'PUT' && sub === 'day-notes' && seg[3]) {
        const body = await readBody(req);
        return json(res, await journal.saveDayNote(sb, uid, decodeURIComponent(seg[3]), body.note || ''));
      }
      if (m === 'DELETE' && sub === 'reviews' && seg[3]) return json(res, await journal.deleteReview(sb, decodeURIComponent(seg[3])));
    }

    if (seg[1] === 'radar') {
      const ctx = authCtx(req);
      if (!ctx) return json(res, { error: 'unauthorized' }, 401);
      const { sb, uid } = ctx;
      const sub = seg[2];
      if (m === 'GET') {
        if (sub === 'bundle') return json(res, await radar.bundle(sb));
        if (sub === 'stocks') return json(res, await radar.stocks(sb));
        if (sub === 'shortlist') return json(res, await radar.shortlist(sb));
        if (sub === 'market') return json(res, await radar.market(sb));
        if (sub === 'groups') return json(res, await radar.groups(sb));
        if (sub === 'screeners') return json(res, radar.screeners());
        if (sub === 'scan' && seg[3]) return json(res, await radar.scan(sb, decodeURIComponent(seg[3]), Math.min(100, +url.searchParams.get('limit') || 50)));
        if (sub === 'analysis' && seg[3]) return json(res, await radar.analysis(sb, decodeURIComponent(seg[3]), { n: url.searchParams.get('name'), sec: url.searchParams.get('sec'), cap: url.searchParams.get('cap'), capBand: url.searchParams.get('capBand'), tags: (url.searchParams.get('tags') || '').split(',').filter(Boolean) }));
        if (sub === 'configs') return json(res, await radar.screenerConfigs(sb));
      }
      if (m === 'POST' && sub === 'shortlist' && seg[3]) return json(res, await radar.toggleShortlist(sb, uid, decodeURIComponent(seg[3])));
      try {
        if (m === 'POST' && sub === 'config') return json(res, await radar.saveScreenerConfig(sb, uid, await readBody(req)), 201);
        if (m === 'POST' && sub === 'schedule' && seg[3]) return json(res, await radar.saveSchedule(sb, uid, decodeURIComponent(seg[3]), await readBody(req)));
        if (m === 'DELETE' && sub === 'config' && seg[3]) return json(res, await radar.deleteScreenerConfig(sb, uid, decodeURIComponent(seg[3])));
      } catch (e) {
        return json(res, { error: String(e && e.message || e) }, 400);
      }
    }

    // the dual-mode feed switch (the admin dashboard reads/writes this global config)
    if (seg[1] === 'admin') {
      const ctx = authCtx(req);
      if (!ctx) return json(res, { error: 'unauthorized' }, 401);
      const { sb } = ctx;
      const sub = seg[2];
      try {
        if (m === 'GET' && sub === 'sources') return json(res, await sources.config(sb));
        if (m === 'POST' && sub === 'mode') return json(res, await sources.setMode(sb, (await readBody(req)).mode));
        if (m === 'POST' && sub === 'group' && seg[3]) return json(res, await sources.setGroup(sb, decodeURIComponent(seg[3]), await readBody(req)));
        if (m === 'POST' && sub === 'key' && seg[3]) { const b = await readBody(req); return json(res, await sources.setKey(sb, decodeURIComponent(seg[3]), b.provider, b.key)); }
        if (m === 'POST' && sub === 'refresh') return json(res, { note: 'Live screeners pull fresh data on each scan — no manual refresh needed.' });
      } catch (e) {
        return json(res, { error: String(e && e.message || e) }, 400); // guard / validation
      }
    }
    return json(res, { error: 'not found', path: p, method: m }, 404);
  } catch (e) {
    return json(res, { error: String(e && e.message || e) }, 500);
  }
}

// Each tool is its own app under app/web/<app>/ and routes client-side within it;
// the Station launcher owns the root. Rebuilding one app never touches another.
const APPS = ['journal', 'radar', 'admin'];

async function sendFile(res, file) {
  const body = await readFile(file); // throws if missing
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(body);
}

// static files; a bare directory serves its index.html; unknown non-file paths fall
// back to the owning app's index.html (SPA client routing). The root serves the
// Station launcher once it exists, otherwise it sends users to the Journal.
async function serveStatic(res, url) {
  let rel = decodeURIComponent(url.pathname);

  if (rel === '/') {
    try { return await sendFile(res, join(WEB, 'index.html')); }
    catch { res.writeHead(302, { location: '/journal/' }); return res.end(); }
  }

  if (rel.endsWith('/')) rel += 'index.html';
  const path = normalize(join(WEB, rel));
  if (!path.startsWith(WEB)) return json(res, { error: 'forbidden' }, 403);
  try {
    const s = await stat(path);
    return await sendFile(res, s.isDirectory() ? join(path, 'index.html') : path);
  } catch {
    const seg = rel.split('/').filter(Boolean);
    if (APPS.includes(seg[0])) {
      try { return await sendFile(res, join(WEB, seg[0], 'index.html')); } catch { /* fall through */ }
    }
    try { return await sendFile(res, join(WEB, 'index.html')); }
    catch { return json(res, { error: 'not found', path: rel }, 404); }
  }
}

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  return serveStatic(res, url);
}).listen(PORT, () => console.log(`Trade-Disk (solo) on http://localhost:${PORT}`));
