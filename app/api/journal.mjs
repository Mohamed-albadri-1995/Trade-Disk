// Trade-Disk — the Journal's data API (reads + writes).
// Reads serve the exact record the approved view consumes; writes persist manual
// entry, edits, day notes, reviews and import to SQLite. The view's own
// stats()/advanced() compute the metrics, so there is one metric definition.

import { all } from '../lib/db.mjs';
import { deriveTrade, insertTrade, seedDemo } from '../db/seed-data.mjs';

const parseTags = v => { try { return v ? JSON.parse(v) : []; } catch { return []; } };
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

function mapTrade(r) {
  return {
    id: r.id, symbol: r.symbol, side: r.side, setup: r.setup, assetType: r.asset_type,
    qty: r.qty, entry: r.entry, exit: r.exit, risk: r.risk, date: r.date, status: r.status,
    adherence: r.adherence, fees: r.fees, net: r.net, gross: r.gross, mult: r.mult,
    movePct: r.move_pct, r: r.r, account: r.account, source: r.source, duration: r.duration,
    tags: parseTags(r.tags), thesis: r.thesis, notes: r.notes, stop: r.stop, target: r.target,
    plannedRR: r.planned_rr, initialRisk: r.initial_risk, emotions: r.emotions, batch: r.batch,
    createdAt: r.created_at, updatedAt: r.updated_at, entrySnapshot: null,
  };
}

/* ---------- reads ---------- */
export const trades = db => all(db, `SELECT * FROM trade ORDER BY date DESC, id DESC`).map(mapTrade);
export const accounts = db => all(db, `SELECT id,name,door,kind,status,last,note FROM account ORDER BY sort, rowid`);
export const setups = db => all(db, `SELECT name FROM setup ORDER BY id`).map(r => r.name);
export function dayNotes(db) { const o = {}; for (const r of all(db, `SELECT day,note FROM day_note`)) o[r.day] = r.note; return o; }
export const reviews = db => all(db, `SELECT id,title,body,created_at AS createdAt FROM review_note ORDER BY created_at DESC`);
export const bundle = db => ({ trades: trades(db), accounts: accounts(db), setups: setups(db), dayNotes: dayNotes(db), reviews: reviews(db) });

/* ---------- writes ---------- */
const nextId = db => {
  const row = all(db, `SELECT id FROM trade WHERE id LIKE 'TD-%' ORDER BY id DESC LIMIT 1`)[0];
  const n = row ? parseInt(row.id.slice(3), 10) : 1000;
  return 'TD-' + String(n + 1).padStart(4, '0');
};

export function addTrade(db, input) {
  const now = new Date().toISOString();
  const t = deriveTrade({
    symbol: String(input.symbol || '').toUpperCase(), side: input.side === 'Short' ? 'Short' : 'Long',
    setup: input.setup || null, assetType: input.assetType || 'stock',
    qty: Number(input.qty) || 0, entry: Number(input.entry) || 0,
    exit: input.exit === '' || input.exit == null ? null : Number(input.exit),
    risk: input.risk != null && input.risk !== '' ? Number(input.risk) : null,
    stop: input.stop != null && input.stop !== '' ? Number(input.stop) : null,
    target: input.target != null && input.target !== '' ? Number(input.target) : null,
    fees: input.fees != null && input.fees !== '' ? Number(input.fees) : null,
    date: input.date || now.slice(0, 10), status: input.exit == null || input.exit === '' ? 'Open' : 'Closed',
    adherence: input.adherence || 'Unknown',
  });
  const full = {
    ...t, id: nextId(db), plannedRR: input.plannedRR != null ? Number(input.plannedRR) : 2,
    account: input.account || 'Manual / CSV', source: input.source || 'Manual entry',
    duration: input.duration != null ? Number(input.duration) : null, tags: input.tags || [],
    thesis: input.thesis || '', notes: input.notes || '', emotions: input.emotions || 'Unknown',
    batch: input.batch || null, createdAt: now, updatedAt: now,
  };
  insertTrade(db, full);
  return mapTrade(all(db, `SELECT * FROM trade WHERE id=?`, full.id)[0]);
}

export function updateTrade(db, id, patch) {
  const cur = all(db, `SELECT * FROM trade WHERE id=?`, id)[0];
  if (!cur) return null;
  const t = mapTrade(cur);
  // editable fields (mirrors the prototype's trade-detail edit)
  if (patch.setup !== undefined) t.setup = patch.setup;
  if (patch.adherence !== undefined) t.adherence = patch.adherence;
  if (patch.emotions !== undefined) t.emotions = patch.emotions;
  if (patch.notes !== undefined) t.notes = patch.notes;
  if (patch.stop !== undefined) t.stop = patch.stop === '' || patch.stop == null ? null : Number(patch.stop);
  if (patch.target !== undefined) t.target = patch.target === '' || patch.target == null ? null : Number(patch.target);
  if (patch.fees !== undefined && patch.fees !== '' && patch.fees != null) t.fees = Number(patch.fees);
  // recompute realized fields from the (possibly changed) stop + fees
  const dir = t.side === 'Long' ? 1 : -1, mult = t.mult || 1;
  if (t.status === 'Closed') { t.gross = round((t.exit - t.entry) * t.qty * mult * dir); t.net = round(t.gross - t.fees); }
  t.initialRisk = t.stop != null ? round(Math.abs(t.entry - t.stop) * t.qty * mult) : null;
  t.r = t.initialRisk && t.status === 'Closed' ? round(t.net / t.initialRisk, 4) : null;
  t.updatedAt = new Date().toISOString();
  db.prepare(`UPDATE trade SET setup=?, adherence=?, emotions=?, notes=?, stop=?, target=?, fees=?, net=?, gross=?, initial_risk=?, r=?, updated_at=? WHERE id=?`)
    .run(t.setup, t.adherence, t.emotions, t.notes, t.stop, t.target, t.fees, t.net, t.gross, t.initialRisk, t.r, t.updatedAt, id);
  return mapTrade(all(db, `SELECT * FROM trade WHERE id=?`, id)[0]);
}

export function saveDayNote(db, day, note) {
  if (note && note.trim()) {
    db.prepare(`INSERT INTO day_note (day,note,updated_at) VALUES (?,?,datetime('now'))
      ON CONFLICT(day) DO UPDATE SET note=excluded.note, updated_at=excluded.updated_at`).run(day, note);
  } else {
    db.prepare(`DELETE FROM day_note WHERE day=?`).run(day);
  }
  return { day, note: note || '' };
}

export function addReview(db, input) {
  const id = 'rev-' + Date.now().toString(36);
  db.prepare(`INSERT INTO review_note (id,title,body) VALUES (?,?,?)`).run(id, input.title || 'Review', input.body || '');
  return all(db, `SELECT id,title,body,created_at AS createdAt FROM review_note WHERE id=?`, id)[0];
}
export function deleteReview(db, id) { db.prepare(`DELETE FROM review_note WHERE id=?`).run(id); return { ok: true }; }

export function importTrades(db, rows) {
  const now = new Date().toISOString(), batch = 'imp-' + Date.now().toString(36);
  let added = 0;
  for (const input of rows || []) {
    addTrade(db, { ...input, source: input.source || 'File import', batch });
    added++;
  }
  return { ok: true, added, batch };
}

export function reset(db) { return { ok: true, trades: seedDemo(db) }; }
