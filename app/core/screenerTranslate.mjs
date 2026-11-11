// Trade-Disk — translate a builder screener (the condition model the Radar builder
// produces, screener-builder.js) into the TradingView filter rules the scanner runs
// ({left, operation, right}). This is what makes a CUSTOM screener runnable, and it
// also runs a built-in that was loaded into the builder and edited — one engine, so
// what you build is what runs. Conditions whose metric/operator cannot be mapped to a
// scanner field are collected in `unsupported` and reported, never silently dropped.

// Builder metric → TradingView scanner field. Indicators (MA family) take a length;
// others map to a fixed field. Only fields we have verified against the live scanner
// are listed — an unmapped metric is reported, not guessed.
const FIELD = {
  // price
  Close: () => 'close', Open: () => 'open', High: () => 'high', Low: () => 'low',
  'Daily change': () => 'change', 'Perf 1D': () => 'change', 'Gap %': () => 'gap',
  // volume & liquidity
  Volume: () => 'volume', 'Average volume': () => 'average_volume_10d_calc', 'Average volume 90D': () => 'average_volume_90d_calc',
  'Relative volume': () => 'relative_volume_10d_calc', 'Intraday relative volume': () => 'relative_volume_intraday',
  'Dollar volume': () => 'Value.Traded',
  'Premarket volume': () => 'premarket_volume', 'Premarket change': () => 'premarket_change',
  // performance & ranges
  'Perf 1W': () => 'Perf.W', 'Perf 1M': () => 'Perf.1M', 'Perf 3M': () => 'Perf.3M',
  'Perf 6M': () => 'Perf.6M', 'Perf 1Y': () => 'Perf.Y',
  'Month high': () => 'High.1M', 'Month low': () => 'Low.1M', 'Week high': () => 'High.5D', 'Week low': () => 'Low.5D',
  // indicators (MA family carry the length in the field name)
  // (WMA is not offered by the scanner at any length, so it is left unmapped and reported.)
  SMA: (len) => `SMA${len}`, EMA: (len) => `EMA${len}`, VWMA: () => 'VWMA',
  VWAP: () => 'VWAP', RSI: (len) => (len === 14 ? 'RSI' : `RSI${len}`), ATR: () => 'ATR', ADX: () => 'ADX', CCI: () => 'CCI20', ROC: () => 'ROC',
  // fundamentals & growth
  'Market cap': () => 'market_cap_basic', PE: () => 'price_earnings_ttm', PS: () => 'price_sales_current',
  'EPS growth Q': () => 'earnings_per_share_diluted_yoy_growth_fq', 'EPS growth Y': () => 'earnings_per_share_diluted_yoy_growth_fy',
  'Revenue growth Q': () => 'total_revenue_yoy_growth_fq', 'Revenue growth Y': () => 'total_revenue_yoy_growth_fy',
  'ROE': () => 'return_on_equity', 'Net margin': () => 'net_margin', 'Dividend yield': () => 'dividends_yield_current',
  // classification (string compares)
  Sector: () => 'sector', Industry: () => 'industry', Exchange: () => 'exchange', Country: () => 'country',
};
// The lengths the live scanner actually has (checked against it 2026-11-11). A field
// for any other length does not exist there, and the scanner answers such a filter with
// "0 stocks" and no error — so an unavailable length is reported here, never sent.
const MA_LENGTHS = [2, 3, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 20, 21, 25, 26, 30, 34, 40, 50, 55, 60, 75, 89, 100, 120, 144, 150, 200, 250, 300];
export const LENGTHS = {
  SMA: MA_LENGTHS, EMA: MA_LENGTHS,
  RSI: [2, 3, 4, 5, 7, 9, 10, 14, 20, 21, 30],
  // one fixed length each on the scanner
  VWMA: [20], ATR: [14], ADX: [14], CCI: [20], ROC: [9],
};
const STRING_METRIC = new Set(['Sector', 'Industry', 'Exchange', 'Country']);
// Metrics the scanner only has on the daily view: with any other timeframe suffix the
// field does not exist and the scan silently returns nothing (checked live), so the
// builder's timeframe is ignored for them.
const DAILY_ONLY = new Set(['Perf 1W', 'Perf 1M', 'Perf 3M', 'Perf 6M', 'Perf 1Y', 'Month high', 'Month low', 'Week high', 'Week low',
  'Premarket volume', 'Premarket change', 'Market cap', 'PE', 'PS', 'EPS growth Q', 'EPS growth Y', 'Revenue growth Q', 'Revenue growth Y',
  'ROE', 'Net margin', 'Dividend yield', ...STRING_METRIC]);
// Indicators are computed by the scanner on the close; the builder's "Source" choice
// (HL2, Volume, …) cannot be honoured, so anything but Close is reported.
const INDICATOR = new Set(['SMA', 'EMA', 'VWMA', 'VWAP', 'RSI', 'ATR', 'ADX', 'CCI', 'ROC']);
const suffix = (metric, timeframe) => (DAILY_ONLY.has(metric) ? ''
  : metric === 'Intraday relative volume' ? '|5'            // the scanner has it on the 5-minute view only
    : (TF[timeframe] || ''));

const OP = { '>': 'greater', '≥': 'egreater', '<': 'less', '≤': 'eless', '=': 'equal', '≠': 'nequal', Between: 'in_range' };

const TF = {
  Daily: '', Weekly: '|1W', Monthly: '|1M', '1 hour': '|60', '4 hours': '|240',
  '1 minute': '|1', '5 minutes': '|5', '15 minutes': '|15', '30 minutes': '|30',
};

// Build the scanner field name for one side: base field + MA length + timeframe suffix.
// → { field } or { error }. A metric with lengths uses the given one (blank = its
// first-choice default) and is refused when the scanner has no such length.
function fieldFor(metric, length, timeframe, what = 'metric') {
  const fn = FIELD[metric];
  if (!fn) return { error: `${what} "${metric}" is not available on the live scanner yet` };
  const allowed = LENGTHS[metric];
  if (!allowed) return { field: fn() + suffix(metric, timeframe) };
  const blank = length == null || String(length).trim() === '';
  const len = blank ? (allowed.includes(14) ? 14 : allowed[0]) : Number(length);
  if (!allowed.includes(len)) {
    return { error: `${metric} length ${length} is not available — the live scanner has ${metric} ${allowed.length === 1 ? allowed[0] + ' only' : allowed.join(', ')}` };
  }
  return { field: fn(len) + suffix(metric, timeframe) };
}

// One condition → one {left, operation, right}, or null (with a reason) if unmappable.
function translateOne(c) {
  const l = fieldFor(c.metric, c.length, c.timeframe);
  if (l.error) return l;
  const left = l.field;
  const operation = OP[c.operator];
  if (!operation) return { error: `operator "${c.operator}" is not available on the live scanner yet` };
  const blank = (v) => v == null || String(v).trim() === '';
  if (c.mode === 'percent') return { error: 'percentage-distance comparisons are not available on the live scanner yet' };
  if (INDICATOR.has(c.metric) && c.source && c.source !== 'Close') return { error: `source "${c.source}" is not available — the live scanner computes ${c.metric} on the close` };
  if (STRING_METRIC.has(c.metric) && (c.mode === 'filter' || !['=', '≠'].includes(c.operator))) return { error: `${c.metric} can only be compared with = or ≠ and a name` };

  if (c.mode === 'filter') {
    if (c.operator === 'Between') return { error: 'Between compares against two numbers, not another filter' };
    const r = fieldFor(c.compareMetric, c.compareLength, c.compareTimeframe, 'compare metric');
    if (r.error) return r;
    return { rule: { left, operation, right: r.field } };
  }
  // value mode (and Between)
  if (c.operator === 'Between') {
    const lo = +c.value, hi = +c.upper;
    if (blank(c.value) || blank(c.upper) || !Number.isFinite(lo) || !Number.isFinite(hi)) return { error: 'Between needs two numbers' };
    return { rule: { left, operation: 'in_range', right: [Math.min(lo, hi), Math.max(lo, hi)] } };
  }
  const raw = c.value;
  if (raw == null || String(raw).trim() === '') return { error: 'missing value' };
  const right = STRING_METRIC.has(c.metric) ? String(raw) : Number(raw);
  if (!STRING_METRIC.has(c.metric) && !Number.isFinite(right)) return { error: `"${raw}" is not a number` };
  return { rule: { left, operation, right } };
}

// conditions[] → { filters, unsupported, anyOf? }, ready for tradingview.scan().
// Each condition's `join` says how it combines with the NEXT one. AND binds tighter
// than OR, as in ordinary logic: "a AND b OR c AND d" is (a AND b) OR (c AND d). With
// no OR, every rule lands in `filters`. With an OR, `filters` is empty and `anyOf`
// holds the groups (a stock matches when one whole group holds).
export function conditionsToFilters(conditions) {
  const unsupported = [], groups = [[]];
  for (const c of conditions || []) {
    const r = translateOne(c);
    if (r.rule) groups[groups.length - 1].push(r.rule);
    else unsupported.push({ metric: c.metric, operator: c.operator, reason: r.error });
    if (c.join === 'OR') groups.push([]);
  }
  const live = groups.filter((g) => g.length);
  if (live.length <= 1) return { filters: live[0] || [], unsupported };
  return { filters: [], anyOf: live, unsupported };
}

// The metrics/operators the builder can currently RUN (for the UI to show what's live).
export const RUNNABLE_METRICS = Object.keys(FIELD);
export const RUNNABLE_OPERATORS = Object.keys(OP);
