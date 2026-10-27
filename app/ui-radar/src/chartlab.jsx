// Trade-Disk — the interactive chart modal for the Register browser. A real chart
// (TradingView's lightweight-charts via TVChart): drag to pan, wheel to zoom, native
// crosshair. Switch timeframe (Daily / 1m / 5m / 15m — intraday for one exact day from
// Polygon, daily from Yahoo) and add/remove indicators (EMA, SMA, VWAP, Bollinger),
// computed here on the loaded bars. ✕ / Esc / backdrop close it.
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { api } from './api.js';
import TVChart from './tvchart.jsx';

const COLORS = ['--cyan', '--yellow', '--purple', '--orange', '--green', '--blue'];
const TFS = [['D', 'Daily'], ['1', '1m'], ['5', '5m'], ['15', '15m']];
const IND_TYPES = [['ema', 'EMA'], ['sma', 'SMA'], ['vwap', 'VWAP'], ['boll', 'Bollinger']];
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

// indicator math (on the loaded bars)
function emaSeries(v, p) { if (!v.length) return []; const k = 2 / (p + 1), o = [v[0]]; for (let i = 1; i < v.length; i++) o.push(v[i] * k + o[i - 1] * (1 - k)); return o; }
function smaSeries(v, n) { const o = new Array(v.length).fill(null); let s = 0; for (let i = 0; i < v.length; i++) { s += v[i]; if (i >= n) s -= v[i - n]; if (i >= n - 1) o[i] = s / n; } return o; }
function vwapSeries(bars) { const o = []; let pv = 0, vv = 0; for (const b of bars) { const tp = (b.h + b.l + b.c) / 3, v = b.v || 0; pv += tp * v; vv += v; o.push(vv ? pv / vv : b.c); } return o; }
function bollSeries(v, n, k) { const mid = smaSeries(v, n), up = new Array(v.length).fill(null), lo = new Array(v.length).fill(null); for (let i = n - 1; i < v.length; i++) { let s = 0; for (let j = i - n + 1; j <= i; j++) s += (v[j] - mid[i]) ** 2; const sd = Math.sqrt(s / n); up[i] = mid[i] + k * sd; lo[i] = mid[i] - k * sd; } return { mid, up, lo }; }

const indLabel = (i) => `${i.type.toUpperCase()}${i.period ? ' ' + i.period : ''}`;

function buildLines(bars, inds) {
  const closes = bars.map((b) => b.c);
  const pts = (series) => series.map((x, i) => (isNum(x) && bars[i] ? { time: bars[i].t, value: +x } : null)).filter(Boolean);
  const out = [];
  for (const ind of inds) {
    if (ind.type === 'ema') out.push({ key: ind.id, color: ind.color, data: pts(emaSeries(closes, ind.period || 20)) });
    else if (ind.type === 'sma') out.push({ key: ind.id, color: ind.color, data: pts(smaSeries(closes, ind.period || 20)) });
    else if (ind.type === 'vwap') out.push({ key: ind.id, color: ind.color, data: pts(vwapSeries(bars)) });
    else if (ind.type === 'boll') { const b = bollSeries(closes, ind.period || 20, 2); out.push({ key: ind.id + 'm', color: ind.color, data: pts(b.mid) }, { key: ind.id + 'u', color: ind.color, dashed: true, data: pts(b.up) }, { key: ind.id + 'l', color: ind.color, dashed: true, data: pts(b.lo) }); }
  }
  return out;
}

export default function ChartLab({ ticker, day, name, onClose }) {
  const [tf, setTf] = useState('1');
  const [bars, setBars] = useState([]); const [loading, setLoading] = useState(true); const [msg, setMsg] = useState(null);
  const [inds, setInds] = useState([{ id: 1, type: 'vwap', color: '--cyan' }, { id: 2, type: 'ema', period: 9, color: '--yellow' }, { id: 3, type: 'ema', period: 20, color: '--purple' }]);
  const [addType, setAddType] = useState('ema'); const [addPer, setAddPer] = useState(20);
  const nextId = useRef(4);

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true); setMsg(null);
      try {
        if (tf === 'D') { const r = await api.bars(ticker); if (on) setBars(r.bars || []); }
        else { const r = await api.intradayBars(ticker, day, tf); if (!on) return; setBars(r.bars || []); if (r.error) setMsg(r.error); else if (r.rateLimited) setMsg('Polygon free limit (≈5/min) hit — wait a moment, then pick the timeframe again.'); else if (!(r.bars || []).length) setMsg('No minute bars for this day.'); }
      } catch (e) { if (on) { setBars([]); setMsg(String(e.message || e)); } } finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, [tf, ticker, day]);

  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);

  const addInd = () => { const needsPer = addType !== 'vwap'; setInds((x) => [...x, { id: nextId.current++, type: addType, ...(needsPer ? { period: Math.max(1, +addPer || 14) } : {}), color: COLORS[x.length % COLORS.length] }]); };
  const delInd = (id) => setInds((x) => x.filter((i) => i.id !== id));
  const lines = useMemo(() => buildLines(bars, inds), [bars, inds]);

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
        {bars.length ? <TVChart bars={bars} lines={lines} height={430} intraday={tf !== 'D'} /> : <div className="cl-chart-empty muted">{loading ? 'Loading…' : (msg || 'No data.')}</div>}
        <div className="cl-foot">
          {loading ? <span className="muted">Loading {tf === 'D' ? 'daily' : tf + 'm'} bars…</span>
            : msg ? <span className="muted">{msg}</span>
              : <span className="muted">{tf === 'D' ? 'Daily candles · Yahoo' : `${tf}-minute candles for ${day} · Polygon`} · {bars.length} bars · drag to pan, scroll to zoom</span>}
        </div>
      </div>
    </div>
  );
}
