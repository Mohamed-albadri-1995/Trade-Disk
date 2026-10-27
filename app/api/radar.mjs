// Trade-Disk — Radar's data API, on Supabase. Per-account data (shortlist, custom
// screeners + schedules) runs through the signed-in user's client (RLS-scoped);
// shared reads (the demo universe, the market snapshot, the feed config) come from
// the global tables any authenticated user may read. The live screener scans
// TradingView directly (no DB). Every function takes a per-request client `sb`.

import * as tv from '../providers/tradingview.mjs';
import * as yahoo from '../providers/yahoo.mjs';
import { COLUMNS, listScreeners, getScreener, toCard } from '../core/screeners.mjs';
import { conditionsToFilters } from '../core/screenerTranslate.mjs';
import { runScreener, readRegister, tickerStamps } from '../core/register.mjs';
import { collect, collectionStatus } from '../core/collect.mjs';
import { computeLabels } from '../core/labels.mjs';
import { activeFor, getMode } from '../core/sources.mjs';
import { getMarket } from '../core/market.mjs';
import { getGroups } from '../core/oneilGroups.mjs';
import { buildAnalysis } from '../core/analysis.mjs';

const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

// A compact market read for the screener/register response, so running any scan
// carries the current broad-market regime to the UI (and the cards' market context).
function marketSummary(snap) {
  if (!snap) return null;
  return { regime: snap.regime?.output || null, bias: snap.regime?.bias || null, asOf: snap.asOf || null, live: !!snap.live };
}

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
  const [s, sl, fe, cfg] = await Promise.all([stocks(sb), shortlist(sb), feedInfo(sb), screenerConfigs(sb)]);
  // The preset list is the built-ins PLUS the user's saved custom screeners, so a
  // custom screener is selectable and runs (into its own daily register) like any other.
  const custom = cfg.custom.map((c) => ({ key: c.id, name: c.name, note: c.description || 'Custom screener', conditions: c.conditions, custom: true }));
  return { stocks: s, shortlist: sl, feed: fe, screeners: [...listScreeners(), ...custom] };
}

export const screeners = () => listScreeners();

// Run one screener (built-in OR saved custom) against the active engine and merge the
// results into today's register (the sticky list). Personal mode uses TradingView.
// Running any scan also force-refreshes the market snapshot, so the Market tab and the
// cards' market context update on every scan.
export async function scan(sb, uid, key, limit = 50) {
  if (await getMode(sb) !== 'personal') {
    return { key, error: 'The live screener runs in Personal mode (TradingView, personal-use). A licensed commercial screener is not wired yet.' };
  }
  const def = getScreener(key);
  let filters, sort, name, unsupported = [];
  if (def) { filters = def.filters; sort = def.sort; name = def.name; }
  else {
    const cfg = chk(await sb.from('radar_screener').select('*').eq('owner_id', uid).eq('id', key).eq('kind', 'custom').limit(1))[0];
    if (!cfg) return { key, error: `unknown screener "${key}"` };
    const t = conditionsToFilters(cfg.conditions || []);
    unsupported = t.unsupported;
    if (!t.filters.length) return { key, screener: cfg.name, error: 'This screener has no runnable conditions yet.', unsupported };
    filters = t.filters; sort = { sortBy: 'relative_volume_10d_calc', sortOrder: 'desc' }; name = cfg.name;
  }
  let reg;
  try { reg = await runScreener(sb, uid, { key, filters, sort, limit }); }
  catch (e) {
    // Live scan failed (market closed, provider hiccup/rate-limit). Don't wipe the
    // day's sticky list — fall back to today's saved register so the stocks that
    // already appeared (now "not live") stay on screen instead of the view going blank.
    const saved = await readRegister(sb, key).catch(() => null);
    if (saved && saved.count) return { key, screener: name, provider: 'tradingview', ...saved, stale: true, scanError: String(e.message || e) };
    return { key, screener: name, error: String(e.message || e) };
  }
  const market = await getMarket(sb, { force: true }).catch(() => null);
  return { screener: name, key, provider: 'tradingview', ...reg, market: marketSummary(market), unsupported };
}

// Builder "Run": preview the current (possibly unsaved) conditions live, without
// touching the register — a quick test of what the rules return right now.
export async function previewConditions(sb, body) {
  if (await getMode(sb) !== 'personal') return { error: 'The live screener runs in Personal mode (TradingView, personal-use).' };
  const t = conditionsToFilters(body?.conditions || []);
  if (!t.filters.length) return { error: 'No runnable conditions — add at least one the live scanner supports.', unsupported: t.unsupported };
  const sort = body?.sort || { sortBy: 'relative_volume_10d_calc', sortOrder: 'desc' };
  const { totalCount, rows } = await tv.scan({ filters: t.filters, columns: COLUMNS, sort, range: [0, Math.min(100, +body?.limit || 50)] });
  return { provider: 'tradingview', totalCount, count: rows.length, stocks: rows.map(toCard), unsupported: t.unsupported };
}

// Today's register for a screener without running a new scan (page revisit / tab switch).
export async function register(sb, key) { return readRegister(sb, key); }

// Daily bars for one symbol (index/ETF/stock) — for the Market tab's quick chart popup.
export async function bars(sb, ticker) {
  const t = String(ticker || '').toUpperCase();
  if (!t) return { error: 'no symbol' };
  try {
    const { meta, bars } = await yahoo.chart(t, { range: '2y', interval: '1d' });
    return { symbol: t, name: meta?.shortName || meta?.longName || t, bars: (bars || []).map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v })) };
  } catch (e) { return { symbol: t, error: String(e.message || e) }; }
}

// ── data collection (the feature store for model-building) ──
// Collect a snapshot now for one screener (manual run of what the scheduler does).
export async function collectNow(sb, uid, key) { return collect(sb, uid, key); }
// What has been collected today (counts + the times snapshots were taken).
export async function collectStatus(sb) { return collectionStatus(sb); }
// Compute today's outcome labels now (normally the scheduler does this after the close).
export async function labelsNow(sb, uid) { return computeLabels(sb, uid); }
// Export a day's collected data (owner-scoped) as JSON, for model-building offline.
export async function exportData(sb, day) {
  const d = day || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const [snapshots, market, facts, labels] = await Promise.all([
    sb.from('radar_snapshot').select('*').eq('day', d).order('taken_at').then(chk),
    sb.from('radar_snapshot_market').select('*').eq('day', d).order('taken_at').then(chk),
    sb.from('radar_snapshot_facts').select('*').eq('day', d).then(chk),
    sb.from('radar_snapshot_label').select('*').eq('day', d).then(chk),
  ]);
  return { day: d, snapshots, market, facts, labels };
}

// The per-stock analysis workspace, live from Yahoo + SEC EDGAR. `scan` carries the
// card context (name/sector/cap) from the result the user opened, for fields Yahoo
// doesn't provide. The live market snapshot feeds the market-direction factor.
export async function analysis(sb, ticker, scan = null) {
  const [market, stamps] = await Promise.all([
    getMarket(sb).catch(() => null),
    tickerStamps(sb, ticker).catch(() => null),  // first-seen / last-live today, for the hero
  ]);
  try {
    const a = await buildAnalysis(ticker, { scan, market });
    return { ...a, stamps };
  } catch (e) {
    return { ticker, live: false, error: String((e && e.message) || e) };
  }
}

// Industry Group Leadership (O'Neil "L") — live S&P 500 group RS ranking, background-
// built and cached daily (core/oneilGroups.mjs). Returns {computing:true} while it builds.
export async function groups(sb) {
  return getGroups(sb);
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
