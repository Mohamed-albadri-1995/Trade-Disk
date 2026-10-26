// Trade-Disk — screener replay (historical backtest over the migrated record).
//
// This is NOT the bar-level strategy backtest (core/lab/backtest.mjs). It answers a
// different, screener-first question honestly: "If I had traded the stocks THIS
// screener actually surfaced, over this date range, what would the recorded
// outcomes have given me?" It reads only the daily record:
//
//   radar_screen_catalog  — the screen (its src, window, filters)
//   radar_history         — the universe: one row per (screen, day, ticker) with
//                           first_seen (when it FIRST appeared that day). The whole
//                           accumulated day is here — not a single early snapshot —
//                           so there is no "9:31 only" bias.
//   radar_history_outcome — the legacy engine's own recorded excursions from entry:
//                           up_r / down_r are MFE / MAE in ATR14 units (R = 1 ATR).
//
// Honesty rules (so a future backtest on this data is not misleading):
//  • Point-in-time. A ticker is tradeable only from its first_seen. The optional
//    entryByMin cutoff drops tickers that appeared LATER than you would have acted
//    (your "it wasn't on my radar yet" rule) — counted, never silently kept.
//  • No path peeking. We have MFE and MAE, not the price path, so we cannot know
//    which came first. When BOTH a target and a stop were reached we cannot call it
//    a clean win — it is 'ambiguous', scored conservatively (stop-first) and shown
//    as its own bucket with the optimistic band alongside.
//  • Unknown exits are not invented. When NEITHER target nor stop was reached, the
//    real exit (end of the recorded window) is not stored, so the trade is 'open'
//    and scored 0R — never imputed — and shown with its average MFE/MAE.
//  • Target and stop are in ATR, matching the data; realized R is normalised to the
//    stop (win = target/stop R, loss = −1R), minus any per-trade cost in R.

const DAY = 'day', TICK = 'ticker';

// Page through a filtered table (PostgREST caps a page at 1000 rows).
async function fetchAll(sb, table, apply) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select('*').range(from, from + 999);
    q = apply(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const minToClock = (m) => {
  if (m == null) return null;
  const t = 570 + m; const h = Math.floor(t / 60), mm = t % 60; // 570 = 9:30 ET open
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

// spec: { screen, start, end, variant='A', targetAtr=1, stopAtr=1, entryByMin=null, costR=0 }
export async function screenReplay(sb, spec = {}) {
  const screen = String(spec.screen || '').trim();
  if (!screen) throw new Error('pick a screen');
  const variant = spec.variant === 'B' ? 'B' : 'A';
  const targetAtr = Math.max(0.1, +spec.targetAtr || 1);
  const stopAtr = Math.max(0.1, +spec.stopAtr || 1);
  const entryByMin = spec.entryByMin == null || spec.entryByMin === '' ? null : +spec.entryByMin;
  const costR = Math.max(0, +spec.costR || 0);

  const cat = (await fetchAll(sb, 'radar_screen_catalog', (q) => q.eq('screen', screen)))[0];
  if (!cat) throw new Error(`unknown screen "${screen}"`);
  const start = spec.start || cat.first_day;
  const end = spec.end || cat.last_day;

  const hist = await fetchAll(sb, 'radar_history', (q) =>
    q.eq('screen', screen).gte(DAY, start).lte(DAY, end).order(DAY));
  const outs = await fetchAll(sb, 'radar_history_outcome', (q) =>
    q.eq('src', cat.src).eq('variant', variant).gte(DAY, start).lte(DAY, end));
  const oByKey = new Map(outs.map((o) => [`${o[DAY]}|${o[TICK]}`, o]));

  const trades = [];
  const cov = { surfaced: hist.length, excludedLate: 0, noOutcome: 0 };
  const winR = targetAtr / stopAtr; // realized R on a win, normalised to the stop

  for (const h of hist) {
    const fsm = h.first_seen_min;
    if (entryByMin != null && (fsm == null || fsm > entryByMin)) { cov.excludedLate++; continue; }
    const o = oByKey.get(`${h[DAY]}|${h[TICK]}`);
    if (!o || o.up_r == null || o.down_r == null) { cov.noOutcome++; continue; }

    const hitT = o.up_r >= targetAtr, hitS = o.down_r >= stopAtr;
    let result, r;
    if (hitT && !hitS) { result = 'win'; r = winR; }
    else if (hitS && !hitT) { result = 'loss'; r = -1; }
    else if (hitT && hitS) { result = 'ambiguous'; r = -1; }  // both reached — stop-first (conservative)
    else { result = 'open'; r = 0; }                          // neither — real exit unknown, scored flat
    r -= costR;

    trades.push({
      day: h[DAY], ticker: h[TICK], firstSeenMin: fsm, firstSeen: minToClock(fsm),
      variant, entry: r2(o.entry_price), mfeAtr: r2(o.up_r), maeAtr: r2(o.down_r),
      atr14: r2(o.atr14), result, r: r3(r),
    });
  }

  trades.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : (a.firstSeenMin ?? 1e9) - (b.firstSeenMin ?? 1e9)));
  return { report: summarise(trades, cov, { screen, cat, variant, targetAtr, stopAtr, entryByMin, costR, start, end, winR }), trades, spec: { screen, variant, targetAtr, stopAtr, entryByMin, costR, start, end } };
}

function summarise(trades, cov, p) {
  const n = trades.length;
  const by = (res) => trades.filter((t) => t.result === res);
  const wins = by('win').length, losses = by('loss').length, amb = by('ambiguous').length, open = by('open').length;
  const resolved = wins + losses + amb; // excludes 'open' (unknown exit)
  const sumR = trades.reduce((s, t) => s + t.r, 0);
  const gross = { pos: 0, neg: 0 };
  for (const t of trades) { if (t.r > 0) gross.pos += t.r; else gross.neg += -t.r; }

  // equity curve + max drawdown, in R, in trade order
  let eq = 0, peak = 0, mdd = 0; const curve = [];
  for (const t of trades) { eq += t.r; peak = Math.max(peak, eq); mdd = Math.min(mdd, eq - peak); curve.push(r3(eq)); }

  const avg = (arr, f) => (arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : null);
  const perDayMap = new Map();
  for (const t of trades) {
    const d = perDayMap.get(t.day) || { day: t.day, trades: 0, wins: 0, sumR: 0 };
    d.trades++; if (t.result === 'win') d.wins++; d.sumR += t.r; perDayMap.set(t.day, d);
  }
  const openTrades = by('open');

  const notes = [
    `R is normalised to the stop: a win = +${r2(p.winR)}R (${p.targetAtr}-ATR target over a ${p.stopAtr}-ATR stop), a loss = −1R${p.costR ? `, minus ${p.costR}R cost/trade` : ''}.`,
    `Universe = every stock "${p.cat.name}" surfaced each day (the whole accumulated day, not one snapshot). Each is tradeable only from when it first appeared.`,
    amb ? `${amb} trade(s) hit BOTH target and stop; order is unknown from the record, so they are scored as losses (conservative). Optimistic (target-first) total R would be ${r3(sumR + amb * (p.winR + 1))}.` : null,
    open ? `${open} trade(s) reached neither target nor stop; the real exit is not in the record, so they are scored 0R (their avg MFE ${r2(avg(openTrades, (t) => t.mfeAtr))} ATR / avg MAE ${r2(avg(openTrades, (t) => t.maeAtr))} ATR).` : null,
    p.entryByMin != null ? `Point-in-time cutoff: only stocks that appeared by ${minToClock(p.entryByMin)} were taken; ${cov.excludedLate} appeared later and were dropped.` : `No time cutoff — every surfaced stock was eligible from its first-seen time.`,
  ].filter(Boolean);

  return {
    screen: p.screen, screenName: p.cat.name, mapsTo: p.cat.maps_to, src: p.cat.src,
    window: { start: p.start, end: p.end }, variant: p.variant,
    rule: { targetAtr: p.targetAtr, stopAtr: p.stopAtr, entryByMin: p.entryByMin, costR: p.costR, winR: r2(p.winR) },
    coverage: { ...cov, traded: n },
    counts: { wins, losses, ambiguous: amb, open, resolved },
    winRateResolved: resolved ? r3(wins / resolved) : null,
    winRateAll: n ? r3(wins / n) : null,
    expectancyR: n ? r3(sumR / n) : null,
    totalR: r3(sumR),
    profitFactor: gross.neg ? r2(gross.pos / gross.neg) : (gross.pos ? Infinity : null),
    maxDrawdownR: r3(mdd),
    avgMfeAtr: r2(avg(trades, (t) => t.mfeAtr)),
    avgMaeAtr: r2(avg(trades, (t) => t.maeAtr)),
    equityCurveR: curve,
    perDay: [...perDayMap.values()].map((d) => ({ ...d, sumR: r3(d.sumR) })),
    headline: n
      ? `${n} trades · ${wins}W/${losses}L${amb ? `/${amb}?` : ''}${open ? ` · ${open} open` : ''} · ${resolved ? Math.round(wins / resolved * 100) : 0}% win (resolved) · ${r3(sumR)}R total · ${n ? r3(sumR / n) : 0}R/trade`
      : 'No trades matched — widen the dates, loosen the time cutoff, or check the screen has recorded outcomes.',
    notes,
  };
}
