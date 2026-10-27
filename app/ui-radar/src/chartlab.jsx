// Trade-Disk — the interactive chart (register browser + anywhere a rich chart helps).
// A candlestick chart with a volume pane, add/remove indicators, and a timeframe
// switch (Daily, or 1/5/15-minute intraday for one exact day). Intraday bars come from
// Polygon via /api/radar/intraday-bars (cache-first); daily from Yahoo via /api/radar/bars.
// Indicators are computed here on the loaded bars: EMA, SMA, VWAP, Bollinger (on price),
// RSI (its own pane). It opens as a modal; ✕ / Esc / backdrop close it.
import React, { useRef, useEffect, useState, useLayoutEffect, useMemo } from 'react';
import { api } from './api.js';

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const fmt = (x, d = 2) => (isNum(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const fmtInt = (x) => (isNum(x) ? Math.round(x).toLocaleString('en-US') : '—');
const PAD = { l: 8, r: 56, t: 10, b: 20 };
const COLORS = ['--cyan', '--yellow', '--purple', '--orange', '--green', '--blue'];
const TFS = [['D', 'Daily'], ['1', '1m'], ['5', '5m'], ['15', '15m']];
const IND_TYPES = [['ema', 'EMA'], ['sma', 'SMA'], ['vwap', 'VWAP'], ['boll', 'Bollinger'], ['rsi', 'RSI (pane)']];
const etTime = (t) => new Date(t * 1000).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
const shortDate = (t) => new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// ── indicator math (on the loaded bars) ──
function emaSeries(vals, p) { if (!vals.length) return []; const k = 2 / (p + 1), out = [vals[0]]; for (let i = 1; i < vals.length; i++) out.push(vals[i] * k + out[i - 1] * (1 - k)); return out; }
function smaSeries(vals, n) { const out = new Array(vals.length).fill(null); let s = 0; for (let i = 0; i < vals.length; i++) { s += vals[i]; if (i >= n) s -= vals[i - n]; if (i >= n - 1) out[i] = s / n; } return out; }
function vwapSeries(bars) { const out = []; let pv = 0, vv = 0; for (const b of bars) { const tp = (b.h + b.l + b.c) / 3, v = b.v || 0; pv += tp * v; vv += v; out.push(vv ? pv / vv : b.c); } return out; }
function bollSeries(vals, n, k) { const mid = smaSeries(vals, n), up = new Array(vals.length).fill(null), lo = new Array(vals.length).fill(null); for (let i = n - 1; i < vals.length; i++) { let s = 0; for (let j = i - n + 1; j <= i; j++) s += (vals[j] - mid[i]) ** 2; const sd = Math.sqrt(s / n); up[i] = mid[i] + k * sd; lo[i] = mid[i] - k * sd; } return { mid, up, lo }; }
function rsiSeries(vals, n) { const out = new Array(vals.length).fill(null); if (vals.length <= n) return out; let ag = 0, al = 0; for (let i = 1; i <= n; i++) { const d = vals[i] - vals[i - 1]; if (d >= 0) ag += d; else al -= d; } ag /= n; al /= n; out[n] = 100 - 100 / (1 + (al === 0 ? 100 : ag / al)); for (let i = n + 1; i < vals.length; i++) { const d = vals[i] - vals[i - 1]; ag = (ag * (n - 1) + Math.max(d, 0)) / n; al = (al * (n - 1) + Math.max(-d, 0)) / n; out[i] = 100 - 100 / (1 + (al === 0 ? 100 : ag / al)); } return out; }

const indLabel = (i) => `${i.type.toUpperCase()}${i.period ? ' ' + i.period : ''}`;

function ChartCanvas({ bars, inds, tf }) {
  const wrap = useRef(null), cv = useRef(null); const [w, setW] = useState(900); const [hover, setHover] = useState(null);
  const height = 430;
  useLayoutEffect(() => { const el = wrap.current; if (!el) return; const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth); return () => ro.disconnect(); }, []);

  const { view, priceOv, oscOv } = useMemo(() => {
    const s0 = tf === 'D' ? Math.max(0, bars.length - 180) : 0;
    const closes = bars.map((b) => b.c);
    const price = [], osc = [];
    for (const ind of inds) {
      if (ind.type === 'ema') price.push({ color: ind.color, series: emaSeries(closes, ind.period || 20) });
      else if (ind.type === 'sma') price.push({ color: ind.color, series: smaSeries(closes, ind.period || 20) });
      else if (ind.type === 'vwap') price.push({ color: ind.color, series: vwapSeries(bars) });
      else if (ind.type === 'boll') { const b = bollSeries(closes, ind.period || 20, 2); price.push({ color: ind.color, series: b.mid }, { color: ind.color, series: b.up, dash: true }, { color: ind.color, series: b.lo, dash: true }); }
      else if (ind.type === 'rsi') osc.push({ color: ind.color, series: rsiSeries(closes, ind.period || 14) });
    }
    return { view: bars.slice(s0), priceOv: price.map((o) => ({ ...o, series: o.series.slice(s0) })), oscOv: osc.map((o) => ({ ...o, series: o.series.slice(s0) })) };
  }, [bars, inds, tf]);

  const hasOsc = oscOv.length > 0;
  useEffect(() => { draw(); }); // redraw on every relevant change

  function geom() {
    const gap = 6, volH = Math.round(height * 0.12), oscH = hasOsc ? Math.round(height * 0.26) : 0;
    const oscBot = height - PAD.b, oscTop = oscBot - oscH;
    const volBot = hasOsc ? oscTop - gap : height - PAD.b, volTop = volBot - volH;
    const priceTop = PAD.t, priceBot = volTop - gap;
    const n = view.length, plotW = w - PAD.l - PAD.r, bw = n ? plotW / n : 0;
    const x = (i) => PAD.l + i * bw + bw / 2;
    let lo = Infinity, hi = -Infinity;
    for (const b of view) { if (b.l < lo) lo = b.l; if (b.h > hi) hi = b.h; }
    for (const o of priceOv) for (const v of o.series) if (isNum(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
    const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
    const y = (p) => priceBot - ((p - lo) / (hi - lo)) * (priceBot - priceTop);
    let vmax = 0; for (const b of view) if (b.v > vmax) vmax = b.v;
    const vy = (v) => volBot - (v / (vmax || 1)) * (volBot - volTop);
    const oy = (v) => oscBot - (v / 100) * (oscBot - oscTop);
    return { n, bw, x, y, vy, oy, lo, hi, priceTop, priceBot, volBot, oscTop, oscBot };
  }

  function draw() {
    const c = cv.current; if (!c) return; const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = height * dpr; c.style.width = w + 'px'; c.style.height = height + 'px';
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, height);
    if (!view.length) return;
    const G = geom(); const { n, bw, x, y, vy, oy } = G;
    const line = css('--line'), muted = css('--muted'), green = css('--green'), red = css('--red');
    g.strokeStyle = line; g.fillStyle = muted; g.font = '10px Inter, sans-serif'; g.textBaseline = 'middle';
    for (let k = 0; k <= 4; k++) { const p = G.lo + (G.hi - G.lo) * (k / 4), yy = y(p); g.globalAlpha = 0.3; g.beginPath(); g.moveTo(PAD.l, yy); g.lineTo(w - PAD.r, yy); g.stroke(); g.globalAlpha = 1; g.fillText(fmt(p, p > 500 ? 0 : 2), w - PAD.r + 4, yy); }
    g.textBaseline = 'alphabetic'; g.textAlign = 'center';
    const step = Math.max(1, Math.floor(n / 7));
    for (let i = 0; i < n; i += step) g.fillText(tf === 'D' ? shortDate(view[i].t) : etTime(view[i].t), x(i), height - 6);
    g.textAlign = 'left';
    // volume
    for (let i = 0; i < n; i++) { const b = view[i]; g.fillStyle = b.c >= b.o ? green : red; g.globalAlpha = 0.24; g.fillRect(x(i) - bw * 0.3, vy(b.v), bw * 0.6, Math.max(0.5, G.volBot - vy(b.v))); }
    g.globalAlpha = 1;
    // candles
    const cwb = Math.max(1, bw * 0.62);
    for (let i = 0; i < n; i++) { const b = view[i], col = b.c >= b.o ? green : red; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(x(i), y(b.h)); g.lineTo(x(i), y(b.l)); g.stroke(); const yo = y(b.o), yc = y(b.c); g.fillRect(x(i) - cwb / 2, Math.min(yo, yc), cwb, Math.max(1, Math.abs(yc - yo))); }
    // price overlays
    for (const o of priceOv) {
      g.strokeStyle = css(o.color); g.lineWidth = 1.4; if (o.dash) g.setLineDash([3, 3]); g.beginPath(); let started = false;
      for (let i = 0; i < n; i++) { const v = o.series[i]; if (!isNum(v)) { started = false; continue; } const px = x(i), py = y(v); started ? g.lineTo(px, py) : g.moveTo(px, py); started = true; }
      g.stroke(); g.setLineDash([]);
    }
    // oscillator pane (RSI)
    if (hasOsc) {
      g.strokeStyle = line; g.fillStyle = muted; g.textBaseline = 'middle';
      for (const lv of [30, 50, 70]) { const yy = oy(lv); g.globalAlpha = lv === 50 ? 0.2 : 0.4; g.setLineDash(lv === 50 ? [] : [2, 3]); g.beginPath(); g.moveTo(PAD.l, yy); g.lineTo(w - PAD.r, yy); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; if (lv !== 50) g.fillText(String(lv), w - PAD.r + 4, yy); }
      for (const o of oscOv) { g.strokeStyle = css(o.color); g.lineWidth = 1.4; g.beginPath(); let started = false; for (let i = 0; i < n; i++) { const v = o.series[i]; if (!isNum(v)) { started = false; continue; } const px = x(i), py = oy(v); started ? g.lineTo(px, py) : g.moveTo(px, py); started = true; } g.stroke(); }
      g.fillStyle = muted; g.textBaseline = 'alphabetic'; g.fillText('RSI', PAD.l + 2, G.oscTop + 11);
    }
    // crosshair
    if (hover != null && hover >= 0 && hover < n) { g.strokeStyle = muted; g.globalAlpha = 0.5; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(x(hover), PAD.t); g.lineTo(x(hover), G.oscBot); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
  }

  function onMove(e) { const rect = cv.current.getBoundingClientRect(); const G = geom(); const i = Math.round((e.clientX - rect.left - PAD.l) / (G.bw || 1) - 0.5); setHover(i >= 0 && i < view.length ? i : null); }
  const hb = hover != null ? view[hover] : null;
  return (
    <div className="cl-chart" ref={wrap} style={{ height }}>
      <canvas ref={cv} onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      {hb && <div className="cl-tip"><b>{tf === 'D' ? shortDate(hb.t) : etTime(hb.t)}</b><span>O {fmt(hb.o)}</span><span>H {fmt(hb.h)}</span><span>L {fmt(hb.l)}</span><span>C {fmt(hb.c)}</span><span className="muted">V {fmtInt(hb.v)}</span></div>}
    </div>
  );
}

export default function ChartLab({ ticker, day, name, onClose }) {
  const [tf, setTf] = useState('1');
  const [bars, setBars] = useState([]); const [loading, setLoading] = useState(true); const [msg, setMsg] = useState(null);
  const [inds, setInds] = useState([{ id: 1, type: 'vwap', color: '--cyan' }, { id: 2, type: 'ema', period: 9, color: '--yellow' }, { id: 3, type: 'ema', period: 20, color: '--purple' }]);
  const [addType, setAddType] = useState('ema'); const [addPer, setAddPer] = useState(20);
  const nextId = useRef(4);

  useEffect(() => { let on = true; (async () => {
    setLoading(true); setMsg(null);
    try {
      if (tf === 'D') { const r = await api.bars(ticker); if (on) setBars(r.bars || []); }
      else { const r = await api.intradayBars(ticker, day, tf); if (!on) return; setBars(r.bars || []); if (r.error) setMsg(r.error); else if (r.rateLimited) setMsg('Polygon free limit (≈5/min) hit — wait a moment, then pick the timeframe again.'); else if (!(r.bars || []).length) setMsg('No minute bars for this day.'); }
    } catch (e) { if (on) { setBars([]); setMsg(String(e.message || e)); } } finally { if (on) setLoading(false); }
  })(); return () => { on = false; }; }, [tf, ticker, day]);

  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);

  const addInd = () => { const needsPer = addType !== 'vwap'; setInds((x) => [...x, { id: nextId.current++, type: addType, ...(needsPer ? { period: Math.max(1, +addPer || 14) } : {}), color: COLORS[x.length % COLORS.length] }]); };
  const delInd = (id) => setInds((x) => x.filter((i) => i.id !== id));

  return (
    <div className="cl-backdrop" onClick={onClose}>
      <div className="cl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-head">
          <div className="cl-title"><b>{ticker}</b> {name ? <span className="muted">{name}</span> : null} <span className="muted">· {day}</span></div>
          <div className="cl-tfs">{TFS.map(([id, l]) => <button key={id} className={'cl-tf' + (tf === id ? ' on' : '')} onClick={() => setTf(id)}>{l}</button>)}</div>
          <button className="cl-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="cl-indbar">
          {inds.map((i) => <span key={i.id} className="cl-chip" style={{ borderColor: `var(${i.color})` }}><i style={{ background: `var(${i.color})` }} />{indLabel(i)}<button onClick={() => delInd(i.id)} aria-label={`Remove ${indLabel(i)}`}>✕</button></span>)}
          <span className="cl-add">
            <select value={addType} onChange={(e) => setAddType(e.target.value)}>{IND_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            {addType !== 'vwap' && <input type="number" min="1" value={addPer} onChange={(e) => setAddPer(e.target.value)} aria-label="Indicator period" />}
            <button onClick={addInd}>+ Add</button>
          </span>
        </div>
        <ChartCanvas bars={bars} inds={inds} tf={tf} />
        <div className="cl-foot">
          {loading ? <span className="muted">Loading {tf === 'D' ? 'daily' : tf + 'm'} bars…</span>
            : msg ? <span className="muted">{msg}</span>
              : <span className="muted">{tf === 'D' ? 'Daily candles · Yahoo' : `${tf}-minute candles for ${day} · Polygon`} · {bars.length} bars</span>}
        </div>
      </div>
    </div>
  );
}
