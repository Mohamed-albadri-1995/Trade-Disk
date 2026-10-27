// Trade-Disk — TradeLab Backtest (the one, unified tab). Pick a strategy (the one in
// the builder or a saved one), a universe (a Radar SCREENER's real picks, your
// shortlist, or a symbol list) and a TIMEFRAME (daily, or 1/5/15-minute intraday),
// then run it through the one engine. Daily uses free Yahoo bars over the whole
// range; intraday uses real Polygon minute bars over the days the screener surfaced
// each stock, point-in-time (tradeable only from the minute it first appeared).
import React, { useRef, useEffect, useState, useMemo, useLayoutEffect } from 'react';
import { api } from './api.js';
import { cls, fmt, signed, pct, money, dateOf } from './lib.js';

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
const TFS = [{ id: 'daily', label: 'Daily' }, { id: '1', label: '1-min' }, { id: '5', label: '5-min' }, { id: '15', label: '15-min' }];
const FILLS_D = [{ id: 'desk', label: 'desk (honest)' }, { id: 'close', label: 'close' }, { id: 'next_open', label: 'next open' }, { id: 'live', label: 'live' }];
const FILLS_I = [{ id: 'next_open', label: 'next bar open' }, { id: 'close', label: 'bar close' }, { id: 'desk', label: 'desk' }];

// ───────────────────────── daily report ─────────────────────────
function EquityCurve({ curve, money: isMoney }) {
  const wrap = useRef(null), cv = useRef(null); const [w, setW] = useState(600);
  useLayoutEffect(() => { const el = wrap.current; if (!el) return; const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth); return () => ro.disconnect(); }, []);
  useEffect(() => {
    const c = cv.current; if (!c || !curve?.length) return; const h = 180, dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const pad = { l: 6, r: 52, t: 10, b: 18 };
    const eqs = curve.map((p) => p.equity); let lo = Math.min(...eqs), hi = Math.max(...eqs); const p = (hi - lo) * 0.08 || 1; lo -= p; hi += p;
    const n = curve.length, x = (i) => pad.l + (i / Math.max(1, n - 1)) * (w - pad.l - pad.r), y = (v) => (h - pad.b) - ((v - lo) / (hi - lo)) * (h - pad.t - pad.b);
    g.strokeStyle = css('--line'); g.fillStyle = css('--muted'); g.font = '10px Inter'; g.textBaseline = 'middle';
    for (let k = 0; k <= 3; k++) { const v = lo + (hi - lo) * k / 3, yy = y(v); g.globalAlpha = .3; g.beginPath(); g.moveTo(pad.l, yy); g.lineTo(w - pad.r, yy); g.stroke(); g.globalAlpha = 1; g.fillText(isMoney === '$' ? money(v) : fmt(v, 0), w - pad.r + 4, yy); }
    let peak = curve[0].equity; g.fillStyle = css('--red'); g.globalAlpha = .1; g.beginPath(); g.moveTo(x(0), y(curve[0].equity));
    const base = []; curve.forEach((pt) => { peak = Math.max(peak, pt.equity); base.push(peak); });
    curve.forEach((pt, i) => g.lineTo(x(i), y(pt.equity))); for (let i = n - 1; i >= 0; i--) g.lineTo(x(i), y(base[i])); g.closePath(); g.fill(); g.globalAlpha = 1;
    const up = curve.at(-1).equity >= curve[0].equity; g.strokeStyle = up ? css('--green') : css('--red'); g.lineWidth = 2; g.beginPath();
    curve.forEach((pt, i) => (i ? g.lineTo(x(i), y(pt.equity)) : g.moveTo(x(i), y(pt.equity)))); g.stroke();
  }, [curve, w, isMoney]);
  return <div ref={wrap} className="eq"><canvas ref={cv} /></div>;
}
const Tile = ({ label, value, cls: c, hint }) => <div className="tile" title={hint || ''}><small>{label}</small><b className={c}>{value}</b></div>;

function DailyReport({ rep }) {
  if (!rep) return null;
  const h = rep.headline, m = rep.money, isM = m === '$';
  const fv = (x) => (isM ? money(x) : pct(x));
  const maxBucket = Math.max(1, ...Object.values(rep.r.distribution));
  return (
    <div className="report">
      <div className="tiles">
        <Tile label="Trades" value={h.trades} />
        <Tile label="Win rate" value={fmt(h.winRate, 1) + '%'} cls={h.winRate >= 50 ? 'pos' : ''} />
        <Tile label="Net profit" value={fv(h.netProfit)} cls={h.netProfit > 0 ? 'pos' : h.netProfit < 0 ? 'neg' : ''} />
        <Tile label="Profit factor" value={h.profitFactor == null ? '—' : fmt(h.profitFactor, 2)} cls={h.profitFactor >= 1.5 ? 'pos' : ''} />
        <Tile label="Expectancy" value={fv(h.expectancy)} cls={h.expectancy > 0 ? 'pos' : 'neg'} />
        <Tile label="Avg R" value={rep.r.average == null ? '—' : signed(rep.r.average, 2)} cls={rep.r.average > 0 ? 'pos' : 'neg'} />
        <Tile label="Max drawdown" value={isM ? money(rep.equity.maxDrawdown) : fmt(rep.equity.maxDrawdownPct, 1) + '%'} cls="neg" />
        <Tile label="Sharpe" value={rep.ratios.sharpe == null ? '—' : fmt(rep.ratios.sharpe, 2)} />
      </div>
      <div className="rep-cols">
        <div className="rep-main">
          <div className="rep-h">Equity curve <span className="muted">· {isM ? 'account $' : 'unit index (100 = start)'}</span></div>
          <EquityCurve curve={rep.equity.curve} money={m} />
          <div className="statline muted">
            Gross +{fmt(h.grossProfit)} / −{fmt(h.grossLoss)} · avg win {fv(h.avgWin)} · avg loss {fv(h.avgLoss)} · payoff {h.payoff ?? '—'} ·
            best {fv(h.largestWin)} / worst {fv(h.largestLoss)} · streaks W{rep.equity.maxWinStreak}/L{rep.equity.maxLossStreak}
          </div>
        </div>
        <div className="rep-side">
          <div className="rep-h">R-multiple spread</div>
          <div className="rbars">
            {Object.entries(rep.r.distribution).map(([k, v]) => (
              <div key={k} className="rbar"><span className="rk">{k}</span><div className="rtrack"><div className={cls('rfill', k.startsWith('≥') || k.startsWith('1') || k.startsWith('0.') ? 'pos' : 'neg')} style={{ width: `${v / maxBucket * 100}%` }} /></div><span className="rv">{v}</span></div>
            ))}
          </div>
          <div className="rep-h" style={{ marginTop: 10 }}>By exit reason</div>
          <div className="splits">{Object.entries(rep.splits.byReason.count).map(([k, v]) => <span key={k} className="split"><b>{k}</b> {v} <em className={rep.splits.byReason.net[k] > 0 ? 'pos' : 'neg'}>{fv(rep.splits.byReason.net[k])}</em></span>)}</div>
        </div>
      </div>
      {rep.warnings?.length > 0 && <div className="warn">{rep.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>}
      <div className="muted small cov">Coverage: {rep.coverage.withBars}/{rep.coverage.requested} symbols had data{rep.coverage.empty.length ? ` · no bars: ${rep.coverage.empty.join(', ')}` : ''}</div>
      <details className="trades-wrap"><summary>{rep.trades?.length ? `All ${rep.trades.length} trades` : 'Trades'}</summary>
        <div className="tbl-scroll"><table className="trades"><thead><tr><th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th>In</th><th>Out</th><th>{isM ? 'P&L' : 'Return'}</th><th>R</th><th>Reason</th><th>Held</th></tr></thead>
          <tbody>{(rep.trades || []).map((t, i) => (
            <tr key={i}><td>{t.symbol}</td><td>{t.side}</td><td>{dateOf(t.entry_ts)}</td><td>{dateOf(t.exit_ts)}</td><td>{fmt(t.entry)}</td><td>{fmt(t.exit)}</td>
              <td className={(isM ? t.pnl : t.ret) > 0 ? 'pos' : 'neg'}>{isM ? money(t.pnl) : pct(t.ret)}</td><td className={t.r > 0 ? 'pos' : 'neg'}>{t.r == null ? '—' : signed(t.r, 2)}</td><td>{t.reason}</td><td>{t.bars_held}</td></tr>
          ))}</tbody></table></div>
      </details>
    </div>
  );
}

// ─────────────────────── intraday report ───────────────────────
function CurveR({ curve }) {
  if (!curve?.length) return null;
  const w = 100, h = 34, n = curve.length;
  let lo = Math.min(0, ...curve), hi = Math.max(0, ...curve); const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
  const x = (i) => (n < 2 ? 0 : (i / (n - 1)) * w); const y = (v) => h - ((v - lo) / (hi - lo)) * h;
  const line = curve.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (<svg className="rp-curve" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1={y(0)} x2={w} y2={y(0)} className="rp-zero" /><path d={line} fill="none" className={curve.at(-1) >= 0 ? 'rp-up' : 'rp-dn'} /></svg>);
}
function IntradayReport({ rep, trades }) {
  if (!rep) return null;
  const C = rep.counts, f = rep.fetch;
  return (
    <div className="report rp-report">
      <div className="rp-headline">{rep.headline}</div>
      {f && (
        <div className={cls('id-fetch', f.missing ? 'warn' : 'ok')}>
          <b>{f.cached}</b> of <b>{f.consideredThisRun}</b> stock-days have {f.interval ? (f.interval === '1' ? '1m' : f.interval + 'm') : ''} bars
          {f.fetchedThisRun ? <> · fetched <b>{f.fetchedThisRun}</b> this run</> : null}
          <div className="muted small">{f.note}{f.capped ? ` ${f.capped}` : ''}</div>
        </div>
      )}
      <div className="tiles">
        <Tile label="Trades" value={C.trades} />
        <Tile label="Win rate" value={rep.winRate == null ? '—' : Math.round(rep.winRate * 100) + '%'} cls={rep.winRate >= 0.5 ? 'pos' : ''} />
        <Tile label="Expectancy" value={rep.expectancyR == null ? '—' : signed(rep.expectancyR, 2) + 'R'} cls={rep.expectancyR > 0 ? 'pos' : rep.expectancyR < 0 ? 'neg' : ''} />
        <Tile label="Total" value={signed(rep.totalR, 1) + 'R'} cls={rep.totalR > 0 ? 'pos' : rep.totalR < 0 ? 'neg' : ''} />
        <Tile label="Avg return" value={pct(rep.avgReturnPct)} cls={rep.avgReturnPct > 0 ? 'pos' : rep.avgReturnPct < 0 ? 'neg' : ''} />
        <Tile label="Profit factor" value={rep.profitFactor == null ? '—' : (rep.profitFactor === Infinity ? '∞' : fmt(rep.profitFactor, 2))} cls={rep.profitFactor >= 1.5 ? 'pos' : ''} />
        <Tile label="Max drawdown" value={signed(rep.maxDrawdownR, 1) + 'R'} cls="neg" />
      </div>
      <div className="rp-buckets">
        <span className="rp-b pos"><b>{C.wins}</b> win</span><span className="rp-b neg"><b>{C.losses}</b> loss</span>
        {C.scratch ? <span className="rp-b open"><b>{C.scratch}</b> scratch</span> : null}
      </div>
      {rep.equityCurveR?.length > 0 && <div className="rp-curve-wrap"><div className="rep-h">Cumulative R <span className="muted">· {trades?.length || 0} trades in order</span></div><CurveR curve={rep.equityCurveR} /></div>}
      {rep.notes?.length > 0 && <ul className="rp-notes">{rep.notes.map((t, i) => <li key={i}>{t}</li>)}</ul>}
      <details className="trades-wrap"><summary>{trades?.length ? `All ${trades.length} trades` : 'Trades'}</summary>
        <div className="tbl-scroll"><table className="trades"><thead><tr><th>Day</th><th>Seen</th><th>Entry&nbsp;@</th><th>Ticker</th><th>Side</th><th>Entry</th><th>Exit</th><th>Return</th><th>R</th><th>Why</th></tr></thead>
          <tbody>{(trades || []).map((t, i) => (
            <tr key={i}><td>{t.day}</td><td className="muted">{t.firstSeen || '—'}</td><td className="muted">{t.entryEt || '—'}</td><td>{t.ticker}</td><td className="muted">{t.side}</td><td>{fmt(t.entry)}</td><td>{fmt(t.exit)}</td>
              <td className={t.ret > 0 ? 'pos' : t.ret < 0 ? 'neg' : 'muted'}>{pct(t.ret)}</td><td className={t.r > 0 ? 'pos' : t.r < 0 ? 'neg' : 'muted'}>{signed(t.r, 2)}</td><td className="pt-reason">{t.reason}</td></tr>
          ))}</tbody></table></div>
      </details>
    </div>
  );
}

// ─────────────────────────── the tab ───────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const yearsAgo = (y) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); return d.toISOString().slice(0, 10); };

export default function Backtest({ doc, saved }) {
  const [screens, setScreens] = useState([]);
  const [key, setKey] = useState(null);               // { hasKey, masked } (for intraday)
  const [keyInput, setKeyInput] = useState('');
  const [form, setForm] = useState({
    strat: '__current__', tf: 'daily', uni: 'symbols',
    screen: '', symbols: 'AAPL, MSFT, NVDA, AMD, GOOGL, META, AMZN, TSLA',
    start: yearsAgo(2), end: today(), fill: 'desk', costBps: 2,
    mode: 'account', startEquity: 10000, riskPct: 1, feePerShare: 0.005, feeMin: 1,
  });
  const [result, setResult] = useState(null);         // { kind:'daily'|'intraday', report, trades }
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [note, setNote] = useState(null);
  const [history, setHistory] = useState([]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isIntraday = form.tf !== 'daily';

  const loadHistory = () => api.backtests().then((rows) => setHistory((rows || []).filter((r) => r.kind === 'daily' || r.kind === 'intraday'))).catch(() => {});
  useEffect(() => {
    loadHistory();
    api.intradayScreens().then((rows) => setScreens(rows || [])).catch(() => {});
    api.intradayKey().then(setKey).catch(() => setKey({ hasKey: false }));
  }, []); // eslint-disable-line
  // default the strategy picker to the saved strategy currently open in the builder
  useEffect(() => { if (doc?.id && (saved || []).some((s) => s.id === doc.id)) set({ strat: doc.id }); }, [doc?.id, saved]); // eslint-disable-line

  const curScreen = useMemo(() => screens.find((s) => s.screen === form.screen) || null, [screens, form.screen]);
  function pickTf(tf) {
    // intraday runs on a screener's real days; switch the universe to screener and pre-fill its window
    if (tf !== 'daily' && form.uni !== 'screener') { const s = screens[0]; set({ tf, uni: 'screener', fill: 'next_open', screen: form.screen || s?.screen || '', start: form.screen ? form.start : (s?.first_day || form.start), end: form.screen ? form.end : (s?.last_day || form.end) }); }
    else set({ tf, ...(tf !== 'daily' && form.fill === 'desk' ? {} : {}) });
  }
  function pickUni(uni) {
    if (uni === 'screener' && !form.screen && screens[0]) set({ uni, screen: screens[0].screen, start: screens[0].first_day || form.start, end: screens[0].last_day || form.end });
    else set({ uni });
  }
  function pickScreen(screen) { const s = screens.find((x) => x.screen === screen); set({ screen, ...(s ? { start: s.first_day || form.start, end: s.last_day || form.end } : {}) }); }

  async function saveKey() {
    const v = keyInput.trim(); if (!v) return;
    setBusy(true); setErr(null);
    try { const r = await api.saveIntradayKey(v); setKey(r); setKeyInput(''); setNote('Polygon key saved.'); setTimeout(() => setNote(null), 2500); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }

  async function run() {
    setBusy(true); setErr(null);
    try {
      let strategy = doc;
      if (form.strat !== '__current__') strategy = (await api.strategy(form.strat))?.doc;
      if (!strategy) throw new Error('pick a strategy to run');
      if (isIntraday) {
        if (form.uni !== 'screener') throw new Error('intraday timeframes run on a screener’s picks — choose the Screener universe');
        if (!form.screen) throw new Error('pick a screener');
        if (!key?.hasKey) throw new Error('add your Polygon API key first (the field above)');
        const out = await api.runIntraday({ screen: form.screen, start: form.start, end: form.end, interval: form.tf, fill: form.fill, costBps: +form.costBps || 0, strategy });
        setResult({ kind: 'intraday', report: out.report, trades: out.trades });
      } else {
        const universe = form.uni === 'screener' ? { kind: 'screener', screen: form.screen, start: form.start, end: form.end }
          : form.uni === 'shortlist' ? { kind: 'shortlist' }
            : { kind: 'symbols', symbols: form.symbols.split(/[,\s]+/).filter(Boolean) };
        if (form.uni === 'screener' && !form.screen) throw new Error('pick a screener');
        const spec = {
          name: strategy.name, strategy, universe, start: form.start, end: form.end, fill: form.fill, costBps: +form.costBps,
          feePerShare: +form.feePerShare, feeMin: +form.feeMin,
          accounting: form.mode === 'account' ? { mode: 'account', startEquity: +form.startEquity, riskPct: +form.riskPct } : { mode: 'unit' },
        };
        const out = await api.backtest(spec);
        setResult({ kind: 'daily', report: { ...out.report, trades: out.trades } });
      }
      loadHistory();
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }
  async function openPast(id, kind) {
    setBusy(true); setErr(null);
    try { const r = await api.getBacktest(id); if (r) setResult(kind === 'intraday' ? { kind: 'intraday', report: r.report, trades: r.trades } : { kind: 'daily', report: { ...r.report, trades: r.trades } }); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }

  const fills = isIntraday ? FILLS_I : FILLS_D;

  return (
    <div className="bt">
      {isIntraday && (
        <div className="id-key">
          <span className="muted small">Polygon API key</span>
          {key?.hasKey && <span className="id-key-ok">✓ saved {key.masked ? <code>{key.masked}</code> : null}</span>}
          <input className="inp" type="password" autoComplete="off" placeholder={key?.hasKey ? 'Replace key…' : 'Paste your Polygon key'} value={keyInput} onChange={(e) => setKeyInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveKey()} />
          <button className="btn" onClick={saveKey} disabled={busy || !keyInput.trim()}>Save key</button>
          <a className="muted small" href="https://polygon.io/dashboard/keys" target="_blank" rel="noreferrer">free key ↗</a>
        </div>
      )}

      <div className="bt-form">
        <div className="bt-field wide">
          <label>Strategy</label>
          <select className="sel" value={form.strat} onChange={(e) => set({ strat: e.target.value })}>
            <option value="__current__">Current builder — “{doc?.name || 'Untitled'}”</option>
            {(saved || []).map((s) => <option key={s.id} value={s.id}>{s.name}{s.side ? ` · ${s.side}` : ''}</option>)}
          </select>
        </div>
        <div className="bt-field"><label>Timeframe</label>
          <div className="ranges">{TFS.map((t) => <button key={t.id} className={cls('range', form.tf === t.id && 'on')} onClick={() => pickTf(t.id)}>{t.label}</button>)}</div>
        </div>
        <div className="bt-field wide">
          <label>Universe</label>
          <div className="ranges">
            <button className={cls('range', form.uni === 'screener' && 'on')} onClick={() => pickUni('screener')}>Screener</button>
            <button className={cls('range', form.uni === 'shortlist' && 'on')} onClick={() => !isIntraday && pickUni('shortlist')} disabled={isIntraday} title={isIntraday ? 'Intraday runs on a screener' : ''}>Shortlist</button>
            <button className={cls('range', form.uni === 'symbols' && 'on')} onClick={() => !isIntraday && pickUni('symbols')} disabled={isIntraday} title={isIntraday ? 'Intraday runs on a screener' : ''}>Symbols</button>
          </div>
        </div>
        {form.uni === 'screener' && (
          <div className="bt-field wide">
            <label>Screener</label>
            <select className="sel" value={form.screen} onChange={(e) => pickScreen(e.target.value)}>
              <option value="">{screens.length ? 'Pick a screener…' : 'No screeners with history'}</option>
              {screens.map((s) => <option key={s.screen} value={s.screen}>{s.name} — {s.members} picks · {s.days}d</option>)}
            </select>
          </div>
        )}
        {form.uni === 'symbols' && <div className="bt-field wide"><label>Symbols</label><input className="inp" value={form.symbols} onChange={(e) => set({ symbols: e.target.value })} placeholder="AAPL, MSFT, …" /></div>}
        <div className="bt-field"><label>From</label><input className="inp" type="date" value={form.start} min={form.uni === 'screener' ? curScreen?.first_day : undefined} max={form.uni === 'screener' ? curScreen?.last_day : undefined} onChange={(e) => set({ start: e.target.value })} /></div>
        <div className="bt-field"><label>To</label><input className="inp" type="date" value={form.end} min={form.uni === 'screener' ? curScreen?.first_day : undefined} max={form.uni === 'screener' ? curScreen?.last_day : undefined} onChange={(e) => set({ end: e.target.value })} /></div>
        <div className="bt-field"><label>Fill</label><select className="sel" value={form.fill} onChange={(e) => set({ fill: e.target.value })}>{fills.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
        <div className="bt-field"><label>Cost (bps/side)</label><input className="inp num" type="number" value={form.costBps} onChange={(e) => set({ costBps: +e.target.value })} /></div>
        {!isIntraday && <div className="bt-field"><label>Accounting</label><select className="sel" value={form.mode} onChange={(e) => set({ mode: e.target.value })}><option value="account">account ($)</option><option value="unit">unit (%)</option></select></div>}
        {!isIntraday && form.mode === 'account' && <>
          <div className="bt-field"><label>Start $</label><input className="inp num" type="number" value={form.startEquity} onChange={(e) => set({ startEquity: +e.target.value })} /></div>
          <div className="bt-field"><label>Risk %/trade</label><input className="inp num" type="number" step="0.25" value={form.riskPct} onChange={(e) => set({ riskPct: +e.target.value })} /></div>
        </>}
        <button className="btn primary run" onClick={run} disabled={busy}>{busy ? 'Running…' : '▶ Run backtest'}</button>
      </div>

      {note && <div className="ok-note">{note}</div>}
      {err && <div className="err">⚠ {err}</div>}
      {!result && !busy && (
        <div className="muted pad">
          {isIntraday
            ? 'Pick a strategy and a screener, then run. Your strategy trades each surfaced stock on real Polygon minute bars, from the minute it first appeared that day. Polygon’s free tier is ~5 requests/min, so the first run over a new range fetches a few stock-days and tells you how many remain — re-run to fill the rest; cached days are instant.'
            : 'Pick a strategy, a universe (a Radar screener’s picks, your shortlist, or a symbol list) and a range, then run on daily bars. Trades enter the day after the signal — the honest desk fill.'}
        </div>
      )}
      {result?.kind === 'daily' && <DailyReport rep={result.report} />}
      {result?.kind === 'intraday' && <IntradayReport rep={result.report} trades={result.trades} />}

      {history.length > 0 && (
        <div className="bt-history">
          <div className="muted small">Recent runs</div>
          {history.map((r) => (
            <button key={r.id} className="hist-row" onClick={() => openPast(r.id, r.kind)}>
              <span className="hn">{r.name}{r.kind === 'intraday' ? ' · intraday' : ''}</span>
              {r.kind === 'intraday'
                ? <span className="hm">{typeof r.headline === 'string' ? r.headline : ''}</span>
                : <span className="hm">{r.headline ? `${r.headline.trades} trades · ${fmt(r.headline.winRate, 0)}% · PF ${r.headline.profitFactor ?? '—'} · net ${r.money === '$' ? money(r.headline.netProfit) : pct(r.headline.netProfit)}` : ''}</span>}
              <span className="hd muted">{dateOf(Math.floor(new Date(r.created_at).getTime() / 1000))}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
