// Trade-Disk — the bridge from a Lab strategy's primitive operands to the REAL qp
// library (the Python qp-compute service). For a bars frame + a strategy it asks
// qp-compute for the exact series of every CORE primitive the strategy names and
// returns a Map keyed by evaluate.mjs's primKey — the map the engine reads through
// opts.prims. The engine falls back to its own JS library (library.mjs) for any
// primitive NOT in this map, so less-common primitives keep working and a qp outage
// degrades gracefully to the (bar-for-bar verified) JS values.
//
// WHY this exists: the live algo imports this same qp/primitives package. Feeding
// the backtest and the chart the SAME values means a signal you backtest is the
// signal the algo trades — no second implementation drifting from the first. (The
// strategy ENGINE — entries, stops, fills — is still evaluate.mjs for now; only the
// market math moves to qp. The Python engine is a later, deliberate step.)

import * as qpc from '../../api/qpcompute.mjs';
import { collectPrimitives, primKey } from './evaluate.mjs';

// Lab primitive name → qp-compute key. Only the primitives whose math a trader
// tunes and that MUST match the algo exactly (and that qp implements identically):
// the moving averages, RSI, session VWAP, and the volatility family. Anything not
// here (pivots, candle anatomy, slope, relative/average volume, window highs/lows,
// previous-bar levels, highest/lowest) stays on the JS library, which is bar-for-bar
// verified against these same qp primitives.
const QP_KEY = {
  sma: 'ma.sma', ema: 'ma.ema', wma: 'ma.wma', rma: 'ma.rma', vwma: 'ma.vwma', hma: 'ma.hma',
  rsi: 'osc.rsi',
  vwap: 'vwap.session',
  true_range: 'volatility.true_range', atr: 'volatility.atr', stdev: 'volatility.stdev', bb: 'volatility.bb',
};
// For a multi-line qp primitive, the line to read when the operand names no `sub`
// (these match library.mjs's own defaults — bb's first line is the upper band).
const DEFAULT_SUB = { bb: 'upper' };

// Daily or coarser? (median bar spacing ≥ 12h). On daily frames session VWAP has no
// intraday session, so qp.vwap.session accumulates across days — not what a daily
// chart means. The MAs/RSI/ATR/BB/stdev/true_range are bar-for-bar identical to the
// JS library on daily, so routing them through qp is a no-op numerically; only vwap
// is carved out on daily and left to the JS library's daily HLC3 convention. On
// intraday, vwap IS routed through qp — the real RTH session VWAP the live algo uses.
function isDaily(bars) {
  if (bars.length < 3) return false;
  const d = [];
  for (let i = 1; i < bars.length; i++) d.push(bars[i].t - bars[i - 1].t);
  d.sort((a, b) => a - b);
  return d[d.length >> 1] >= 12 * 3600;
}

// Returns Map(primKey -> number[]) for the strategy's CORE primitives on these bars,
// or null when qp-compute is not configured or produced nothing usable (→ the engine
// then computes every primitive with the JS library, exactly as before).
export async function qpPrims(bars, strat) {
  if (!qpc.configured() || !bars || !bars.length) return null;
  const daily = isDaily(bars);
  const specs = collectPrimitives(strat).filter((s) => QP_KEY[s.name] && !(daily && s.name === 'vwap'));
  if (!specs.length) return null;
  // one overlay per spec; the id is the spec index so the result keys back by primKey
  const overlays = specs.map((s, i) => ({ id: String(i), key: QP_KEY[s.name], source: s.source || 'close', params: s.params || {} }));
  let res;
  try { res = await qpc.compute(bars, overlays); } catch { return null; }   // outage → JS fallback everywhere
  const out = new Map();
  for (const sr of res.series || []) {
    const spec = specs[+sr.id];
    if (!spec || sr.error) continue;
    let vals = null;
    if (sr.values) vals = sr.values;
    else if (sr.lines) { const line = (spec.sub && sr.lines[spec.sub]) ? spec.sub : (DEFAULT_SUB[spec.name] || Object.keys(sr.lines)[0]); vals = sr.lines[line]; }
    if (!vals) continue;
    // keep only when qp produced at least one real value. Session VWAP on DAILY bars
    // is all-null (a daily bar has no intraday session) — dropping it lets the engine
    // fall back to the JS library's daily convention instead of trading an all-NaN
    // series. Primitives that legitimately have values are always kept.
    if (!vals.some((v) => v != null && Number.isFinite(v))) continue;
    out.set(primKey(spec), vals.map((v) => (v == null ? NaN : v)));
  }
  return out.size ? out : null;
}
