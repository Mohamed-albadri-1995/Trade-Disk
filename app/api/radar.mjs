// Trade-Disk — Radar's data API (piece A: screener universe + shortlist).
// Serves the exact record the approved radar prototype's Screener reads; the view
// does its own filtering/sorting. Market, screeners and the per-stock analysis
// read-models arrive with their screens in later pieces.

import { all, one, run } from '../lib/db.mjs';
import { activeFor, getMode } from '../core/sources.mjs';
import * as tv from '../providers/tradingview.mjs';
import { COLUMNS, listScreeners, getScreener, toCard } from '../core/screeners.mjs';

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

export const bundle = db => ({ stocks: stocks(db), shortlist: shortlist(db), feed: feedInfo(db), screeners: listScreeners() });

// The live screeners available in the view (name + one-line note).
export const screeners = () => listScreeners();

// Run one screener against the active screener engine and return cards. Personal
// mode uses TradingView (personal-use only); commercial awaits a licensed engine.
export async function scan(db, key, limit = 50) {
  const def = getScreener(key);
  if (!def) return { error: `unknown screener "${key}"` };
  if (getMode(db) !== 'personal') {
    return { screener: def.name, key, error: 'The live screener runs in Personal mode (TradingView, personal-use). A licensed commercial screener is not wired yet.' };
  }
  const { totalCount, rows } = await tv.scan({ filters: def.filters, columns: COLUMNS, sort: def.sort, range: [0, limit] });
  return { screener: def.name, key, provider: 'tradingview', totalCount, count: rows.length, stocks: rows.map(toCard) };
}

// ── screener configs + scan schedules (server-persisted; was browser localStorage) ──
// Returns the trader's custom screeners and the built-in screeners' schedules.
export function screenerConfigs(db) {
  const rows = all(db, `SELECT * FROM radar_screener ORDER BY sort, updated_at`);
  const custom = rows.filter((r) => r.kind === 'custom').map((r) => {
    const conditions = J(r.conditions);
    return { id: r.id, name: r.name, description: r.description || '', conditions,
      filters: conditions.map((c) => c.metric), windows: J(r.windows), timezone: r.timezone };
  });
  const schedules = {};
  for (const r of rows) if (r.kind === 'builtin') schedules[r.id] = { windows: J(r.windows), timezone: r.timezone };
  return { custom, schedules };
}

export function saveScreenerConfig(db, cfg) {
  if (!cfg || !String(cfg.name || '').trim()) throw new Error('a screener name is required');
  const id = cfg.id || ('scr-' + Date.now());
  run(db, `INSERT INTO radar_screener (id,kind,name,description,conditions,windows,timezone,sort,updated_at)
           VALUES (?,?,?,?,?,?,?,?,datetime('now'))
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description,
             conditions=excluded.conditions, windows=excluded.windows, timezone=excluded.timezone, updated_at=excluded.updated_at`,
    id, 'custom', String(cfg.name).trim(), cfg.description || '', JSON.stringify(cfg.conditions || []),
    JSON.stringify(cfg.windows || []), cfg.timezone || 'device', cfg.sort || 0);
  return screenerConfigs(db);
}

export function deleteScreenerConfig(db, id) {
  run(db, `DELETE FROM radar_screener WHERE id=? AND kind='custom'`, id);
  return screenerConfigs(db);
}

// The scan schedule for one built-in screener (its rule set is fixed; only the
// windows + timezone are the trader's to set).
export function saveSchedule(db, key, body) {
  const def = getScreener(key);
  if (!def) throw new Error('unknown screener ' + key);
  run(db, `INSERT INTO radar_screener (id,kind,name,description,conditions,windows,timezone,updated_at)
           VALUES (?,?,?,?,?,?,?,datetime('now'))
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, windows=excluded.windows, timezone=excluded.timezone, updated_at=excluded.updated_at`,
    key, 'builtin', def.name, '', '[]', JSON.stringify(body?.windows || []), body?.timezone || 'device');
  return screenerConfigs(db);
}

// The materialized market_snapshot read model: one global read the Market screen
// renders and never recomputes (MARKET.md §3.5).
export function market(db) {
  const r = one(db, `SELECT snapshot FROM radar_market WHERE id = 1`);
  return r ? JSON.parse(r.snapshot) : null;
}
