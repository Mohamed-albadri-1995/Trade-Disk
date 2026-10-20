// Trade-Disk — Radar's data API, on Supabase. Per-account data (shortlist, custom
// screeners + schedules) runs through the signed-in user's client (RLS-scoped);
// shared reads (the demo universe, the market snapshot, the feed config) come from
// the global tables any authenticated user may read. The live screener scans
// TradingView directly (no DB). Every function takes a per-request client `sb`.

import * as tv from '../providers/tradingview.mjs';
import { COLUMNS, listScreeners, getScreener, toCard } from '../core/screeners.mjs';
import { activeFor, getMode } from '../core/sources.mjs';
import { getMarket } from '../core/market.mjs';
import { buildAnalysis } from '../core/analysis.mjs';

const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

function mapStock(r) {
  return {
    t: r.t, n: r.n, p: r.p, c: r.c, abs: r.abs, s: r.s, r: r.r, adr: r.adr, pm: r.pm,
    pmHigh: r.pm_high, pmLow: r.pm_low, pmRange: r.pm_range, pmPct: r.pm_pct,
    cap: r.cap, capBand: r.cap_band, sec: r.sec, mark: r.mark, color: r.color,
    tags: Array.isArray(r.tags) ? r.tags : [], ema: !!r.ema, stacked: !!r.stacked, news: !!r.news, cs: !!r.cs,
    changeLine: Array.isArray(r.change_line) ? r.change_line : [],
  };
}

export async function stocks(sb) {
  return chk(await sb.from('radar_stock').select('*').order('sort')).map(mapStock);
}
export async function shortlist(sb) {
  return chk(await sb.from('radar_shortlist').select('ticker').order('added_at')).map((r) => r.ticker);
}
export async function toggleShortlist(sb, uid, ticker) {
  const existing = chk(await sb.from('radar_shortlist').select('ticker').eq('ticker', ticker).limit(1));
  if (existing[0]) { chk(await sb.from('radar_shortlist').delete().eq('ticker', ticker)); return { ticker, saved: false }; }
  chk(await sb.from('radar_shortlist').insert({ owner_id: uid, ticker }));
  return { ticker, saved: true };
}

// The feed the Price group is on, so the view shows a live/demo badge honestly.
async function feedInfo(sb) {
  const first = (await activeFor(sb, 'price'))[0] || { id: 'demo' };
  const live = first.id !== 'demo' && first.usable && !(first.needsKey && !first.hasKey);
  const at = chk(await sb.from('app_setting').select('value').eq('key', 'radar_refreshed_at').limit(1))[0]?.value || null;
  return { mode: await getMode(sb), provider: first.id, live, at };
}

export async function bundle(sb) {
  const [s, sl, fe] = await Promise.all([stocks(sb), shortlist(sb), feedInfo(sb)]);
  return { stocks: s, shortlist: sl, feed: fe, screeners: listScreeners() };
}

export const screeners = () => listScreeners();

// Run one screener against the active engine; Personal mode uses TradingView.
export async function scan(sb, key, limit = 50) {
  const def = getScreener(key);
  if (!def) return { error: `unknown screener "${key}"` };
  if (await getMode(sb) !== 'personal') {
    return { screener: def.name, key, error: 'The live screener runs in Personal mode (TradingView, personal-use). A licensed commercial screener is not wired yet.' };
  }
  const { totalCount, rows } = await tv.scan({ filters: def.filters, columns: COLUMNS, sort: def.sort, range: [0, limit] });
  return { screener: def.name, key, provider: 'tradingview', totalCount, count: rows.length, stocks: rows.map(toCard) };
}

// The per-stock analysis workspace, live from Yahoo + SEC EDGAR. `scan` carries the
// card context (name/sector/cap) from the result the user opened, for fields Yahoo
// doesn't provide. The live market snapshot feeds the market-direction factor.
export async function analysis(sb, ticker, scan = null) {
  const market = await getMarket(sb).catch(() => null);
  try {
    return await buildAnalysis(ticker, { scan, market });
  } catch (e) {
    return { ticker, live: false, error: String((e && e.message) || e) };
  }
}

// The market snapshot read model — live from Yahoo, lazily refreshed (core/market.mjs).
export async function market(sb) {
  return getMarket(sb);
}

// ── screener configs + scan schedules (per account) ──
export async function screenerConfigs(sb) {
  const rows = chk(await sb.from('radar_screener').select('*').order('sort').order('updated_at'));
  const custom = rows.filter((r) => r.kind === 'custom').map((r) => ({
    id: r.id, name: r.name, description: r.description || '', conditions: r.conditions || [],
    filters: (r.conditions || []).map((c) => c.metric), windows: r.windows || [], timezone: r.timezone,
  }));
  const schedules = {};
  for (const r of rows) if (r.kind === 'builtin') schedules[r.id] = { windows: r.windows || [], timezone: r.timezone };
  return { custom, schedules };
}

export async function saveScreenerConfig(sb, uid, cfg) {
  if (!cfg || !String(cfg.name || '').trim()) throw new Error('a screener name is required');
  const id = cfg.id || ('scr-' + Date.now());
  chk(await sb.from('radar_screener').upsert({
    owner_id: uid, id, kind: 'custom', name: String(cfg.name).trim(), description: cfg.description || '',
    conditions: cfg.conditions || [], windows: cfg.windows || [], timezone: cfg.timezone || 'device',
    sort: cfg.sort || 0, updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id,id' }));
  return screenerConfigs(sb);
}

export async function deleteScreenerConfig(sb, uid, id) {
  chk(await sb.from('radar_screener').delete().eq('id', id).eq('kind', 'custom'));
  return screenerConfigs(sb);
}

export async function saveSchedule(sb, uid, key, body) {
  const def = getScreener(key);
  if (!def) throw new Error('unknown screener ' + key);
  chk(await sb.from('radar_screener').upsert({
    owner_id: uid, id: key, kind: 'builtin', name: def.name, description: '',
    conditions: [], windows: body?.windows || [], timezone: body?.timezone || 'device', updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id,id' }));
  return screenerConfigs(sb);
}
