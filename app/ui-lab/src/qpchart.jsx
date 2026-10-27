// Trade-Disk — the qp chart. Our own canvas chart (no third-party library), made a
// real chart: drag to pan, scroll to zoom, the price axis auto-fits the visible bars,
// a crosshair with an OHLC read-out. It draws candles + a volume pane + price overlays
// (EMA/SMA/VWAP/Bollinger) + an oscillator pane (RSI) + entry/exit markers — the parent
// computes the series (from the qp library math) and hands them in.
import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';

const PAD = { l: 8, r: 56, t: 10, b: 20 };
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
const col = (c) => (c && c.startsWith('--') ? css(c) : (c || '#888'));
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const fmt = (x, d = 2) => (isNum(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const fmtInt = (x) => (isNum(x) ? Math.round(x).toLocaleString('en-US') : '—');
const etTime = (t) => new Date(t * 1000).toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
const etDate = (t) => new Date(t * 1000).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const MIN_BARS = 15;

// priceOverlays/oscOverlays: [{ color, series (aligned to bars), dashed? }]
// markers: [{ t, dir:'up'|'down', color }]
export default function QpChart({ bars = [], priceOverlays = [], oscOverlays = [], markers = [], height = 420, intraday = false }) {
  const wrap = useRef(null), cv = useRef(null);
  const [w, setW] = useState(900);
  const [hover, setHover] = useState(null);
  const [view, setView] = useState({ start: 0, count: 0 });   // visible window into bars
  const drag = useRef(null);
  const hasOsc = oscOverlays.length > 0;

  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // reset the window to fit when the bar set changes (new symbol / day / timeframe)
  const key = `${bars[0]?.t || 0}:${bars[bars.length - 1]?.t || 0}:${bars.length}`;
  const keyRef = useRef('');
  useEffect(() => { if (key !== keyRef.current) { keyRef.current = key; setView({ start: 0, count: bars.length }); setHover(null); } }, [key, bars.length]);

  const vStart = Math.max(0, Math.min(view.start, Math.max(0, bars.length - MIN_BARS)));
  const vCount = view.count > 0 ? Math.min(view.count, bars.length - vStart) : bars.length;
  const s0 = vStart, s1 = Math.min(bars.length, vStart + vCount);
  const viewBars = bars.slice(s0, s1);

  // native wheel listener (so we can preventDefault page scroll while zooming)
  useEffect(() => {
    const el = cv.current; if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      if (!bars.length) return;
      const rect = el.getBoundingClientRect();
      const plotW = w - PAD.l - PAD.r, bw = plotW / Math.max(1, vCount);
      const cursorBar = clamp(Math.round((e.clientX - rect.left - PAD.l) / (bw || 1)), 0, vCount - 1);
      const anchorIdx = s0 + cursorBar;
      const factor = e.deltaY < 0 ? 0.82 : 1.22;                 // in / out
      const newCount = clamp(Math.round(vCount * factor), MIN_BARS, bars.length);
      const frac = vCount > 1 ? cursorBar / (vCount - 1) : 0.5;
      let newStart = Math.round(anchorIdx - frac * (newCount - 1));
      newStart = clamp(newStart, 0, Math.max(0, bars.length - newCount));
      setView({ start: newStart, count: newCount });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [w, vCount, s0, bars.length]);

  useEffect(() => { draw(); }); // redraw on any relevant change

  function geom() {
    const gap = 6, volH = Math.round(height * 0.14), oscH = hasOsc ? Math.round(height * 0.24) : 0;
    const oscBot = height - PAD.b, oscTop = oscBot - oscH;
    const volBot = hasOsc ? oscTop - gap : height - PAD.b, volTop = volBot - volH;
    const priceTop = PAD.t, priceBot = volTop - gap;
    const n = viewBars.length, plotW = w - PAD.l - PAD.r, bw = n ? plotW / n : 0;
    const x = (i) => PAD.l + i * bw + bw / 2;
    let lo = Infinity, hi = -Infinity;
    for (const b of viewBars) { if (b.l < lo) lo = b.l; if (b.h > hi) hi = b.h; }
    for (const o of priceOverlays) for (let i = s0; i < s1; i++) { const v = o.series[i]; if (isNum(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }
    if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
    const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
    const y = (p) => priceBot - ((p - lo) / (hi - lo)) * (priceBot - priceTop);
    let vmax = 0; for (const b of viewBars) if (b.v > vmax) vmax = b.v;
    const vy = (v) => volBot - (v / (vmax || 1)) * (volBot - volTop);
    const oy = (v) => oscBot - (v / 100) * (oscBot - oscTop);
    return { n, bw, x, y, vy, oy, lo, hi, priceBot, volBot, oscTop, oscBot };
  }

  function draw() {
    const c = cv.current; if (!c) return; const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = height * dpr; c.style.width = w + 'px'; c.style.height = height + 'px';
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, height);
    if (!viewBars.length) return;
    const G = geom(); const { n, bw, x, y, vy, oy } = G;
    const line = css('--line'), muted = css('--muted'), green = css('--green'), red = css('--red');
    g.strokeStyle = line; g.fillStyle = muted; g.font = '10px Inter, sans-serif'; g.textBaseline = 'middle';
    for (let k = 0; k <= 4; k++) { const p = G.lo + (G.hi - G.lo) * (k / 4), yy = y(p); g.globalAlpha = 0.3; g.beginPath(); g.moveTo(PAD.l, yy); g.lineTo(w - PAD.r, yy); g.stroke(); g.globalAlpha = 1; g.fillText(fmt(p, p > 500 ? 0 : 2), w - PAD.r + 4, yy); }
    g.textBaseline = 'alphabetic'; g.textAlign = 'center';
    const step = Math.max(1, Math.floor(n / 7));
    for (let i = 0; i < n; i += step) g.fillText(intraday ? etTime(viewBars[i].t) : etDate(viewBars[i].t), x(i), height - 6);
    g.textAlign = 'left';
    // volume
    for (let i = 0; i < n; i++) { const b = viewBars[i]; g.fillStyle = b.c >= b.o ? green : red; g.globalAlpha = 0.24; g.fillRect(x(i) - bw * 0.3, vy(b.v), bw * 0.6, Math.max(0.5, G.volBot - vy(b.v))); }
    g.globalAlpha = 1;
    // candles
    const cwb = Math.max(1, bw * 0.62);
    for (let i = 0; i < n; i++) { const b = viewBars[i], cc = b.c >= b.o ? green : red; g.strokeStyle = cc; g.fillStyle = cc; g.lineWidth = 1; g.beginPath(); g.moveTo(x(i), y(b.h)); g.lineTo(x(i), y(b.l)); g.stroke(); const yo = y(b.o), yc = y(b.c); g.fillRect(x(i) - cwb / 2, Math.min(yo, yc), cwb, Math.max(1, Math.abs(yc - yo))); }
    // price overlays
    for (const o of priceOverlays) {
      g.strokeStyle = col(o.color); g.lineWidth = 1.4; if (o.dashed) g.setLineDash([3, 3]); g.beginPath(); let started = false;
      for (let i = 0; i < n; i++) { const v = o.series[s0 + i]; if (!isNum(v)) { started = false; continue; } const px = x(i), py = y(v); started ? g.lineTo(px, py) : g.moveTo(px, py); started = true; }
      g.stroke(); g.setLineDash([]);
    }
    // oscillator pane (RSI)
    if (hasOsc) {
      for (const lv of [30, 50, 70]) { const yy = oy(lv); g.strokeStyle = line; g.globalAlpha = lv === 50 ? 0.2 : 0.4; g.setLineDash(lv === 50 ? [] : [2, 3]); g.beginPath(); g.moveTo(PAD.l, yy); g.lineTo(w - PAD.r, yy); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; if (lv !== 50) { g.fillStyle = muted; g.textBaseline = 'middle'; g.fillText(String(lv), w - PAD.r + 4, yy); } }
      for (const o of oscOverlays) { g.strokeStyle = col(o.color); g.lineWidth = 1.3; g.beginPath(); let started = false; for (let i = 0; i < n; i++) { const v = o.series[s0 + i]; if (!isNum(v)) { started = false; continue; } const px = x(i), py = oy(v); started ? g.lineTo(px, py) : g.moveTo(px, py); started = true; } g.stroke(); }
      g.fillStyle = muted; g.textBaseline = 'alphabetic'; g.fillText('RSI', PAD.l + 2, G.oscTop + 11);
    }
    // entry/exit markers
    const idx = new Map(viewBars.map((b, i) => [b.t, i]));
    for (const m of markers) { const i = idx.get(m.t); if (i == null) continue; const b = viewBars[i]; tri(g, x(i), m.dir === 'up' ? y(b.l) + 11 : y(b.h) - 11, 5, m.dir === 'up', col(m.color)); }
    // crosshair
    if (hover != null && hover >= 0 && hover < n) { g.strokeStyle = muted; g.globalAlpha = 0.5; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(x(hover), PAD.t); g.lineTo(x(hover), G.oscBot); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
  }
  function tri(g, cx, cy, r, up, color) { g.fillStyle = color; g.beginPath(); if (up) { g.moveTo(cx, cy); g.lineTo(cx - r, cy + r * 1.4); g.lineTo(cx + r, cy + r * 1.4); } else { g.moveTo(cx, cy); g.lineTo(cx - r, cy - r * 1.4); g.lineTo(cx + r, cy - r * 1.4); } g.closePath(); g.fill(); }

  function px2bar(e) { const rect = cv.current.getBoundingClientRect(); const plotW = w - PAD.l - PAD.r, bw = plotW / Math.max(1, viewBars.length); return Math.round((e.clientX - rect.left - PAD.l) / (bw || 1) - 0.5); }
  function onDown(e) { drag.current = { x: e.clientX, start: s0, count: vCount }; }
  function onMove(e) {
    if (drag.current) {
      const plotW = w - PAD.l - PAD.r, bw = plotW / Math.max(1, drag.current.count);
      const dBars = Math.round((e.clientX - drag.current.x) / (bw || 1));
      const ns = clamp(drag.current.start - dBars, 0, Math.max(0, bars.length - drag.current.count));
      setView({ start: ns, count: drag.current.count });
    } else { const i = px2bar(e); setHover(i >= 0 && i < viewBars.length ? i : null); }
  }
  function onUp() { drag.current = null; }
  const hb = hover != null ? viewBars[hover] : null;

  return (
    <div className="qpchart" ref={wrap} style={{ height }}>
      <canvas ref={cv} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => { drag.current = null; setHover(null); }} style={{ cursor: drag.current ? 'grabbing' : 'crosshair' }} />
      {hb && <div className="qpchart-tip"><b>{intraday ? etTime(hb.t) : etDate(hb.t)}</b><span>O {fmt(hb.o)}</span><span>H {fmt(hb.h)}</span><span>L {fmt(hb.l)}</span><span>C {fmt(hb.c)}</span><span className="muted">V {fmtInt(hb.v)}</span></div>}
    </div>
  );
}
