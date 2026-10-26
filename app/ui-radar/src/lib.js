// Trade-Disk — Radar view logic, ported VERBATIM from the approved radar prototype
// (frontend-design/radar.html). The view does its own formatting, filtering and
// sorting over the records the API returns; these are the prototype's own functions
// so the numbers and ordering match it exactly.

export const money = (n) => '$' + Number(n).toFixed(2);

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

// filterStocks's predicate, field for field. Note: the Pre-Market toggle is a view
// chip in the prototype and does not narrow the list, so it is absent here too.
export function filterStocks(stocks, f) {
  const c = f.checks;
  return stocks.filter((s) =>
    s.s >= f.score &&
    s.r >= f.rvol &&
    s.p >= f.minp &&
    s.p <= f.maxp &&
    (f.sector === 'Any' || s.sec === f.sector) &&
    (f.cap === 'Any' || s.capBand === f.cap) &&
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

// updateFilterCount: checked boxes + the three always-on numeric filters.
export const filterCount = (checks) => Object.values(checks).filter(Boolean).length + 3;

export const CHECK_IDS = ['premarket', 'earnings', 'canslimfilter', 'ema', 'stacked', 'hot', 'newsfilter'];

export const DEFAULT_FILTERS = {
  market: 'US Stocks',
  preset: 'T1 — Big Move',
  score: 60,
  rvol: 2,
  minp: 5,
  maxp: 500,
  cap: 'Any',
  sector: 'Any',
  checks: { premarket: true, earnings: false, canslimfilter: false, ema: false, stacked: false, hot: false, newsfilter: false },
};
