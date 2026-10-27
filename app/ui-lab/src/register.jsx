// Trade-Disk — qp Register browser (the design's §3.6). Open it, pick a screener, pick
// a day → the stocks that screener surfaced that day, as cards. Click a card and the qp
// chart loads that stock on that exact day (intraday from Polygon, or daily), with
// indicators you add/remove and a timeframe switch. Our own chart + indicator math — no
// third-party library. Reads the recorded daily record via /api/radar/register-*.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import QpChart from './qpchart.jsx';

const COLORS = ['--cyan', '--yellow', '--purple', '--orange', '--green', '--blue'];
const TFS = [['D', 'Daily'], ['1', '1m'], ['5', '5m'], ['15', '15m']];
const IND_TYPES = [['ema', 'EMA'], ['sma', 'SMA'], ['vwap', 'VWAP'], ['boll', 'Bollinger'], ['rsi', 'RSI']];
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

// indicator math (the qp primitives, on the loaded bars)
function emaSeries(v, p) { if (!v.length) return []; const k = 2 / (p + 1), o = [v[0]]; for (let i = 1; i < v.length; i++) o.push(v[i] * k + o[i - 1] * (1 - k)); return o; }
function smaSeries(v, n) { const o = new Array(v.length).fill(null); let s = 0; for (let i = 0; i < v.length; i++) { s += v[i]; if (i >= n) s -= v[i - n]; if (i >= n - 1) o[i] = s / n; } return o; }
function vwapSeries(bars) { const o = []; let pv = 0, vv = 0; for (const b of bars) { const tp = (b.h + b.l + b.c) / 3, v = b.v || 0; pv += tp * v; vv += v; o.push(vv ? pv / vv : b.c); } return o; }
function bollSeries(v, n, k) { const mid = smaSeries(v, n), up = new Array(v.length).fill(null), lo = new Array(v.length).fill(null); for (let i = n - 1; i < v.length; i++) { let s = 0; for (let j = i - n + 1; j <= i; j++) s += (v[j] - mid[i]) ** 2; const sd = Math.sqrt(s / n); up[i] = mid[i] + k * sd; lo[i] = mid[i] - k * sd; } return { mid, up, lo }; }
function rsiSeries(v, n) { const o = new Array(v.length).fill(null); if (v.length <= n) return o; let ag = 0, al = 0; for (let i = 1; i <= n; i++) { const d = v[i] - v[i - 1]; if (d >= 0) ag += d; else al -= d; } ag /= n; al /= n; o[n] = 100 - 100 / (1 + (al === 0 ? 100 : ag / al)); for (let i = n + 1; i < v.length; i++) { const d = v[i] - v[i - 1]; ag = (ag * (n - 1) + Math.max(d, 0)) / n; al = (al * (n - 1) + Math.max(-d, 0)) / n; o[i] = 100 - 100 / (1 + (al === 0 ? 100 : ag / al)); } return o; }
const indLabel = (i) => `${i.type.toUpperCase()}${i.period ? ' ' + i.period : ''}`;

export default function Register() {
  const [screens, setScreens] = useState(null);
  const [screen, setScreen] = useState('');
  const [days, setDays] = useState([]); const [day, setDay] = useState('');
  const [rows, setRows] = useState(null);
  const [pick, setPick] = useState(null);                 // { ticker, name, day }
  const [tf, setTf] = useState('1');
  const [bars, setBars] = useState([]); const [loading, setLoading] = useState(false); const [msg, setMsg] = useState(null);
  const [inds, setInds] = useState([{ id: 1, type: 'vwap', color: '--cyan' }, { id: 2, type: 'ema', period: 9, color: '--yellow' }, { id: 3, type: 'ema', period: 20, color: '--purple' }]);
  const [addType, setAddType] = useState('ema'); const [addPer, setAddPer] = useState(20);
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
  function pickCard(r) { setPick({ ticker: r.ticker, name: r.name, day }); }

  // load bars whenever the pick or timeframe changes
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

  const addInd = () => { const needsPer = addType !== 'vwap'; setInds((x) => [...x, { id: nextId.current++, type: addType, ...(needsPer ? { period: Math.max(1, +addPer || 14) } : {}), color: COLORS[x.length % COLORS.length] }]); };
  const delInd = (id) => setInds((x) => x.filter((i) => i.id !== id));

  const { priceOverlays, oscOverlays } = useMemo(() => {
    const closes = bars.map((b) => b.c); const price = [], osc = [];
    for (const ind of inds) {
      if (ind.type === 'ema') price.push({ color: ind.color, series: emaSeries(closes, ind.period || 20) });
      else if (ind.type === 'sma') price.push({ color: ind.color, series: smaSeries(closes, ind.period || 20) });
      else if (ind.type === 'vwap') price.push({ color: ind.color, series: vwapSeries(bars) });
      else if (ind.type === 'boll') { const b = bollSeries(closes, ind.period || 20, 2); price.push({ color: ind.color, series: b.mid }, { color: ind.color, dashed: true, series: b.up }, { color: ind.color, dashed: true, series: b.lo }); }
      else if (ind.type === 'rsi') osc.push({ color: ind.color, series: rsiSeries(closes, ind.period || 14) });
    }
    return { priceOverlays: price, oscOverlays: osc };
  }, [bars, inds]);

  if (!screens) return <div className="muted pad">{err ? <span className="err">⚠ {err}</span> : 'Loading registers…'}</div>;
  if (!screens.length) return <div className="muted pad">No screeners with recorded history yet.</div>;
  const curDay = days.find((d) => d.day === day);

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
            <button key={r.ticker} className={'reg-card' + (pick?.ticker === r.ticker ? ' on' : '')} onClick={() => pickCard(r)}>
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
              <select value={addType} onChange={(e) => setAddType(e.target.value)}>{IND_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              {addType !== 'vwap' && <input type="number" min="1" value={addPer} onChange={(e) => setAddPer(e.target.value)} aria-label="Indicator period" />}
              <button onClick={addInd}>+ Add</button>
            </span>
          </div>
          {bars.length ? <QpChart bars={bars} priceOverlays={priceOverlays} oscOverlays={oscOverlays} height={430} intraday={tf !== 'D'} />
            : <div className="reg-chart-empty muted">{loading ? 'Loading…' : (msg || 'No data.')}</div>}
          <div className="muted small reg-foot">
            {loading ? `Loading ${tf === 'D' ? 'daily' : tf + 'm'} bars…` : msg ? msg : `${tf === 'D' ? 'Daily candles · Yahoo' : `${tf}-minute candles for ${pick.day} · Polygon`} · ${bars.length} bars · drag to pan, scroll to zoom`}
          </div>
        </div>
      )}
    </div>
  );
}
