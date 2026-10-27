// Trade-Disk — Polygon.io provider (intraday minute bars for the screener backtest).
// Free tier: ~5 requests/minute, ~2 years history, end-of-day (fine for backtesting).
// One call returns a whole day of 1-minute aggregates for one ticker. Polygon stamps
// bars in milliseconds; we normalise to seconds to match the rest of the engine.

const BASE = 'https://api.polygon.io';

// Intraday bars for one ticker on one ET trading day ('YYYY-MM-DD'), at a minute
// multiplier (1, 5, 15, …). → { bars:[{t(sec),o,h,l,c,v}] } | { rateLimited:true }
// | throws on other errors.
export async function bars(ticker, day, apiKey, mult = 1) {
  if (!apiKey) throw new Error('no Polygon API key configured');
  const m = Math.max(1, Math.floor(+mult || 1));
  const u = `${BASE}/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/${m}/minute/${day}/${day}?adjusted=true&sort=asc&limit=50000&apiKey=${apiKey}`;
  const res = await fetch(u);
  if (res.status === 429) return { rateLimited: true };
  if (!res.ok) throw new Error(`Polygon ${ticker} ${day}: HTTP ${res.status}`);
  const j = await res.json();
  const out = (j.results || []).map((b) => ({ t: Math.floor(b.t / 1000), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }));
  return { bars: out };
}
// 1-minute convenience wrapper (unchanged call site shape).
export const minuteBars = (ticker, day, apiKey) => bars(ticker, day, apiKey, 1);

// Does a key look configured? (Does not call the network.)
export const hasKey = (k) => typeof k === 'string' && k.length >= 12;
