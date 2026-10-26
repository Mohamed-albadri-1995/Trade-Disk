// Trade-Disk — the live Market snapshot builder (MARKET.md §3.5). Computes the
// broad-market read model from free Yahoo daily bars: index dashboard, the O'Neil
// market model (short/mid/long) and final regime, the sector heatmap, market breadth
// and theme watch. It writes the materialized snapshot into radar_market so the
// Market screen reads one row and never recomputes. Refresh is lazy: a read older
// than STALE_MS rebuilds it (owner/admin only — RLS gates the global write), so solo
// mode needs no cron. The O'Neil 175-industry-group ranking is NOT here: that needs
// the research engine (a whole-market classification), so the snapshot marks it
// pending rather than inventing numbers.

import * as yahoo from '../providers/yahoo.mjs';
import { ema } from '../providers/compute.mjs';

const STALE_MS = 10 * 60 * 1000; // rebuild a snapshot older than ten minutes

const INDEXES = [
  { sym: 'SPY', y: 'SPY', name: 'SPDR S&P 500 ETF', kind: 'etf' },
  { sym: 'QQQ', y: 'QQQ', name: 'Nasdaq-100 ETF', kind: 'etf' },
  { sym: 'DIA', y: 'DIA', name: 'Dow Jones ETF', kind: 'etf' },
  { sym: 'IWM', y: 'IWM', name: 'Russell 2000 ETF', kind: 'etf' },
  { sym: 'VIX', y: '^VIX', name: 'Cboe Volatility Index', kind: 'index' },
];

const SECTORS = [
  ['Energy', 'XLE'], ['Utilities', 'XLU'], ['Communication Services', 'XLC'],
  ['Materials', 'XLB'], ['Real Estate', 'XLRE'], ['Financials', 'XLF'],
  ['Retail', 'XRT'], ['Technology', 'XLK'], ['Consumer Discretionary', 'XLY'],
  ['Consumer Staples', 'XLP'], ['Semiconductors', 'SMH'], ['Industrials', 'XLI'],
  ['Transportation', 'XTN'], ['Health Care', 'XLV'], ['Biotechnology', 'IBB'],
];

// ── small maths on bars (oldest→newest, {t,o,h,l,c,v}) ──
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sma = (closes, n) => (closes.length >= n ? mean(closes.slice(-n)) : null);
const stdev = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const pct = (a, b) => (b ? ((a - b) / b) * 100 : 0);

// Day / week percentage change from completed closes. prev = yesterday's close
// (the bar before the last), week = five sessions before the last.
function changes(bars) {
  const c = bars.map((b) => b.c);
  const last = c[c.length - 1];
  const prev = c.length >= 2 ? c[c.length - 2] : last;
  const wk = c.length >= 6 ? c[c.length - 6] : c[0];
  return { price: last, day: pct(last, prev), week: pct(last, wk) };
}

// Wilder ADX(14) — trend strength, 0–100. Needs ~2·period bars.
function adx(bars, period = 14) {
  if (bars.length < period * 2 + 1) return null;
  let tr = 0, pdm = 0, ndm = 0; const dxs = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].h, l = bars[i].l, ph = bars[i - 1].h, pl = bars[i - 1].l, pc = bars[i - 1].c;
    const t = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    const up = h - ph, dn = pl - l;
    const p = up > dn && up > 0 ? up : 0;
    const n = dn > up && dn > 0 ? dn : 0;
    if (i <= period) { tr += t; pdm += p; ndm += n; }
    else { tr = tr - tr / period + t; pdm = pdm - pdm / period + p; ndm = ndm - ndm / period + n; }
    if (i >= period) {
      const pDI = 100 * (pdm / tr), nDI = 100 * (ndm / tr);
      const sum = pDI + nDI;
      dxs.push(sum ? (100 * Math.abs(pDI - nDI)) / sum : 0);
    }
  }
  if (dxs.length < period) return null;
  let a = mean(dxs.slice(0, period));
  for (let i = period; i < dxs.length; i++) a = (a * (period - 1) + dxs[i]) / period;
  return Math.round(a);
}

// Distribution days — SPY down > 0.2% on higher volume than the prior session,
// counted over the last 25 completed sessions (O'Neil's selling-pressure gauge).
function distributionDays(bars) {
  const w = bars.slice(-26);
  let n = 0;
  for (let i = 1; i < w.length; i++) {
    const d = pct(w[i].c, w[i - 1].c);
    if (d < -0.2 && w[i].v > w[i - 1].v) n++;
  }
  return n;
}

// ── formatting ──
const MINUS = '−';
const sign = (v) => (v >= 0 ? '+' : MINUS) + Math.abs(v).toFixed(2);
const pctStr = (v) => sign(v) + '%';
// VIX up is risk-off, so it reads 'negative' (red) when rising, like the prototype.
const cls = (v, invert = false) => ((invert ? -v : v) > 0.0001 ? 'positive' : (invert ? -v : v) < -0.0001 ? 'negative' : '');

// Drop today's still-forming bar so day/week changes compare completed sessions.
const dayUTC = (ms) => new Date(ms).toISOString().slice(0, 10);
function completed(bars) {
  const last = bars[bars.length - 1];
  return last && dayUTC(last.t * 1000) === dayUTC(Date.now()) ? bars.slice(0, -1) : bars;
}

// ── the builder ──
export async function buildSnapshot() {
  const symbols = [...INDEXES.map((i) => i.y), ...SECTORS.map(([, e]) => e)];
  const { out } = await yahoo.charts(symbols, { range: '1y', interval: '1d' });
  const barsOf = (y) => { const r = out[y]; return r && r.bars.length ? completed(r.bars) : null; };

  const spy = barsOf('SPY');
  if (!spy) throw new Error('market build: SPY bars unavailable');
  const spyCh = changes(spy);
  const spyC = spy.map((b) => b.c);

  // Index dashboard
  const indexes = INDEXES.map((ix) => {
    const b = barsOf(ix.y);
    if (!b) return null;
    const ch = changes(b);
    const price = ix.kind === 'index' ? ch.price.toFixed(2) : '$' + ch.price.toFixed(2);
    const vixInvert = ix.sym === 'VIX';
    return {
      sym: ix.sym, name: ix.name, price,
      changes: [
        { v: pctStr(ch.day), c: cls(ch.day, vixInvert), label: 'Day' },
        { v: pctStr(ch.week), c: cls(ch.week, vixInvert), label: 'Week' },
      ],
    };
  }).filter(Boolean);

  // O'Neil market model — short / mid / long
  const q = (y) => (barsOf(y) ? changes(barsOf(y)) : null);
  const spx = q('SPY'), ndx = q('QQQ'), rut = q('IWM'), vix = q('^VIX');
  const tri = (v) => (v > 0.1 ? 1 : v < -0.1 ? -1 : 0);
  const sig = (v, invert = false) => { const s = tri(invert ? -v : v); return [s, s > 0 ? 'positive' : s < 0 ? 'negative' : '']; };
  const shortSignals = [
    ['SPY Day', ...(spx ? sig(spx.day) : [0, ''])],
    ['QQQ Day', ...(ndx ? sig(ndx.day) : [0, ''])],
    ['IWM Day', ...(rut ? sig(rut.day) : [0, ''])],
    ['VIX', ...(vix ? sig(vix.day, true) : [0, ''])],
    ['SPY Week', ...(spx ? sig(spx.week) : [0, ''])],
    ['QQQ Week', ...(ndx ? sig(ndx.week) : [0, ''])],
  ];
  const shortScore = shortSignals.reduce((a, s) => a + s[1], 0);
  const shortVal = shortScore >= 2 ? 'BULLISH' : shortScore <= -2 ? 'BEARISH' : 'NEUTRAL';

  const s5 = sma(spyC, 5), s20 = sma(spyC, 20), s50 = sma(spyC, 50), s200 = sma(spyC, 200);
  const close = spyCh.price;
  const ab = (a, b) => (a != null && b != null ? (a >= b ? ['Above', 'positive'] : ['Below', 'negative']) : ['—', '']);
  const midSignals = [
    ['Close vs 5-day MA', ...ab(close, s5)],
    ['Close vs 20-day MA', ...ab(close, s20)],
    ['5-day vs 20-day MA', ...ab(s5, s20)],
    ['20-day vs 50-day MA', ...ab(s20, s50)],
  ];
  const midUp = midSignals.filter((s) => s[2] === 'positive').length;
  const midVal = midUp >= 3 ? 'UPTREND' : midUp <= 1 ? 'DOWNTREND' : 'SIDEWAYS';
  const midClass = midVal === 'UPTREND' ? 'positive' : midVal === 'DOWNTREND' ? 'negative' : '';

  const longSignals = [
    ['SPY close vs 200-day MA', ...ab(close, s200)],
    ['50-day MA vs 200-day MA', ...ab(s50, s200)],
    ['Reference instrument', 'SPY', ''],
  ];
  const longBull = longSignals.slice(0, 2).filter((s) => s[2] === 'positive').length;
  const longVal = longBull === 2 ? 'BULLISH' : longBull === 0 ? 'BEARISH' : 'MIXED';
  const longClass = longVal === 'BULLISH' ? 'positive' : longVal === 'BEARISH' ? 'negative' : '';

  // Bollinger position of SPY (20, 2σ) for the regime
  const win20 = spyC.slice(-20);
  const sd = win20.length === 20 ? stdev(win20) : 0;
  const boll = s20 == null ? 'MIDDLE' : close > s20 + 1.5 * sd ? 'UPPER' : close < s20 - 1.5 * sd ? 'LOWER' : 'MIDDLE';
  const bias = longVal === 'BULLISH' && midVal === 'UPTREND' ? 'LONG'
    : longVal === 'BEARISH' && midVal === 'DOWNTREND' ? 'SHORT' : 'NEUTRAL';
  const regimeOut = bias === 'LONG' ? (boll === 'UPPER' ? 'EXTENDED UP' : 'UPTREND')
    : bias === 'SHORT' ? (boll === 'LOWER' ? 'EXTENDED DOWN' : 'DOWNTREND') : 'RANGE-BOUND';

  const model = {
    short: { kicker: 'SHORT TERM', title: 'Market Bias', value: shortVal, valueClass: shortVal === 'BULLISH' ? 'positive' : shortVal === 'BEARISH' ? 'negative' : '',
      note: `Score ${shortScore >= 0 ? '+' : MINUS}${Math.abs(shortScore)} · six index day/week contributions`,
      signals: shortSignals.map(([l, s, c]) => [l, s > 0 ? '+' + s : s < 0 ? MINUS + Math.abs(s) : '0', c]) },
    mid: { kicker: 'MID TERM', title: 'Market Stage', value: midVal, valueClass: midClass,
      note: `${midUp} of 4 trend checks bullish · computed from SPY moving averages`, signals: midSignals },
    long: { kicker: 'LONG TERM', title: 'Long-Term Bias', value: longVal, valueClass: longClass,
      note: 'Computed from SPY vs its 200-day MA and the 50/200 cross', signals: longSignals },
  };
  const regime = {
    output: regimeOut, outputClass: bias === 'LONG' ? 'positive' : bias === 'SHORT' ? 'negative' : '',
    terms: [['Long-term', longVal], ['Mid-term', midVal], ['Bollinger position', boll]],
    bias, biasClass: bias === 'LONG' ? 'positive' : bias === 'SHORT' ? 'negative' : '',
    confidence: 'Computed from free daily data · not a trade instruction',
  };

  // Sector heatmap — each ETF vs SPY, with a trend bias, score, ADX and heat
  const heatRows = SECTORS.map(([name, etf]) => {
    const b = barsOf(etf);
    if (!b) return null;
    const ch = changes(b);
    const rsDay = ch.day - spyCh.day, rsWk = ch.week - spyCh.week;
    const c = b.map((x) => x.c), e50 = sma(c, 50), e20 = sma(c, 20);
    const trend = e20 != null && e50 != null && ch.price > e20 && e20 > e50 ? 'BULLISH'
      : e50 != null && ch.price < e50 ? 'BEARISH' : 'NEUTRAL';
    const ax = adx(b) ?? 0;
    // score 0..100: relative strength tilt + trend + ADX
    const score = Math.max(0, Math.min(100, Math.round(50 + rsWk * 4 + (trend === 'BULLISH' ? 15 : trend === 'BEARISH' ? -15 : 0) + (ax - 20) * 0.5)));
    const hot = score >= 70 && trend === 'BULLISH' ? '🔥 HOT' : '—';
    return { name, etf, day: ch.day, week: ch.week, rsDay, rsWk, trend, score, adx: ax, hot };
  }).filter(Boolean).sort((a, b) => b.score - a.score);

  const heatmap = heatRows.map((r) => ({ cells: [
    { t: r.name }, { t: r.etf },
    { t: pctStr(r.day), c: cls(r.day) }, { t: pctStr(r.week), c: cls(r.week) },
    { t: pctStr(r.rsDay), c: cls(r.rsDay) }, { t: pctStr(r.rsWk), c: cls(r.rsWk) },
    { t: r.trend }, { t: '' + r.score }, { t: '' + r.adx }, { t: r.hot },
  ] }));

  // Breadth — sector advancers as the free proxy, real distribution days, live VIX
  const adv = heatRows.filter((r) => r.day > 0.05).length;
  const dec = heatRows.filter((r) => r.day < -0.05).length;
  const unch = heatRows.length - adv - dec;
  const pctOf = (n) => Math.round((n / (heatRows.length || 1)) * 100) + '%';
  const vixLevel = vix ? vix.price.toFixed(2) : '—';
  const breadth = {
    advancing: pctOf(adv), declining: pctOf(dec), unchanged: pctOf(unch),
    distribution: `${distributionDays(spy)} · last 25 sessions`,
    volatility: `VIX ${vixLevel}`,
  };

  // Theme watch — derived from the live sector/industry leaders
  const byEtf = Object.fromEntries(heatRows.map((r) => [r.etf, r]));
  const themeOf = (etf, name) => {
    const r = byEtf[etf]; if (!r) return null;
    const dot = r.score >= 70 ? 'hot' : r.score >= 50 ? 'warm' : 'cool';
    const status = r.trend === 'BULLISH' ? 'Strong' : r.trend === 'BEARISH' ? 'Weak' : 'Mixed';
    const statusClass = r.trend === 'BULLISH' ? 'positive' : r.trend === 'BEARISH' ? 'negative' : '';
    return { dot, name, note: `${r.etf} · score ${r.score} · RS wk ${pctStr(r.rsWk)}`, status, statusClass };
  };
  const themes = [
    themeOf('SMH', 'Semiconductors'), themeOf('XLK', 'Technology'),
    themeOf('XLF', 'Financials'), themeOf('XLE', 'Energy'),
  ].filter(Boolean);

  const now = new Date();
  const asOf = now.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' ET';
  return {
    live: true, asOf, builtAt: now.toISOString(),
    scan: { title: 'Live screeners active', window: '04:00–20:00 ET', lastScan: now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' }), examples: 5 },
    indexes, model, regime, heatmap,
    breadth, themes,
  };
}

const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

// Read the materialized snapshot; if it is stale and this client may write the global
// row (owner/admin — RLS), rebuild it from the live feed first. Any failure falls back
// to the last good snapshot so the screen never breaks.
// `force` (set when a scan runs) refreshes the snapshot even if it is not yet stale,
// so running any scanner updates the Market tab — but a 60s floor avoids rebuilding
// it twice when several scans fire in quick succession.
export async function getMarket(sb, { force = false } = {}) {
  const rows = chk(await sb.from('radar_market').select('snapshot, as_of').eq('id', 1).limit(1));
  const cur = rows[0] || null;
  const ageMs = cur?.as_of ? Date.now() - new Date(cur.as_of).getTime() : Infinity;
  if (cur && ageMs < (force ? 60 * 1000 : STALE_MS)) return cur.snapshot;
  try {
    const snap = await buildSnapshot();
    const { error } = await sb.from('radar_market').upsert({ id: 1, snapshot: snap, as_of: snap.builtAt });
    if (error) return cur ? cur.snapshot : snap; // not allowed to write (not owner) → serve what we built/have
    return snap;
  } catch {
    return cur ? cur.snapshot : null; // live build failed → last good snapshot
  }
}
