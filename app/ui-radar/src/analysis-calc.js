// Trade-Disk — Radar analysis presentation values, ported VERBATIM from the radar
// prototype's renderOverview/renderTechnical. These are deterministic *illustrative*
// values derived from the selected stock's record — not calculated market signals.
// The real product reads materialized per-stock snapshots (PAGES.md §3.5); in solo
// demo the view projects the stock record exactly as the prototype does.

import { money } from './lib.js';

export function derive(s) {
  const p = s.p, bullish = s.s >= 70, sign = bullish ? 1 : -1;
  const ema = { 9: p - sign * p * 0.003, 13: p - sign * p * 0.006, 20: p - sign * p * 0.012, 50: p - sign * p * 0.025, 200: p - sign * p * 0.075 };
  const ma5 = p - p * 0.0018, vwap = p - p * 0.0012, prev = p / (1 + s.c / 100), open = p - p * 0.0015;
  const high = p * 1.012, low = p * 0.978, pmh = s.pmHigh, pml = s.pmLow;
  const atr = (p * s.adr) / 100, dayMove = Math.abs(p - prev), moveAtr = dayMove / (atr || 1);
  return { p, bullish, sign, ema, ma5, vwap, prev, open, high, low, pmh, pml, atr, dayMove, moveAtr };
}

export const f = money;
export const pct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
export const state = (above) => (above ? 'ABOVE' : 'BELOW');
