// Trade-Disk — Radar's live screener definitions. Each is a set of TradingView
// filter rules ({left, operation, right}); the TradingView provider evaluates
// them against the whole US market (personal mode). The rule sets are the
// battle-tested ones from the reference desk, verified field-for-field against
// live TradingView data. A definition is backend-agnostic: the same rules will
// drive a licensed provider in commercial mode when one is wired.
//
// operation: egreater ≥ · greater > · eless ≤ · less <

// The columns each result row carries, for the Radar card. Order matters: the
// provider reads values by position and refuses a misaligned response.
export const COLUMNS = [
  'description', 'close', 'change',
  'relative_volume_10d_calc', 'average_volume_10d_calc',
  'market_cap_basic', 'sector', 'industry',
  'premarket_change', 'premarket_volume', 'ATR',
  'EMA9', 'EMA13', 'EMA20', 'EMA50',
];

// Each built-in also carries a `conditions` array in the BUILDER's own grammar
// (screener-builder.js / screenerTranslate.mjs). That is what makes the built-ins
// buildable: you can load one into the custom builder, see its rules, edit them, and
// run the edited version — the builder reproduces the real screener, which is how its
// flexibility is proved. `filters` is the exact, TradingView-verified rule set run by
// default; `conditions` is the editable equivalent (a few intraday-only rules in
// Trend Leaders are expressed with their daily equivalents, which the builder supports).
const C = (metric, operator, extra = {}) => ({ metric, operator, mode: 'value', timeframe: 'Daily', ...extra });
const F = (metric, operator, compareMetric, extra = {}) => ({ metric, operator, mode: 'filter', timeframe: 'Daily', compareMetric, compareTimeframe: 'Daily', ...extra });

export const SCREENERS = [
  {
    key: 'trend-leaders', name: 'Trend Leaders',
    note: 'In an uptrend across day, week and month, with volume coming in.',
    sort: { sortBy: 'change', sortOrder: 'desc' },
    filters: [
      { left: 'close', operation: 'egreater', right: 20 },
      { left: 'close', operation: 'egreater', right: 'SMA5' },
      { left: 'close', operation: 'egreater', right: 'VWAP' },
      { left: 'close|1W', operation: 'greater', right: 'VWAP|1W' },
      { left: 'close|1M', operation: 'greater', right: 'VWAP|1M' },
      { left: 'EMA50|1', operation: 'greater', right: 'EMA120|1' },
      { left: 'close|1', operation: 'egreater', right: 'EMA50|1' },
      { left: 'average_volume_90d_calc', operation: 'greater', right: 1000000 },
      { left: 'VWAP', operation: 'egreater', right: 'SMA75|5' },
      { left: 'relative_volume_intraday|5', operation: 'greater', right: 3 },
      { left: 'relative_volume_10d_calc', operation: 'greater', right: 1.5 },
      { left: 'close', operation: 'egreater', right: 1 },
    ],
    conditions: [
      C('Close', '≥', { value: 20 }),
      F('Close', '≥', 'SMA', { compareLength: 5 }),
      F('Close', '≥', 'VWAP'),
      F('Close', '>', 'VWAP', { timeframe: 'Weekly', compareTimeframe: 'Weekly' }),
      F('Close', '>', 'VWAP', { timeframe: 'Monthly', compareTimeframe: 'Monthly' }),
      F('EMA', '>', 'EMA', { length: 50, compareLength: 120 }),
      F('Close', '≥', 'EMA', { compareLength: 50 }),
      C('Average volume', '>', { value: 1000000 }),
      C('Relative volume', '>', { value: 1.5 }),
      C('Close', '≥', { value: 1 }),
    ],
  },
  {
    key: 'premarket-movers', name: 'Pre-Market Movers',
    note: 'Liquid names with heavy pre-market volume, before the open.',
    sort: { sortBy: 'premarket_volume', sortOrder: 'desc' },
    filters: [
      { left: 'close', operation: 'egreater', right: 0.5 },
      { left: 'close', operation: 'egreater', right: 1 },
      { left: 'average_volume_10d_calc', operation: 'greater', right: 2000000 },
      { left: 'relative_volume_10d_calc', operation: 'greater', right: 3 },
      { left: 'premarket_volume', operation: 'greater', right: 1500000 },
    ],
    conditions: [
      C('Close', '≥', { value: 1 }),
      C('Average volume', '>', { value: 2000000 }),
      C('Relative volume', '>', { value: 3 }),
      C('Premarket volume', '>', { value: 1500000 }),
    ],
  },
  {
    key: 'volume-surges', name: 'Volume Surges',
    note: 'Trading on extreme relative volume — 10× a normal day or more.',
    sort: { sortBy: 'relative_volume_10d_calc', sortOrder: 'desc' },
    filters: [
      { left: 'relative_volume_10d_calc', operation: 'greater', right: 10 },
      { left: 'close', operation: 'egreater', right: 2 },
      { left: 'average_volume_10d_calc', operation: 'greater', right: 2000000 },
    ],
    conditions: [
      C('Relative volume', '>', { value: 10 }),
      C('Close', '≥', { value: 2 }),
      C('Average volume', '>', { value: 2000000 }),
    ],
  },
  {
    key: 'ma-stack-breakout', name: 'MA Stack Breakout',
    note: 'Moving averages stacked and price breaking the 1-month high.',
    sort: { sortBy: 'relative_volume_10d_calc', sortOrder: 'desc' },
    filters: [
      { left: 'SMA5|1', operation: 'greater', right: 'EMA9|1' },
      { left: 'EMA9|1', operation: 'greater', right: 'EMA13|1' },
      { left: 'EMA13|1', operation: 'greater', right: 'EMA20|1' },
      { left: 'close', operation: 'egreater', right: 'High.1M' },
      { left: 'close', operation: 'egreater', right: 1 },
      { left: 'average_volume_10d_calc', operation: 'greater', right: 500000 },
    ],
    conditions: [
      F('SMA', '>', 'EMA', { length: 5, compareLength: 9 }),
      F('EMA', '>', 'EMA', { length: 9, compareLength: 13 }),
      F('EMA', '>', 'EMA', { length: 13, compareLength: 20 }),
      F('Close', '≥', 'Month high'),
      C('Close', '≥', { value: 1 }),
      C('Average volume', '>', { value: 500000 }),
    ],
  },
  {
    key: 'growth-pullback', name: 'Growth Pullback',
    note: 'Growth companies (CAN SLIM) pulling back to the 20-EMA in an uptrend.',
    sort: { sortBy: 'Perf.6M', sortOrder: 'desc' },
    filters: [
      { left: 'earnings_per_share_diluted_yoy_growth_fq', operation: 'egreater', right: 25 },
      { left: 'earnings_per_share_diluted_yoy_growth_fy', operation: 'egreater', right: 25 },
      { left: 'Perf.6M', operation: 'greater', right: 30 },
      { left: 'close', operation: 'egreater', right: 'SMA50' },
      { left: 'close', operation: 'eless', right: 'EMA20' },
      { left: 'market_cap_basic', operation: 'greater', right: 300000000 },
    ],
    conditions: [
      C('EPS growth Q', '≥', { value: 25 }),
      C('EPS growth Y', '≥', { value: 25 }),
      C('Perf 6M', '>', { value: 30 }),
      F('Close', '≥', 'SMA', { compareLength: 50 }),
      F('Close', '≤', 'EMA', { compareLength: 20 }),
      C('Market cap', '>', { value: 300000000 }),
    ],
  },
];

const byKey = Object.fromEntries(SCREENERS.map((s) => [s.key, s]));
// The builder can load a built-in's `conditions`, so they ride along with the list.
export const listScreeners = () => SCREENERS.map(({ key, name, note, conditions }) => ({ key, name, note, conditions: conditions || [] }));
export const getScreener = (key) => byKey[key];

// ── result → Radar card ──────────────────────────────────────────────────────
const COLORS = ['', 'blue', 'purple', 'orange', 'green'];
const capFmt = (n) => {
  if (n == null) return '—';
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return Math.round(n / 1e9) + 'B';
  if (a >= 1e6) return Math.round(n / 1e6) + 'M';
  return String(Math.round(n));
};
const capBand = (n) => (n == null ? '' : n >= 1e10 ? 'large' : n >= 2e9 ? 'mid' : 'small');

// Map one TradingView row to the exact card record the Radar screener renders.
// Price/change/volume/range/indicator fields are live; `s` is a transparent
// activity score (not the trained model yet); news/CAN-SLIM flags stay off until
// those feeds are wired (DATA-CATALOG groups 6 & 8).
export function toCard(r, i = 0) {
  const p = r.close, c = r.change ?? 0;
  const prev = (p != null && c != null) ? p / (1 + c / 100) : p;
  const abs = (p != null && prev != null) ? +(p - prev).toFixed(2) : 0;
  const adr = (r.ATR && p) ? +((r.ATR / p) * 100).toFixed(2) : 0;
  const rvol = r.relative_volume_10d_calc;
  const pmc = r.premarket_change;
  const ema = p != null && r.EMA20 != null && p > r.EMA20;
  const stacked = [r.EMA9, r.EMA13, r.EMA20, r.EMA50].every((x) => x != null)
    && r.EMA9 > r.EMA13 && r.EMA13 > r.EMA20 && r.EMA20 > r.EMA50;
  const tags = [];
  if (pmc != null && Math.abs(pmc) >= 2) tags.push('Pre-Market');
  if (rvol != null && rvol >= 5) tags.push('High RVOL');
  if (Math.abs(c) >= 4) tags.push('Big Move');
  const score = Math.max(5, Math.min(99, Math.round(50 + c * 1.5 + ((rvol ?? 1) - 1) * 6)));
  return {
    t: r.ticker, n: r.description || r.ticker,
    p: p != null ? +p.toFixed(2) : 0, c: +(+c).toFixed(2), abs,
    s: score, r: rvol != null ? +rvol.toFixed(2) : 0, adr,
    pm: (adr && pmc != null) ? +(Math.abs(pmc) / adr).toFixed(2) : 0,
    pmHigh: 0, pmLow: 0, pmRange: 0, pmPct: pmc != null ? +pmc.toFixed(2) : 0,
    cap: capFmt(r.market_cap_basic), capBand: capBand(r.market_cap_basic),
    sec: r.industry || r.sector || '—', mark: (r.ticker || '?')[0], color: COLORS[i % COLORS.length],
    tags, ema, stacked, news: false, cs: false,
    changeLine: [+((prev ?? p) || 0).toFixed(2), +((p) || 0).toFixed(2)],
  };
}
