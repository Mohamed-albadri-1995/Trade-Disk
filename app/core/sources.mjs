// Trade-Disk — the dual-mode feed switch (DATA-CATALOG.md, DATA-SOURCES.md §3.7).
// The platform runs 'personal' (free sources) or 'commercial' (licensed). Each of
// the eight data groups picks its provider(s): one active with an ordered fallback
// ('prime'), or several merged ('merge'). 'demo' serves seeded demo data. Switching
// free↔paid is config only — the app's screens, API shape and look do not change.
//
// The config is global/operator state in Supabase (source_group + app_setting),
// read by any signed-in user and written only by an owner/admin (enforced by RLS).
// Every function takes a per-request Supabase client `sb`.

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
const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

export async function getMode(sb) {
  const data = chk(await sb.from('app_setting').select('value').eq('key', 'mode').limit(1));
  return (data[0]?.value) || 'personal';
}

export async function setMode(sb, mode) {
  if (mode !== 'personal' && mode !== 'commercial') throw new Error('mode must be personal or commercial');
  chk(await sb.from('app_setting').upsert({ key: 'mode', value: mode }, { onConflict: 'key' }));
  return config(sb);
}

async function rowFor(sb, id) {
  const data = chk(await sb.from('source_group').select('*').eq('id', id).limit(1));
  return data[0] || { id, mode: byId[id]?.defaultMode || 'prime', active: ['demo'], keys: {} };
}

// The full config: the run mode and, per group, its providers (with status), the
// active selection, and whether the current mode blocks it.
export async function config(sb) {
  const mode = await getMode(sb);
  const rows = chk(await sb.from('source_group').select('*'));
  const byRow = Object.fromEntries(rows.map((r) => [r.id, r]));
  const groups = GROUPS.map((g) => {
    const r = byRow[g.id] || { mode: g.defaultMode, active: ['demo'], keys: {} };
    const active = Array.isArray(r.active) ? r.active : ['demo'];
    const keys = r.keys || {};
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

// The providers feeding a group, in active order, tagged for the running mode.
export async function activeFor(sb, groupId) {
  const g = byId[groupId];
  if (!g) return [];
  const mode = await getMode(sb);
  const r = await rowFor(sb, groupId);
  const keys = r.keys || {};
  const active = Array.isArray(r.active) ? r.active : ['demo'];
  return active.map((id) => {
    const p = prov(g, id);
    if (!p) return { id, missing: true, usable: false };
    return { id, tier: p.tier, needsKey: p.needsKey, hasKey: !!keys[id], commercialOk: p.commercialOk,
      usable: mode === 'commercial' ? p.commercialOk : true, key: keys[id] || null };
  });
}

export async function setGroup(sb, groupId, { mode, active }) {
  const g = byId[groupId];
  if (!g) throw new Error('unknown group ' + groupId);
  const appMode = await getMode(sb);
  const ids = Array.isArray(active) ? active : [active];
  if (!ids.length) throw new Error('at least one provider must be active');
  for (const id of ids) {
    const p = prov(g, id);
    if (!p) throw new Error(`provider ${id} is not available for ${groupId}`);
    if (appMode === 'commercial' && !p.commercialOk) throw new Error(`${p.name} is not licensed for commercial use — pick a licensed provider`);
  }
  const r = await rowFor(sb, groupId);
  chk(await sb.from('source_group').upsert({ id: groupId, mode: mode === 'merge' ? 'merge' : 'prime', active: ids, keys: r.keys || {} }, { onConflict: 'id' }));
  return config(sb);
}

export async function setKey(sb, groupId, providerId, key) {
  const g = byId[groupId];
  if (!g) throw new Error('unknown group ' + groupId);
  if (!prov(g, providerId)) throw new Error(`provider ${providerId} is not available for ${groupId}`);
  const r = await rowFor(sb, groupId);
  const keys = r.keys || {};
  if (key) keys[providerId] = key; else delete keys[providerId];
  chk(await sb.from('source_group').upsert({ id: groupId, mode: r.mode, active: Array.isArray(r.active) ? r.active : ['demo'], keys }, { onConflict: 'id' }));
  return { ok: true, groupId, providerId, hasKey: !!key };
}
