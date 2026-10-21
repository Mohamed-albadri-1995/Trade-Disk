// Trade-Disk — the 'computed' provider: Radar's range & indicator fields derived
// from price bars (DATA-CATALOG.md groups 3 & 4). It has no feed of its own and is
// commercial-ok, because the maths is ours. Bars are oldest→newest, shaped
// {t,o,h,l,c,v} (see providers/yahoo.mjs).

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

// Exponential moving average over the given closes (seeded on the first value).
export function ema(vals, period) {
  if (!vals.length) return null;
  const k = 2 / (period + 1);
  let e = vals[0];
  for (let i = 1; i < vals.length; i++) e = vals[i] * k + e * (1 - k);
  return e;
}

// ADR% — average daily range, the common SMA(high/low, n)·100 − 100 form.
export function adrPct(bars, n = 20) {
  const w = bars.slice(-n);
  if (!w.length) return null;
  return +(mean(w.map((b) => b.h / b.l)) * 100 - 100).toFixed(2);
}

// Relative volume — today's volume vs the mean of the prior n sessions.
export function rvol(bars, n = 20) {
  if (bars.length < 2) return null;
  const today = bars[bars.length - 1].v;
  const prior = bars.slice(-1 - n, -1).map((b) => b.v).filter((v) => v > 0);
  const avg = mean(prior);
  return avg ? +(today / avg).toFixed(2) : null;
}

const dayUTC = (ms) => new Date(ms).toISOString().slice(0, 10);

// The derived range/indicator fields for one symbol, matching radar_stock columns.
// Volume & range stats use only completed sessions: during market hours the final
// daily bar is still forming, so counting it would understate relative volume (and
// range). Price/change and the EMA flags use the live last bar, as a trader expects.
export function derive(bars, nowMs = Date.now()) {
  const closes = bars.map((b) => b.c);
  const price = closes[closes.length - 1];
  const last = bars[bars.length - 1];
  const partial = last && dayUTC(last.t * 1000) === dayUTC(nowMs); // today's bar is in progress
  const done = partial ? bars.slice(0, -1) : bars;
  const e10 = ema(closes.slice(-60), 10), e20 = ema(closes.slice(-80), 20), e50 = ema(closes.slice(-150), 50);
  return {
    r: rvol(done),
    adr: adrPct(done),
    // above the key moving averages, and the stack aligned (fast > mid > slow)
    ema: price != null && e20 != null && e50 != null && price > e20 && price > e50,
    stacked: e10 != null && e20 != null && e50 != null && e10 > e20 && e20 > e50,
    changeLine: closes.slice(-12).map((v) => +v.toFixed(2)),
  };
}
