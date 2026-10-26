// Trade-Disk — TradeLab. One page: chart a stock with the engine's own indicators,
// build a strategy by clicking and see its signals and trades on that chart, then
// backtest it honestly over a universe. The chart preview and the backtest call the
// same engine, so a signal you see is the signal it trades.
import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api.js';
import { signOut } from './auth.js';
import { getTheme, toggleTheme } from './theme.js';
import { cls, fmt, pct } from './lib.js';
import CandleChart from './chart.jsx';
import Builder from './builder.jsx';
import Backtest from './backtest.jsx';

const clone = (x) => JSON.parse(JSON.stringify(x));
const RANGES = ['6mo', '1y', '2y', '5y'];

export default function App() {
  const [meta, setMeta] = useState(null);
  const [symbol, setSymbol] = useState('AAPL');
  const [symInput, setSymInput] = useState('AAPL');
  const [range, setRange] = useState('1y');
  const [doc, setDoc] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saved, setSaved] = useState([]);
  const [tab, setTab] = useState('chart');
  const [theme, setTh] = useState(getTheme());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState(null);
  const [panel, setPanel] = useState(null);             // mobile: which side panel is open ('strategy' | 'trades' | null)
  const [chH, setChH] = useState(420);                  // chart height — chart-first (tall) on phones, standard on desktop

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  // Lead with a big chart on phones (TradingView-style); standard height on desktop.
  useEffect(() => {
    const f = () => setChH(window.innerWidth <= 920 ? Math.max(340, Math.round(window.innerHeight * 0.58)) : 420);
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, []);

  // first load: grammar + templates + saved strategies, then an initial preview
  useEffect(() => {
    (async () => {
      try {
        const m = await api.meta(); setMeta(m);
        const first = m.templates[0]?.doc ? clone(m.templates[0].doc) : { name: 'New strategy', side: 'long', fill: 'desk', entry: { logic: 'AND', rules: [] }, exit: { logic: 'OR', rules: [] }, risk: { sl: { type: 'pct', value: 8 } } };
        setDoc(first);
        api.strategies().then(setSaved).catch(() => {});
      } catch (e) { setErr(String(e.message || e)); }
    })();
  }, []);

  const runPreview = useCallback(async (sym = symbol, d = doc, rg = range) => {
    if (!d) return;
    setBusy(true); setErr(null);
    try {
      const p = await api.preview(sym, d, { range: rg, fill: d.fill, costBps: 2 });
      if (p.error) { setErr(p.error); setPreview((prev) => prev); } else setPreview(p);
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }, [symbol, doc, range]);

  // initial preview once doc is set
  useEffect(() => { if (doc && !preview) runPreview(symbol, doc, range); }, [doc]); // eslint-disable-line

  function loadSymbol(s) { const sym = (s || symInput).trim().toUpperCase(); if (!sym) return; setSymbol(sym); runPreview(sym, doc, range); }
  function changeRange(r) { setRange(r); runPreview(symbol, doc, r); }
  function onTemplate(id) { const t = meta.templates.find((x) => x.id === id); if (!t) return; const d = clone(t.doc); setDoc(d); setDirty(false); runPreview(symbol, d, range); flash(`Loaded “${t.name}”`); }
  async function onLoad(id) { try { const s = await api.strategy(id); if (s?.doc) { setDoc(s.doc); setDirty(false); runPreview(symbol, s.doc, range); flash(`Loaded “${s.name}”`); } } catch (e) { setErr(String(e.message || e)); } }
  async function onSave() {
    setBusy(true); setErr(null);
    try { const r = await api.saveStrategy(doc, doc.id); setDoc((d) => ({ ...d, id: r.id })); setDirty(false); api.strategies().then(setSaved); flash(`Saved “${r.name}” · v${r.version}`); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }
  async function onDelete(id) { try { await api.deleteStrategy(id); setSaved((s) => s.filter((x) => x.id !== id)); if (doc.id === id) setDoc((d) => ({ ...d, id: undefined })); flash('Deleted'); } catch (e) { setErr(String(e.message || e)); } }
  const editDoc = (d) => { setDoc(d); setDirty(true); };

  function flipTheme() { toggleTheme(); setTh(getTheme()); }

  if (!meta || !doc) return <div className="boot">{err ? <span className="err">⚠ {err}</span> : 'Loading TradeLab…'}</div>;

  const last = preview?.bars?.at(-1);
  const prevC = preview?.bars?.at(-2)?.c;
  const chg = last && prevC ? (last.c - prevC) / prevC * 100 : null;

  return (
    <div className="lab">
      <header className="appbar">
        <a className="brand" href="/" title="Back to the Station" style={{ textDecoration: 'none', color: 'inherit' }}><span className="logo">▥</span> Trade-Disk <em>· TradeLab</em></a>
        <div className="sym-box">
          <input className="input sym" value={symInput} onChange={(e) => setSymInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadSymbol()} placeholder="Symbol" aria-label="Symbol" />
          <button className="ghost" onClick={() => loadSymbol()}>Load</button>
          <div className="ranges">{RANGES.map((r) => <button key={r} className={cls('range', r === range && 'on')} onClick={() => changeRange(r)}>{r}</button>)}</div>
        </div>
        <div className="app-actions">
          <a className="ghost" href="/" title="Station">⌂</a>
          <button className="iconbtn" onClick={flipTheme} title="Theme">{theme === 'dark' ? '☀' : '☾'}</button>
          <button className="ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="tabs">
        <button className={cls('tab', tab === 'chart' && 'on')} onClick={() => setTab('chart')}>Chart & Strategy</button>
        <button className={cls('tab', tab === 'backtest' && 'on')} onClick={() => setTab('backtest')}>Backtest</button>
      </div>

      {err && <div className="err bar">⚠ {err}</div>}

      {tab === 'chart' && (
        <div className="work">
          <div className="chart-col">
            <div className="chart-head">
              <div className="ch-sym"><b>{preview?.symbol || symbol}</b> <span className="muted">{preview?.name || ''}</span></div>
              {last && <div className="ch-price"><b>{fmt(last.c)}</b> <span className={chg > 0 ? 'pos' : 'neg'}>{pct(chg)}</span></div>}
              <div className="ch-flags">
                {preview && <span className={cls('flag', preview.lastEntryTrue ? 'on' : '')}>{preview.lastEntryTrue ? '● entry signal true now' : '○ no entry signal now'}</span>}
                {preview && <span className="flag ghost">{preview.trades.length} trades · {preview.entryBars.length} signals in window</span>}
              </div>
            </div>
            {preview ? <CandleChart bars={preview.bars} overlays={preview.overlays} trades={preview.trades} height={chH} /> : <div className="muted pad">Loading chart…</div>}
            <div className={cls('prev-trades-wrap', panel === 'trades' && 'open')}>
              <button className="panel-close" onClick={() => setPanel(null)}>✕ Close trades</button>
              {preview && <PreviewTrades trades={preview.trades} />}
            </div>
          </div>
          <aside className={cls('build-col', panel === 'strategy' && 'open')}>
            <button className="panel-close" onClick={() => setPanel(null)}>✕ Close builder</button>
            <Builder meta={meta} doc={doc} setDoc={editDoc} onEvaluate={() => runPreview()} onSave={onSave}
              saved={saved} onLoad={onLoad} onDelete={onDelete} templates={meta.templates} onTemplate={onTemplate} busy={busy} dirty={dirty} />
          </aside>
          <nav className="lab-rail" aria-label="Chart tools">
            <button className={cls(panel === 'strategy' && 'on')} onClick={() => setPanel((p) => (p === 'strategy' ? null : 'strategy'))} title="Strategy builder"><b>⚙</b><small>Strategy</small></button>
            <button className={cls(panel === 'trades' && 'on')} onClick={() => setPanel((p) => (p === 'trades' ? null : 'trades'))} title="Trades on this chart"><b>☰</b><small>Trades</small></button>
          </nav>
          {panel && <div className="lab-backdrop" onClick={() => setPanel(null)} />}
        </div>
      )}

      {tab === 'backtest' && <Backtest doc={doc} />}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function PreviewTrades({ trades }) {
  if (!trades?.length) return <div className="muted small pad">No trades for this strategy on this symbol and window.</div>;
  return (
    <div className="prev-trades">
      <div className="pt-head">Trades on this chart <span className="muted">· {trades.length}</span></div>
      <div className="pt-scroll">
        {trades.slice().reverse().map((t, i) => (
          <div key={i} className="pt-row">
            <span className="pt-date">{new Date(t.entry_ts * 1000).toISOString().slice(0, 10)}</span>
            <span>{fmt(t.entry)} → {fmt(t.exit)}</span>
            <span className={t.ret > 0 ? 'pos' : 'neg'}>{pct(t.ret)}</span>
            <span className="muted">{t.r == null ? '' : (t.r > 0 ? '+' : '') + fmt(t.r, 2) + 'R'}</span>
            <span className="pt-reason">{t.reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
