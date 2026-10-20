import React, { useState } from 'react';
import { f, pct, state } from './analysis-calc.js';

// The Technical tab — the selected stock's price behaviour, computed live from Yahoo
// daily bars (moving averages, momentum, volatility, ranges, support/resistance).
// Intraday-only fields (VWAP, pre-market, 5-minute structure) are not available from
// daily bars and are shown as such, not invented. Broad-market regime lives in Market.

const TIMEFRAMES = ['1M', '3M', '6M', 'YTD', '1Y'];
const Rows = ({ data }) => data.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>);
const Pill = ({ label, ok }) => <span className={`tech-pill ${ok ? 'up' : 'down'}`}>{ok ? '▲' : '▼'} {label}</span>;
const n = (v, d = 2, suf = '') => (v == null || !isFinite(v) ? '—' : (+v).toFixed(d) + suf);

// Build an SVG path from a series of closes, scaled to the viewBox.
function pathOf(series, w = 900, h = 230, pad = 8) {
  const v = (series || []).filter((x) => x != null);
  if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const step = w / (v.length - 1);
  return v.map((c, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)} ${(h - pad - ((c - lo) / span) * (h - pad * 2)).toFixed(1)}`).join(' ');
}

function RangeItem({ label, posPct }) {
  const p = Math.max(0, Math.min(100, posPct ?? 0));
  return (
    <div className="tech-range-item">
      <div className="tech-range-head"><span>{label}</span><strong>{posPct == null ? '—' : Math.round(p) + '%'}</strong></div>
      <div className="tech-range-track"><i style={{ width: `${p}%` }}></i><b style={{ left: `${p}%` }}></b></div>
      <div className="tech-range-foot"><span>low</span><span>high</span></div>
    </div>
  );
}

export function Technical({ stock, a, loading, onNav }) {
  const [tf, setTf] = useState('1Y');
  if (loading || !a || !a.technical) {
    return <div id="technical" className="pane"><div className="empty"><b>Computing technicals…</b>Reading Yahoo daily bars and calculating moving averages, momentum and ranges.</div></div>;
  }
  const d = a.technical;
  const p = d.price, up = !!d.bullish;
  const rp = d.rangePosPct || {};

  return (
    <div id="technical" className="pane">
      <div className="page-head">
        <div><div className="eyebrow">Price behaviour &amp; indicators</div><h2>Technical Analysis</h2><p className="subtitle">Live from Yahoo daily bars: moving averages, momentum, volatility, ranges and support/resistance. Intraday-only fields (VWAP, pre-market, minute structure) need an intraday feed and are marked as such.</p></div>
        <span className="tag">Live · daily bars</span>
      </div>
      <div id="technicalWorkspace">
        <div className="tech-status-row">
          <Pill label={`9MA ${state(p >= d.ema9)}`} ok={p >= d.ema9} />
          <Pill label={`13MA ${state(p >= d.ema13)}`} ok={p >= d.ema13} />
          <Pill label={`20MA ${state(p >= d.ema20)}`} ok={p >= d.ema20} />
          <Pill label={`50MA ${state(p >= d.ema50)}`} ok={p >= d.ema50} />
          <Pill label={`200MA ${state(p >= d.sma200)}`} ok={p >= d.sma200} />
          <Pill label={`5MA ${state(p >= d.sma5)}`} ok={p >= d.sma5} />
          <Pill label={`PDC ${state(p >= d.prevClose)}`} ok={p >= d.prevClose} />
          <Pill label={`OPEN ${state(p >= d.open)}`} ok={p >= d.open} />
          <span className="tech-pill neutral">RVOL {n(d.rvol20, 1)}×</span>
          <span className="tech-pill neutral">ADR {n(d.adrPct20, 1)}%</span>
        </div>
        <div className="tech-work-grid">
          <article className="card tech-card wide">
            <div className="results-top">
              <div><h3>{a.ticker} · Price &amp; Trend</h3><p className="subtitle">Price {f(p)} · daily change {pct(stock.c)} · {a.overview?.chart?.length || 0} sessions, live from Yahoo.</p></div>
              <div className="tech-timeframe" id="techTimeframes">{TIMEFRAMES.map((t) => <button key={t} className={t === tf ? 'active' : ''} onClick={() => setTf(t)}>{t}</button>)}</div>
            </div>
            <svg className="mini-chart" style={{ height: '240px' }} viewBox="0 0 900 240" preserveAspectRatio="none" aria-label={`Price chart for ${a.ticker}`}>
              <path d={pathOf(a.overview?.chart)} fill="none" stroke={up ? '#19dfa0' : '#ff6374'} strokeWidth="2.5" />
            </svg>
            <div className="legend"><span>━ Close (last ~120 sessions)</span><span style={{ color: 'var(--muted)' }}>Candles &amp; volume overlay need an intraday feed</span></div>
          </article>

          <article className="card tech-card">
            <h3>Session Price Data</h3>
            <table className="tech-table"><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>
              <Rows data={[['Price', f(p)], ['Previous close', f(d.prevClose)], ['Open', f(d.open)], ['Day high', f(d.dayHigh)], ['Day low', f(d.dayLow)], ['5-day MA', f(d.sma5)], ['Gap vs prev close', d.prevClose ? pct((d.open / d.prevClose - 1) * 100) : '—'], ['VWAP', 'Intraday feed needed']]} />
            </tbody></table>
          </article>

          <article className="card tech-card">
            <h3>Moving Averages · Values &amp; Alignment</h3>
            <table className="tech-table"><thead><tr><th>Indicator</th><th>Value</th><th>Price vs MA</th></tr></thead><tbody>
              <Rows data={[['EMA 9', f(d.ema9), state(p >= d.ema9)], ['EMA 13', f(d.ema13), state(p >= d.ema13)], ['EMA 20', f(d.ema20), state(p >= d.ema20)], ['EMA 50', f(d.ema50), state(p >= d.ema50)], ['SMA 200', f(d.sma200), state(p >= d.sma200)], ['EMA alignment', d.alignment ? '9 > 13 > 20 > 50' : 'Not aligned', d.alignment ? 'Stacked' : 'Mixed']]} />
            </tbody></table>
          </article>

          <article className="card tech-card">
            <h3>Volume &amp; Participation</h3>
            <div className="tech-kpi-grid">{[['Session volume', d.volumeSessionStr || '—'], ['Relative volume', n(d.rvol20, 1) + '×'], ['20-day avg volume', d.avgVol20Str || '—'], ['Up/down volume', n(d.upDownVolRatio, 2) + '×'], ['Float', 'Needs a holdings feed'], ['Short interest', 'Needs a holdings feed']].map((x) => <div className="tech-kpi" key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong></div>)}</div>
            <div className="data-row"><span>Market capitalization</span><strong>{d.marketCapStr || '—'}</strong></div>
            <div className="data-row"><span>Accumulation / distribution</span><strong className={d.accumulation ? 'positive' : 'negative'}>{d.accumulation ? 'Accumulation' : 'Distribution'}</strong></div>
          </article>

          <article className="card tech-card">
            <h3>Momentum Indicators</h3>
            <table className="tech-table"><thead><tr><th>Indicator</th><th>Reading</th><th>Interpretation</th></tr></thead><tbody>
              <Rows data={[
                ['RSI (14)', n(d.rsi14, 1), d.rsi14 == null ? '—' : d.rsi14 >= 70 ? 'Overbought' : d.rsi14 >= 50 ? 'Positive' : d.rsi14 >= 30 ? 'Weak' : 'Oversold'],
                ['MACD (12,26,9)', d.macd ? (d.macd.above ? 'Above signal' : 'Below signal') : '—', d.macd ? (d.macd.above ? 'Bullish' : 'Bearish') : '—'],
                ['MACD histogram', d.macd ? n(d.macd.hist, 2) : '—', d.macd && d.macd.hist >= 0 ? 'Positive' : 'Negative'],
                ['Stochastic (14,3,3)', d.stoch ? `${n(d.stoch.k, 0)} / ${n(d.stoch.d, 0)}` : '—', d.stoch && d.stoch.k >= 80 ? 'Overbought' : d.stoch && d.stoch.k >= 50 ? 'Strong' : 'Weak'],
                ['ROC (20)', n(d.roc20Pct, 1, '%'), d.roc20Pct == null ? '—' : d.roc20Pct >= 0 ? 'Positive' : 'Negative'],
              ]} />
            </tbody></table>
          </article>

          <article className="card tech-card">
            <h3>Volatility &amp; Range</h3>
            <div className="data-row"><span>ATR (14)</span><strong>{f(d.atr14)}</strong></div>
            <div className="data-row"><span>Daily move / ATR</span><strong>{n(d.dailyMoveAtr, 2)}×</strong></div>
            <div className="data-row"><span>ADR (20)</span><strong>{n(d.adrPct20, 1)}%</strong></div>
            <div className="data-row"><span>3-month return</span><strong className={d.mom3mPct >= 0 ? 'positive' : 'negative'}>{n(d.mom3mPct, 1, '%')}</strong></div>
            <div className="data-row"><span>52-week high</span><strong>{f(d.high52)}</strong></div>
            <div className="data-row"><span>52-week low</span><strong>{f(d.low52)}</strong></div>
            <div className="data-row"><span>Distance from 52-wk high</span><strong>{n(d.distFromHighPct, 1, '%')}</strong></div>
          </article>

          <article className="card tech-card">
            <h3>Range Position</h3>
            <RangeItem label="Week" posPct={rp.week} />
            <RangeItem label="Month" posPct={rp.month} />
            <RangeItem label="Quarter" posPct={rp.quarter} />
            <RangeItem label="Year" posPct={rp.year} />
          </article>

          <article className="card tech-card">
            <h3>Support, Resistance &amp; Pivot</h3>
            <div className="data-row"><span>Near support</span><strong>{f(d.support?.near)}</strong></div>
            <div className="data-row"><span>Major support</span><strong>{f(d.support?.major)}</strong></div>
            <div className="data-row"><span>Resistance 1</span><strong>{f(d.resistance?.r1)}</strong></div>
            <div className="data-row"><span>Resistance 2</span><strong>{f(d.resistance?.r2)}</strong></div>
            <div className="data-row"><span>Classic pivot</span><strong>{f(d.pivot)}</strong></div>
            <div className="tech-note">Support/resistance are recent swing highs/lows from daily bars, not confirmed chart patterns.</div>
          </article>

          <article className="card tech-card wide">
            <div className="results-top"><div><h3>Market context is shown separately</h3><p className="subtitle">This workspace describes this stock’s own price behaviour. The broad-market regime can differ — see the Market tab.</p></div><button className="linkbtn" onClick={() => onNav('market')}>Open Market dashboard →</button></div>
          </article>
        </div>
        <div className="tech-note">Computed live from Yahoo daily bars (personal-use). Intraday candles, VWAP, pre-market and minute-timeframe structure need an intraday feed and are not shown. Informational only — not a trade recommendation.</div>
      </div>
    </div>
  );
}
