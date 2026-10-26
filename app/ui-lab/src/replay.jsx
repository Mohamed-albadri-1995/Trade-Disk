// Trade-Disk — TradeLab "Screener replay". The historical backtest that runs over
// the migrated daily record (what each paused screener actually surfaced, with
// recorded outcomes), not live bars. It answers "did this screen have an edge?"
// honestly: you pick a screen, a date range, an ATR target/stop, and — your
// point-in-time rule — an optional "only if it appeared by HH:MM" cutoff. The
// report never hides the awkward buckets (both-hit = ambiguous, neither-hit =
// open) or how much of the universe was actually tradeable.
import React, { useEffect, useState, useMemo } from 'react';
import { api } from './api.js';
import { cls, fmt, signed } from './lib.js';

const OPS = { greater: '>', egreater: '≥', less: '<', eless: '≤', equal: '=', in_range: 'in', crosses: 'crosses', above: '>', below: '<' };
const filterLine = (f) => `${f.left} ${OPS[f.operation] || f.operation} ${f.right}`;
const clockToMin = (hhmm) => { if (!hhmm) return null; const [h, m] = hhmm.split(':').map(Number); if (!Number.isFinite(h)) return null; return Math.max(0, h * 60 + (m || 0) - 570); };
const minToClock = (m) => { if (m == null) return ''; const t = 570 + m; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

// cumulative-R curve as a compact SVG sparkline, green/red by final sign, with the
// drawdown envelope from the running peak shaded under it.
function CurveR({ curve }) {
  if (!curve?.length) return null;
  const w = 100, h = 34, n = curve.length;
  let lo = Math.min(0, ...curve), hi = Math.max(0, ...curve); const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
  const x = (i) => (n < 2 ? 0 : (i / (n - 1)) * w);
  const y = (v) => h - ((v - lo) / (hi - lo)) * h;
  const line = curve.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const up = curve.at(-1) >= 0;
  const zeroY = y(0);
  return (
    <svg className="rp-curve" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1={zeroY} x2={w} y2={zeroY} className="rp-zero" />
      <path d={line} fill="none" className={up ? 'rp-up' : 'rp-dn'} />
    </svg>
  );
}

function Tile({ label, value, c, hint }) {
  return <div className="tile" title={hint || ''}><small>{label}</small><b className={c}>{value}</b></div>;
}

function Report({ rep, trades }) {
  if (!rep) return null;
  const C = rep.counts, cov = rep.coverage;
  const pf = rep.profitFactor;
  return (
    <div className="report rp-report">
      <div className="rp-headline">{rep.headline}</div>
      <div className="tiles">
        <Tile label="Trades" value={cov.traded} hint="Surfaced stocks that had a recorded outcome and passed the time cutoff" />
        <Tile label="Win rate (resolved)" value={rep.winRateResolved == null ? '—' : Math.round(rep.winRateResolved * 100) + '%'} c={rep.winRateResolved >= 0.5 ? 'pos' : ''} hint="Wins ÷ (wins+losses+ambiguous). Excludes 'open' trades whose exit isn't in the record." />
        <Tile label="Expectancy" value={rep.expectancyR == null ? '—' : signed(rep.expectancyR, 2) + 'R'} c={rep.expectancyR > 0 ? 'pos' : rep.expectancyR < 0 ? 'neg' : ''} hint="Average R per trade across all taken trades" />
        <Tile label="Total" value={signed(rep.totalR, 1) + 'R'} c={rep.totalR > 0 ? 'pos' : rep.totalR < 0 ? 'neg' : ''} />
        <Tile label="Profit factor" value={pf == null ? '—' : fmt(pf, 2)} c={pf >= 1.5 ? 'pos' : ''} />
        <Tile label="Max drawdown" value={signed(rep.maxDrawdownR, 1) + 'R'} c="neg" />
        <Tile label="Avg MFE / MAE" value={`${fmt(rep.avgMfeAtr, 2)} / ${fmt(rep.avgMaeAtr, 2)}`} hint="Average max favourable / adverse excursion, in ATR units" />
        <Tile label="Win = " value={signed(rep.rule.winR, 2) + 'R'} hint={`${rep.rule.targetAtr}-ATR target over a ${rep.rule.stopAtr}-ATR stop`} />
      </div>

      <div className="rp-buckets">
        <span className="rp-b pos"><b>{C.wins}</b> win</span>
        <span className="rp-b neg"><b>{C.losses}</b> loss</span>
        <span className="rp-b amb"><b>{C.ambiguous}</b> ambiguous</span>
        <span className="rp-b open"><b>{C.open}</b> open</span>
      </div>

      <div className="rp-curve-wrap">
        <div className="rep-h">Cumulative R <span className="muted">· {trades?.length || 0} trades in order</span></div>
        <CurveR curve={rep.equityCurveR} />
      </div>

      <div className="rp-cov muted small">
        Universe this run: <b>{cov.surfaced}</b> surfaced · <b>{cov.traded}</b> taken
        {cov.excludedLate ? <> · <b>{cov.excludedLate}</b> dropped (appeared after the cutoff)</> : null}
        {cov.noOutcome ? <> · <b>{cov.noOutcome}</b> had no recorded outcome</> : null}
      </div>

      {rep.notes?.length > 0 && <ul className="rp-notes">{rep.notes.map((t, i) => <li key={i}>{t}</li>)}</ul>}

      <details className="trades-wrap"><summary>{trades?.length ? `All ${trades.length} trades` : 'Trades'}</summary>
        <div className="tbl-scroll"><table className="trades"><thead><tr><th>Day</th><th>Seen</th><th>Ticker</th><th>Entry</th><th>MFE</th><th>MAE</th><th>Result</th><th>R</th></tr></thead>
          <tbody>{(trades || []).map((t, i) => (
            <tr key={i}><td>{t.day}</td><td className="muted">{t.firstSeen || '—'}</td><td>{t.ticker}</td><td>{fmt(t.entry)}</td>
              <td>{fmt(t.mfeAtr, 2)}</td><td>{fmt(t.maeAtr, 2)}</td>
              <td className={cls('rp-res', t.result)}>{t.result}</td>
              <td className={t.r > 0 ? 'pos' : t.r < 0 ? 'neg' : 'muted'}>{signed(t.r, 2)}</td></tr>
          ))}</tbody></table></div>
      </details>
    </div>
  );
}

export default function Replay() {
  const [screens, setScreens] = useState(null);
  const [form, setForm] = useState({ screen: '', start: '', end: '', variant: 'A', targetAtr: 1, stopAtr: 1, entryBy: '', costR: 0 });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null);
  const [history, setHistory] = useState([]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    api.replayScreens().then((rows) => {
      setScreens(rows);
      if (rows[0]) pickScreen(rows[0], rows);
    }).catch((e) => setErr(String(e.message || e)));
    api.replays().then(setHistory).catch(() => {});
  }, []); // eslint-disable-line

  function pickScreen(s, all = screens) {
    setForm((f) => ({ ...f, screen: s.screen, start: s.first_day || '', end: s.last_day || '' }));
  }
  const current = useMemo(() => (screens || []).find((s) => s.screen === form.screen) || null, [screens, form.screen]);

  async function run() {
    if (!form.screen) return;
    setBusy(true); setErr(null);
    try {
      const spec = {
        screen: form.screen, start: form.start, end: form.end, variant: form.variant,
        targetAtr: +form.targetAtr, stopAtr: +form.stopAtr,
        entryByMin: form.entryBy ? clockToMin(form.entryBy) : null, costR: +form.costR || 0,
      };
      const out = await api.runReplay(spec);
      setResult({ report: out.report, trades: out.trades });
      api.replays().then(setHistory).catch(() => {});
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }
  async function openPast(id) {
    setBusy(true); setErr(null);
    try { const r = await api.getBacktest(id); if (r) setResult({ report: r.report, trades: r.trades }); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }

  if (!screens) return <div className="muted pad">{err ? <span className="err">⚠ {err}</span> : 'Loading screens…'}</div>;
  if (!screens.length) return <div className="muted pad">No paused screens with history yet. Import the legacy record first.</div>;

  return (
    <div className="bt rp">
      <div className="bt-form">
        <div className="bt-field wide">
          <label>Screen</label>
          <select className="sel" value={form.screen} onChange={(e) => { const s = screens.find((x) => x.screen === e.target.value); if (s) pickScreen(s); }}>
            {screens.map((s) => <option key={s.screen} value={s.screen}>{s.name} — {s.members} picks · {s.src}{s.maps_to ? ` → ${s.maps_to}` : ''}</option>)}
          </select>
        </div>
        <div className="bt-field"><label>From</label><input className="inp" type="date" value={form.start} min={current?.first_day} max={current?.last_day} onChange={(e) => set({ start: e.target.value })} /></div>
        <div className="bt-field"><label>To</label><input className="inp" type="date" value={form.end} min={current?.first_day} max={current?.last_day} onChange={(e) => set({ end: e.target.value })} /></div>
        <div className="bt-field"><label>Entry variant</label><select className="sel" value={form.variant} onChange={(e) => set({ variant: e.target.value })}><option value="A">A</option><option value="B">B</option></select></div>
        <div className="bt-field"><label>Target (ATR)</label><input className="inp num" type="number" step="0.25" min="0.25" value={form.targetAtr} onChange={(e) => set({ targetAtr: e.target.value })} /></div>
        <div className="bt-field"><label>Stop (ATR)</label><input className="inp num" type="number" step="0.25" min="0.25" value={form.stopAtr} onChange={(e) => set({ stopAtr: e.target.value })} /></div>
        <div className="bt-field"><label>Only if seen by</label><input className="inp" type="time" value={form.entryBy} onChange={(e) => set({ entryBy: e.target.value })} title="Point-in-time: skip stocks that first appeared after this ET time" /></div>
        <div className="bt-field"><label>Cost (R/trade)</label><input className="inp num" type="number" step="0.05" min="0" value={form.costR} onChange={(e) => set({ costR: e.target.value })} /></div>
        <button className="btn primary run" onClick={run} disabled={busy}>{busy ? 'Running…' : '▶ Run replay'}</button>
      </div>

      {current?.filters?.length > 0 && (
        <details className="rp-what"><summary className="muted small">What “{current.name}” screened for ({current.first_day} → {current.last_day}, paused)</summary>
          <div className="rp-filters">{current.filters.map((f, i) => <code key={i}>{filterLine(f)}</code>)}</div>
        </details>
      )}

      {err && <div className="err">⚠ {err}</div>}
      {!result && !busy && <div className="muted pad">Pick a screen and a range, then run. The replay takes every stock the screen surfaced each day — from the moment it appeared — and scores the recorded outcome under your ATR target and stop. Nothing is re-simulated; these are the engine's own recorded excursions.</div>}
      {result && <Report rep={result.report} trades={result.trades} />}

      {history.length > 0 && (
        <div className="bt-history">
          <div className="muted small">Recent replays</div>
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
