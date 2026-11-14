// Trade-Disk — the qp chart. Our own canvas chart (no third-party library): drag (or
// swipe) to pan, scroll (or pinch) to zoom, on-screen buttons for both, the price axis
// auto-fits the visible bars, a crosshair with an OHLC read-out (tap on a phone). It
// draws candles + a volume pane + price overlays + an oscillator pane + entry/exit
// markers, and can open centred on one bar it highlights (`focus`: the day a stock showed
// up on a register, or the minute it was first seen). The parent computes the series.
// This file is shared by Radar and Lab (ui-radar/src and ui-lab/src hold the same copy).
import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { initialView } from './chartview.js';

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
// focus: { index, label } — the bar to centre on and highlight; initialCount: bars shown at first
export default function QpChart({ bars = [], priceOverlays = [], oscOverlays = [], markers = [], height = 420, intraday = false, focus = null, initialCount = 0 }) {
  const wrap = useRef(null), cv = useRef(null);
  const [w, setW] = useState(900);
  const [hover, setHover] = useState(null);
  const [view, setView] = useState({ start: 0, count: 0 });   // visible window into bars
  const pointers = useRef(new Map());                          // active pointers (mouse / fingers)
  const gesture = useRef(null);                                // { kind:'pan'|'pinch', ... }
  const hasOsc = oscOverlays.length > 0;
  const focusIndex = focus && isNum(focus.index) && focus.index >= 0 && focus.index < bars.length ? focus.index : null;

  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // open on the focus (or fit) when the bar set or focus changes (new symbol / day / timeframe)
  const key = `${bars[0]?.t || 0}:${bars[bars.length - 1]?.t || 0}:${bars.length}:${focusIndex}:${initialCount}`;
  const keyRef = useRef('');
  const reset = () => { setView(initialView(bars.length, focusIndex, initialCount)); setHover(null); };
  useEffect(() => { if (key !== keyRef.current) { keyRef.current = key; reset(); } }); // eslint-disable-line

  const vStart = Math.max(0, Math.min(view.start, Math.max(0, bars.length - MIN_BARS)));
  const vCount = view.count > 0 ? Math.min(view.count, bars.length - vStart) : bars.length;
  const s0 = vStart, s1 = Math.min(bars.length, vStart + vCount);
  const viewBars = bars.slice(s0, s1);
  const plotW = () => w - PAD.l - PAD.r;

  // zoom by `factor` (<1 in, >1 out) keeping the bar under `frac` (0..1 across the plot) still
  function zoom(factor, frac = 0.5, from = { start: s0, count: vCount }) {
    if (!bars.length) return;
    const anchorIdx = from.start + frac * (from.count - 1);
    const count = clamp(Math.round(from.count * factor), Math.min(MIN_BARS, bars.length), bars.length);
    const start = clamp(Math.round(anchorIdx - frac * (count - 1)), 0, Math.max(0, bars.length - count));
    setView({ start, count });
  }
  function pan(dBars, from = { start: s0, count: vCount }) {
    setView({ start: clamp(from.start + dBars, 0, Math.max(0, bars.length - from.count)), count: from.count });
  }
  const fracAt = (clientX) => { const r = cv.current.getBoundingClientRect(); return clamp((clientX - r.left - PAD.l) / Math.max(1, plotW()), 0, 1); };

  // native wheel listener (so we can preventDefault page scroll while zooming)
  useEffect(() => {
    const el = cv.current; if (!el) return;
    const onWheel = (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 0.82 : 1.22, fracAt(e.clientX)); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  useEffect(() => { draw(); }); // redraw on any relevant change

  function geom() {
    const gap = 6, volH = Math.round(height * 0.14), oscH = hasOsc ? Math.round(height * 0.24) : 0;
    const oscBot = height - PAD.b, oscTop = oscBot - oscH;
    const volBot = hasOsc ? oscTop - gap : height - PAD.b, volTop = volBot - volH;
    const priceTop = PAD.t, priceBot = volTop - gap;
    const n = viewBars.length, bw = n ? plotW() / n : 0;
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
    const line = css('--line'), muted = css('--muted'), green = css('--green'), red = css('--red'), accent = css('--yellow') || '#f5c542';
    // focus: a band behind the bar the chart is about, with its label
    if (focusIndex != null && focusIndex >= s0 && focusIndex < s1) {
      const fx = x(focusIndex - s0);
      g.fillStyle = accent; g.globalAlpha = 0.14; g.fillRect(fx - Math.max(bw, 6) / 2, PAD.t, Math.max(bw, 6), G.oscBot - PAD.t); g.globalAlpha = 1;
      if (focus.label) {
        g.font = 'bold 11px Inter, sans-serif'; const tw = g.measureText(focus.label).width;
        const lx = clamp(fx - tw / 2, PAD.l + 2, w - PAD.r - tw - 2);
        g.fillStyle = accent; g.fillText(focus.label, lx, PAD.t + 12);
      }
    }
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

  function barAt(clientX) { const r = cv.current.getBoundingClientRect(); const bw = plotW() / Math.max(1, viewBars.length); const i = Math.round((clientX - r.left - PAD.l) / (bw || 1) - 0.5); return i >= 0 && i < viewBars.length ? i : null; }

  // ── pointer input: one pointer pans (mouse drag or finger swipe), two fingers pinch-zoom,
  //    a tap shows the read-out; the mouse also hovers ──
  function onPointerDown(e) {
    cv.current.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX });
    const ps = [...pointers.current.values()];
    if (ps.length === 1) gesture.current = { kind: 'pan', x: e.clientX, from: { start: s0, count: vCount }, moved: false };
    else if (ps.length === 2) gesture.current = { kind: 'pinch', dist: Math.abs(ps[0].x - ps[1].x) || 1, mid: (ps[0].x + ps[1].x) / 2, from: { start: s0, count: vCount } };
  }
  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) { if (e.pointerType === 'mouse') setHover(barAt(e.clientX)); return; }
    pointers.current.set(e.pointerId, { x: e.clientX });
    const gs = gesture.current; if (!gs) return;
    if (gs.kind === 'pan') {
      const bw = plotW() / Math.max(1, gs.from.count);
      const dx = e.clientX - gs.x;
      if (Math.abs(dx) > 4) gs.moved = true;
      pan(-Math.round(dx / (bw || 1)), gs.from);
      if (e.pointerType === 'mouse') setHover(barAt(e.clientX));
    } else if (gs.kind === 'pinch') {
      const ps = [...pointers.current.values()]; if (ps.length < 2) return;
      const dist = Math.abs(ps[0].x - ps[1].x) || 1;
      zoom(gs.dist / dist, fracAt(gs.mid), gs.from);              // fingers apart → zoom in
    }
  }
  function onPointerUp(e) {
    const gs = gesture.current;
    if (gs && gs.kind === 'pan' && !gs.moved && e.pointerType !== 'mouse') setHover(barAt(e.clientX));   // tap → read-out
    pointers.current.delete(e.pointerId);
    const left = [...pointers.current.values()];
    gesture.current = left.length === 1 ? { kind: 'pan', x: left[0].x, from: { start: s0, count: vCount }, moved: true } : null;
  }
  const hb = hover != null ? viewBars[hover] : null;
  const step = Math.max(1, Math.round(vCount / 4));
  // Buttons act on the finger lifting: a phone can drop the click that follows a swipe on
  // the chart, which left the buttons dead after panning. The click (mouse / keyboard) is
  // still handled, and a touch that already acted swallows its own click.
  const touched = useRef(0);
  const btn = (label, title, act, disabled = false) => (
    <button type="button" className="qpchart-btn" title={title} aria-label={title} disabled={disabled}
      onPointerUp={(e) => { if (e.pointerType !== 'mouse' && !disabled) { touched.current = Date.now(); act(); } }}
      onClick={() => { if (Date.now() - touched.current < 700) return; act(); }}>{label}</button>);

  return (
    <div className="qpchart" ref={wrap} style={{ height }}>
      <canvas ref={cv} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse' && !pointers.current.size) setHover(null); }}
        style={{ cursor: gesture.current ? 'grabbing' : 'crosshair', touchAction: 'none' }} />
      {hb && <div className="qpchart-tip"><b>{intraday ? `${etDate(hb.t)} ${etTime(hb.t)}` : etDate(hb.t)}</b><span>O {fmt(hb.o)}</span><span>H {fmt(hb.h)}</span><span>L {fmt(hb.l)}</span><span>C {fmt(hb.c)}</span><span className="muted">V {fmtInt(hb.v)}</span></div>}
      <div className="qpchart-nav">
        {btn('◀', 'Earlier', () => pan(-step), s0 === 0)}
        {btn('−', 'Zoom out', () => zoom(1.5), vCount >= bars.length)}
        {btn('+', 'Zoom in', () => zoom(0.66), vCount <= MIN_BARS)}
        {btn('▶', 'Later', () => pan(step), s1 >= bars.length)}
        {btn('⟲', focusIndex != null ? 'Back to the day it showed up' : 'Reset', reset)}
      </div>
    </div>
  );
}
