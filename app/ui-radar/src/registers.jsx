// Trade-Disk — the Register browser. Pick a screener and a day to see exactly which
// stocks it surfaced that day (from the recorded daily history), then click any one to
// open the interactive chart on that exact day (intraday by default, with indicators
// and a timeframe switch). This is the "what did this screen show me, that day, and
// how did those names trade" view.
import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import ChartLab from './chartlab.jsx';

export function RegisterView() {
  const [screens, setScreens] = useState(null);
  const [screen, setScreen] = useState('');
  const [days, setDays] = useState([]);              // [{day, n}]
  const [day, setDay] = useState('');
  const [rows, setRows] = useState(null);            // stocks surfaced that day
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null);
  const [chart, setChart] = useState(null);          // { ticker, name, day }

  useEffect(() => {
    api.registerScreens().then((s) => { setScreens(s || []); if (s?.[0]) pick(s[0].screen, s); }).catch((e) => setErr(String(e.message || e)));
  }, []); // eslint-disable-line

  async function pick(scr) {
    setScreen(scr); setRows(null); setDay(''); setDays([]); setErr(null);
    try { const d = await api.registerDays(scr); setDays(d || []); if (d?.[0]) loadDay(scr, d[0].day); }
    catch (e) { setErr(String(e.message || e)); }
  }
  async function loadDay(scr, dy) {
    setDay(dy); setBusy(true); setErr(null);
    try { const r = await api.registerDay(scr, dy); setRows(r || []); }
    catch (e) { setErr(String(e.message || e)); setRows([]); } finally { setBusy(false); }
  }

  const cur = (screens || []).find((s) => s.screen === screen);
  if (!screens) return <section className="view"><div className="muted pad">{err ? <span className="err">⚠ {err}</span> : 'Loading registers…'}</div></section>;
  if (!screens.length) return <section className="view"><div className="reg-head"><h2>Registers</h2></div><div className="muted pad">No screeners with recorded history yet.</div></section>;

  return (
    <section className="view regview">
      <div className="reg-head">
        <h2>Registers</h2>
        <p className="muted">Open a screener's register for a day — the stocks it surfaced — then click one to chart that exact day.</p>
      </div>
      <div className="reg-controls">
        <label>Screener
          <select className="select" value={screen} onChange={(e) => pick(e.target.value)}>
            {screens.map((s) => <option key={s.screen} value={s.screen}>{s.name} — {s.members} picks · {s.days}d</option>)}
          </select>
        </label>
        <label>Day
          <select className="select" value={day} onChange={(e) => loadDay(screen, e.target.value)}>
            {!days.length && <option value="">No recorded days</option>}
            {days.map((d) => <option key={d.day} value={d.day}>{d.day} · {d.n} stock{d.n === 1 ? '' : 's'}</option>)}
          </select>
        </label>
        {cur && <span className="muted small">window {cur.first_day} → {cur.last_day}</span>}
      </div>

      {err && <div className="err pad">⚠ {err}</div>}
      {busy && <div className="muted pad">Loading the day's register…</div>}
      {rows && !busy && (rows.length ? (
        <div className="reg-grid">
          {rows.map((r) => (
            <button key={r.ticker} className="reg-card" onClick={() => setChart({ ticker: r.ticker, name: r.name, day })}>
              <span className="reg-tk">{r.ticker}</span>
              {r.name ? <span className="reg-nm muted">{r.name}</span> : null}
              <span className="reg-seen muted">seen {r.firstSeen || '—'}</span>
              <span className="reg-chart">chart ↗</span>
            </button>
          ))}
        </div>
      ) : <div className="muted pad">No stocks recorded on {day}.</div>)}

      {chart && <ChartLab ticker={chart.ticker} name={chart.name} day={chart.day} onClose={() => setChart(null)} />}
    </section>
  );
}
