import React, { useState } from 'react';
import { pmRange, pmRangePct, pmAdr } from './lib.js';
import { derive, f, pct, state } from './analysis-calc.js';

// The Technical tab — the selected stock's price behaviour only (chart, moving
// averages, VWAP, volume, momentum, volatility, ranges, levels, timeframes). Ported
// verbatim from the prototype's renderTechnical; values are a coherent illustrative
// scenario keyed to the stock's model score, not calculated market signals.

const TIMEFRAMES = ['1D', '5D', '1M', '3M', '6M', 'QTD', '1Y', '5Y', 'All'];
const PRICE_PATH = {
  up: 'M0 190 L38 172 L75 184 L112 146 L150 158 L188 129 L225 144 L263 112 L300 121 L338 98 L375 113 L413 81 L450 91 L488 72 L525 82 L563 58 L600 68 L638 45 L675 59 L713 35 L750 46 L788 27 L825 39 L862 18 L900 28',
  down: 'M0 24 L38 35 L75 30 L112 55 L150 49 L188 72 L225 65 L263 92 L300 84 L338 109 L375 101 L413 127 L450 118 L488 144 L525 134 L563 157 L600 148 L638 174 L675 164 L713 187 L750 177 L788 204 L825 195 L862 216 L900 207',
};
const EMA20_PATH = { up: 'M0 201 C160 180 260 160 420 126 S700 70 900 46', down: 'M0 40 C160 65 260 88 420 120 S700 170 900 194' };
const EMA50_PATH = { up: 'M0 214 C160 202 260 187 420 157 S700 110 900 79', down: 'M0 55 C160 80 260 104 420 139 S700 190 900 214' };

const Rows = ({ data }) => data.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>);

function Pill({ label, ok }) {
  return <span className={`tech-pill ${ok ? 'up' : 'down'}`}>{ok ? '▲' : '▼'} {label}</span>;
}

function RangeItem({ label, lo, hi, p }) {
  const position = Math.max(0, Math.min(100, ((p - lo) / (hi - lo)) * 100));
  return (
    <div className="tech-range-item">
      <div className="tech-range-head"><span>{label}</span><strong>{Math.round(position)}%</strong></div>
      <div className="tech-range-track"><i style={{ width: `${position}%` }}></i><b style={{ left: `${position}%` }}></b></div>
      <div className="tech-range-foot"><span>L {f(lo)}</span><span>H {f(hi)}</span></div>
    </div>
  );
}

export function Technical({ stock, onNav, onToast }) {
  const s = stock;
  const d = derive(s);
  const { p, bullish, ema, ma5, vwap, prev, open, high, low, pmh, pml, atr, moveAtr } = d;
  const [tf, setTf] = useState('1D');
  const onTf = (t) => { setTf(t); onToast('Selected ' + t + ' timeframe. Chart remains illustrative; no live data is connected.'); };

  return (
    <div id="technical" className="pane">
      <div className="page-head">
        <div><div className="eyebrow">Price behaviour &amp; indicators</div><h2>Technical Analysis</h2><p className="subtitle">Selected-stock price action only: chart, moving averages, VWAP, volume, momentum, volatility, support/resistance and timeframes. Broad-market regime and sector classification live in the Market tab.</p></div>
        <span className="tag">Fictional demo readings</span>
      </div>
      <div id="technicalWorkspace">
        <div className="tech-status-row">
          <Pill label={`9MA ${state(p >= ema[9])}`} ok={p >= ema[9]} />
          <Pill label={`13MA ${state(p >= ema[13])}`} ok={p >= ema[13]} />
          <Pill label={`20MA ${state(p >= ema[20])}`} ok={p >= ema[20]} />
          <Pill label={`50MA ${state(p >= ema[50])}`} ok={p >= ema[50]} />
          <Pill label={`5MA ${state(p >= ma5)}`} ok={p >= ma5} />
          <Pill label={`VWAP ${state(p >= vwap)}`} ok={p >= vwap} />
          <Pill label={`PDC ${state(p >= prev)}`} ok={p >= prev} />
          <Pill label={`OPEN ${state(p >= open)}`} ok={p >= open} />
          <Pill label={`PMH ${p >= pmh ? 'ABOVE' : 'BELOW'}`} ok={p >= pmh} />
          <Pill label={`PML ${p >= pml ? 'ABOVE' : 'BELOW'}`} ok={p >= pml} />
          <span className="tech-pill neutral">PM/ADR {pmAdr(s).toFixed(2)}×</span>
        </div>
        <div className="tech-work-grid">
          <article className="card tech-card wide">
            <div className="results-top">
              <div><h3>{s.t} · Price, Candles &amp; Volume</h3><p className="subtitle">Price {f(p)} · daily change {pct(s.c)} · all chart points are illustrative.</p></div>
              <div className="tech-timeframe" id="techTimeframes">{TIMEFRAMES.map((t) => <button key={t} className={t === tf ? 'active' : ''} onClick={() => onTf(t)}>{t}</button>)}</div>
            </div>
            <svg className="mini-chart" style={{ height: '240px' }} viewBox="0 0 900 240" preserveAspectRatio="none" aria-label={`Illustrative price chart for ${s.t}`}>
              <path d={bullish ? PRICE_PATH.up : PRICE_PATH.down} fill="none" stroke={bullish ? '#19dfa0' : '#ff6374'} strokeWidth="3" />
              <path d={bullish ? EMA20_PATH.up : EMA20_PATH.down} fill="none" stroke="#b9a1ff" strokeWidth="2" />
              <path d={bullish ? EMA50_PATH.up : EMA50_PATH.down} fill="none" stroke="#ffad43" strokeWidth="2" />
              <g fill="#167cff" opacity=".7">{Array.from({ length: 24 }, (_, i) => { const h = 12 + ((i * 13 + 7) % 40); return <rect key={i} x={8 + i * 37} y={235 - h} width="18" height={h} />; })}</g>
            </svg>
            <div className="legend"><span>━ Price</span><span style={{ color: 'var(--purple)' }}>━ EMA 20</span><span style={{ color: 'var(--orange)' }}>━ EMA 50</span><span style={{ color: '#68aaff' }}>▮ Volume</span></div>
          </article>

          <article className="card tech-card">
            <h3>Full Session Price Data</h3>
            <table className="tech-table"><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>
              <Rows data={[['Price', f(p)], ['Previous close (PDC)', f(prev)], ['Open', f(open)], ['Day high', f(high)], ['Day low', f(low)], ['VWAP', f(vwap)], ['5-day MA', f(ma5)], ['Gap vs previous close', pct((open / prev - 1) * 100)]]} />
            </tbody></table>
            <div className="tech-note">Open, high, low, VWAP and moving averages are a coherent fictional snapshot for this selected demo symbol.</div>
          </article>

          <article className="card tech-card">
            <h3>Moving Averages · Values, Status &amp; Alignment</h3>
            <table className="tech-table"><thead><tr><th>Indicator</th><th>Value</th><th>Price vs MA</th></tr></thead><tbody>
              <Rows data={[['EMA 9', f(ema[9]), state(p >= ema[9])], ['EMA 13', f(ema[13]), state(p >= ema[13])], ['EMA 20', f(ema[20]), state(p >= ema[20])], ['EMA 50', f(ema[50]), state(p >= ema[50])], ['SMA 200', f(ema[200]), state(p >= ema[200])], ['EMA alignment', bullish ? '9 > 13 > 20 > 50' : '9 < 13 < 20 < 50', 'Consistent']]} />
            </tbody></table>
            <p className="subtitle">The badge row, values and alignment all use the same illustrative trend scenario.</p>
          </article>

          <article className="card tech-card">
            <h3>Volume, Float &amp; Participation</h3>
            <div className="tech-kpi-grid">{[['Session volume', '218.4M'], ['Relative volume', s.r.toFixed(1) + '×'], ['20-day avg volume', '35.2M'], ['Up/down volume', '1.6×'], ['Float', 'N/A · unverified'], ['Short interest', 'N/A · unverified']].map((x) => <div className="tech-kpi" key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong><em>Demo / not verified</em></div>)}</div>
            <div className="data-row"><span>Market capitalization</span><strong>{s.cap} · demo</strong></div>
            <div className="data-row"><span>Days to cover</span><strong>N/A · not verified</strong></div>
            <div className="data-row"><span>Volume vs usual</span><strong>{s.r >= 2 ? 'Elevated' : 'Near / below normal'} · demo</strong></div>
            <div className="data-row"><span>Accumulation / distribution</span><strong className={bullish ? 'positive' : 'negative'}>{bullish ? 'Positive' : 'Negative'} · demo</strong></div>
          </article>

          <article className="card tech-card">
            <h3>Momentum Indicators</h3>
            <table className="tech-table"><thead><tr><th>Indicator</th><th>Demo reading</th><th>Interpretation</th></tr></thead><tbody>
              <Rows data={[['RSI (14)', bullish ? '64.8' : '38.6', bullish ? 'Positive' : 'Weak'], ['MACD (12,26,9)', bullish ? 'Above signal' : 'Below signal', bullish ? 'Bullish' : 'Bearish'], ['MACD histogram', bullish ? '+0.84' : '−0.64', bullish ? 'Positive' : 'Negative'], ['Stochastic (14,3,3)', bullish ? '78 / 72' : '31 / 39', bullish ? 'Strong' : 'Weak'], ['ROC (20)', bullish ? '+12.4%' : '−8.2%', bullish ? 'Positive' : 'Negative']]} />
            </tbody></table>
            <p className="subtitle">Indicator readings are illustrative; not computed from the chart points.</p>
          </article>

          <article className="card tech-card">
            <h3>Technical Volatility, Range &amp; Pre-Market · Full Detail</h3>
            <div className="data-row"><span>ATR (14)</span><strong>{f(atr)} · {s.adr.toFixed(1)}%</strong></div>
            <div className="data-row"><span>Daily move / ATR</span><strong>{moveAtr.toFixed(2)}×</strong></div>
            <div className="data-row"><span>ADR (20)</span><strong>{s.adr.toFixed(1)}%</strong></div>
            <div className="data-row"><span>Pre-market high (PMH)</span><strong>{f(pmh)}</strong></div>
            <div className="data-row"><span>Pre-market low (PML)</span><strong>{f(pml)}</strong></div>
            <div className="data-row"><span>Pre-market range</span><strong>{f(pmRange(s))} · {pmRangePct(s).toFixed(2)}%</strong></div>
            <div className="data-row"><span>Pre-market / ADR</span><strong>{pmAdr(s).toFixed(2)}×</strong></div>
          </article>

          <article className="card tech-card">
            <h3>Range Position · Week / Month / Quarter / Year</h3>
            <RangeItem label="Week" lo={p * 0.94} hi={p * 1.04} p={p} />
            <RangeItem label="Month" lo={p * 0.90} hi={p * 1.08} p={p} />
            <RangeItem label="Quarter" lo={p * 0.82} hi={p * 1.16} p={p} />
            <RangeItem label="Year" lo={p * 0.58} hi={p * 1.32} p={p} />
            <div className="data-row"><span>All-time high (demo)</span><strong>{f(p * 1.32)}</strong></div>
            <div className="data-row"><span>Distance from ATH</span><strong>24.2% below · demo</strong></div>
          </article>

          <article className="card tech-card">
            <h3>Support, Resistance &amp; Setups</h3>
            <div className="data-row"><span>Near support</span><strong>{f(p * 0.978)}</strong></div>
            <div className="data-row"><span>Major support</span><strong>{f(p * 0.94)}</strong></div>
            <div className="data-row"><span>Resistance 1</span><strong>{f(p * 1.025)}</strong></div>
            <div className="data-row"><span>Resistance 2</span><strong>{f(p * 1.06)}</strong></div>
            <div className="data-row"><span>Pivot / breakout level</span><strong>{f(p * 1.02)} · demo</strong></div>
            <div className="data-row"><span>Breakout volume confirmation</span><strong>Not assessed</strong></div>
            <div className="tech-note">No pattern is labelled confirmed. Levels are placeholders, not support/resistance calculations.</div>
          </article>

          <article className="card tech-card">
            <h3>Multi-Timeframe Structure</h3>
            <table className="tech-table"><thead><tr><th>Timeframe</th><th>Structure</th><th>Note</th></tr></thead><tbody>
              <Rows data={[['5-minute', bullish ? 'Bullish' : 'Bearish', 'Demo'], ['15-minute', bullish ? 'Bullish' : 'Bearish', 'Demo'], ['1-hour', bullish ? 'Bullish' : 'Bearish', 'Demo'], ['Daily', bullish ? 'Bullish' : 'Bearish', 'Demo'], ['Weekly', bullish ? 'Constructive' : 'Weak', 'Demo']]} />
            </tbody></table>
            <div className="tech-note">This is the selected stock’s technical scenario. The broad-market short-term bias can differ; that is not itself a contradiction. Every row remains demo data.</div>
          </article>

          <article className="card tech-card wide">
            <div className="results-top"><div><h3>Market context is shown separately</h3><p className="subtitle">This workspace describes this stock’s price behaviour only. Broad-market bias can differ from the stock’s own technical trend.</p></div><button className="linkbtn" onClick={() => onNav('market')}>Open Market dashboard →</button></div>
            <div className="tech-note">Do not compare the market’s short-term bias with this stock’s trend as if they were the same signal. Market regime, index snapshots and sector heatmap are maintained only in the Market tab.</div>
          </article>
        </div>
        <div className="tech-note">Important: this page is a UI prototype. Values are illustrative, not calculated from actual candles. No live data, signals, or trade recommendations are provided.</div>
      </div>
    </div>
  );
}
