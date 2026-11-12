// Trade-Disk — Radar view logic, ported VERBATIM from the approved radar prototype
// (frontend-design/radar.html). The view does its own formatting, filtering and
// sorting over the records the API returns; these are the prototype's own functions
// so the numbers and ordering match it exactly.

export const money = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : '$' + Number(n).toFixed(2));

export const pmRange = (s) => Math.max(0, s.pmHigh - s.pmLow);
export const pmRangePct = (s) => (s.pmLow > 0 ? (pmRange(s) / s.pmLow) * 100 : 0);
export const pmAdr = (s) => {
  const adrDollar = (s.p * s.adr) / 100;
  return adrDollar > 0 ? pmRange(s) / adrDollar : 0;
};

// The sparkline geometry — same viewBox, same point math, same up/down colours.
export function sparkData(points) {
  const max = Math.max(...points), min = Math.min(...points), w = 120, h = 30;
  const coords = points
    .map((v, i) => `${((i * w) / (points.length - 1)).toFixed(1)},${(h - 3 - ((v - min) / (max - min || 1)) * (h - 7)).toFixed(1)}`)
    .join(' ');
  return { coords, w, h, stroke: points[points.length - 1] >= points[0] ? '#19dfa0' : '#ff6374' };
}

// renderStocks's sort: change ↓, ticker A–Z, else score ↓.
export const sortStocks = (list, sort) =>
  [...list].sort((a, b) => (sort === 'change' ? b.c - a.c : sort === 'ticker' ? a.t.localeCompare(b.t) : b.s - a.s));

// The sidebar filters over the scan's results. A numeric filter left at 0 (or blank)
// is off, so "Apply" narrows by exactly what the user set and nothing else.
export function filterStocks(stocks, f) {
  const c = f.checks, on = (v) => Number(v) > 0;
  return stocks.filter((s) =>
    (!on(f.score) || s.s >= f.score) &&
    (!on(f.rvol) || s.r >= f.rvol) &&
    (!on(f.minp) || s.p >= f.minp) &&
    (!on(f.maxp) || s.p <= f.maxp) &&
    (!f.market || f.market === 'US Stocks' || s.ex === f.market) &&
    (f.sector === 'Any' || s.sec === f.sector) &&
    (f.cap === 'Any' || s.capBand === f.cap) &&
    (!c.premarket || s.tags.includes('Pre-Market')) &&
    (!c.earnings || s.tags.includes('Earnings')) &&
    (!c.canslimfilter || s.cs) &&
    (!c.ema || s.ema) &&
    (!c.stacked || s.stacked) &&
    (!c.newsfilter || s.news) &&
    (!c.hot || s.c >= 4)
  );
}

// changePreset's score/rvol mapping and title.
export function presetValues(preset) {
  if (preset.startsWith('T2')) return { score: 65, rvol: 2.5 };
  if (preset.startsWith('T7')) return { score: 68, rvol: 2 };
  return { score: 60, rvol: 2 };
}
export const presetTitle = (preset) => preset.split(' — ')[0] + ' Scanner';

// How many filter boxes are ticked (shown on the mobile filters toggle).
export const filterCount = (checks) => Object.values(checks).filter(Boolean).length;

export const CHECK_IDS = ['premarket', 'earnings', 'canslimfilter', 'ema', 'stacked', 'hot', 'newsfilter'];

// Everything off: a fresh scan shows all its matches, and Apply only narrows by what
// the user then sets.
export const DEFAULT_FILTERS = {
  market: 'US Stocks',
  preset: '',
  score: 0,
  rvol: 0,
  minp: 0,
  maxp: 0,
  cap: 'Any',
  sector: 'Any',
  checks: { premarket: false, earnings: false, canslimfilter: false, ema: false, stacked: false, hot: false, newsfilter: false },
};

// The US market's session right now, for the header badge.
export function marketSession(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now).map((x) => [x.type, x.value]));
  const m = (+p.hour % 24) * 60 + +p.minute;
  if (p.weekday === 'Sat' || p.weekday === 'Sun' || m < 240 || m >= 1200) return 'closed';
  return m < 570 ? 'pre' : m < 960 ? 'open' : 'after';
}
