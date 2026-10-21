// Trade-Disk — TradeLab candlestick chart, drawn on a canvas (no chart library, so
// the overlays and trade markers are exactly the engine's own values). A price pane
// with candles + indicator lines + entry/exit markers, a volume pane below, and a
// crosshair with an OHLC read-out on hover.
import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { OVERLAY_COLORS, fmt, fmtInt, shortDate, dateOf } from './lib.js';

const PAD = { l: 8, r: 58, t: 10, b: 20 };
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';

export default function CandleChart({ bars = [], overlays = {}, trades = [], height = 420 }) {
  const wrap = useRef(null), cv = useRef(null);
  const [w, setW] = useState(900);
  const [hover, setHover] = useState(null);

  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { draw(); }, [bars, overlays, trades, w, height, hover]);

  function geom() {
    const volH = Math.round(height * 0.2);
    const priceTop = PAD.t, priceBot = height - PAD.b - volH - 6;
    const volTop = height - PAD.b - volH, volBot = height - PAD.b;
    const n = bars.length;
    const plotW = w - PAD.l - PAD.r;
    const bw = n ? plotW / n : 0;
    const x = (i) => PAD.l + i * bw + bw / 2;
    let lo = Infinity, hi = -Infinity;
    for (const b of bars) { if (b.l < lo) lo = b.l; if (b.h > hi) hi = b.h; }
    for (const s of Object.values(overlays)) for (const v of s || []) if (v != null && Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
    const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
    const y = (p) => priceBot - ((p - lo) / (hi - lo)) * (priceBot - priceTop);
    let vmax = 0; for (const b of bars) if (b.v > vmax) vmax = b.v;
    const vy = (v) => volBot - (v / (vmax || 1)) * (volBot - volTop);
    return { n, bw, x, y, vy, lo, hi, priceTop, priceBot, volTop, volBot, plotW };
  }

  function draw() {
    const c = cv.current; if (!c || !bars.length) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = height * dpr; c.style.width = w + 'px'; c.style.height = height + 'px';
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, height);
    const G = geom(); const { n, bw, x, y, vy } = G;
    const line = css('--line'), muted = css('--muted'), green = css('--green'), red = css('--red'), text = css('--text');

    // grid + price axis
    g.strokeStyle = line; g.fillStyle = muted; g.font = '10px Inter, sans-serif'; g.textBaseline = 'middle';
    for (let k = 0; k <= 4; k++) {
      const p = G.lo + (G.hi - G.lo) * (k / 4), yy = y(p);
      g.globalAlpha = 0.35; g.beginPath(); g.moveTo(PAD.l, yy); g.lineTo(w - PAD.r, yy); g.stroke(); g.globalAlpha = 1;
      g.fillText(fmt(p, p > 500 ? 0 : 2), w - PAD.r + 4, yy);
    }
    // x date labels
    g.textBaseline = 'alphabetic'; g.textAlign = 'center';
    const step = Math.max(1, Math.floor(n / 7));
    for (let i = 0; i < n; i += step) g.fillText(shortDate(bars[i].t), x(i), height - 6);
    g.textAlign = 'left';

    // volume
    for (let i = 0; i < n; i++) {
      const b = bars[i], up = b.c >= b.o;
      g.fillStyle = up ? green : red; g.globalAlpha = 0.28;
      const vh = G.volBot - vy(b.v); g.fillRect(x(i) - bw * 0.3, vy(b.v), bw * 0.6, Math.max(0.5, vh));
    }
    g.globalAlpha = 1;

    // candles
    const cwb = Math.max(1, bw * 0.62);
    for (let i = 0; i < n; i++) {
      const b = bars[i], up = b.c >= b.o, col = up ? green : red;
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x(i), y(b.h)); g.lineTo(x(i), y(b.l)); g.stroke();
      const yo = y(b.o), yc = y(b.c), top = Math.min(yo, yc), h = Math.max(1, Math.abs(yc - yo));
      g.fillRect(x(i) - cwb / 2, top, cwb, h);
    }

    // overlays
    let ci = 0;
    for (const [key, s] of Object.entries(overlays)) {
      g.strokeStyle = OVERLAY_COLORS[ci % OVERLAY_COLORS.length]; g.lineWidth = 1.5; g.beginPath();
      let started = false;
      for (let i = 0; i < n; i++) { const v = s?.[i]; if (v == null || !Number.isFinite(v)) { started = false; continue; } const px = x(i), py = y(v); if (!started) { g.moveTo(px, py); started = true; } else g.lineTo(px, py); }
      g.stroke(); ci++;
    }

    // trade markers (map ts → index)
    const idx = new Map(bars.map((b, i) => [b.t, i]));
    for (const t of trades) {
      const ei = idx.get(t.entry_ts), xi = idx.get(t.exit_ts);
      if (ei == null) continue;
      const win = t.ret > 0, mc = win ? green : red;
      if (xi != null) { g.strokeStyle = mc; g.globalAlpha = 0.5; g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x(ei), y(t.entry)); g.lineTo(x(xi), y(t.exit)); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
      tri(g, x(ei), y(bars[ei].l) + 10, 5, true, css('--blue'));           // entry ▲
      if (xi != null) tri(g, x(xi), y(bars[xi].h) - 10, 5, false, mc);     // exit ▼
    }

    // crosshair + tooltip
    if (hover != null && hover >= 0 && hover < n) {
      const hx = x(hover);
      g.strokeStyle = muted; g.globalAlpha = 0.5; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(hx, PAD.t); g.lineTo(hx, G.volBot); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
  }

  function tri(g, cx, cy, r, up, color) {
    g.fillStyle = color; g.beginPath();
    if (up) { g.moveTo(cx, cy); g.lineTo(cx - r, cy + r * 1.4); g.lineTo(cx + r, cy + r * 1.4); }
    else { g.moveTo(cx, cy); g.lineTo(cx - r, cy - r * 1.4); g.lineTo(cx + r, cy - r * 1.4); }
    g.closePath(); g.fill();
  }

  function onMove(e) {
    const rect = cv.current.getBoundingClientRect();
    const G = geom(); const i = Math.round((e.clientX - rect.left - PAD.l) / (G.bw || 1) - 0.5);
    setHover(i >= 0 && i < bars.length ? i : null);
  }

  const hb = hover != null ? bars[hover] : null;
  return (
    <div className="lab-chart" ref={wrap} style={{ height }}>
      <canvas ref={cv} onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      {hb && (
        <div className="lab-chart-tip">
          <b>{dateOf(hb.t)}</b>
          <span>O {fmt(hb.o)}</span><span>H {fmt(hb.h)}</span><span>L {fmt(hb.l)}</span><span>C {fmt(hb.c)}</span>
          <span className="muted">Vol {fmtInt(hb.v)}</span>
        </div>
      )}
    </div>
  );
}
