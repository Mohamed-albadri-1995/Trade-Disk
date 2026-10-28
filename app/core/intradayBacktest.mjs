// Trade-Disk — intraday screener backtest (the engine). Runs a SAVED strategy over
// the stocks a screener actually surfaced, on real 1-minute bars (Polygon), honouring
// the point-in-time rule: a stock is only tradeable from the minute it first appeared
// on the screener that day. It reuses the Lab's own simulate() — the same evaluator the
// chart preview and the daily backtest use — so a signal you'd see is the signal it trades.
//
// This module is pure: the API layer hands it the day's picks and a map of their minute
// bars (already fetched/cached) plus the strategy; it returns trades + an honest report.

import { simulate } from './lab/evaluate.mjs';
import { qpPrims } from './lab/qpprims.mjs';

const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
// minutes from the 9:30 ET open for a bar timestamp (seconds)
const etMinFromOpen = (tSec) => {
  const d = new Date(tSec * 1000);
  const s = d.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit' });
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m - 570;
};
const clock = (min) => { if (min == null) return null; const t = 570 + min; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(((t % 60) + 60) % 60).padStart(2, '0')}`; };

// pairs: [{day, ticker, firstSeenMin}] ; barsByKey: Map('day|ticker' -> [{t,o,h,l,c,v}])
// strategy: a Lab strategy doc ; opts: { fill, costBps }
export async function run(pairs, barsByKey, strategy, opts = {}) {
  const fill = opts.fill || 'desk', costBps = +opts.costBps || 0;
  const trades = [];
  const cov = { pairs: pairs.length, withBars: 0, noBars: 0, noSignal: 0 };
  for (const p of pairs) {
    const bars = barsByKey.get(`${p.day}|${p.ticker}`);
    if (!bars || bars.length < 5) { cov.noBars++; continue; }
    cov.withBars++;
    let sim;
    // indicators from the REAL qp library (Python) on this day's minute bars — the
    // same values the live algo trades; null → the JS library (bar-for-bar verified).
    try { const prims = await qpPrims(bars, strategy); sim = simulate(bars, strategy, { fill, costBps, prims }); } catch { continue; }
    const fsm = p.firstSeenMin;
    // point-in-time: a stock is tradeable only from the minute it first appeared on the
    // screen that day, and only in the regular session (no pre-market / after-hours entries).
    const kept = (sim.trades || []).filter((t) => {
      const m = etMinFromOpen(t.entry_ts);
      return m >= (fsm == null ? 0 : fsm) && m < 390;
    });
    if (!kept.length) { cov.noSignal++; continue; }
    for (const t of kept) trades.push({
      day: p.day, ticker: p.ticker, firstSeen: clock(fsm), entryEt: clock(etMinFromOpen(t.entry_ts)),
      entry: r2(t.entry), exit: r2(t.exit), ret: r2(t.ret), r: t.r == null ? null : r3(t.r),
      reason: t.reason, side: t.side, barsHeld: t.bars_held,
    });
  }
  trades.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : (a.entryEt || '').localeCompare(b.entryEt || '')));
  return { report: summarise(trades, cov, opts), trades };
}

function summarise(trades, cov, opts) {
  const n = trades.length;
  const withR = trades.filter((t) => t.r != null);
  const wins = withR.filter((t) => t.r > 0).length;
  const losses = withR.filter((t) => t.r < 0).length;
  const scratch = n - wins - losses;
  const sumR = withR.reduce((s, t) => s + t.r, 0);
  const sumRet = trades.reduce((s, t) => s + (t.ret || 0), 0);
  let pos = 0, neg = 0; for (const t of withR) (t.r > 0 ? pos += t.r : neg += -t.r);
  let eq = 0, peak = 0, mdd = 0; const curve = [];
  for (const t of withR) { eq += t.r; peak = Math.max(peak, eq); mdd = Math.min(mdd, eq - peak); curve.push(r3(eq)); }
  const resolved = wins + losses;
  return {
    counts: { trades: n, wins, losses, scratch },
    coverage: cov,
    winRate: resolved ? r3(wins / resolved) : null,
    expectancyR: withR.length ? r3(sumR / withR.length) : null,
    totalR: r3(sumR),
    avgReturnPct: n ? r2(sumRet / n) : null,
    profitFactor: neg ? r2(pos / neg) : (pos ? Infinity : null),
    maxDrawdownR: r3(mdd),
    equityCurveR: curve,
    headline: n
      ? `${n} trades · ${wins}W/${losses}L${scratch ? `/${scratch}=` : ''} · ${resolved ? Math.round(wins / resolved * 100) : 0}% win · ${r3(sumR)}R total · ${withR.length ? r3(sumR / withR.length) : 0}R/trade`
      : (cov.withBars ? 'No signals — the strategy produced no entries on the stocks that had bars.' : 'No minute bars yet for this screen/range — run again to fetch more (5/min on free Polygon).'),
    notes: [
      `Your strategy ran on real 1-minute bars; a stock was tradeable only from the minute it first appeared on the screen that day.`,
      cov.noBars ? `${cov.noBars} of ${cov.pairs} stock-days have no minute bars cached yet — re-run to fetch more (Polygon free tier is ~5 requests/min).` : `All ${cov.pairs} stock-days had minute bars.`,
      `R is the strategy's own risk unit (its stop). Costs: ${costNote(opts)}.`,
    ],
  };
}
const costNote = (opts) => (+opts.costBps ? `${opts.costBps} bps/side` : 'none');
