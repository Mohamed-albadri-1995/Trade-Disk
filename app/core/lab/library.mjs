// Trade-Disk — the Lab's verified indicator library: the ONLY market math in the
// Lab. Every indicator the chart draws or a strategy names is one function here,
// registered into one map, so what you see on the chart is what the backtest
// trades. Each function is pure over an OHLCV frame (bars oldest→newest) and
// returns an array aligned to the bars, or a dict of named lines. Warm-up and
// undefined bars are NaN, NEVER zero — a strategy rule reading a NaN is false,
// not "0 > x". Definitions follow TradingView's (SMA/EMA/RMA/RSI/ATR/BB) so a
// value matches the chart a trader already trusts.
//
// Scope: the daily-bar essentials (the Lab runs on free Yahoo daily bars).
// Intraday-session primitives (session VWAP, pre-market levels) need intraday
// feeds and are out of this MVP; the registry is built to grow into them.

const NA = NaN;
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

// ---- sources: one array pulled from the frame -----------------------------
export const SOURCES = ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4', 'volume'];
export function source(bars, which = 'close') {
  switch (which) {
    case 'open': return bars.map((b) => b.o);
    case 'high': return bars.map((b) => b.h);
    case 'low': return bars.map((b) => b.l);
    case 'volume': return bars.map((b) => b.v);
    case 'hl2': return bars.map((b) => (b.h + b.l) / 2);
    case 'hlc3': return bars.map((b) => (b.h + b.l + b.c) / 3);
    case 'ohlc4': return bars.map((b) => (b.o + b.h + b.l + b.c) / 4);
    case 'close':
    default: return bars.map((b) => b.c);
  }
}

// ---- small array helpers ---------------------------------------------------
const fill = (n) => new Array(n).fill(NA);

function sma(src, length) {
  const out = fill(src.length);
  let sum = 0, cnt = 0;
  for (let i = 0; i < src.length; i++) {
    if (isNum(src[i])) { sum += src[i]; cnt++; }
    if (i >= length) { const o = src[i - length]; if (isNum(o)) { sum -= o; cnt--; } }
    if (i >= length - 1 && cnt === length) out[i] = sum / length;
  }
  return out;
}

// Wilder's running MA (RMA / SMMA): alpha = 1/length, seeded with the SMA of the
// first `length` values. Used by RSI and ATR, exactly as TradingView's ta.rma.
function rma(src, length) {
  const out = fill(src.length);
  let prev = NA, seedSum = 0, seedCnt = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (!isNum(prev)) {
      if (isNum(v)) { seedSum += v; seedCnt++; }
      if (seedCnt === length) { prev = seedSum / length; out[i] = prev; }
    } else {
      prev = (prev * (length - 1) + (isNum(v) ? v : prev)) / length;
      out[i] = prev;
    }
  }
  return out;
}

function ema(src, length) {
  const out = fill(src.length);
  const k = 2 / (length + 1);
  let prev = NA, seedSum = 0, seedCnt = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (!isNum(prev)) {
      if (isNum(v)) { seedSum += v; seedCnt++; }       // seed with SMA, like TV
      if (seedCnt === length) { prev = seedSum / length; out[i] = prev; }
    } else {
      prev = isNum(v) ? v * k + prev * (1 - k) : prev;
      out[i] = prev;
    }
  }
  return out;
}

function wma(src, length) {
  const out = fill(src.length);
  const denom = (length * (length + 1)) / 2;
  for (let i = length - 1; i < src.length; i++) {
    let num = 0, ok = true;
    for (let j = 0; j < length; j++) { const v = src[i - length + 1 + j]; if (!isNum(v)) { ok = false; break; } num += v * (j + 1); }
    if (ok) out[i] = num / denom;
  }
  return out;
}

function vwma(bars, length) {
  const out = fill(bars.length);
  let pv = 0, vol = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (isNum(b.c) && isNum(b.v)) { pv += b.c * b.v; vol += b.v; }
    if (i >= length) { const o = bars[i - length]; if (isNum(o.c) && isNum(o.v)) { pv -= o.c * o.v; vol -= o.v; } }
    if (i >= length - 1 && vol > 0) out[i] = pv / vol;
  }
  return out;
}

// Hull MA: wma(2*wma(src, n/2) − wma(src, n), round(sqrt(n))).
function hma(src, length) {
  const half = Math.max(1, Math.round(length / 2));
  const sq = Math.max(1, Math.round(Math.sqrt(length)));
  const w1 = wma(src, half), w2 = wma(src, length);
  const raw = src.map((_, i) => (isNum(w1[i]) && isNum(w2[i]) ? 2 * w1[i] - w2[i] : NA));
  return wma(raw, sq);
}

function stdevPop(src, length) {               // population stdev (÷N), like TV ta.stdev
  const out = fill(src.length);
  for (let i = length - 1; i < src.length; i++) {
    let sum = 0, ok = true;
    for (let j = 0; j < length; j++) { const v = src[i - j]; if (!isNum(v)) { ok = false; break; } sum += v; }
    if (!ok) continue;
    const mean = sum / length;
    let va = 0;
    for (let j = 0; j < length; j++) { const d = src[i - j] - mean; va += d * d; }
    out[i] = Math.sqrt(va / length);
  }
  return out;
}

function trueRange(bars) {
  const out = fill(bars.length);
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (!isNum(b.h) || !isNum(b.l)) continue;
    if (i === 0 || !isNum(bars[i - 1].c)) { out[i] = b.h - b.l; continue; }
    const pc = bars[i - 1].c;
    out[i] = Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc));
  }
  return out;
}

function rsi(src, length) {
  const out = fill(src.length);
  const gain = fill(src.length), loss = fill(src.length);
  for (let i = 1; i < src.length; i++) {
    if (!isNum(src[i]) || !isNum(src[i - 1])) { gain[i] = NA; loss[i] = NA; continue; }
    const d = src[i] - src[i - 1];
    gain[i] = d > 0 ? d : 0;
    loss[i] = d < 0 ? -d : 0;
  }
  const ag = rma(gain, length), al = rma(loss, length);
  for (let i = 0; i < src.length; i++) {
    if (!isNum(ag[i]) || !isNum(al[i])) continue;
    out[i] = al[i] === 0 ? 100 : 100 - 100 / (1 + ag[i] / al[i]);
  }
  return out;
}

function highest(src, length) {
  const out = fill(src.length);
  for (let i = length - 1; i < src.length; i++) {
    let m = -Infinity, ok = true;
    for (let j = 0; j < length; j++) { const v = src[i - j]; if (!isNum(v)) { ok = false; break; } if (v > m) m = v; }
    if (ok) out[i] = m;
  }
  return out;
}
function lowest(src, length) {
  const out = fill(src.length);
  for (let i = length - 1; i < src.length; i++) {
    let m = Infinity, ok = true;
    for (let j = 0; j < length; j++) { const v = src[i - j]; if (!isNum(v)) { ok = false; break; } if (v < m) m = v; }
    if (ok) out[i] = m;
  }
  return out;
}

// Previous-bar value (on a daily frame, the prior trading day). offset 1 = prev.
const prev = (src, k = 1) => src.map((_, i) => (i >= k ? src[i - k] : NA));

// Floor (classic) pivots from the PREVIOUS bar's H/L/C — the standard daily pivot
// grid. Returns NaN on the first bar (no prior day).
function floorPivots(bars) {
  const n = bars.length, P = fill(n), R1 = fill(n), R2 = fill(n), R3 = fill(n), S1 = fill(n), S2 = fill(n), S3 = fill(n);
  for (let i = 1; i < n; i++) {
    const h = bars[i - 1].h, l = bars[i - 1].l, c = bars[i - 1].c;
    if (!isNum(h) || !isNum(l) || !isNum(c)) continue;
    const p = (h + l + c) / 3, rng = h - l;
    P[i] = p; R1[i] = 2 * p - l; S1[i] = 2 * p - h; R2[i] = p + rng; S2[i] = p - rng; R3[i] = h + 2 * (p - l); S3[i] = l - 2 * (h - p);
  }
  return { P, R1, R2, R3, S1, S2, S3 };
}

// Pivot high/low: a swing confirmed `right` bars later (no look-ahead — the value
// first appears at the confirmation bar). Carry it forward with hold:true to get
// a level to retest, exactly like Pine's ta.pivothigh + fixnan.
function pivotHL(bars, left, right, hi) {
  const n = bars.length, out = fill(n);
  const arr = bars.map((b) => (hi ? b.h : b.l));
  for (let i = left; i < n - right; i++) {
    const v = arr[i];
    if (!isNum(v)) continue;
    let ok = true;
    for (let j = 1; j <= left && ok; j++) if (!(hi ? arr[i - j] < v : arr[i - j] > v)) ok = false;
    for (let j = 1; j <= right && ok; j++) if (!(hi ? arr[i + j] <= v : arr[i + j] >= v)) ok = false;
    if (ok) out[i + right] = v;      // placed at the confirmation bar
  }
  return out;
}

function slope(src, length) {         // least-squares slope over `length` bars (per bar)
  const out = fill(src.length);
  const xs = Array.from({ length }, (_, j) => j);
  const xbar = (length - 1) / 2;
  let sxx = 0; for (const x of xs) sxx += (x - xbar) ** 2;
  for (let i = length - 1; i < src.length; i++) {
    let ybar = 0, ok = true;
    for (let j = 0; j < length; j++) { const v = src[i - length + 1 + j]; if (!isNum(v)) { ok = false; break; } ybar += v; }
    if (!ok) continue;
    ybar /= length;
    let sxy = 0;
    for (let j = 0; j < length; j++) sxy += (xs[j] - xbar) * (src[i - length + 1 + j] - ybar);
    out[i] = sxy / sxx;
  }
  return out;
}

const candle = (bars, which) => bars.map((b) => {
  if (!isNum(b.o) || !isNum(b.h) || !isNum(b.l) || !isNum(b.c)) return NA;
  if (which === 'body') return Math.abs(b.c - b.o);
  if (which === 'upper_wick') return b.h - Math.max(b.o, b.c);
  if (which === 'lower_wick') return Math.min(b.o, b.c) - b.l;
  return b.h - b.l;                 // bar_range
});

// Relative volume: today's volume ÷ the average of the PRIOR `length` bars (today
// excluded, so it is a clean "how busy vs normal" with no self-reference).
function relVolume(bars, length) {
  const out = fill(bars.length);
  for (let i = length; i < bars.length; i++) {
    let sum = 0, ok = true;
    for (let j = 1; j <= length; j++) { const v = bars[i - j].v; if (!isNum(v)) { ok = false; break; } sum += v; }
    if (ok && sum > 0) out[i] = bars[i].v / (sum / length);
  }
  return out;
}

// Session VWAP — RTH only (09:30–16:00 ET), source HLC/3, resets each ET day.
// A faithful port of the qp `vwap.session` primitive (matches TradingView's VWAP
// on an RTH chart). On daily+ frames each bar is its own session → value = HLC3.
const _etHM = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit' });
const _etDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
function etParts(tSec) {
  const d = new Date(tSec * 1000);
  let [h, m] = _etHM.format(d).split(':').map(Number);
  if (h === 24) h = 0;                               // some engines format midnight as 24:00
  return { h, m, day: _etDay.format(d) };
}
const inRth = (h, m) => (h > 9 || (h === 9 && m >= 30)) && h < 16;
function isDailyBars(bars) {
  if (bars.length < 3) return false;
  const d = [];
  for (let i = 1; i < bars.length; i++) d.push(bars[i].t - bars[i - 1].t);
  d.sort((a, b) => a - b);
  return d[d.length >> 1] >= 12 * 3600;              // median spacing ≥ 12h → daily+
}
function sessionVwap(bars) {
  const out = fill(bars.length);
  if (!bars.length) return out;
  if (isDailyBars(bars)) {
    for (let i = 0; i < bars.length; i++) { const b = bars[i]; if (isNum(b.h) && isNum(b.l) && isNum(b.c)) out[i] = (b.h + b.l + b.c) / 3; }
    return out;
  }
  let cumPv = 0, cumV = 0, lastDay = null;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (!isNum(b.h) || !isNum(b.l) || !isNum(b.c) || !isNum(b.v)) continue;
    const { h, m, day } = etParts(b.t);
    if (!inRth(h, m)) continue;                      // skip pre/after-hours
    if (day !== lastDay) { cumPv = 0; cumV = 0; lastDay = day; }  // reset at the session
    const price = (b.h + b.l + b.c) / 3;
    cumPv += price * b.v; cumV += b.v;
    if (cumV > 0) out[i] = cumPv / cumV;
  }
  return out;
}

// ---- the registry: short name → definition --------------------------------
// `inputs: 'source'` → the fn gets (array, params); `'bars'` → (frame, params).
// `lines` lists a multi-line primitive's outputs (picked with operand `sub`).
const P = (name, kind, def, extra = {}) => ({ name, kind, default: def, ...extra });

export const LIB = {
  // moving averages
  sma: { group: 'ma', inputs: 'source', params: [P('length', 'int', 20, { min: 1 })], fn: (s, p) => sma(s, p.length), desc: 'Simple moving average.' },
  ema: { group: 'ma', inputs: 'source', params: [P('length', 'int', 20, { min: 1 })], fn: (s, p) => ema(s, p.length), desc: 'Exponential moving average (SMA-seeded, like TradingView).' },
  wma: { group: 'ma', inputs: 'source', params: [P('length', 'int', 20, { min: 1 })], fn: (s, p) => wma(s, p.length), desc: 'Weighted moving average.' },
  rma: { group: 'ma', inputs: 'source', params: [P('length', 'int', 14, { min: 1 })], fn: (s, p) => rma(s, p.length), desc: "Wilder's running MA (SMMA)." },
  vwma: { group: 'ma', inputs: 'bars', params: [P('length', 'int', 20, { min: 1 })], fn: (b, p) => vwma(b, p.length), desc: 'Volume-weighted moving average.' },
  hma: { group: 'ma', inputs: 'source', params: [P('length', 'int', 20, { min: 2 })], fn: (s, p) => hma(s, p.length), desc: 'Hull moving average.' },

  // oscillator
  rsi: { group: 'osc', inputs: 'source', params: [P('length', 'int', 14, { min: 2 })], fn: (s, p) => rsi(s, p.length), desc: 'Relative Strength Index (Wilder).' },

  // session VWAP (intraday RTH; HLC3; resets 09:30 ET) — matches qp vwap.session
  vwap: { group: 'vwap', inputs: 'bars', params: [], fn: (b) => sessionVwap(b), desc: 'Session VWAP — RTH only, HLC3, resets 09:30 ET (matches TradingView VWAP).' },

  // volatility
  true_range: { group: 'volatility', inputs: 'bars', params: [], fn: (b) => trueRange(b), desc: 'True range.' },
  atr: { group: 'volatility', inputs: 'bars', params: [P('length', 'int', 14, { min: 1 })], fn: (b, p) => rma(trueRange(b), p.length), desc: 'Average true range (Wilder).' },
  stdev: { group: 'volatility', inputs: 'source', params: [P('length', 'int', 20, { min: 1 })], fn: (s, p) => stdevPop(s, p.length), desc: 'Population standard deviation.' },
  bb: {
    group: 'volatility', inputs: 'source', lines: ['upper', 'middle', 'lower'],
    params: [P('length', 'int', 20, { min: 1 }), P('mult', 'float', 2, { min: 0.1 })],
    fn: (s, p) => { const mid = sma(s, p.length), sd = stdevPop(s, p.length); return { middle: mid, upper: mid.map((m, i) => (isNum(m) ? m + p.mult * sd[i] : NA)), lower: mid.map((m, i) => (isNum(m) ? m - p.mult * sd[i] : NA)) }; },
    desc: 'Bollinger Bands (SMA ± mult·stdev).',
  },

  // extremes & levels
  highest: { group: 'extremes', inputs: 'source', params: [P('length', 'int', 20, { min: 1 })], fn: (s, p) => highest(s, p.length), desc: 'Highest value over length.' },
  lowest: { group: 'extremes', inputs: 'source', params: [P('length', 'int', 20, { min: 1 })], fn: (s, p) => lowest(s, p.length), desc: 'Lowest value over length.' },
  prev_close: { group: 'levels', inputs: 'bars', params: [], fn: (b) => prev(b.map((x) => x.c)), desc: "Previous bar's close." },
  prev_high: { group: 'levels', inputs: 'bars', params: [], fn: (b) => prev(b.map((x) => x.h)), desc: "Previous bar's high." },
  prev_low: { group: 'levels', inputs: 'bars', params: [], fn: (b) => prev(b.map((x) => x.l)), desc: "Previous bar's low." },
  prev_open: { group: 'levels', inputs: 'bars', params: [], fn: (b) => prev(b.map((x) => x.o)), desc: "Previous bar's open." },
  window_high: { group: 'levels', inputs: 'bars', params: [P('length', 'int', 20, { min: 1 })], fn: (b, p) => highest(b.map((x) => x.h), p.length), desc: 'Highest high over length bars.' },
  window_low: { group: 'levels', inputs: 'bars', params: [P('length', 'int', 20, { min: 1 })], fn: (b, p) => lowest(b.map((x) => x.l), p.length), desc: 'Lowest low over length bars.' },
  floor: { group: 'pivots', inputs: 'bars', lines: ['P', 'R1', 'R2', 'R3', 'S1', 'S2', 'S3'], params: [], fn: (b) => floorPivots(b), desc: 'Classic floor pivots from the prior bar (P, R1–R3, S1–S3).' },

  // structure
  pivot_high: { group: 'structure', inputs: 'bars', params: [P('left', 'int', 5, { min: 1 }), P('right', 'int', 5, { min: 1 })], fn: (b, p) => pivotHL(b, p.left, p.right, true), desc: 'Swing high, confirmed `right` bars later.' },
  pivot_low: { group: 'structure', inputs: 'bars', params: [P('left', 'int', 5, { min: 1 }), P('right', 'int', 5, { min: 1 })], fn: (b, p) => pivotHL(b, p.left, p.right, false), desc: 'Swing low, confirmed `right` bars later.' },

  // candle anatomy
  body: { group: 'candle', inputs: 'bars', params: [], fn: (b) => candle(b, 'body'), desc: 'Candle body size |close − open|.' },
  upper_wick: { group: 'candle', inputs: 'bars', params: [], fn: (b) => candle(b, 'upper_wick'), desc: 'Upper wick length.' },
  lower_wick: { group: 'candle', inputs: 'bars', params: [], fn: (b) => candle(b, 'lower_wick'), desc: 'Lower wick length.' },
  bar_range: { group: 'candle', inputs: 'bars', params: [], fn: (b) => candle(b, 'bar_range'), desc: 'Bar range high − low.' },

  // trend & volume
  slope: { group: 'trend', inputs: 'source', params: [P('length', 'int', 20, { min: 2 })], fn: (s, p) => slope(s, p.length), desc: 'Least-squares slope per bar over length.' },
  avg_volume: { group: 'volume', inputs: 'bars', params: [P('length', 'int', 20, { min: 1 })], fn: (b, p) => sma(b.map((x) => x.v), p.length), desc: 'Average volume over length.' },
  rel_volume: { group: 'volume', inputs: 'bars', params: [P('length', 'int', 20, { min: 1 })], fn: (b, p) => relVolume(b, p.length), desc: 'Relative volume vs the prior `length` bars.' },
};

// Resolve a primitive by short name or `group.name`.
export function resolve(name) {
  if (LIB[name]) return { key: name, def: LIB[name] };
  for (const [k, def] of Object.entries(LIB)) if (`${def.group}.${k}` === name) return { key: k, def };
  return null;
}

// Compute one primitive over a frame. `spec` = { name, source?, params?, sub? }.
// Returns an array aligned to bars (a dict line picked by `sub`, else the whole
// dict for a multi-line primitive when no sub is given → its first line).
export function compute(bars, spec) {
  const r = resolve(spec.name);
  if (!r) throw new Error(`unknown primitive: ${spec.name}`);
  const { def } = r;
  const params = {};
  for (const pdef of def.params) {
    let v = spec.params?.[pdef.name];
    v = v == null ? pdef.default : v;
    if (pdef.kind === 'int') v = Math.round(+v);
    else if (pdef.kind === 'float') v = +v;
    if (pdef.min != null && v < pdef.min) v = pdef.min;
    if (pdef.max != null && v > pdef.max) v = pdef.max;
    params[pdef.name] = v;
  }
  const input = def.inputs === 'bars' ? bars : source(bars, spec.source || 'close');
  const res = def.fn(input, params);
  if (def.lines) { const line = spec.sub && def.lines.includes(spec.sub) ? spec.sub : def.lines[0]; return res[line]; }
  return res;
}

// A plain catalogue (for the UI's indicator picker and help).
export function catalogue() {
  return Object.entries(LIB).map(([name, d]) => ({
    name, key: `${d.group}.${name}`, group: d.group, inputs: d.inputs,
    params: d.params.map((p) => ({ name: p.name, kind: p.kind, default: p.default, min: p.min, max: p.max })),
    lines: d.lines || null, desc: d.desc,
  }));
}
