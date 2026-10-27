// Trade-Disk — the intraday screener backtest API (the one the user actually asked
// for): take a SAVED strategy and run it, on real 1-minute bars, over the stocks a
// screener really surfaced on real days. It answers "if I had traded my strategy on
// what THIS screen showed me, that day, what would it have done?" — honouring the
// point-in-time rule (a stock is tradeable only from the minute it first appeared).
//
// Minute bars come from Polygon (free tier ≈ 5 requests/min). So a run is cache-first:
// it uses every bar already stored, fetches up to FETCH_BUDGET new stock-days, and
// reports how many still need bars. Re-run (after ~a minute) to fill the rest; once a
// stock-day is cached, later runs are instant. The run itself (over whatever is cached)
// is always complete and honest — coverage says exactly what it saw.
//
// Per-account data (history, strategies, the saved run, the bar cache) rides the
// signed-in user's RLS-scoped client `sb`. The engine (core/intradayBacktest.mjs) is
// pure; this layer only moves data in and out of it.

import { bars as fetchBars, hasKey } from '../providers/polygon.mjs';
import { run as runEngine } from '../core/intradayBacktest.mjs';
import { validateStrategy } from '../core/lab/evaluate.mjs';

const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const FETCH_BUDGET = 5;   // new stock-days fetched per run (Polygon free tier ≈ 5/min)
const MAX_PAIRS = 300;    // universe cap per run (narrow the dates to cover a bigger screen)

// ── the Polygon API key (stored in app_setting; the field in the Lab writes it) ──
async function getKey(sb) {
  const d = chk(await sb.from('app_setting').select('value').eq('key', 'polygon_api_key').limit(1));
  return (d[0]?.value || '').trim();
}
export async function keyStatus(sb) {
  const k = await getKey(sb);
  return { hasKey: hasKey(k), masked: k ? `${k.slice(0, 3)}…${k.slice(-3)}` : null };
}
export async function saveKey(sb, key) {
  const v = String(key || '').trim();
  chk(await sb.from('app_setting').upsert({ key: 'polygon_api_key', value: v }, { onConflict: 'key' }));
  return { ok: true, hasKey: hasKey(v), masked: v ? `${v.slice(0, 3)}…${v.slice(-3)}` : null };
}

// ── the pickable screens (the migrated daily record's catalog) ──
export async function screens(sb) {
  return chk(await sb.from('radar_screen_catalog')
    .select('screen,name,src,status,first_day,last_day,days,members')
    .order('members', { ascending: false }));
}

// Every stock a screen surfaced in [start,end] → [{day, ticker, firstSeenMin}].
async function loadPairs(sb, screen, start, end) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('radar_history')
      .select('day,ticker,first_seen_min')
      .eq('screen', screen).gte('day', start).lte('day', end)
      .order('day').range(from, from + 999);
    if (error) throw new Error('radar_history: ' + error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out.map((h) => ({ day: h.day, ticker: h.ticker, firstSeenMin: h.first_seen_min }));
}

// Load whatever bars are already cached for these pairs (a cached row — even empty —
// counts as "known", so we never re-spend budget on a day that genuinely has no data).
async function loadCache(sb, pairs, interval) {
  const map = new Map();
  if (!pairs.length) return map;
  const want = new Set(pairs.map((p) => `${p.day}|${p.ticker}`));
  const days = [...new Set(pairs.map((p) => p.day))];
  const ticks = [...new Set(pairs.map((p) => p.ticker))];
  for (let i = 0; i < ticks.length; i += 100) {       // chunk tickers (keep the URL small)
    const batch = ticks.slice(i, i + 100);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('polygon_bars')
        .select('ticker,day,bars').eq('interval', interval).in('ticker', batch).in('day', days).range(from, from + 999);
      if (error) throw new Error('polygon_bars: ' + error.message);
      for (const r of (data || [])) { const k = `${r.day}|${r.ticker}`; if (want.has(k)) map.set(k, r.bars || []); }
      if (!data || data.length < 1000) break;
    }
  }
  return map;
}

// Fetch up to FETCH_BUDGET missing stock-days from Polygon, cache each, stop on a 429.
async function fillCache(sb, uid, pairs, cache, key, mult, interval) {
  const need = pairs.filter((p) => !cache.has(`${p.day}|${p.ticker}`));
  let fetched = 0, rateLimited = false;
  for (const p of need) {
    if (fetched >= FETCH_BUDGET) break;
    let r;
    try { r = await fetchBars(p.ticker, p.day, key, mult); }
    catch { continue; }                               // bad ticker/day — skip, try the next
    if (r.rateLimited) { rateLimited = true; break; }
    fetched++;
    const got = r.bars || [];
    cache.set(`${p.day}|${p.ticker}`, got);
    chk(await sb.from('polygon_bars').upsert(
      { owner_id: uid, ticker: p.ticker, day: p.day, interval, bars: got, n: got.length, fetched_at: new Date().toISOString() },
      { onConflict: 'owner_id,ticker,day,interval' }));
  }
  return { fetched, rateLimited, needed: need.length };
}

// Run one intraday backtest, persist it (kind 'intraday' in lab_backtest), return it.
export async function runIntraday(sb, uid, spec = {}) {
  const key = await getKey(sb);
  if (!hasKey(key)) throw new Error('Add your Polygon API key first (the field above) — intraday minute bars come from Polygon.');
  const strategy = spec.strategy;
  const v = validateStrategy(strategy);
  if (!v.ok) throw new Error('invalid strategy: ' + v.errors.join('; '));
  const screen = String(spec.screen || '').trim();
  if (!screen) throw new Error('pick a screen');

  const cat = chk(await sb.from('radar_screen_catalog').select('*').eq('screen', screen).limit(1))[0];
  if (!cat) throw new Error(`unknown screen "${screen}"`);
  const start = spec.start || cat.first_day;
  const end = spec.end || cat.last_day;

  const interval = ['1', '5', '15'].includes(String(spec.interval)) ? String(spec.interval) : '1';
  const mult = +interval;
  const all = await loadPairs(sb, screen, start, end);
  const pairs = all.slice(0, MAX_PAIRS);
  const cache = await loadCache(sb, pairs, interval);
  const fill = await fillCache(sb, uid, pairs, cache, key, mult, interval);

  const opts = { fill: spec.fill || 'next_open', costBps: Math.max(0, +spec.costBps || 0) };
  const { report, trades } = runEngine(pairs, cache, strategy, opts);

  const cached = pairs.filter((p) => cache.has(`${p.day}|${p.ticker}`)).length;
  const missing = pairs.length - cached;
  report.fetch = {
    universe: all.length, consideredThisRun: pairs.length, cached, missing, interval,
    fetchedThisRun: fill.fetched, rateLimited: fill.rateLimited,
    note: fill.rateLimited
      ? `Polygon's free limit (≈5/min) was hit — wait ~1 minute and run again to fetch the remaining ${missing}.`
      : (missing > 0
        ? `${missing} stock-day${missing === 1 ? '' : 's'} still need bars — run again to fetch up to ${FETCH_BUDGET} more (≈5/min on the free tier).`
        : `All ${pairs.length} stock-days have bars cached — this run is complete.`),
    ...(all.length > MAX_PAIRS ? { capped: `Universe capped at ${MAX_PAIRS} of ${all.length} stock-days per run — narrow the date range to cover the rest.` } : {}),
  };

  const tf = interval === '1' ? '1m' : `${interval}m`;
  const id = 'id-' + Date.now().toString(36);
  const name = `${cat.name} · ${tf} · ${start}→${end}`;
  chk(await sb.from('lab_backtest').insert({
    owner_id: uid, id, name, status: 'done',
    spec: { kind: 'intraday', screen, screenName: cat.name, start, end, interval, fill: opts.fill, costBps: opts.costBps, strategy },
    report, trades,
  }));
  return { id, name, report, trades, spec: { kind: 'intraday', screen, start, end, interval, fill: opts.fill, costBps: opts.costBps } };
}

export async function listIntraday(sb) {
  const rows = chk(await sb.from('lab_backtest').select('id,name,status,created_at,report,spec')
    .eq('spec->>kind', 'intraday').order('created_at', { ascending: false }).limit(50));
  return rows.map((r) => ({ id: r.id, name: r.name, status: r.status, created_at: r.created_at, headline: r.report?.headline || null, screen: r.spec?.screen || null }));
}
