// Trade-Disk — TradeLab backtest panel + report. Runs the current strategy over a
// universe and a date range through the one engine, then shows the honest report:
// headline stats, the equity curve with its drawdown, the R-multiple spread, the
// trades and the coverage. Every number says whether it is unit % or account $.
import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { api } from './api.js';
import { cls, fmt, signed, pct, money, dateOf } from './lib.js';

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
const today = () => new Date().toISOString().slice(0, 10);
const yearsAgo = (y) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); return d.toISOString().slice(0, 10); };

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
    // drawdown shading from running peak
    let peak = curve[0].equity; g.fillStyle = css('--red'); g.globalAlpha = .1; g.beginPath(); g.moveTo(x(0), y(curve[0].equity));
    const base = []; curve.forEach((pt, i) => { peak = Math.max(peak, pt.equity); base.push(peak); });
    curve.forEach((pt, i) => g.lineTo(x(i), y(pt.equity))); for (let i = n - 1; i >= 0; i--) g.lineTo(x(i), y(base[i])); g.closePath(); g.fill(); g.globalAlpha = 1;
    // equity line
    const up = curve.at(-1).equity >= curve[0].equity; g.strokeStyle = up ? css('--green') : css('--red'); g.lineWidth = 2; g.beginPath();
    curve.forEach((pt, i) => (i ? g.lineTo(x(i), y(pt.equity)) : g.moveTo(x(i), y(pt.equity)))); g.stroke();
  }, [curve, w, isMoney]);
  return <div ref={wrap} className="eq"><canvas ref={cv} /></div>;
}

function Tile({ label, value, cls: c }) { return <div className="tile"><small>{label}</small><b className={c}>{value}</b></div>; }

function Report({ rep }) {
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
            best {fv(h.largestWin)} / worst {fv(h.largestLoss)} · streaks W{rep.equity.maxWinStreak}/L{rep.equity.maxLossStreak} ·
            Sortino {rep.ratios.sortino ?? '—'} · Calmar {rep.ratios.calmar ?? '—'}
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
      <div className="muted small cov">Coverage: {rep.coverage.withBars}/{rep.coverage.requested} symbols had data{rep.coverage.empty.length ? ` · no bars: ${rep.coverage.empty.join(', ')}` : ''}{rep.account ? ` · skipped (no stop): ${rep.account.skippedNoStop}, (buying power): ${rep.account.skippedNoBuyingPower}` : ''}</div>

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

export default function Backtest({ doc, trades }) {
  const [form, setForm] = useState({ universe: 'AAPL, MSFT, NVDA, AMD, GOOGL, META, AMZN, TSLA', useShortlist: false, start: yearsAgo(2), end: today(), fill: doc?.fill || 'desk', costBps: 2, mode: 'account', startEquity: 10000, riskPct: 1, feePerShare: 0.005, feeMin: 1 });
  const [rep, setRep] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null);
  const [history, setHistory] = useState([]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const loadHistory = () => api.backtests().then(setHistory).catch(() => {});
  useEffect(() => { loadHistory(); }, []);

  async function run() {
    setBusy(true); setErr(null);
    try {
      const spec = {
        name: doc.name, strategy: doc,
        universe: form.useShortlist ? { kind: 'shortlist' } : { kind: 'symbols', symbols: form.universe.split(/[,\s]+/).filter(Boolean) },
        start: form.start, end: form.end, fill: form.fill, costBps: +form.costBps,
        feePerShare: +form.feePerShare, feeMin: +form.feeMin,
        accounting: form.mode === 'account' ? { mode: 'account', startEquity: +form.startEquity, riskPct: +form.riskPct } : { mode: 'unit' },
      };
      const out = await api.backtest(spec);
      setRep({ ...out.report, trades: out.trades }); loadHistory();
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }
  async function openPast(id) { setBusy(true); try { const r = await api.getBacktest(id); if (r) setRep({ ...r.report, trades: r.trades }); } finally { setBusy(false); } }

  return (
    <div className="bt">
      <div className="bt-form">
        <div className="bt-field wide">
          <label>Universe</label>
          <div className="uni">
            <label className="chk"><input type="checkbox" checked={form.useShortlist} onChange={(e) => set({ useShortlist: e.target.checked })} /> my Radar shortlist</label>
            {!form.useShortlist && <input className="inp" value={form.universe} onChange={(e) => set({ universe: e.target.value })} placeholder="AAPL, MSFT, …" />}
          </div>
        </div>
        <div className="bt-field"><label>From</label><input className="inp" type="date" value={form.start} onChange={(e) => set({ start: e.target.value })} /></div>
        <div className="bt-field"><label>To</label><input className="inp" type="date" value={form.end} onChange={(e) => set({ end: e.target.value })} /></div>
        <div className="bt-field"><label>Fill</label><select className="sel" value={form.fill} onChange={(e) => set({ fill: e.target.value })}><option value="desk">desk (honest)</option><option value="close">close</option><option value="next_open">next_open</option><option value="live">live</option></select></div>
        <div className="bt-field"><label>Cost (bps/side)</label><input className="inp num" type="number" value={form.costBps} onChange={(e) => set({ costBps: +e.target.value })} /></div>
        <div className="bt-field"><label>Accounting</label><select className="sel" value={form.mode} onChange={(e) => set({ mode: e.target.value })}><option value="account">account ($)</option><option value="unit">unit (%)</option></select></div>
        {form.mode === 'account' && <>
          <div className="bt-field"><label>Start $</label><input className="inp num" type="number" value={form.startEquity} onChange={(e) => set({ startEquity: +e.target.value })} /></div>
          <div className="bt-field"><label>Risk %/trade</label><input className="inp num" type="number" step="0.25" value={form.riskPct} onChange={(e) => set({ riskPct: +e.target.value })} /></div>
        </>}
        <button className="btn primary run" onClick={run} disabled={busy}>{busy ? 'Running…' : '▶ Run backtest'}</button>
      </div>
      {err && <div className="err">⚠ {err}</div>}
      {!rep && !busy && <div className="muted pad">Build or load a strategy, set the universe and range, then run. Trades enter the day after the signal at the open and price the stop from the decision close — the honest <b>desk</b> fill.</div>}
      <Report rep={rep} />

      {history.length > 0 && (
        <div className="bt-history">
          <div className="muted small">Recent runs</div>
          {history.map((r) => (
            <button key={r.id} className="hist-row" onClick={() => openPast(r.id)}>
              <span className="hn">{r.name}</span>
              {r.headline && <span className="hm">{r.headline.trades} trades · {fmt(r.headline.winRate, 0)}% · PF {r.headline.profitFactor ?? '—'} · net {r.money === '$' ? money(r.headline.netProfit) : pct(r.headline.netProfit)}</span>}
              <span className="hd muted">{dateOf(Math.floor(new Date(r.created_at).getTime() / 1000))}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
