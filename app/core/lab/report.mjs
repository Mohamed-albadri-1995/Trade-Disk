// Trade-Disk — the Lab's report. Computed AFTER the run, from the stored trades,
// so it re-runs on any past backtest. Every number is honest about which money it
// is in: `unit` (per-trade %) or `account` ($). A backtest without costs lies, so
// costs are already in each trade's net return; an open position at the end is
// reported apart, never mixed into the win rate.

const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => (a.length ? sum(a) / a.length : 0);
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);

// trades: the simulate() rows, each augmented by accounting with { pnl, equityAfter }
// when mode==='account'. `field` is 'ret' (unit %) or 'pnl' ($).
export function report(trades, { mode = 'unit', startEquity = 10000 } = {}) {
  const money = mode === 'account' ? '$' : '%';
  const closed = trades.filter((t) => t.reason !== 'open');
  const open = trades.filter((t) => t.reason === 'open');
  const field = mode === 'account' ? 'pnl' : 'ret';
  const val = (t) => (mode === 'account' ? (t.pnl ?? 0) : t.ret);

  const wins = closed.filter((t) => val(t) > 0);
  const losses = closed.filter((t) => val(t) < 0);
  const evens = closed.filter((t) => val(t) === 0);
  const grossProfit = sum(wins.map(val));
  const grossLoss = -sum(losses.map(val));
  const net = sum(closed.map(val));

  // equity curve, marked at each exit, in trade (chronological) order
  const ordered = [...closed].sort((a, b) => a.exit_ts - b.exit_ts);
  let eq = mode === 'account' ? startEquity : 100;        // unit mode: 100 = a compounding index
  const curve = [{ t: ordered[0]?.entry_ts ?? null, equity: r2(eq) }];
  for (const t of ordered) {
    eq = mode === 'account' ? eq + (t.pnl ?? 0) : eq * (1 + t.ret / 100);
    curve.push({ t: t.exit_ts, equity: r2(eq) });
  }
  // max drawdown on the curve
  let peak = curve[0].equity, mddAbs = 0, mddPct = 0, ddLen = 0, curLen = 0, peakIdx = 0;
  curve.forEach((p, i) => {
    if (p.equity > peak) { peak = p.equity; peakIdx = i; curLen = 0; }
    else { curLen = i - peakIdx; const dd = peak - p.equity; if (dd > mddAbs) { mddAbs = dd; mddPct = peak ? dd / peak * 100 : 0; ddLen = curLen; } }
  });
  // streaks
  let ws = 0, ls = 0, maxW = 0, maxL = 0;
  for (const t of ordered) { if (val(t) > 0) { ws++; ls = 0; maxW = Math.max(maxW, ws); } else if (val(t) < 0) { ls++; ws = 0; maxL = Math.max(maxL, ls); } else { ws = 0; ls = 0; } }

  // R-multiples (read from net)
  const rs = closed.map((t) => t.r).filter((x) => x != null);
  const rBuckets = { '≤-2': 0, '-2..-1': 0, '-1..0': 0, '0..1': 0, '1..2': 0, '≥2': 0 };
  for (const r of rs) { if (r <= -2) rBuckets['≤-2']++; else if (r < -1) rBuckets['-2..-1']++; else if (r < 0) rBuckets['-1..0']++; else if (r < 1) rBuckets['0..1']++; else if (r < 2) rBuckets['1..2']++; else rBuckets['≥2']++; }

  // daily-return ratios from a calendar-daily equity series
  const ratios = dailyRatios(curve, mddPct);

  // splits
  const byReason = tally(closed, (t) => t.reason, val);
  const bySymbol = tally(closed, (t) => t.symbol || '—', val);
  const bySide = tally(closed, (t) => t.side, val);

  // holding
  const held = closed.map((t) => t.bars_held);
  const heldW = wins.map((t) => t.bars_held), heldL = losses.map((t) => t.bars_held);

  // sample adequacy
  const warnings = [];
  if (closed.length < 30) warnings.push(`only ${closed.length} closed trades — a small sample; treat the numbers as indicative`);
  if (open.length) warnings.push(`${open.length} position(s) still open at the end — reported apart, not in the win rate`);
  const topSym = Object.entries(bySymbol.count).sort((a, b) => b[1] - a[1])[0];
  if (topSym && closed.length && topSym[1] / closed.length > 0.5) warnings.push(`${topSym[0]} is ${Math.round(topSym[1] / closed.length * 100)}% of trades — the result leans on one symbol`);

  return {
    money, mode,
    headline: {
      trades: closed.length, wins: wins.length, losses: losses.length, breakeven: evens.length,
      winRate: r2(closed.length ? wins.length / closed.length * 100 : 0),
      grossProfit: r2(grossProfit), grossLoss: r2(grossLoss), netProfit: r2(net),
      profitFactor: grossLoss > 0 ? r2(grossProfit / grossLoss) : null,
      expectancy: r2(mean(closed.map(val))),
      avgWin: r2(mean(wins.map(val))), avgLoss: r2(mean(losses.map(val))),
      payoff: losses.length && wins.length ? r2(mean(wins.map(val)) / Math.abs(mean(losses.map(val)))) : null,
      largestWin: r2(Math.max(0, ...closed.map(val))), largestLoss: r2(Math.min(0, ...closed.map(val))),
    },
    r: { total: r3(sum(rs)), average: r3(mean(rs)), best: r3(rs.length ? Math.max(...rs) : null), worst: r3(rs.length ? Math.min(...rs) : null), distribution: rBuckets },
    holding: { average: r2(mean(held)), longest: held.length ? Math.max(...held) : 0, shortest: held.length ? Math.min(...held) : 0, winnersAvg: r2(mean(heldW)), losersAvg: r2(mean(heldL)) },
    equity: { start: r2(curve[0].equity), end: r2(curve.at(-1).equity), curve, maxDrawdown: r2(mddAbs), maxDrawdownPct: r2(mddPct), drawdownLen: ddLen, maxWinStreak: maxW, maxLossStreak: maxL },
    ratios,
    splits: { byReason, bySymbol, bySide },
    open: open.map((t) => ({ symbol: t.symbol, side: t.side, entry: t.entry, unrealised: mode === 'account' ? r2(t.pnl) : r2(t.ret) })),
    warnings,
  };
}

function tally(trades, keyFn, val) {
  const count = {}, net = {};
  for (const t of trades) { const k = keyFn(t); count[k] = (count[k] || 0) + 1; net[k] = r2((net[k] || 0) + val(t)); }
  return { count, net };
}

// Build a calendar-daily equity series from the exit-marked curve and derive the
// annualised Sharpe/Sortino/Calmar. Flagged as an extrapolation on short samples.
function dailyRatios(curve, mddPct) {
  if (curve.length < 3) return { sharpe: null, sortino: null, calmar: null, note: 'too few trades for ratios' };
  const pts = curve.filter((p) => p.t != null);
  if (pts.length < 3) return { sharpe: null, sortino: null, calmar: null, note: 'too few dated points' };
  const day0 = Math.floor(pts[0].t / 86400), dayN = Math.floor(pts.at(-1).t / 86400);
  const span = Math.max(1, dayN - day0);
  const daily = new Array(span + 1).fill(null);
  for (const p of pts) daily[Math.floor(p.t / 86400) - day0] = p.equity;
  let last = daily[0] ?? pts[0].equity;
  const rets = [];
  for (let i = 1; i < daily.length; i++) { const e = daily[i] == null ? last : daily[i]; rets.push(last ? (e - last) / last : 0); last = e; }
  const m = mean(rets);
  const sd = Math.sqrt(mean(rets.map((x) => (x - m) ** 2)));
  // downside deviation: squared negatives averaged over ALL periods (target 0), the standard Sortino denominator
  const dsd = Math.sqrt(sum(rets.map((x) => (x < 0 ? x * x : 0))) / rets.length);
  const ann = Math.sqrt(252);
  const totalRet = last && daily[0] ? (last / (daily[0] || pts[0].equity) - 1) * 100 : 0;
  const years = span / 365;
  const cagr = years > 0 && daily[0] ? ((last / daily[0]) ** (1 / years) - 1) * 100 : null;
  return {
    sharpe: sd > 0 ? r2(m / sd * ann) : null,
    sortino: dsd > 0 ? r2(m / dsd * ann) : null,
    calmar: mddPct > 0 && cagr != null ? r2(cagr / mddPct) : null,
    totalReturn: r2(totalRet),
    note: rets.length < 60 ? 'annualised from a short sample — an extrapolation' : null,
  };
}
