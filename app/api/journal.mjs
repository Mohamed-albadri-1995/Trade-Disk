// Trade-Disk — the Journal's data API.
// It SERVES the records the approved view reads — trades (in the exact shape the
// prototype's buildSeed() produced), accounts, setups and day notes — and lets
// the view's own stats()/advanced() compute every metric, so the backend matches
// the view field-for-field instead of defining a second, divergent metric set.

import { all } from '../lib/db.mjs';

const parseTags = v => { try { return v ? JSON.parse(v) : []; } catch { return []; } };

// DB row (snake_case) -> the exact camelCase trade object the screens consume
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

export const trades = db =>
  all(db, `SELECT * FROM trade ORDER BY date DESC, id DESC`).map(mapTrade);

export const accounts = db =>
  all(db, `SELECT id,name,door,kind,status,last,note FROM account ORDER BY sort, rowid`);

export const setups = db =>
  all(db, `SELECT name FROM setup ORDER BY id`).map(r => r.name);

export function dayNotes(db) {
  const out = {};
  for (const r of all(db, `SELECT day,note FROM day_note`)) out[r.day] = r.note;
  return out;
}

// one call the app can make on load to get everything the screens need
export const bundle = db => ({
  trades: trades(db), accounts: accounts(db), setups: setups(db), dayNotes: dayNotes(db),
});
