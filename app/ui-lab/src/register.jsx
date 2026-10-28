// Trade-Disk — qp Register browser (design/05-qp/CHART.md §3.6). Open it, pick a
// screener, pick a day → the stocks that screener surfaced that day, as cards. Click a
// card and the qp chart loads that stock on that exact day (intraday from Polygon, or
// daily), with indicators you add/remove and a timeframe switch. The indicators are the
// REAL qp library (core/lab/library.mjs — the same verified primitives the backtest and
// strategy chart use), computed bar-for-bar — no ad-hoc math, no third-party library.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import QpChart from './qpchart.jsx';
import { compute } from '../../core/lab/library.mjs';

const COLORS = ['--cyan', '--yellow', '--purple', '--orange', '--green', '--blue'];
const TFS = [['D', 'Daily'], ['1', '1m'], ['5', '5m'], ['15', '15m']];
// the pickable indicators map to real qp-library primitives; `pane` = oscillator pane,
// `multi` = a 3-line primitive (Bollinger), `noPer` = no length param.
const IND_TYPES = [
  { name: 'vwap', label: 'VWAP (session)', noPer: true },
  { name: 'ema', label: 'EMA', per: 20 },
  { name: 'sma', label: 'SMA', per: 20 },
  { name: 'wma', label: 'WMA', per: 20 },
  { name: 'hma', label: 'HMA', per: 20 },
  { name: 'vwma', label: 'VWMA', per: 20 },
  { name: 'bb', label: 'Bollinger', per: 20, multi: true },
  { name: 'rsi', label: 'RSI', per: 14, pane: true },
  { name: 'atr', label: 'ATR', per: 14, pane: true },
  { name: 'rel_volume', label: 'RVOL', per: 20, pane: true },
  { name: 'slope', label: 'Slope', per: 20, pane: true },
];
const BY = Object.fromEntries(IND_TYPES.map((t) => [t.name, t]));
const indLabel = (i) => `${(BY[i.name]?.label || i.name).replace(' (session)', '')}${i.period ? ' ' + i.period : ''}`;

function buildOverlays(bars, inds) {
  const price = [], osc = [];
  for (const ind of inds) {
    const meta = BY[ind.name] || {};
    const params = ind.period ? { length: ind.period } : {};
    try {
      if (meta.multi) {
        const mid = compute(bars, { name: ind.name, sub: 'middle', params });
        const up = compute(bars, { name: ind.name, sub: 'upper', params });
        const lo = compute(bars, { name: ind.name, sub: 'lower', params });
        price.push({ color: ind.color, series: mid }, { color: ind.color, dashed: true, series: up }, { color: ind.color, dashed: true, series: lo });
      } else {
        const series = compute(bars, { name: ind.name, params });
        (meta.pane ? osc : price).push({ color: ind.color, series });
      }
    } catch { /* skip a primitive that can't compute on this bar set */ }
  }
  return { priceOverlays: price, oscOverlays: osc };
}

export default function Register() {
  const [screens, setScreens] = useState(null);
  const [screen, setScreen] = useState('');
  const [days, setDays] = useState([]); const [day, setDay] = useState('');
  const [rows, setRows] = useState(null);
  const [pick, setPick] = useState(null);                 // { ticker, name, day }
  const [tf, setTf] = useState('1');
  const [bars, setBars] = useState([]); const [loading, setLoading] = useState(false); const [msg, setMsg] = useState(null);
  const [inds, setInds] = useState([{ id: 1, name: 'vwap', color: '--cyan' }, { id: 2, name: 'ema', period: 9, color: '--yellow' }, { id: 3, name: 'ema', period: 20, color: '--purple' }]);
  const [addName, setAddName] = useState('ema'); const [addPer, setAddPer] = useState(20);
  const [err, setErr] = useState(null);
  const nextId = useRef(4);

  useEffect(() => { api.registerScreens().then((s) => { setScreens(s || []); if (s?.[0]) pickScreen(s[0].screen); }).catch((e) => setErr(String(e.message || e))); }, []); // eslint-disable-line

  async function pickScreen(scr) {
    setScreen(scr); setRows(null); setDay(''); setDays([]); setPick(null); setErr(null);
    try { const d = await api.registerDays(scr); setDays(d || []); if (d?.[0]) loadDay(scr, d[0].day); } catch (e) { setErr(String(e.message || e)); }
  }
  async function loadDay(scr, dy) {
    setDay(dy); setPick(null); setErr(null);
    try { const r = await api.registerDay(scr, dy); setRows(r || []); } catch (e) { setErr(String(e.message || e)); setRows([]); }
  }

  useEffect(() => {
    if (!pick) { setBars([]); return; }
    let on = true;
    (async () => {
      setLoading(true); setMsg(null);
      try {
        if (tf === 'D') { const r = await api.bars(pick.ticker); if (on) setBars(r.bars || []); }
        else { const r = await api.intradayBars(pick.ticker, pick.day, tf); if (!on) return; setBars(r.bars || []); if (r.error) setMsg(r.error); else if (r.rateLimited) setMsg('Polygon free limit (≈5/min) hit — wait a moment, then pick the timeframe again.'); else if (!(r.bars || []).length) setMsg('No minute bars for this day.'); }
      } catch (e) { if (on) { setBars([]); setMsg(String(e.message || e)); } } finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, [pick, tf]);

  const addInd = () => { const meta = BY[addName] || {}; setInds((x) => [...x, { id: nextId.current++, name: addName, ...(meta.noPer ? {} : { period: Math.max(1, +addPer || meta.per || 20) }), color: COLORS[x.length % COLORS.length] }]); };
  const delInd = (id) => setInds((x) => x.filter((i) => i.id !== id));
  const { priceOverlays, oscOverlays } = useMemo(() => buildOverlays(bars, inds), [bars, inds]);

  if (!screens) return <div className="muted pad">{err ? <span className="err">⚠ {err}</span> : 'Loading registers…'}</div>;
  if (!screens.length) return <div className="muted pad">No screeners with recorded history yet.</div>;
  const curDay = days.find((d) => d.day === day);
  const addMeta = BY[addName] || {};

  return (
    <div className="reg">
      <div className="reg-controls">
        <label>Screener
          <select className="sel" value={screen} onChange={(e) => pickScreen(e.target.value)}>
            {screens.map((s) => <option key={s.screen} value={s.screen}>{s.name} — {s.members} picks · {s.days}d</option>)}
          </select>
        </label>
        <label>Day
          <select className="sel" value={day} onChange={(e) => loadDay(screen, e.target.value)}>
            {!days.length && <option value="">No recorded days</option>}
            {days.map((d) => <option key={d.day} value={d.day}>{d.day} · {d.n} stock{d.n === 1 ? '' : 's'}</option>)}
          </select>
        </label>
        {curDay && <span className="muted small">{curDay.n} stock{curDay.n === 1 ? '' : 's'} on {day}</span>}
      </div>

      {err && <div className="err pad">⚠ {err}</div>}
      {rows && (rows.length ? (
        <div className="reg-grid">
          {rows.map((r) => (
            <button key={r.ticker} className={'reg-card' + (pick?.ticker === r.ticker ? ' on' : '')} onClick={() => setPick({ ticker: r.ticker, name: r.name, day })}>
              <span className="reg-tk">{r.ticker}</span>
              {r.name ? <span className="reg-nm muted">{r.name}</span> : null}
              <span className="reg-seen muted">seen {r.firstSeen || '—'}</span>
            </button>
          ))}
        </div>
      ) : <div className="muted pad">No stocks recorded on {day}.</div>)}

      {pick && (
        <div className="reg-chartwrap">
          <div className="reg-charthead">
            <div className="reg-charttitle"><b>{pick.ticker}</b> {pick.name ? <span className="muted">{pick.name}</span> : null} <span className="muted">· {pick.day}</span></div>
            <div className="ranges">{TFS.map(([id, l]) => <button key={id} className={'range' + (tf === id ? ' on' : '')} onClick={() => setTf(id)}>{l}</button>)}</div>
          </div>
          <div className="reg-indbar">
            {inds.map((i) => <span key={i.id} className="reg-chip" style={{ borderColor: `var(${i.color})` }}><i style={{ background: `var(${i.color})` }} />{indLabel(i)}<button onClick={() => delInd(i.id)} aria-label={`Remove ${indLabel(i)}`}>✕</button></span>)}
            <span className="reg-add">
              <select value={addName} onChange={(e) => setAddName(e.target.value)}>{IND_TYPES.map((t) => <option key={t.name} value={t.name}>{t.label}</option>)}</select>
              {!addMeta.noPer && <input type="number" min="1" value={addPer} onChange={(e) => setAddPer(e.target.value)} aria-label="Indicator length" />}
              <button onClick={addInd}>+ Add</button>
            </span>
          </div>
          {bars.length ? <QpChart bars={bars} priceOverlays={priceOverlays} oscOverlays={oscOverlays} height={430} intraday={tf !== 'D'} />
            : <div className="reg-chart-empty muted">{loading ? 'Loading…' : (msg || 'No data.')}</div>}
          <div className="muted small reg-foot">
            {loading ? `Loading ${tf === 'D' ? 'daily' : tf + 'm'} bars…` : msg ? msg : `${tf === 'D' ? 'Daily candles · Yahoo' : `${tf}-minute candles for ${pick.day} · Polygon`} · ${bars.length} bars · indicators: qp library · drag to pan, scroll to zoom`}
          </div>
        </div>
      )}
    </div>
  );
}
