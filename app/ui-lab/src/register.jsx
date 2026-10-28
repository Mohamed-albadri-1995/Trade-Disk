// Trade-Disk — qp Register browser (design/05-qp/CHART.md §3.6). Pick a screener +
// day → the stocks it surfaced → click one → the qp chart on that exact day, with
// indicators from the REAL qp library. Every indicator here is computed by the
// qp-compute service (the Python qp/primitives, pinned) through our /api/lab/compute
// proxy — the SAME code the live algo imports, so the chart can never disagree with a
// backtest or a trade. The picker offers the full catalog (all primitives).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import QpChart from './qpchart.jsx';

const COLORS = ['--cyan', '--yellow', '--purple', '--orange', '--green', '--blue'];
const TFS = [['D', 'Daily'], ['1', '1m'], ['5', '5m'], ['15', '15m']];
// indicators that draw ON the price scale; everything else drops into the oscillator pane.
const PRICE_GROUPS = new Set(['ma', 'vwap', 'levels', 'pivots', 'structure', 'extremes']);
const isPriceKey = (meta) => !!meta && (PRICE_GROUPS.has(meta.group) || meta.key === 'volatility.bb' || meta.key === 'volatility.bb_ema');

export default function Register() {
  const [screens, setScreens] = useState(null);
  const [screen, setScreen] = useState('');
  const [days, setDays] = useState([]); const [day, setDay] = useState('');
  const [rows, setRows] = useState(null);
  const [pick, setPick] = useState(null);                 // { ticker, name, day }
  const [tf, setTf] = useState('1');
  const [bars, setBars] = useState([]); const [loading, setLoading] = useState(false); const [msg, setMsg] = useState(null);
  const [cat, setCat] = useState([]);                     // the qp primitive catalog
  const [inds, setInds] = useState([{ id: 1, key: 'vwap.session', params: {}, color: '--cyan' }, { id: 2, key: 'ma.ema', params: { length: 9 }, color: '--yellow' }, { id: 3, key: 'ma.ema', params: { length: 20 }, color: '--purple' }]);
  const [series, setSeries] = useState([]);               // computed series from qp-compute
  const [addKey, setAddKey] = useState('ma.ema'); const [addParams, setAddParams] = useState({ length: 20 });
  const [err, setErr] = useState(null);
  const nextId = useRef(4);

  const metaByKey = useMemo(() => Object.fromEntries(cat.map((p) => [p.key, p])), [cat]);
  const groups = useMemo(() => { const g = {}; for (const p of cat) (g[p.group] ||= []).push(p); return g; }, [cat]);
  const addMeta = metaByKey[addKey];

  useEffect(() => {
    api.registerScreens().then((s) => { setScreens(s || []); if (s?.[0]) pickScreen(s[0].screen); }).catch((e) => setErr(String(e.message || e)));
    api.primitives().then((r) => setCat((r.primitives || []).filter((p) => !p.compute_tf))).catch(() => {});  // fixed-tf primitives need special bars; hide for now
  }, []); // eslint-disable-line

  async function pickScreen(scr) {
    setScreen(scr); setRows(null); setDay(''); setDays([]); setPick(null); setErr(null);
    try { const d = await api.registerDays(scr); setDays(d || []); if (d?.[0]) loadDay(scr, d[0].day); } catch (e) { setErr(String(e.message || e)); }
  }
  async function loadDay(scr, dy) {
    setDay(dy); setPick(null); setErr(null);
    try { const r = await api.registerDay(scr, dy); setRows(r || []); } catch (e) { setErr(String(e.message || e)); setRows([]); }
  }

  // load bars for the picked stock + timeframe
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

  // compute every indicator through the REAL qp library (qp-compute) on the loaded bars
  useEffect(() => {
    if (!bars.length || !inds.length) { setSeries([]); return; }
    let on = true;
    api.compute(bars, inds.map((i) => ({ id: String(i.id), key: i.key, params: i.params || {}, source: 'close' })))
      .then((r) => { if (on) setSeries(r.series || []); })
      .catch(() => { if (on) setSeries([]); });
    return () => { on = false; };
  }, [bars, inds]);

  function onAddKey(k) { setAddKey(k); const m = metaByKey[k]; setAddParams(Object.fromEntries((m?.params || []).map((p) => [p.name, p.default]))); }
  function addInd() { setInds((x) => [...x, { id: nextId.current++, key: addKey, params: { ...addParams }, color: COLORS[x.length % COLORS.length] }]); }
  const delInd = (id) => setInds((x) => x.filter((i) => i.id !== id));
  const label = (i) => { const m = metaByKey[i.key]; const nm = m?.name || i.key; const ps = Object.values(i.params || {}).filter((v) => v != null); return nm + (ps.length ? ' ' + ps.join('·') : ''); };

  const { priceOverlays, oscOverlays } = useMemo(() => {
    const byId = Object.fromEntries(inds.map((i) => [String(i.id), i]));
    const price = [], osc = [];
    for (const sr of series) {
      const ind = byId[String(sr.id)]; if (!ind || sr.error) continue;
      const dest = isPriceKey(metaByKey[sr.key] || metaByKey[ind.key]) ? price : osc;
      if (sr.lines) { for (const [nm, vals] of Object.entries(sr.lines)) dest.push({ color: ind.color, dashed: !/mid/i.test(nm), series: vals }); }
      else if (sr.values) dest.push({ color: ind.color, series: sr.values });
    }
    return { priceOverlays: price, oscOverlays: osc };
  }, [series, inds, metaByKey]);

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
            {inds.map((i) => <span key={i.id} className="reg-chip" style={{ borderColor: `var(${i.color})` }}><i style={{ background: `var(${i.color})` }} />{label(i)}<button onClick={() => delInd(i.id)} aria-label={`Remove ${label(i)}`}>✕</button></span>)}
            <span className="reg-add">
              <select value={addKey} onChange={(e) => onAddKey(e.target.value)} title="qp library primitive">
                {Object.entries(groups).map(([g, ps]) => <optgroup key={g} label={g}>{ps.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</optgroup>)}
              </select>
              {(addMeta?.params || []).map((p) => (
                <input key={p.name} type="number" title={p.name} value={addParams[p.name] ?? p.default ?? ''} step={p.kind === 'float' ? 'any' : 1} min={p.min ?? undefined}
                  onChange={(e) => setAddParams((x) => ({ ...x, [p.name]: p.kind === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10) }))} />
              ))}
              <button onClick={addInd} disabled={!addKey}>+ Add</button>
            </span>
          </div>
          {bars.length ? <QpChart bars={bars} priceOverlays={priceOverlays} oscOverlays={oscOverlays} height={430} intraday={tf !== 'D'} />
            : <div className="reg-chart-empty muted">{loading ? 'Loading…' : (msg || 'No data.')}</div>}
          <div className="muted small reg-foot">
            {loading ? `Loading ${tf === 'D' ? 'daily' : tf + 'm'} bars…` : msg ? msg : `${tf === 'D' ? 'Daily candles · Yahoo' : `${tf}-minute candles for ${pick.day} · Polygon`} · ${bars.length} bars · indicators: qp library (Python) · drag to pan, scroll to zoom`}
          </div>
        </div>
      )}
    </div>
  );
}
