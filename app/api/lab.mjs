// Trade-Disk — the Lab's API, on Supabase. Per-account data (strategies, their
// versions, backtests) runs through the signed-in user's RLS-scoped client `sb`.
// Market math and the backtest come from core/lab/* — the one engine the chart
// preview and the backtest share, so what you see is what it trades. Bars are
// free Yahoo daily.

import * as yahoo from '../providers/yahoo.mjs';
import { catalogue, compute, LIB } from '../core/lab/library.mjs';
import { simulate, validateStrategy, FILLS, primKey } from '../core/lab/evaluate.mjs';
import { qpPrims } from '../core/lab/qpprims.mjs';
import { runBacktest } from '../core/lab/backtest.mjs';
import { screenReplay } from '../core/replay.mjs';
import { TEMPLATES } from '../core/lab/templates.mjs';

const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const RANGES = { '6mo': '6mo', '1y': '1y', '2y': '2y', '5y': '5y' };

// The grammar + library meta the builder UI needs to offer rules and indicators.
export function meta() {
  return {
    primitives: catalogue(),
    sources: ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4', 'volume'],
    operators: [
      { op: 'gt', label: 'is above (>)' }, { op: 'lt', label: 'is below (<)' },
      { op: 'ge', label: 'at or above (≥)' }, { op: 'le', label: 'at or below (≤)' },
      { op: 'cross_above', label: 'crosses above' }, { op: 'cross_below', label: 'crosses below' },
      { op: 'gt_pct', label: 'is above by ≥ %', pct: true }, { op: 'lt_pct', label: 'is below by ≥ %', pct: true },
      { op: 'rising', label: 'is rising', solo: true }, { op: 'falling', label: 'is falling', solo: true },
      { op: 'bounce_up', label: 'bounces up off' }, { op: 'bounce_down', label: 'bounces down off' },
    ],
    groups: ['AND', 'OR', 'ATLEAST', 'THEN'],
    fills: FILLS,
    stopTypes: ['pct', 'atr', 'points', 'prim'],
    templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name, side: t.side, about: t.about, doc: t.doc })),
  };
}

// ── chart + preview ──
// Bars for a symbol, with any requested indicator overlays computed by the one
// library (never a second implementation on the client).
export async function chartData(symbol, range = '1y', overlays = []) {
  const { meta: m, bars } = await yahoo.chart(symbol, { range: RANGES[range] || '1y', interval: '1d' });
  const series = {};
  for (const ov of overlays || []) {
    if (!LIB[ov.name] && !ov.name?.includes('.')) continue;
    try { series[ov.key || ov.name] = compute(bars, ov).map((v) => (Number.isFinite(v) ? +v.toFixed(4) : null)); } catch { /* skip bad overlay */ }
  }
  return { symbol: symbol.toUpperCase(), name: m.shortName || m.longName || symbol.toUpperCase(), bars, overlays: series };
}

// Run one strategy over one symbol for the chart drawer: the trades it would have
// taken, the bars where entry is true, and the indicator overlays it references.
export async function preview(symbol, strategy, opts = {}) {
  const v = validateStrategy(strategy);
  if (!v.ok) return { error: v.errors.join('; '), validation: v };
  const { meta: m, bars } = await yahoo.chart(symbol, { range: RANGES[opts.range] || '1y', interval: '1d' });
  // One source of truth: the REAL qp library (Python) computes the indicators; the
  // engine trades those exact series and the chart draws them (JS fallback if qp is
  // down or doesn't cover a primitive), so the overlay you see IS what it traded.
  const prims = await qpPrims(bars, strategy);
  const { trades, entrySig } = simulate(bars, strategy, { fill: opts.fill, costBps: +opts.costBps || 0, prims });
  const overlays = {};
  for (const ov of indicatorsIn(strategy)) {
    try {
      const vals = prims && prims.get(primKey({ name: ov.name, source: ov.source, params: ov.params, sub: ov.sub }));
      overlays[ov.key] = (vals || compute(bars, ov)).map((x) => (Number.isFinite(x) ? +x.toFixed(4) : null));
    } catch { /* skip */ }
  }
  return {
    symbol: symbol.toUpperCase(), name: m.shortName || m.longName || symbol.toUpperCase(),
    bars, overlays, trades,
    entryBars: entrySig.map((b, i) => (b ? bars[i].t : null)).filter(Boolean),
    lastEntryTrue: !!entrySig[bars.length - 1],
  };
}

// Pull the distinct primitive operands a strategy names, for charting.
function indicatorsIn(strat) {
  const out = new Map();
  const walk = (g) => { for (const r of g?.rules || []) { if (r.logic) { walk(r); continue; } for (const op of [r.left, r.right]) collect(op, out); } };
  const collect = (op, m) => {
    if (!op) return;
    if (op.kind === 'primitive') { const key = `${op.name}${op.sub ? '.' + op.sub : ''}_${JSON.stringify(op.params || {})}`; m.set(key, { key, name: op.name, sub: op.sub, source: op.source, params: op.params }); }
    if (op.kind === 'expr') { collect(op.left, m); collect(op.right, m); }
  };
  walk(strat.entry); walk(strat.exit);
  if (strat.risk?.sl?.type === 'prim') out.set('sl', { key: 'sl', name: strat.risk.sl.anchor, sub: strat.risk.sl.sub, source: strat.risk.sl.source, params: strat.risk.sl.params });
  return [...out.values()];
}

// ── strategies (per account) ──
export async function listStrategies(sb) {
  const rows = chk(await sb.from('lab_strategy').select('id,name,side,stage,version,updated_at').order('updated_at', { ascending: false }));
  return rows;
}
export async function getStrategy(sb, id) {
  const row = chk(await sb.from('lab_strategy').select('*').eq('id', id).limit(1))[0];
  return row || null;
}
export async function saveStrategy(sb, uid, body) {
  const doc = body?.doc || body;
  const v = validateStrategy(doc);
  if (!v.ok) throw new Error('invalid strategy: ' + v.errors.join('; '));
  const id = body.id || doc.id || ('str-' + Date.now().toString(36));
  const existing = chk(await sb.from('lab_strategy').select('version').eq('id', id).limit(1))[0];
  const version = (existing?.version || 0) + 1;
  const name = String(doc.name || 'Untitled strategy').slice(0, 120);
  const now = new Date().toISOString();
  chk(await sb.from('lab_strategy').upsert({
    owner_id: uid, id, name, side: doc.side || 'long', stage: doc.stage || 'development',
    doc: { ...doc, id, name }, version, updated_at: now,
    ...(existing ? {} : { created_at: now }),
  }, { onConflict: 'owner_id,id' }));
  chk(await sb.from('lab_strategy_version').insert({ owner_id: uid, strategy_id: id, version, name, doc: { ...doc, id, name } }));
  return { id, version, name };
}
export async function deleteStrategy(sb, id) {
  chk(await sb.from('lab_strategy').delete().eq('id', id));
  chk(await sb.from('lab_strategy_version').delete().eq('strategy_id', id));
  return { id, deleted: true };
}

// ── backtests (per account) ──
const MAX_SYMBOLS = 60;

async function resolveUniverse(sb, universe) {
  if (universe?.kind === 'shortlist') {
    const rows = chk(await sb.from('radar_shortlist').select('ticker').order('added_at'));
    return rows.map((r) => r.ticker);
  }
  if (universe?.kind === 'screener') {
    const screen = String(universe.screen || '').trim();
    if (!screen) throw new Error('pick a screen');
    const rows = [];
    for (let from = 0; ; from += 1000) {
      let q = sb.from('radar_history').select('ticker').eq('screen', screen);
      if (universe.start) q = q.gte('day', universe.start);
      if (universe.end) q = q.lte('day', universe.end);
      const { data, error } = await q.range(from, from + 999);
      if (error) throw new Error('radar_history: ' + error.message);
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return [...new Set(rows.map((r) => r.ticker))];   // distinct tickers the screen surfaced
  }
  return (universe?.symbols || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
}

export async function runBacktestApi(sb, uid, spec) {
  const symbols = (await resolveUniverse(sb, spec.universe)).slice(0, MAX_SYMBOLS);
  if (!symbols.length) throw new Error('the universe is empty — add symbols or save a shortlist in Radar first');
  const v = validateStrategy(spec.strategy);
  if (!v.ok) throw new Error('invalid strategy: ' + v.errors.join('; '));
  const id = 'bt-' + Date.now().toString(36);
  const runSpec = { ...spec, universe: { kind: spec.universe?.kind || 'symbols', symbols } };
  let out;
  try {
    out = await runBacktest(runSpec, {});
  } catch (e) {
    chk(await sb.from('lab_backtest').insert({ owner_id: uid, id, name: spec.name || spec.strategy?.name || 'Backtest', status: 'error', spec: runSpec, error: String(e.message || e) }));
    throw e;
  }
  chk(await sb.from('lab_backtest').insert({
    owner_id: uid, id, name: spec.name || spec.strategy?.name || 'Backtest', status: 'done',
    spec: out.spec, report: out.report, trades: out.trades,
  }));
  return { id, status: 'done', report: out.report, trades: out.trades };
}

export async function listBacktests(sb) {
  const rows = chk(await sb.from('lab_backtest').select('id,name,status,created_at,report,spec').order('created_at', { ascending: false }).limit(60));
  return rows.map((r) => ({
    id: r.id, name: r.name, status: r.status, created_at: r.created_at,
    kind: r.spec?.kind || 'daily',                   // 'daily' | 'intraday' | 'screener-replay'
    headline: r.report?.headline ?? null, money: r.report?.money || '%',
  }));
}
export async function getBacktest(sb, id) {
  const row = chk(await sb.from('lab_backtest').select('*').eq('id', id).limit(1))[0];
  return row || null;
}
export async function deleteBacktest(sb, id) {
  chk(await sb.from('lab_backtest').delete().eq('id', id));
  return { id, deleted: true };
}

// ── screener replay (historical backtest over the migrated daily record) ──
// The pickable screens, with their window and size, for the replay chooser.
export async function replayScreens(sb) {
  const rows = chk(await sb.from('radar_screen_catalog')
    .select('screen,name,src,maps_to,status,filters,first_day,last_day,days,members')
    .order('members', { ascending: false }));
  return rows;
}

// Run one replay, persist it (kind 'screener-replay' in lab_backtest), return it.
export async function runReplay(sb, uid, spec) {
  const out = await screenReplay(sb, spec);
  const id = 'rp-' + Date.now().toString(36);
  const name = `${out.report.screenName} replay · ${out.report.window.start}→${out.report.window.end}`;
  chk(await sb.from('lab_backtest').insert({
    owner_id: uid, id, name, status: 'done',
    spec: { kind: 'screener-replay', ...out.spec }, report: out.report, trades: out.trades,
  }));
  return { id, name, report: out.report, trades: out.trades, spec: out.spec };
}

export async function listReplays(sb) {
  const rows = chk(await sb.from('lab_backtest').select('id,name,status,created_at,report,spec')
    .eq('spec->>kind', 'screener-replay').order('created_at', { ascending: false }).limit(50));
  return rows.map((r) => ({ id: r.id, name: r.name, status: r.status, created_at: r.created_at, headline: r.report?.headline || null, screen: r.spec?.screen || null }));
}
