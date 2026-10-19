// Trade-Disk — the dual-mode feed switch (DATA-CATALOG.md, DATA-SOURCES.md §3.7).
// The platform runs 'personal' (free sources) or 'commercial' (licensed). Each of
// the eight data groups (the Radar screener's filter categories) picks its
// provider(s): one active with an ordered fallback ('prime'), or several merged
// ('merge'). 'demo' serves the seeded demo data and is the default today, so the
// built app needs no real feed yet. Switching free↔paid is config only — the app's
// screens, API shape and look do not change.

import { all, one, run } from '../lib/db.mjs';

// Provider shorthands. commercialOk = may be used in a sold product. Government
// sources (EDGAR/FRED) are free AND redistributable; free personal-use feeds
// (Yahoo/TradingView) are not; licensed vendors need a key.
const demo = { id: 'demo', name: 'Demo data (seeded)', tier: 'demo', commercialOk: false, needsKey: false };
const computed = { id: 'computed', name: 'Computed from price bars', tier: 'free', commercialOk: true, needsKey: false };
const yahoo = { id: 'yahoo', name: 'Yahoo Finance', tier: 'free', commercialOk: false, needsKey: false };
const tradingview = { id: 'tradingview', name: 'TradingView scanner', tier: 'free', commercialOk: false, needsKey: false };
const finnhubFree = { id: 'finnhub_free', name: 'Finnhub (free)', tier: 'free', commercialOk: false, needsKey: true };
const edgar = { id: 'edgar', name: 'SEC EDGAR', tier: 'free', commercialOk: true, needsKey: false };
const sec8k = { id: 'sec_8k', name: 'SEC 8-K filings', tier: 'free', commercialOk: true, needsKey: false };
const fred = { id: 'fred', name: 'FRED / BLS / Fed (macro)', tier: 'free', commercialOk: true, needsKey: false };
const polygon = { id: 'polygon', name: 'Polygon / Massive', tier: 'commercial', commercialOk: true, needsKey: true };
const alpaca = { id: 'alpaca', name: 'Alpaca (SIP)', tier: 'commercial', commercialOk: true, needsKey: true };
const eodhd = { id: 'eodhd', name: 'EODHD', tier: 'commercial', commercialOk: true, needsKey: true };
const fmp = { id: 'fmp', name: 'FMP (enterprise)', tier: 'commercial', commercialOk: true, needsKey: true };
const intrinio = { id: 'intrinio', name: 'Intrinio', tier: 'commercial', commercialOk: true, needsKey: true };
const benzinga = { id: 'benzinga', name: 'Benzinga', tier: 'commercial', commercialOk: true, needsKey: true };

// The eight data groups. `band` = whether it works on free feeds today ('free-now')
// or needs a new paid feed ('paid-feed'). `defaultMode` = merge or prime+backup.
export const GROUPS = [
  { id: 'price', n: 1, name: 'Price & trading', band: 'free-now', defaultMode: 'prime',
    note: 'Quote, change, open/close, day range — free from Yahoo/TradingView; paid is the licensed tier of the same feed.',
    providers: [demo, yahoo, tradingview, polygon, alpaca, finnhubFree] },
  { id: 'volume', n: 2, name: 'Volume & liquidity', band: 'free-now', defaultMode: 'prime',
    note: 'Volume rides every price bar; relative/dollar volume are computed.',
    providers: [demo, yahoo, polygon, alpaca] },
  { id: 'range', n: 3, name: 'Performance & range', band: 'free-now', defaultMode: 'prime',
    note: 'ADR/ATR/52-week and period ranges — computed from the price bars.',
    providers: [demo, computed] },
  { id: 'indicators', n: 4, name: 'Technical indicators', band: 'free-now', defaultMode: 'prime',
    note: 'EMA/RSI/MACD/… — computed by us from the price bars, no separate feed.',
    providers: [demo, computed] },
  { id: 'fundamentals', n: 5, name: 'Fundamentals & valuation', band: 'paid-feed', defaultMode: 'prime',
    note: 'Raw financials are free from SEC EDGAR; forward/ratio data needs a licensed vendor.',
    providers: [demo, edgar, eodhd, fmp, intrinio] },
  { id: 'growth', n: 6, name: 'Growth & estimates', band: 'paid-feed', defaultMode: 'prime',
    note: 'EPS/revenue growth is computed from EDGAR; analyst estimates/targets need a paid feed.',
    providers: [demo, edgar, fmp, eodhd, finnhubFree] },
  { id: 'classification', n: 7, name: 'Security & classification', band: 'free-now', defaultMode: 'prime',
    note: 'Sector/industry/exchange/type — free from Yahoo/Finnhub; paid is the licensed tier.',
    providers: [demo, yahoo, finnhubFree, eodhd, fmp] },
  { id: 'events', n: 8, name: 'Events & market state', band: 'paid-feed', defaultMode: 'merge',
    note: 'SEC 8-K + macro (FRED) are free; real-time news and forward earnings dates need a paid feed.',
    providers: [demo, sec8k, fred, benzinga, fmp] },
];

const byId = Object.fromEntries(GROUPS.map((g) => [g.id, g]));
const prov = (g, id) => g.providers.find((p) => p.id === id);
const J = (v, d) => { try { return v ? JSON.parse(v) : d; } catch { return d; } };

// Create default rows the first time (idempotent): personal mode, every group on demo.
export function ensureSeeded(db) {
  if (!one(db, `SELECT key FROM app_setting WHERE key='mode'`)) {
    run(db, `INSERT INTO app_setting (key,value) VALUES ('mode','personal')`);
  }
  for (const g of GROUPS) {
    if (!one(db, `SELECT id FROM source_group WHERE id=?`, g.id)) {
      run(db, `INSERT INTO source_group (id,mode,active,keys) VALUES (?,?,?,?)`, g.id, g.defaultMode, '["demo"]', '{}');
    }
  }
}

export const getMode = (db) => (one(db, `SELECT value FROM app_setting WHERE key='mode'`)?.value) || 'personal';

export function setMode(db, mode) {
  if (mode !== 'personal' && mode !== 'commercial') throw new Error('mode must be personal or commercial');
  run(db, `INSERT INTO app_setting (key,value) VALUES ('mode',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, mode);
  return config(db);
}

const rowFor = (db, id) => one(db, `SELECT * FROM source_group WHERE id=?`, id) || { id, mode: byId[id]?.defaultMode || 'prime', active: '["demo"]', keys: '{}' };

// The full config: the run mode and, per group, its providers (with status), the
// active selection, and whether the current mode blocks it (a non-commercial-ok
// provider active while commercial).
export function config(db) {
  const mode = getMode(db);
  const groups = GROUPS.map((g) => {
    const r = rowFor(db, g.id);
    const active = J(r.active, ['demo']);
    const keys = J(r.keys, {});
    const providers = g.providers.map((p) => ({
      id: p.id, name: p.name, tier: p.tier, commercialOk: p.commercialOk, needsKey: p.needsKey,
      hasKey: !!keys[p.id], active: active.includes(p.id),
      usableNow: mode === 'commercial' ? p.commercialOk : true,
    }));
    const blocked = mode === 'commercial' && active.some((id) => !prov(g, id)?.commercialOk);
    return { id: g.id, n: g.n, name: g.name, band: g.band, note: g.note, mode: r.mode, active, providers, blocked };
  });
  return { mode, groups };
}

export function setGroup(db, groupId, { mode, active }) {
  const g = byId[groupId];
  if (!g) throw new Error('unknown group ' + groupId);
  const appMode = getMode(db);
  const ids = Array.isArray(active) ? active : [active];
  if (!ids.length) throw new Error('at least one provider must be active');
  for (const id of ids) {
    const p = prov(g, id);
    if (!p) throw new Error(`provider ${id} is not available for ${groupId}`);
    if (appMode === 'commercial' && !p.commercialOk) throw new Error(`${p.name} is not licensed for commercial use — pick a licensed provider`);
  }
  const m = mode === 'merge' ? 'merge' : 'prime';
  run(db, `INSERT INTO source_group (id,mode,active,keys) VALUES (?,?,?, COALESCE((SELECT keys FROM source_group WHERE id=?),'{}'))
           ON CONFLICT(id) DO UPDATE SET mode=excluded.mode, active=excluded.active`, groupId, m, JSON.stringify(ids), groupId);
  return config(db);
}

export function setKey(db, groupId, providerId, key) {
  const g = byId[groupId];
  if (!g) throw new Error('unknown group ' + groupId);
  if (!prov(g, providerId)) throw new Error(`provider ${providerId} is not available for ${groupId}`);
  const r = rowFor(db, groupId);
  const keys = J(r.keys, {});
  if (key) keys[providerId] = key; else delete keys[providerId];
  run(db, `INSERT INTO source_group (id,mode,active,keys) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET keys=excluded.keys`, groupId, r.mode, r.active || '["demo"]', JSON.stringify(keys));
  return { ok: true, groupId, providerId, hasKey: !!key };
}
