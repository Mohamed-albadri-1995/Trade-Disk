// Trade-Disk — the Lab's backtest runner. A strategy, replayed over a range on a
// universe of symbols, honestly. For each symbol it calls the SAME simulate() the
// chart preview uses (evaluate.mjs), over that symbol's bars up to the range end,
// and keeps only the trades ENTERED inside the range (bars before the start are
// warm-up context, never trades) — so there is no second evaluator and no
// look-ahead. The report (report.mjs) is computed afterwards from the stored
// trades, in unit % or real-money account terms.

import * as yahoo from '../../providers/yahoo.mjs';
import { simulate } from './evaluate.mjs';
import { qpPrims } from './qpprims.mjs';
import { report } from './report.mjs';

const toUnix = (d) => Math.floor(new Date(d + 'T00:00:00Z').getTime() / 1000);

// Pick a Yahoo range that reaches back past the start (plus warm-up headroom).
function yahooRange(startUnix) {
  const years = (Date.now() / 1000 - startUnix) / (365 * 86400) + 0.3;
  if (years <= 1) return '1y';
  if (years <= 2) return '2y';
  if (years <= 5) return '5y';
  if (years <= 10) return '10y';
  return 'max';
}

// spec: { strategy, universe:{kind:'symbols'|'shortlist', symbols?}, start, end,
//         fill, costBps, feePerShare, feeMin, accounting:{mode,startEquity,riskPct|riskUsd} }
// deps: { getBars?(symbol,range)->{bars}, onProgress?(done,total,symbol) }
export async function runBacktest(spec, deps = {}) {
  const start = spec.start ? toUnix(spec.start) : 0;
  const end = spec.end ? toUnix(spec.end) + 86400 : Math.floor(Date.now() / 1000);
  const range = yahooRange(start || Date.now() / 1000 - 2 * 365 * 86400);
  const getBars = deps.getBars || ((sym) => yahoo.chart(sym, { range, interval: '1d' }));
  const symbols = (spec.universe?.symbols || []).map((s) => String(s).toUpperCase());
  if (!symbols.length) throw new Error('no symbols in the universe');

  const acct = spec.accounting || { mode: 'unit' };
  const all = [];
  const coverage = { requested: symbols.length, withBars: 0, empty: [], perSymbol: {} };

  let done = 0;
  for (let i = 0; i < symbols.length; i += 8) {                 // small chunks keep Yahoo happy
    await Promise.all(symbols.slice(i, i + 8).map(async (sym) => {
      let bars = [];
      try { ({ bars } = await getBars(sym, range)); } catch { bars = []; }
      done++; deps.onProgress?.(done, symbols.length, sym);
      if (!bars.length) { coverage.empty.push(sym); return; }
      coverage.withBars++;
      const usable = bars.filter((b) => b.t <= end);
      if (usable.length < 60) return;                            // need warm-up + range
      let trades;
      try {
        const prims = await qpPrims(usable, spec.strategy);      // the REAL qp library (Python); null → JS fallback
        ({ trades } = simulate(usable, spec.strategy, { fill: spec.fill, costBps: spec.costBps, prims }));
      } catch { return; }
      const inRange = trades.filter((t) => t.entry_ts >= start && t.entry_ts < end).map((t) => ({ ...t, symbol: sym }));
      coverage.perSymbol[sym] = inRange.length;
      all.push(...inRange);
    }));
  }

  all.sort((a, b) => a.entry_ts - b.entry_ts || a.exit_ts - b.exit_ts);

  // account sizing: shares from the stop so every stop-out risks the same budget;
  // equity compounds in entry order. Trades with no usable stop, or that the
  // buying power cannot take, are excluded and counted — never silently sized at 1.
  const accountInfo = { skippedNoStop: 0, skippedNoBuyingPower: 0 };
  if (acct.mode === 'account') {
    let equity = +acct.startEquity || 10000;
    const feePS = +spec.feePerShare || 0, feeMin = +spec.feeMin || 0;
    for (const t of all) {
      if (t.reason === 'open') { t.pnl = 0; continue; }
      const dir = t.side === 'short' ? -1 : 1;
      const rps = t.stop != null ? Math.abs(t.entry - t.stop) : null;
      if (!rps) { t.skipped = 'no stop'; accountInfo.skippedNoStop++; continue; }
      const budget = acct.riskUsd != null ? +acct.riskUsd : equity * (+acct.riskPct || 1) / 100;
      let shares = Math.floor(budget / rps);
      shares = Math.min(shares, Math.floor(equity / t.entry));   // no margin
      if (shares < 1) { t.skipped = 'buying power'; accountInfo.skippedNoBuyingPower++; continue; }
      const fees = Math.max(feeMin, feePS * shares) * 2;         // two orders
      const pnl = shares * t.entry * (t.ret / 100) - fees;
      t.shares = shares; t.pnl = Math.round(pnl * 100) / 100; equity += t.pnl; t.equityAfter = Math.round(equity * 100) / 100;
    }
  }
  const counted = acct.mode === 'account' ? all.filter((t) => t.skipped == null) : all;

  const rep = report(counted, { mode: acct.mode, startEquity: +acct.startEquity || 10000 });
  rep.coverage = coverage;
  if (acct.mode === 'account') rep.account = accountInfo;
  return { report: rep, trades: counted, spec: { ...spec, builtAt: new Date().toISOString() } };
}
