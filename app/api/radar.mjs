// Trade-Disk — Radar's data API (piece A: screener universe + shortlist).
// Serves the exact record the approved radar prototype's Screener reads; the view
// does its own filtering/sorting. Market, screeners and the per-stock analysis
// read-models arrive with their screens in later pieces.

import { all, one, run } from '../lib/db.mjs';
import { activeFor, getMode } from '../core/sources.mjs';

const J = v => { try { return v ? JSON.parse(v) : []; } catch { return []; } };

function mapStock(r) {
  return {
    t: r.t, n: r.n, p: r.p, c: r.c, abs: r.abs, s: r.s, r: r.r, adr: r.adr, pm: r.pm,
    pmHigh: r.pm_high, pmLow: r.pm_low, pmRange: r.pm_range, pmPct: r.pm_pct,
    cap: r.cap, capBand: r.cap_band, sec: r.sec, mark: r.mark, color: r.color,
    tags: J(r.tags), ema: !!r.ema, stacked: !!r.stacked, news: !!r.news, cs: !!r.cs,
    changeLine: J(r.change_line),
  };
}

export const stocks = db => all(db, `SELECT * FROM radar_stock ORDER BY sort`).map(mapStock);
export const shortlist = db => all(db, `SELECT ticker FROM radar_shortlist ORDER BY added_at`).map(r => r.ticker);

export function toggleShortlist(db, ticker) {
  const exists = one(db, `SELECT ticker FROM radar_shortlist WHERE ticker=?`, ticker);
  if (exists) run(db, `DELETE FROM radar_shortlist WHERE ticker=?`, ticker);
  else if (one(db, `SELECT t FROM radar_stock WHERE t=?`, ticker)) run(db, `INSERT INTO radar_shortlist (ticker) VALUES (?)`, ticker);
  return { ticker, saved: !exists };
}

// The feed the Price group is on, so the view can show a live/demo badge honestly.
// `live` means a real provider is active and usable (not the seeded demo).
function feedInfo(db) {
  const first = activeFor(db, 'price')[0] || { id: 'demo' };
  const live = first.id !== 'demo' && first.usable && !(first.needsKey && !first.hasKey);
  const at = one(db, `SELECT value FROM app_setting WHERE key='radar_refreshed_at'`)?.value || null;
  return { mode: getMode(db), provider: first.id, live, at };
}

export const bundle = db => ({ stocks: stocks(db), shortlist: shortlist(db), feed: feedInfo(db) });

// The materialized market_snapshot read model: one global read the Market screen
// renders and never recomputes (MARKET.md §3.5).
export function market(db) {
  const r = one(db, `SELECT snapshot FROM radar_market WHERE id = 1`);
  return r ? JSON.parse(r.snapshot) : null;
}
