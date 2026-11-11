// Trade-Disk — technical indicators computed from daily OHLCV bars (oldest→newest,
// {t,o,h,l,c,v}). Pure maths, no feed of its own; the analysis builder feeds it
// Yahoo daily bars. Volume/range stats use only completed sessions (today's bar is
// still forming); price/high/low/open reflect the latest live bar, prevClose the one
// before it. Intraday-only indicators (VWAP, pre-market) are not computable here.

import { ema as emaOf } from '../providers/compute.mjs';

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const r2 = (v) => (v == null || !isFinite(v) ? null : +(+v).toFixed(2));
const r1 = (v) => (v == null || !isFinite(v) ? null : +(+v).toFixed(1));
const sma = (vals, n) => (vals.length >= n ? mean(vals.slice(-n)) : null);
// The US market's calendar day and minute-of-day for an instant. A daily bar is
// "still forming" only on its own ET day before the 16:00 ET close.
const etDay = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const etMinute = (ms) => {
  const [h, m] = new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' }).split(':').map(Number);
  return (h % 24) * 60 + m;
};

// Wilder RSI(14): seed with the plain average of the first n changes, then smooth
// every later change in (avg = (avg·(n−1) + change) / n) — the form TradingView and
// other platforms use, so the number matches what a trader sees elsewhere.
function rsi(closes, n = 14) {
  if (closes.length < n + 1) return null;
  let ag = 0, al = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) ag += d; else al -= d;
  }
  ag /= n; al /= n;
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (n - 1) + Math.max(d, 0)) / n;
    al = (al * (n - 1) + Math.max(-d, 0)) / n;
  }
  if (al === 0) return ag === 0 ? 50 : 100;
  return 100 - 100 / (1 + ag / al);
}

// Wilder ATR(14).
function atr(bars, n = 14) {
  if (bars.length < n + 1) return null;
  const trs = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].h, l = bars[i].l, pc = bars[i - 1].c;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  let a = mean(trs.slice(0, n));
  for (let i = n; i < trs.length; i++) a = (a * (n - 1) + trs[i]) / n;
  return a;
}

// Full EMA series (for MACD line + signal).
function emaSeries(vals, period) {
  if (!vals.length) return [];
  const k = 2 / (period + 1), out = [vals[0]];
  for (let i = 1; i < vals.length; i++) out.push(vals[i] * k + out[i - 1] * (1 - k));
  return out;
}

function macd(closes) {
  if (closes.length < 26) return null;
  const e12 = emaSeries(closes, 12), e26 = emaSeries(closes, 26);
  const line = e12.map((v, i) => v - e26[i]);
  const sig = emaSeries(line.slice(25), 9); // start once 26-EMA is meaningful
  const l = line[line.length - 1], s = sig[sig.length - 1];
  return { line: r2(l), signal: r2(s), hist: r2(l - s), above: l > s };
}

function stochastic(bars, n = 14, d = 3) {
  if (bars.length < n + d) return null;
  const ks = [];
  for (let i = bars.length - d; i < bars.length; i++) {
    const w = bars.slice(i - n + 1, i + 1);
    const hi = Math.max(...w.map((b) => b.h)), lo = Math.min(...w.map((b) => b.l));
    ks.push(hi === lo ? 50 : ((bars[i].c - lo) / (hi - lo)) * 100);
  }
  const k = ks[ks.length - 1];
  return { k: r1(k), d: r1(mean(ks)) };
}

const posPct = (price, w) => {
  if (!w.length) return null;
  const lo = Math.min(...w.map((b) => b.l)), hi = Math.max(...w.map((b) => b.h));
  return hi === lo ? 50 : r1(((price - lo) / (hi - lo)) * 100);
};

export function technicals(bars, nowMs = Date.now()) {
  if (!bars || bars.length < 2) return {};
  const last = bars[bars.length - 1];
  const partial = etDay(last.t * 1000) === etDay(nowMs) && etMinute(nowMs) < 16 * 60;
  const done = partial ? bars.slice(0, -1) : bars;   // completed sessions
  const closesAll = bars.map((b) => b.c);
  const closesDone = done.map((b) => b.c);

  const price = last.c;
  const prevClose = bars.length >= 2 ? bars[bars.length - 2].c : null;
  const ema9 = emaOf(closesAll.slice(-60), 9), ema13 = emaOf(closesAll.slice(-80), 13),
    ema20 = emaOf(closesAll.slice(-120), 20), ema50 = emaOf(closesAll.slice(-200), 50);
  const sma200v = sma(closesAll, 200), sma5v = sma(closesAll, 5);

  // volume / range on completed sessions
  const vols = done.map((b) => b.v).filter((v) => v > 0);
  const volumeSession = done.length ? done[done.length - 1].v : null;
  const avgVol20 = vols.length >= 5 ? mean(vols.slice(-21, -1)) : null;
  const rvol20 = avgVol20 ? (done[done.length - 1].v) / avgVol20 : null;
  let upv = 0, dnv = 0;
  for (let i = done.length - 50; i < done.length; i++) { if (i < 1) continue; (done[i].c >= done[i - 1].c ? upv += done[i].v : dnv += done[i].v); }
  const upDown = dnv ? upv / dnv : null;   // null when there was no down-volume at all
  const adr = (() => { const w = done.slice(-20); return w.length ? mean(w.map((b) => b.h / b.l)) * 100 - 100 : null; })();
  const atr14 = atr(done);

  const win = (n) => bars.slice(-n);
  const y = bars.slice(-252);
  const high52 = y.length ? Math.max(...y.map((b) => b.h)) : null;
  const low52 = y.length ? Math.min(...y.map((b) => b.l)) : null;

  // support/resistance from recent swing extremes
  const lo10 = Math.min(...win(10).map((b) => b.l)), lo30 = Math.min(...win(30).map((b) => b.l));
  const hi10 = Math.max(...win(10).map((b) => b.h)), hi30 = Math.max(...win(30).map((b) => b.h));
  const pcBar = done[done.length - 1] || last;

  return {
    price: r2(price), prevClose: r2(prevClose), open: r2(last.o), dayHigh: r2(last.h), dayLow: r2(last.l),
    sma5: r2(sma5v), ema9: r2(ema9), ema13: r2(ema13), ema20: r2(ema20), ema50: r2(ema50), sma200: r2(sma200v),
    bullish: ema20 != null && ema50 != null && price > ema20 && price > ema50,
    alignment: [ema9, ema13, ema20, ema50].every((x) => x != null) && ema9 > ema13 && ema13 > ema20 && ema20 > ema50,
    rsi14: r1(rsi(closesAll)), macd: macd(closesAll), stoch: stochastic(bars),
    roc20Pct: closesAll.length > 20 ? r2((price / closesAll[closesAll.length - 21] - 1) * 100) : null,
    atr14: r2(atr14), adrPct20: r1(adr), dailyMoveAtr: atr14 ? r2((last.h - last.l) / atr14) : null,
    volumeSession, avgVol20: avgVol20 ? Math.round(avgVol20) : null, rvol20: r2(rvol20),
    upDownVolRatio: r2(upDown), accumulation: upDown != null ? upDown > 1 : upv > 0,
    high52: r2(high52), low52: r2(low52), distFromHighPct: high52 ? r1(((price - high52) / high52) * 100) : null,
    rangePosPct: { week: posPct(price, win(5)), month: posPct(price, win(21)), quarter: posPct(price, win(63)), year: posPct(price, y) },
    support: { near: r2(Math.min(lo10, price)), major: r2(lo30) },
    resistance: { r1: r2(Math.max(hi10, price)), r2: r2(hi30) },
    pivot: r2((pcBar.h + pcBar.l + pcBar.c) / 3),
  };
}
