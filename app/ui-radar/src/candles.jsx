// Trade-Disk — Radar's candlestick chart for the Technical tab, drawn on a canvas
// from the live Yahoo daily bars the analysis API returns. Real daily candles with
// a volume pane and moving-average overlays (EMA 20, SMA 50, SMA 200) computed the
// same way the technicals table does, plus a crosshair read-out. Replaces the old
// close-only line: daily candles are honest from daily bars — only intraday candles
// (minute/VWAP) need an intraday feed, and those stay marked as such elsewhere.
import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';

const PAD = { l: 8, r: 56, t: 10, b: 20 };
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const fmt = (x, d = 2) => (isNum(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const fmtInt = (x) => (isNum(x) ? Math.round(x).toLocaleString('en-US') : '—');
const shortDate = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
const dateOf = (ts) => (ts ? new Date(ts * 1000).toISOString().slice(0, 10) : '—');

// EMA seeded on the first value (matches core/technicals.mjs emaSeries); SMA trailing.
function emaSeries(vals, p) {
  if (!vals.length) return [];
  const k = 2 / (p + 1), out = [vals[0]];
  for (let i = 1; i < vals.length; i++) out.push(vals[i] * k + out[i - 1] * (1 - k));
  return out;
}
function smaSeries(vals, n) {
  const out = new Array(vals.length).fill(null);
  let sum = 0;
  for (let i = 0; i < vals.length; i++) { sum += vals[i]; if (i >= n) sum -= vals[i - n]; if (i >= n - 1) out[i] = sum / n; }
  return out;
}
const TF_BARS = { '1M': 21, '3M': 63, '6M': 126, '1Y': 10000 };
function startIndex(bars, tf) {
  if (tf === 'YTD') { const y = new Date().getUTCFullYear(); const i = bars.findIndex((b) => new Date(b.t * 1000).getUTCFullYear() === y); return i < 0 ? 0 : i; }
  return Math.max(0, bars.length - (TF_BARS[tf] || 10000));
}

const MAS = [['EMA 20', 'ema', 20, '--cyan'], ['SMA 50', 'sma', 50, '--yellow'], ['SMA 200', 'sma', 200, '--purple']];

export default function Candles({ bars = [], tf = '1Y', height = 300 }) {
  const wrap = useRef(null), cv = useRef(null);
  const [w, setW] = useState(900);
  const [hover, setHover] = useState(null);

  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // overlays computed on the FULL series, then sliced with the bars to the timeframe
  const closes = bars.map((b) => b.c);
  const overlays = MAS.map(([, kind, n, color]) => ({ color, series: kind === 'ema' ? emaSeries(closes, n) : smaSeries(closes, n) }));
  const s0 = startIndex(bars, tf);
  const view = bars.slice(s0);
  const ov = overlays.map((o) => ({ color: o.color, series: o.series.slice(s0) }));

  useEffect(() => { draw(); }, [bars, tf, w, height, hover]);

  function geom() {
    const volH = Math.round(height * 0.2);
    const priceTop = PAD.t, priceBot = height - PAD.b - volH - 6, volTop = height - PAD.b - volH, volBot = height - PAD.b;
    const n = view.length, plotW = w - PAD.l - PAD.r, bw = n ? plotW / n : 0;
    const x = (i) => PAD.l + i * bw + bw / 2;
    let lo = Infinity, hi = -Infinity;
    for (const b of view) { if (b.l < lo) lo = b.l; if (b.h > hi) hi = b.h; }
    for (const o of ov) for (const v of o.series) if (isNum(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
    const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
    const y = (p) => priceBot - ((p - lo) / (hi - lo)) * (priceBot - priceTop);
    let vmax = 0; for (const b of view) if (b.v > vmax) vmax = b.v;
    const vy = (v) => volBot - (v / (vmax || 1)) * (volBot - volTop);
    return { n, bw, x, y, vy, lo, hi, priceBot, volBot };
  }

  function draw() {
    const c = cv.current; if (!c || !view.length) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = height * dpr; c.style.width = w + 'px'; c.style.height = height + 'px';
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, height);
    const G = geom(); const { n, bw, x, y, vy } = G;
    const line = css('--line'), muted = css('--muted'), green = css('--green'), red = css('--red');

    g.strokeStyle = line; g.fillStyle = muted; g.font = '10px Inter, sans-serif'; g.textBaseline = 'middle';
    for (let k = 0; k <= 4; k++) {
      const p = G.lo + (G.hi - G.lo) * (k / 4), yy = y(p);
      g.globalAlpha = 0.3; g.beginPath(); g.moveTo(PAD.l, yy); g.lineTo(w - PAD.r, yy); g.stroke(); g.globalAlpha = 1;
      g.fillText(fmt(p, p > 500 ? 0 : 2), w - PAD.r + 4, yy);
    }
    g.textBaseline = 'alphabetic'; g.textAlign = 'center';
    const step = Math.max(1, Math.floor(n / 7));
    for (let i = 0; i < n; i += step) g.fillText(shortDate(view[i].t), x(i), height - 6);
    g.textAlign = 'left';

    for (let i = 0; i < n; i++) { const b = view[i]; g.fillStyle = b.c >= b.o ? green : red; g.globalAlpha = 0.26; g.fillRect(x(i) - bw * 0.3, vy(b.v), bw * 0.6, Math.max(0.5, G.volBot - vy(b.v))); }
    g.globalAlpha = 1;

    const cwb = Math.max(1, bw * 0.62);
    for (let i = 0; i < n; i++) {
      const b = view[i], col = b.c >= b.o ? green : red; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x(i), y(b.h)); g.lineTo(x(i), y(b.l)); g.stroke();
      const yo = y(b.o), yc = y(b.c); g.fillRect(x(i) - cwb / 2, Math.min(yo, yc), cwb, Math.max(1, Math.abs(yc - yo)));
    }

    for (const o of ov) {
      g.strokeStyle = css(o.color); g.lineWidth = 1.5; g.beginPath(); let started = false;
      for (let i = 0; i < n; i++) { const v = o.series[i]; if (!isNum(v)) { started = false; continue; } const px = x(i), py = y(v); started ? g.lineTo(px, py) : g.moveTo(px, py); started = true; }
      g.stroke();
    }

    if (hover != null && hover >= 0 && hover < n) {
      g.strokeStyle = muted; g.globalAlpha = 0.5; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(x(hover), PAD.t); g.lineTo(x(hover), G.volBot); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
  }

  function onMove(e) {
    const rect = cv.current.getBoundingClientRect(); const G = geom();
    const i = Math.round((e.clientX - rect.left - PAD.l) / (G.bw || 1) - 0.5);
    setHover(i >= 0 && i < view.length ? i : null);
  }

  const hb = hover != null ? view[hover] : null;
  return (
    <div className="rchart" ref={wrap} style={{ height }}>
      <canvas ref={cv} onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      {hb && (
        <div className="rchart-tip">
          <b>{dateOf(hb.t)}</b><span>O {fmt(hb.o)}</span><span>H {fmt(hb.h)}</span><span>L {fmt(hb.l)}</span><span>C {fmt(hb.c)}</span><span className="muted">Vol {fmtInt(hb.v)}</span>
        </div>
      )}
      <div className="rchart-legend">
        {MAS.map(([label, , , color]) => <span key={label}><i style={{ background: `var(${color})` }} /> {label}</span>)}
        <span className="muted">Daily candles + volume · live from Yahoo</span>
      </div>
    </div>
  );
}
