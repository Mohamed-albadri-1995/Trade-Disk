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
  Volume: () => 'volume', 'Average volume': () => 'average_volume_10d_calc',
  'Relative volume': () => 'relative_volume_10d_calc', 'Dollar volume': () => 'Value.Traded',
  'Premarket volume': () => 'premarket_volume', 'Premarket change': () => 'premarket_change',
  // performance & ranges
  'Perf 1W': () => 'Perf.W', 'Perf 1M': () => 'Perf.1M', 'Perf 3M': () => 'Perf.3M',
  'Perf 6M': () => 'Perf.6M', 'Perf 1Y': () => 'Perf.Y',
  'Month high': () => 'High.1M', 'Month low': () => 'Low.1M', 'Week high': () => 'High.1W', 'Week low': () => 'Low.1W',
  // indicators (MA family carry the length in the field name)
  SMA: (len) => `SMA${len}`, EMA: (len) => `EMA${len}`, WMA: (len) => `WMA${len}`, VWMA: (len) => `VWMA${len}`,
  VWAP: () => 'VWAP', RSI: () => 'RSI', ATR: () => 'ATR', ADX: () => 'ADX', CCI: () => 'CCI20', ROC: () => 'ROC',
  // fundamentals & growth
  'Market cap': () => 'market_cap_basic', PE: () => 'price_earnings_ttm', PS: () => 'price_sales_current',
  'EPS growth Q': () => 'earnings_per_share_diluted_yoy_growth_fq', 'EPS growth Y': () => 'earnings_per_share_diluted_yoy_growth_fy',
  'Revenue growth Q': () => 'total_revenue_yoy_growth_fq', 'Revenue growth Y': () => 'total_revenue_yoy_growth_fy',
  'ROE': () => 'return_on_equity', 'Net margin': () => 'net_margin', 'Dividend yield': () => 'dividend_yield_recent',
  // classification (string compares)
  Sector: () => 'sector', Industry: () => 'industry', Exchange: () => 'exchange', Country: () => 'country',
};
const MA_FAMILY = new Set(['SMA', 'EMA', 'WMA', 'VWMA']);
const STRING_METRIC = new Set(['Sector', 'Industry', 'Exchange', 'Country']);

const OP = { '>': 'greater', '≥': 'egreater', '<': 'less', '≤': 'eless', '=': 'equal', '≠': 'nequal', Between: 'in_range' };

const TF = {
  Daily: '', Weekly: '|1W', Monthly: '|1M', '1 hour': '|60', '4 hours': '|240',
  '1 minute': '|1', '5 minutes': '|5', '15 minutes': '|15', '30 minutes': '|30',
};

// Build the scanner field name for one side: base field + MA length + timeframe suffix.
function fieldFor(metric, length, timeframe) {
  const fn = FIELD[metric];
  if (!fn) return null;
  const base = MA_FAMILY.has(metric) ? fn(Math.max(1, +length || 14)) : fn();
  return base + (TF[timeframe] || '');
}

// One condition → one {left, operation, right}, or null (with a reason) if unmappable.
function translateOne(c) {
  const left = fieldFor(c.metric, c.length, c.timeframe);
  if (!left) return { error: `metric "${c.metric}" is not available on the live scanner yet` };
  const operation = OP[c.operator];
  if (!operation) return { error: `operator "${c.operator}" is not available on the live scanner yet` };

  if (c.mode === 'filter') {
    const right = fieldFor(c.compareMetric, c.compareLength, c.compareTimeframe);
    if (!right) return { error: `compare metric "${c.compareMetric}" is not available yet` };
    return { rule: { left, operation, right } };
  }
  // value mode (and Between)
  if (c.operator === 'Between') {
    const lo = +c.value, hi = +c.upper;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { error: 'Between needs two numbers' };
    return { rule: { left, operation: 'in_range', right: [Math.min(lo, hi), Math.max(lo, hi)] } };
  }
  const raw = c.value;
  if (raw == null || String(raw).trim() === '') return { error: 'missing value' };
  const right = STRING_METRIC.has(c.metric) ? String(raw) : Number(raw);
  if (!STRING_METRIC.has(c.metric) && !Number.isFinite(right)) return { error: `"${raw}" is not a number` };
  return { rule: { left, operation, right } };
}

// conditions[] → { filters, unsupported }. `filters` is ready for tradingview.scan().
export function conditionsToFilters(conditions) {
  const filters = [], unsupported = [];
  for (const c of conditions || []) {
    const r = translateOne(c);
    if (r.rule) filters.push(r.rule);
    else unsupported.push({ metric: c.metric, operator: c.operator, reason: r.error });
  }
  return { filters, unsupported };
}

// The metrics/operators the builder can currently RUN (for the UI to show what's live).
export const RUNNABLE_METRICS = Object.keys(FIELD);
export const RUNNABLE_OPERATORS = Object.keys(OP);
