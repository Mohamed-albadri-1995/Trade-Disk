import React from 'react';

// The CAN SLIM / O'Neil tab — a seven-factor evidence review. Ported verbatim from
// the prototype's renderCanslim: a topline keyed to the selected stock, the factor
// strip, the seven factor panels (each with stats, tables and demo charts), and the
// missing-data note. All figures are fictional illustrative demo data.

const SPARK = 'M0 61 L15 51 L30 55 L45 37 L60 43 L75 29 L90 35 L105 24 L120 31 L135 17 L150 24 L165 13 L180 20 L195 10 L210 16 L225 7 L240 12 L255 5 L270 9 L285 3 L300 6 L320 1';
const STRIP = [['C', 'Strong', false], ['A', 'Strong', false], ['N', 'Mixed', true], ['S', 'Positive', false], ['L', 'Leader', false], ['I', 'Positive', false], ['M', 'Caution', true]];
const QUARTERS = [['Q2 2025', '0.68', '0.49', '+38%', '30.0', '+24%'], ['Q1 2025', '0.61', '0.47', '+29%', '26.0', '+22%'], ['Q4 2024', '0.52', '0.41', '+27%', '22.1', '+20%'], ['Q3 2024', '0.47', '0.38', '+22%', '18.1', '+17%']];
const ANNUALS = [['2025', '3.00', '+11%', '120.0', '24%'], ['2024', '2.70', '+50%', '96.3', '26%'], ['2023', '1.80', '+50%', '60.9', '21%'], ['2022', '1.20', '—', '40.2', '18%']];
const C_BARS = [['Q3 23', 0.28], ['Q4 23', 0.32], ['Q1 24', 0.36], ['Q2 24', 0.38], ['Q3 24', 0.41], ['Q4 24', 0.47], ['Q1 25', 0.61], ['Q2 25', 0.68]];
const A_BARS = [['2022', 1.2], ['2023', 1.8], ['2024', 2.7], ['2025', 3]];

const CsStat = ({ label, value, note, tone }) => (
  <div className="cs-stat"><small>{label}</small><strong className={tone || undefined}>{value}</strong>{note ? <em>{note}</em> : null}</div>
);
const CsFactor = ({ letter, title, question, status, warn, children }) => (
  <section className="cs-factor-panel">
    <div className="cs-factor-intro">
      <div className={`cs-letter ${warn ? 'warn' : ''}`}>{letter}</div>
      <div><h3>{title}</h3><p>{question}</p><span className={`cs-status ${warn ? 'warn' : ''}`}>{status}</span></div>
    </div>
    {children}
  </section>
);
const ChartBars = ({ bars, scale }) => (
  <>
    <div className="cs-chartbars">{bars.map(([l, v]) => <div className="cs-barcol" key={l}><span>{v.toFixed(2)}</span><i style={{ height: `${(v / scale) * 68}px` }}></i></div>)}</div>
    <div className="cs-chartlabels">{bars.map(([l]) => <span key={l}>{l}</span>)}</div>
  </>
);

export function Canslim({ stock }) {
  const s = stock, p = s.p;
  const nBase = [['52-Week High', '$133.00'], ['Current Price', `$${p.toFixed(2)}`], ['Distance from High', '3.5% below'], ['Base Pattern', 'Cup with Handle (demo)'], ['Base Depth', '18% (normal range)'], ['Pivot Price', '$130.00'], ['Distance from Pivot', '1.2% below'], ['Breakout Volume Confirmation', 'Not confirmed']];
  return (
    <div id="canslim" className="pane">
      <div className="page-head">
        <div><div className="eyebrow">William J. O’Neil framework</div><h2>CAN SLIM / O’Neil Analysis</h2><p className="subtitle">Seven-factor evidence review · all figures are fictional and for illustration only.</p></div>
        <span className="tag">Evidence review · not a buy signal</span>
      </div>
      <div className="canslim-page" id="canslimDetails">
        <div className="cs-topline">
          <div className="cs-markethead">
            <div>
              <div className="cs-market-price" id="csPrice">${p.toFixed(2)} <small>+{s.abs.toFixed(2)} (+{s.c.toFixed(2)}%)</small></div>
              <div className="cs-market-meta">{s.n} &nbsp;|&nbsp; NASDAQ &nbsp;|&nbsp; {s.sec}<br />After hours <b>${(p + 0.12).toFixed(2)}</b> &nbsp; <span className="positive">+0.12 (+0.09%)</span></div>
            </div>
            <svg className="cs-sparkline" viewBox="0 0 320 70" preserveAspectRatio="none"><path d={SPARK} fill="none" stroke="#20e5a4" strokeWidth="2.5" /></svg>
          </div>
          <div className="cs-factorstrip">
            <div className="cs-strip-title">7-FACTOR REVIEW (CAN SLIM)</div>
            <div className="cs-factor-pills">{STRIP.map(([l, v, w]) => <div className={`cs-factor-pill ${w ? 'warn' : ''}`} key={l}><b>{l}</b><span>{v}</span></div>)}</div>
            <div className="cs-disclaimer">Evidence review — not a buy signal.</div>
          </div>
        </div>

        <CsFactor letter="C" title="Current Quarterly Earnings" question="Are recent quarterly earnings increasing significantly?" status="Strong">
          <div className="cs-stat-grid">
            <CsStat label="Latest Quarter (Q2 2025, demo)" value="EPS +38%" note="vs. Q2 2024" tone="good" />
            <CsStat label="Sales" value="+24%" note="vs. Q2 2024" tone="good" />
            <div className="cs-evidence" style={{ gridColumn: '1/-1' }}>
              <h4>Recent Quarterly Results (EPS = earnings per share)</h4>
              <table className="cs-table"><thead><tr><th>Quarter</th><th>EPS</th><th>Year-ago EPS</th><th>YoY Growth</th><th>Sales (B)</th><th>Sales Growth</th></tr></thead>
                <tbody>{QUARTERS.map((r, ri) => <tr key={ri}>{r.map((v, i) => <td key={i} className={[3, 5].includes(i) ? 'good' : undefined}>{v}</td>)}</tr>)}</tbody></table>
            </div>
          </div>
          <div className="cs-evidence"><h4>Quarterly EPS Trend (last 8 quarters, demo)</h4><ChartBars bars={C_BARS} scale={0.7} /></div>
        </CsFactor>

        <CsFactor letter="A" title="Annual Earnings" question="Has the company grown its earnings over several years?" status="Strong">
          <div className="cs-stat-grid">
            <CsStat label="3-Year EPS CAGR (demo)" value="35.7%" note="Annualized growth" tone="good" />
            <CsStat label="Return on Equity (ROE, demo)" value="24%" note="> 17% reference level" tone="good" />
            <CsStat label="Earnings Stability (demo)" value="Consistent" note="4 of 4 years higher" tone="good" />
            <div className="cs-evidence" style={{ gridColumn: '1/-1' }}>
              <h4>Annual EPS History (fiscal year, demo)</h4>
              <table className="cs-table"><thead><tr><th>Fiscal Year</th><th>EPS</th><th>YoY Growth</th><th>Revenue (B)</th><th>ROE</th></tr></thead>
                <tbody>{ANNUALS.map((r, ri) => <tr key={ri}>{r.map((v, i) => <td key={i} className={i === 3 || i === 4 ? 'good' : undefined}>{v}</td>)}</tr>)}</tbody></table>
            </div>
          </div>
          <div className="cs-evidence"><h4>Annual EPS Trend (demo)</h4><ChartBars bars={A_BARS} scale={3.2} /></div>
        </CsFactor>

        <CsFactor letter="N" title="New Products, Services & Price Highs" question="Is something new driving the company or the stock?" status="Mixed" warn>
          <div className="cs-evidence">
            <h4>New Developments / Catalysts (demo)</h4>
            <div className="cs-minirow"><span>✦ AI chip demand remains strong</span><b>Demo</b></div>
            <p className="subtitle" style={{ fontSize: '10px', margin: '3px 0 9px' }}>Product demand related to data centers and AI.</p>
            <div className="cs-minirow"><span>✦ New product roadmap (demo)</span><b>Verify</b></div>
            <p className="subtitle" style={{ fontSize: '10px', margin: '3px 0 9px' }}>Next-generation GPU expected (verify source).</p>
            <div className="cs-minirow"><span>✦ Recent news (demo)</span><b>Sep 18, 2026</b></div>
            <p className="subtitle" style={{ fontSize: '10px', margin: '3px 0' }}>Analyst raises price target (verify source).</p>
          </div>
          <div className="cs-evidence">
            <h4>Price / Base Setup (demo)</h4>
            {nBase.map(([k, v], i) => <div className="cs-minirow" key={k}><span>{k}</span><b style={i === 2 || i === 6 || i === 7 ? { color: '#ff777f' } : undefined}>{v}</b></div>)}
          </div>
        </CsFactor>

        <CsFactor letter="S" title="Supply and Demand" question="What do share supply and trading demand show?" status="Positive">
          <div className="cs-stat-grid">
            <CsStat label="Shares Outstanding" value="24.5B" />
            <CsStat label="Float" value="1.2B" />
            <CsStat label="Float %" value="4.9%" />
            <CsStat label="Up/Down Volume Ratio" value="1.6" note="50-day, demo" tone="good" />
            <CsStat label="Short Interest" value="N/A" />
            <CsStat label="Days to Cover" value="N/A" />
          </div>
          <div className="cs-evidence">
            <h4>Accumulation / Distribution (demo)</h4>
            <strong className="good">▂ ▅ ▇ Positive</strong>
            <p className="subtitle" style={{ fontSize: '10px', marginTop: '4px' }}>More up volume than down volume in recent weeks.</p>
            <h4 style={{ marginTop: '12px' }}>Share Count Trend (demo)</h4>
            <strong className="good">◉ Stable</strong>
            <p className="subtitle" style={{ fontSize: '10px', marginTop: '4px' }}>No significant increase in shares.</p>
          </div>
        </CsFactor>

        <CsFactor letter="L" title="Leader or Laggard" question="How does the stock rank against its industry peers?" status="Leader">
          <div className="cs-stat-grid">
            <CsStat label="Relative Strength (RS, demo)" value="92 / 99" note="Percentile vs. all stocks" tone="good" />
            <CsStat label="Industry Group Rank (demo)" value="12 / 197" note="Semiconductors" tone="good" />
            <CsStat label="Industry Group" value="Semiconductors" note="Top industry group" />
            <CsStat label="Leader-Range" value="■■■■■■■■□" note="Stock is a leader in its industry group (demo)." tone="good" />
          </div>
          <div className="cs-evidence">
            <h4>Relative Strength</h4>
            <div className="cs-meter"><i style={{ width: '92%' }}></i></div>
            <p className="subtitle" style={{ fontSize: '10px' }}>RS rating 92 / 99 · fictional demo value.</p>
          </div>
        </CsFactor>

        <CsFactor letter="I" title="Institutional Sponsorship" question="What does institutional ownership show?" status="Positive">
          <div className="cs-stat-grid">
            <CsStat label="Funds Holding (demo)" value="1,420" note="+86 last quarter" tone="good" />
            <CsStat label="Institutional Ownership" value="65%" note="of shares (demo)" />
            <CsStat label="Trend" value="Increasing" note="More funds added shares" tone="good" />
            <CsStat label="Institution Quality (demo)" value="Not assessed" note="Requires detailed 13F analysis" />
          </div>
          <div className="cs-evidence">
            <h4>Important context</h4>
            <p className="subtitle" style={{ fontSize: '11px' }}>13F data is delayed (typically up to 45 days). Figures are illustrative and may not reflect the latest filings.</p>
          </div>
        </CsFactor>

        <CsFactor letter="M" title="Market Direction" question="Does the broader market support the setup?" status="Caution" warn>
          <div className="cs-stat-grid">
            <CsStat label="Market Regime (demo)" value="Uptrend" note="Confirmed uptrend" tone="good" />
            <CsStat label="Major Index Trend (demo)" value="Positive" note="Above key moving averages" tone="good" />
            <CsStat label="Distribution Days (demo)" value="3" note="In last 25 trading days" />
            <CsStat label="Price/Volume Confirmation" value="Positive" note="Market holding up (demo)" tone="good" />
          </div>
          <div className="cs-evidence">
            <h4>Market direction note</h4>
            <p className="subtitle" style={{ fontSize: '11px' }}>This is a fictional snapshot. Real evaluation needs dated major-index price/volume data and a consistent distribution-day methodology.</p>
          </div>
        </CsFactor>

        <section className="cs-missing">
          <h3>🔴 Missing or Unverified Data</h3>
          <ul>
            <li>New-product catalyst source not verified. Review original news sources.</li>
            <li>Institutional quality rating requires detailed 13F analysis and is not fully assessed.</li>
            <li>Short interest and days to cover are unavailable in this demo.</li>
            <li>All metrics shown are fictional demo data and for illustration only.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
