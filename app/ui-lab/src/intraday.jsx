// Trade-Disk — TradeLab "Intraday backtest". The one the request was really about:
// take a SAVED strategy and run it on real 1-minute bars over the stocks a screen
// actually surfaced, on real days — point-in-time (a stock is tradeable only from the
// minute it first appeared that day). Minute bars come from Polygon (free ≈5/min), so
// a run is cache-first and tells you how many stock-days still need bars; re-run to
// fetch more. Nothing is faked — coverage says exactly what it traded over.
import React, { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { cls, fmt, signed, pct } from './lib.js';

const FILLS = [
  { id: 'next_open', label: 'Next minute open (realistic)' },
  { id: 'close', label: 'Signal-bar close' },
  { id: 'desk', label: 'Desk fill' },
];

// cumulative-R sparkline (green/red by final sign), zero line shaded.
function CurveR({ curve }) {
  if (!curve?.length) return null;
  const w = 100, h = 34, n = curve.length;
  let lo = Math.min(0, ...curve), hi = Math.max(0, ...curve); const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
  const x = (i) => (n < 2 ? 0 : (i / (n - 1)) * w);
  const y = (v) => h - ((v - lo) / (hi - lo)) * h;
  const line = curve.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg className="rp-curve" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1={y(0)} x2={w} y2={y(0)} className="rp-zero" />
      <path d={line} fill="none" className={curve.at(-1) >= 0 ? 'rp-up' : 'rp-dn'} />
    </svg>
  );
}
const Tile = ({ label, value, c, hint }) => <div className="tile" title={hint || ''}><small>{label}</small><b className={c}>{value}</b></div>;

function Report({ rep, trades }) {
  if (!rep) return null;
  const C = rep.counts, f = rep.fetch;
  return (
    <div className="report rp-report">
      <div className="rp-headline">{rep.headline}</div>

      {f && (
        <div className={cls('id-fetch', f.missing ? 'warn' : 'ok')}>
          <b>{f.cached}</b> of <b>{f.consideredThisRun}</b> stock-days have minute bars
          {f.fetchedThisRun ? <> · fetched <b>{f.fetchedThisRun}</b> this run</> : null}
          <div className="muted small">{f.note}{f.capped ? ` ${f.capped}` : ''}</div>
        </div>
      )}

      <div className="tiles">
        <Tile label="Trades" value={C.trades} hint="Entries the strategy took, from the minute each stock first appeared" />
        <Tile label="Win rate" value={rep.winRate == null ? '—' : Math.round(rep.winRate * 100) + '%'} c={rep.winRate >= 0.5 ? 'pos' : ''} hint="Wins ÷ (wins+losses), by R sign" />
        <Tile label="Expectancy" value={rep.expectancyR == null ? '—' : signed(rep.expectancyR, 2) + 'R'} c={rep.expectancyR > 0 ? 'pos' : rep.expectancyR < 0 ? 'neg' : ''} hint="Average R per trade (R = the strategy's own stop)" />
        <Tile label="Total" value={signed(rep.totalR, 1) + 'R'} c={rep.totalR > 0 ? 'pos' : rep.totalR < 0 ? 'neg' : ''} />
        <Tile label="Avg return" value={pct(rep.avgReturnPct)} c={rep.avgReturnPct > 0 ? 'pos' : rep.avgReturnPct < 0 ? 'neg' : ''} hint="Average raw % per trade, after costs" />
        <Tile label="Profit factor" value={rep.profitFactor == null ? '—' : (rep.profitFactor === Infinity ? '∞' : fmt(rep.profitFactor, 2))} c={rep.profitFactor >= 1.5 ? 'pos' : ''} />
        <Tile label="Max drawdown" value={signed(rep.maxDrawdownR, 1) + 'R'} c="neg" />
      </div>

      <div className="rp-buckets">
        <span className="rp-b pos"><b>{C.wins}</b> win</span>
        <span className="rp-b neg"><b>{C.losses}</b> loss</span>
        {C.scratch ? <span className="rp-b open"><b>{C.scratch}</b> scratch</span> : null}
      </div>

      {rep.equityCurveR?.length > 0 && (
        <div className="rp-curve-wrap">
          <div className="rep-h">Cumulative R <span className="muted">· {trades?.length || 0} trades in order</span></div>
          <CurveR curve={rep.equityCurveR} />
        </div>
      )}

      {rep.notes?.length > 0 && <ul className="rp-notes">{rep.notes.map((t, i) => <li key={i}>{t}</li>)}</ul>}

      <details className="trades-wrap"><summary>{trades?.length ? `All ${trades.length} trades` : 'Trades'}</summary>
        <div className="tbl-scroll"><table className="trades"><thead><tr><th>Day</th><th>Seen</th><th>Entry&nbsp;@</th><th>Ticker</th><th>Side</th><th>Entry</th><th>Exit</th><th>Return</th><th>R</th><th>Why</th></tr></thead>
          <tbody>{(trades || []).map((t, i) => (
            <tr key={i}><td>{t.day}</td><td className="muted">{t.firstSeen || '—'}</td><td className="muted">{t.entryEt || '—'}</td><td>{t.ticker}</td>
              <td className="muted">{t.side}</td><td>{fmt(t.entry)}</td><td>{fmt(t.exit)}</td>
              <td className={t.ret > 0 ? 'pos' : t.ret < 0 ? 'neg' : 'muted'}>{pct(t.ret)}</td>
              <td className={t.r > 0 ? 'pos' : t.r < 0 ? 'neg' : 'muted'}>{signed(t.r, 2)}</td>
              <td className="pt-reason">{t.reason}</td></tr>
          ))}</tbody></table></div>
      </details>
    </div>
  );
}

export default function Intraday({ doc, saved }) {
  const [screens, setScreens] = useState(null);
  const [key, setKey] = useState(null);            // { hasKey, masked }
  const [keyInput, setKeyInput] = useState('');
  const [form, setForm] = useState({ screen: '', start: '', end: '', strat: '__current__', fill: 'next_open', costBps: 2 });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [note, setNote] = useState(null);
  const [history, setHistory] = useState([]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    api.intradayScreens().then((rows) => {
      setScreens(rows);
      if (rows[0]) setForm((f) => ({ ...f, screen: rows[0].screen, start: rows[0].first_day || '', end: rows[0].last_day || '' }));
    }).catch((e) => setErr(String(e.message || e)));
    api.intradayKey().then(setKey).catch(() => setKey({ hasKey: false }));
    api.intradayRuns().then(setHistory).catch(() => {});
  }, []); // eslint-disable-line

  // default the strategy picker to the saved strategy currently open in the builder
  useEffect(() => { if (doc?.id && (saved || []).some((s) => s.id === doc.id)) setForm((f) => ({ ...f, strat: doc.id })); }, [doc?.id, saved]);

  const current = useMemo(() => (screens || []).find((s) => s.screen === form.screen) || null, [screens, form.screen]);

  async function saveKey() {
    const v = keyInput.trim(); if (!v) return;
    setBusy(true); setErr(null);
    try { const r = await api.saveIntradayKey(v); setKey(r); setKeyInput(''); setNote('Polygon key saved.'); setTimeout(() => setNote(null), 2500); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }

  async function run() {
    if (!form.screen) return;
    setBusy(true); setErr(null);
    try {
      let strategy = doc;
      if (form.strat !== '__current__') { const s = await api.strategy(form.strat); strategy = s?.doc; }
      if (!strategy) throw new Error('pick a strategy to run');
      const out = await api.runIntraday({ screen: form.screen, start: form.start, end: form.end, fill: form.fill, costBps: +form.costBps || 0, strategy });
      setResult({ report: out.report, trades: out.trades });
      api.intradayRuns().then(setHistory).catch(() => {});
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }
  async function openPast(id) {
    setBusy(true); setErr(null);
    try { const r = await api.getBacktest(id); if (r) setResult({ report: r.report, trades: r.trades }); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }

  if (!screens) return <div className="muted pad">{err ? <span className="err">⚠ {err}</span> : 'Loading screens…'}</div>;

  return (
    <div className="bt rp id">
      <div className="id-key">
        <span className="muted small">Polygon API key</span>
        {key?.hasKey && <span className="id-key-ok">✓ saved {key.masked ? <code>{key.masked}</code> : null}</span>}
        <input className="inp" type="password" autoComplete="off" placeholder={key?.hasKey ? 'Replace key…' : 'Paste your Polygon key'} value={keyInput} onChange={(e) => setKeyInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveKey()} />
        <button className="btn" onClick={saveKey} disabled={busy || !keyInput.trim()}>Save key</button>
        <a className="muted small" href="https://polygon.io/dashboard/keys" target="_blank" rel="noreferrer">get a free key ↗</a>
      </div>

      {!screens.length ? (
        <div className="muted pad">No screens with recorded history yet. The intraday backtest runs over the stocks a screen surfaced on real days — import or collect that daily record first.</div>
      ) : (
        <>
          <div className="bt-form">
            <div className="bt-field wide">
              <label>Strategy</label>
              <select className="sel" value={form.strat} onChange={(e) => set({ strat: e.target.value })}>
                <option value="__current__">Current builder strategy — “{doc?.name || 'Untitled'}”</option>
                {(saved || []).map((s) => <option key={s.id} value={s.id}>{s.name}{s.side ? ` · ${s.side}` : ''}</option>)}
              </select>
            </div>
            <div className="bt-field wide">
              <label>Screen</label>
              <select className="sel" value={form.screen} onChange={(e) => { const s = screens.find((x) => x.screen === e.target.value); if (s) set({ screen: s.screen, start: s.first_day || '', end: s.last_day || '' }); }}>
                {screens.map((s) => <option key={s.screen} value={s.screen}>{s.name} — {s.members} picks · {s.days}d · {s.src}</option>)}
              </select>
            </div>
            <div className="bt-field"><label>From</label><input className="inp" type="date" value={form.start} min={current?.first_day} max={current?.last_day} onChange={(e) => set({ start: e.target.value })} /></div>
            <div className="bt-field"><label>To</label><input className="inp" type="date" value={form.end} min={current?.first_day} max={current?.last_day} onChange={(e) => set({ end: e.target.value })} /></div>
            <div className="bt-field"><label>Entry fill</label><select className="sel" value={form.fill} onChange={(e) => set({ fill: e.target.value })}>{FILLS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
            <div className="bt-field"><label>Cost (bps/side)</label><input className="inp num" type="number" step="1" min="0" value={form.costBps} onChange={(e) => set({ costBps: e.target.value })} /></div>
            <button className="btn primary run" onClick={run} disabled={busy || !key?.hasKey} title={key?.hasKey ? '' : 'Add your Polygon key first'}>{busy ? 'Running…' : '▶ Run backtest'}</button>
          </div>
          {!key?.hasKey && <div className="muted small pad">Add your Polygon API key above to fetch the minute bars (free tier is fine — ≈5 requests/min).</div>}
        </>
      )}

      {note && <div className="ok-note">{note}</div>}
      {err && <div className="err">⚠ {err}</div>}
      {!result && !busy && screens.length > 0 && key?.hasKey && (
        <div className="muted pad">Pick a strategy, a screen and a date range, then run. Your strategy trades each surfaced stock on real 1-minute bars, from the minute it first appeared that day. Minute bars come from Polygon (≈5/min free), so the first run over a new range fetches a few days and tells you how many remain — re-run to fill the rest; cached days are instant.</div>
      )}
      {result && <Report rep={result.report} trades={result.trades} />}

      {history.length > 0 && (
        <div className="bt-history">
          <div className="muted small">Recent intraday backtests</div>
          {history.map((r) => (
            <button key={r.id} className="hist-row" onClick={() => openPast(r.id)}>
              <span className="hn">{r.name}</span>
              {r.headline && <span className="hm muted">{r.headline}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
