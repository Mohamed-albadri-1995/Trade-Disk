// Trade-Disk — Radar's custom screener builder logic, ported VERBATIM from the
// approved radar prototype (frontend-design/radar.html). The filter library, the
// condition field model, the rule-preview string, the save validation and the saved
// summaries are the prototype's own. Solo mode persists a user's custom screeners on
// the device (localStorage, the 'tradeDiskScreeners' key) exactly as the prototype
// does and as its copy says ("Saved on this device"); hosted mode persists them
// per-account server-side (SCREENERS.md §4.7).

// The 81-filter library, 8 categories, exactly as the prototype offers them.
export const FILTER_LIBRARY = [
  {"category":"Price & trading","items":[["Close","Close price","number","price"],["Open","Open price","number","price"],["High","High price","number","price"],["Low","Low price","number","price"],["Previous close","Previous close","number","price"],["Daily change","Daily change %","number","percent"],["Gap %","Gap %","number","percent"],["Change from open","Change from open %","number","percent"],["Distance from high","Distance from day high %","number","percent"],["Distance from low","Distance from day low %","number","percent"]]},
  {"category":"Volume & liquidity","items":[["Volume","Volume","number","volume"],["Average volume","Average volume","number","volume"],["Relative volume","Relative volume","number","ratio"],["Dollar volume","Dollar volume","number","money"],["Float","Float shares","number","shares"],["Short float","Short float %","number","percent"],["Shares outstanding","Shares outstanding","number","shares"]]},
  {"category":"Performance & range","items":[["Perf 1D","Performance · 1 day %","number","percent"],["Perf 1W","Performance · 1 week %","number","percent"],["Perf 1M","Performance · 1 month %","number","percent"],["Perf 3M","Performance · 3 months %","number","percent"],["Perf 6M","Performance · 6 months %","number","percent"],["Perf 1Y","Performance · 1 year %","number","percent"],["Distance 52W high","Distance from 52-week high %","number","percent"],["Distance 52W low","Distance from 52-week low %","number","percent"],["ADR","Average daily range %","number","percent"],["ATR percent","ATR as % of price","indicator","percent"]]},
  {"category":"Technical indicators","items":[["SMA","Simple moving average","indicator","price"],["EMA","Exponential moving average","indicator","price"],["WMA","Weighted moving average","indicator","price"],["VWMA","Volume-weighted moving average","indicator","price"],["RSI","Relative strength index","indicator","number"],["MACD","MACD line","indicator","number"],["MACD Signal","MACD signal line","indicator","number"],["ADX","Average directional index","indicator","number"],["ATR","Average true range","indicator","price"],["Stochastic K","Stochastic %K","indicator","number"],["Stochastic D","Stochastic %D","indicator","number"],["Bollinger Upper","Bollinger upper band","indicator","price"],["Bollinger Middle","Bollinger middle band","indicator","price"],["Bollinger Lower","Bollinger lower band","indicator","price"],["VWAP","VWAP","indicator","price"],["CCI","Commodity channel index","indicator","number"],["OBV","On-balance volume","indicator","number"],["MFI","Money flow index","indicator","number"],["ROC","Rate of change %","indicator","percent"]]},
  {"category":"Fundamentals & valuation","items":[["Market cap","Market capitalization","number","money"],["PE","P/E ratio","number","ratio"],["Forward PE","Forward P/E","number","ratio"],["PEG","PEG ratio","number","ratio"],["PS","Price / sales","number","ratio"],["PB","Price / book","number","ratio"],["EV EBITDA","EV / EBITDA","number","ratio"],["Gross margin","Gross margin %","number","percent"],["Operating margin","Operating margin %","number","percent"],["Net margin","Net margin %","number","percent"],["ROE","Return on equity %","number","percent"],["ROIC","Return on invested capital %","number","percent"],["Debt equity","Debt / equity","number","ratio"],["Current ratio","Current ratio","number","ratio"],["Free cash flow","Free cash flow","number","money"]]},
  {"category":"Growth & estimates","items":[["Revenue growth Q","Quarterly revenue growth %","number","percent"],["Revenue growth Y","Annual revenue growth %","number","percent"],["EPS growth Q","Quarterly EPS growth %","number","percent"],["EPS growth Y","Annual EPS growth %","number","percent"],["EPS surprise","EPS surprise %","number","percent"],["Analyst target upside","Analyst target upside %","number","percent"]]},
  {"category":"Security & classification","items":[["Exchange","Exchange","choice",""],["Sector","Sector","choice",""],["Industry","Industry","choice",""],["Index","Index membership","choice",""],["Country","Country","choice",""],["Security type","Security type","choice",""]]},
  {"category":"Events & market state","items":[["Earnings window","Earnings date window","choice",""],["News catalyst","News catalyst","choice",""],["Analyst action","Analyst action","choice",""],["New high low","New high / low","choice",""],["Pattern","Chart pattern","choice",""],["Options available","Options available","choice",""],["Dividend yield","Dividend yield %","number","percent"],["Payout ratio","Dividend payout ratio %","number","percent"]]}
];

export const FILTER_MAP = Object.fromEntries(
  FILTER_LIBRARY.flatMap((g) => g.items.map((i) => [i[0], { label: i[1], type: i[2], unit: i[3], category: g.category }]))
);

export const OPERATORS = ['>', '≥', '<', '≤', '=', '≠', 'Between', 'Crosses above', 'Crosses below', 'Rising', 'Falling', 'Above by %', 'Below by %', 'Within % of'];
export const TIMEFRAMES = ['1 minute', '5 minutes', '15 minutes', '30 minutes', '1 hour', '4 hours', 'Daily', 'Weekly', 'Monthly'];
export const SOURCES = ['Close', 'Open', 'High', 'Low', 'HL2', 'HLC3', 'OHLC4', 'Volume'];
export const VARIANTS = ['SMA', 'EMA', 'WMA', 'VWMA', 'Standard'];
export const SESSIONS = ['Pre-market', 'Opening range', 'Regular session', 'After-hours', 'Custom window'];
export const EVERY_OPTIONS = [1, 5, 10, 15, 30, 60];
export const TIMEZONES = [['device', 'Device local time'], ['America/New_York', 'US Eastern Time'], ['UTC', 'UTC']];

const MA_METRICS = ['SMA', 'EMA', 'WMA', 'VWMA'];
// The metrics the saved-list summary renders with a (length, timeframe) suffix.
const INDICATOR_SUMMARY = ['SMA', 'EMA', 'WMA', 'VWMA', 'RSI', 'MACD', 'ADX', 'ATR', 'Stochastic K', 'Stochastic D', 'Bollinger Upper', 'Bollinger Middle', 'Bollinger Lower', 'VWAP', 'CCI', 'OBV', 'MFI', 'ROC'];

let seq = 0;
const uid = (p) => `${p}-${Date.now()}-${++seq}`;

export function newCondition(data = {}) {
  return {
    id: uid('cond'),
    metric: data.metric || 'Close',
    timeframe: data.timeframe || 'Daily',
    length: data.length ?? 14,
    operator: data.operator || '>',
    mode: data.mode || 'value',
    value: data.value ?? '',
    source: data.source || 'Close',
    variant: data.variant || 'SMA',
    compareMetric: data.compareMetric || 'SMA',
    compareTimeframe: data.compareTimeframe || 'Daily',
    compareLength: data.compareLength ?? 50,
    percent: data.percent ?? 10,
    upper: data.upper ?? '',
    join: data.join || 'AND',
  };
}

export function newWindow(data = {}) {
  return {
    id: uid('win'),
    session: data.session || 'Regular session',
    start: data.start || '09:30',
    end: data.end || '16:00',
    every: Number(data.every || 5),
  };
}

// Which fields show, from the metric type, the compare mode and the operator.
export function fieldVisibility(c) {
  const meta = FILTER_MAP[c.metric] || {};
  return {
    length: meta.type === 'indicator',
    source: meta.type === 'indicator',
    variant: MA_METRICS.includes(c.metric),
    value: c.mode === 'value',
    second: c.mode === 'filter',
    percent: c.mode === 'percent' || c.operator.includes('%'),
    upper: c.operator === 'Between',
  };
}

// The live "Rule preview" string — the prototype's buildConditionPreview.
export function buildConditionPreview(c) {
  const meta = FILTER_MAP[c.metric] || {};
  const left = meta.type === 'indicator'
    ? `${c.variant === 'Standard' ? '' : c.variant + ' '}${meta.label}(${c.length}, ${c.timeframe})`
    : `${meta.label} (${c.timeframe})`;
  const val = c.value || '…';
  if (c.mode === 'filter') {
    return `${left} ${c.operator} ${FILTER_MAP[c.compareMetric]?.label || c.compareMetric} (${c.compareLength}, ${c.compareTimeframe})`;
  }
  if (c.mode === 'percent' || c.operator.includes('%')) {
    return `${left} ${c.operator} ${c.percent || '…'}%${c.mode === 'percent' ? ' vs ' + (FILTER_MAP[c.compareMetric]?.label || 'reference') : ''}`;
  }
  return `${left} ${c.operator} ${c.operator === 'Between' ? val + ' and ' + (c.upper || '…') : val}${meta.unit === 'percent' ? '%' : meta.unit === 'price' ? ' price' : ''}`;
}

// saveScreenerConfig's per-condition completeness test.
export function conditionIncomplete(c) {
  return (c.mode === 'value' && String(c.value).trim() === '' && c.operator !== 'Between') ||
    (c.mode === 'filter' && !c.compareMetric) ||
    (c.mode === 'percent' && String(c.percent).trim() === '');
}

// The saved-card summaries — renderScreenerConfigs.
export function filterSummary(conds) {
  if (!conds.length) return '';
  return conds.map((x) => {
    const m = FILTER_MAP[x.metric]?.label || x.metric;
    const lhs = INDICATOR_SUMMARY.includes(x.metric)
      ? `${x.variant && x.variant !== 'Standard' ? x.variant + ' ' : ''}${m}(${x.length || 14}, ${x.timeframe || 'Daily'})`
      : m;
    const rhs = x.mode === 'filter'
      ? (FILTER_MAP[x.compareMetric]?.label || x.compareMetric) + `(${x.compareLength || 50}, ${x.compareTimeframe || 'Daily'})`
      : x.mode === 'percent' ? `${x.percent || 10}% distance` : (x.value || '…');
    return `${lhs} ${x.operator} ${rhs}`;
  }).join(' · ');
}

export function scheduleSummary(windows) {
  return windows.map((w) => `${w.session} ${w.start}–${w.end} · ${w.every}m`).join(' / ');
}

const KEY = 'tradeDiskScreeners';
export function loadConfigs() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
export function saveConfigs(configs) {
  try { localStorage.setItem(KEY, JSON.stringify(configs)); } catch { /* private mode */ }
}
export const newScreenerId = () => 'scr-' + Date.now();
