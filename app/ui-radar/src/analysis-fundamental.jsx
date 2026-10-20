import React from 'react';

// The Fundamentals & News tab — company financials and valuation computed live from
// SEC EDGAR company facts (the same numbers filed in each 10-K/10-Q) plus the live
// market cap from Yahoo's price. Fields that free filings don't carry — gross/operating
// margin without the full income statement, balance-sheet lines, cash flow, forward
// estimates, PEG, a dated earnings calendar and per-ticker news — are shown as
// "needs a data feed", never invented. Broad-market data lives only in the Market tab.

const n = (v, d = 2, suf = '') => (v == null || !isFinite(v) ? '—' : (+v).toFixed(d) + suf);
const x2 = (v) => (v == null || !isFinite(v) ? '—' : (+v).toFixed(1) + '×');
const pctS = (v, d = 1) => (v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '') + (+v).toFixed(d) + '%');
const tone = (v) => (v == null || !isFinite(v) ? undefined : v >= 0 ? 'positive' : 'negative');
function big(v) {
  if (v == null || !isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  return '$' + (+v).toFixed(0);
}

export function Fundamental({ a, loading, onNav }) {
  if (loading || !a) {
    return <div id="fundamental" className="pane"><div className="empty"><b>Loading company financials…</b>Reading SEC EDGAR filings (EPS, revenue, net income, margins) for this company.</div></div>;
  }
  const fnd = a.fundamental || {};
  const annRev = fnd.annualRevenue || [];
  const annEps = fnd.annualEps || [];
  const qRev = fnd.quarterlyRevenue || [];
  // merge annual revenue + EPS by fiscal year for one history table (newest first, last 5)
  const fys = [...new Set([...annRev.map((r) => r.fy), ...annEps.map((e) => e.fy)])].sort((a, b) => b - a).slice(0, 5);
  const revByFy = Object.fromEntries(annRev.map((r) => [r.fy, r.value]));
  const epsByFy = Object.fromEntries(annEps.map((e) => [e.fy, e.value]));
  const latestQRev = qRev.length ? qRev[qRev.length - 1] : null;

  return (
    <div id="fundamental" className="pane">
      <div className="page-head">
        <div><div className="eyebrow">Company performance, valuation &amp; catalysts</div><h2>Fundamentals &amp; News</h2><p className="subtitle">Financial health, valuation and earnings — live from SEC EDGAR filings. Broad market conditions live in the separate Market tab.</p></div>
        {fnd.available
          ? <span className="demo" style={{ color: '#5df0b7', borderColor: '#1a6555', background: '#0c302a' }}>● LIVE · SEC EDGAR</span>
          : <span className="demo">SEC data unavailable</span>}
      </div>

      {!fnd.available ? <div className="notice">No SEC EDGAR company facts were found for this ticker (ADRs, recent listings and some funds don’t file US-GAAP XBRL). Market cap is still live from price; the rest needs a filings feed.</div> : null}

      <div className="detailgrid">
        <article className="card detailcard" style={{ gridColumn: '1/-1' }}>
          <h3>Company &amp; Valuation Snapshot</h3>
          <div className="detailgrid">
            <div className="metric"><small>Market Capitalization</small><strong>{fnd.marketCapStr || '—'}</strong></div>
            <div className="metric"><small>P/E · TTM</small><strong>{x2(fnd.pe)}</strong></div>
            <div className="metric"><small>Forward P/E</small><strong>{fnd.forwardPe == null ? 'Needs estimates feed' : x2(fnd.forwardPe)}</strong></div>
            <div className="metric"><small>Price / Sales · TTM</small><strong>{x2(fnd.ps)}</strong></div>
            <div className="metric"><small>EPS · TTM</small><strong>{fnd.epsTtm == null ? '—' : '$' + n(fnd.epsTtm)}</strong></div>
            <div className="metric"><small>PEG</small><strong>{fnd.peg == null ? 'Needs estimates feed' : n(fnd.peg)}</strong></div>
          </div>
          <p>P/E, P/S and EPS are trailing-twelve-month, from the latest four filed quarters. Period, currency and as-of date: {fnd.source || 'SEC EDGAR'}{fnd.asOf ? ` · as of ${fnd.asOf}` : ''}.</p>
        </article>

        <article className="card detailcard">
          <h3>Revenue &amp; Earnings</h3>
          <div className="data-row"><span>Revenue · TTM</span><strong>{fnd.revenueTtmStr || '—'}</strong></div>
          <div className="data-row"><span>Revenue growth · YoY</span><strong className={tone(fnd.revenueYoyPct)}>{pctS(fnd.revenueYoyPct)}</strong></div>
          <div className="data-row"><span>Latest quarter revenue · YoY</span><strong className={tone(fnd.revenueQoqYoyPct)}>{pctS(fnd.revenueQoqYoyPct)}</strong></div>
          <div className="data-row"><span>EPS growth · YoY (latest Q)</span><strong className={tone(fnd.epsYoyPct)}>{pctS(fnd.epsYoyPct)}</strong></div>
          <div className="data-row"><span>Latest quarter revenue</span><strong>{latestQRev ? `${big(latestQRev.value)} · ${latestQRev.label}` : '—'}</strong></div>
          <div className="data-row"><span>Net income · TTM</span><strong>{fnd.netIncomeTtmStr || '—'}</strong></div>
          <p>Quarterly and annual periods are kept separate; all are reported results, never estimates.</p>
        </article>

        <article className="card detailcard">
          <h3>Profitability</h3>
          <div className="data-row"><span>Net margin · TTM</span><strong className={tone(fnd.netMargin)}>{n(fnd.netMargin, 1, '%')}</strong></div>
          <div className="data-row"><span>Return on equity</span><strong className={tone(fnd.roe)}>{n(fnd.roe, 1, '%')}</strong></div>
          <div className="data-row"><span>Gross margin</span><strong>{fnd.grossMargin == null ? 'Needs full income stmt' : n(fnd.grossMargin, 1, '%')}</strong></div>
          <div className="data-row"><span>Operating margin</span><strong>{fnd.operatingMargin == null ? 'Needs full income stmt' : n(fnd.operatingMargin, 1, '%')}</strong></div>
          <div className="data-row"><span>Operating / free cash flow</span><strong>Needs cash-flow statement</strong></div>
          <p>Net margin and ROE are computed from filed net income, revenue and equity. Gross/operating margin need the full income-statement breakdown.</p>
        </article>

        <article className="card detailcard">
          <h3>Annual History</h3>
          {fys.length ? (
            <table className="cs-table"><thead><tr><th>Fiscal Year</th><th>Revenue</th><th>EPS (diluted)</th></tr></thead>
              <tbody>{fys.map((fy) => <tr key={fy}><td>{fy}</td><td>{big(revByFy[fy])}</td><td>{epsByFy[fy] == null ? '—' : '$' + n(epsByFy[fy])}</td></tr>)}</tbody>
            </table>
          ) : <div className="data-row"><span>Annual filings</span><strong>—</strong></div>}
          <p className="subtitle" style={{ fontSize: '10px', marginTop: '6px' }}>From 10-K filings · {fnd.source || 'SEC EDGAR'}.</p>
        </article>

        <article className="card detailcard">
          <h3>Share Structure &amp; Balance Sheet</h3>
          <div className="data-row"><span>Diluted shares</span><strong>{fnd.sharesStr || '—'}</strong></div>
          <div className="data-row"><span>Cash &amp; equivalents</span><strong>Needs balance sheet</strong></div>
          <div className="data-row"><span>Total debt</span><strong>Needs balance sheet</strong></div>
          <div className="data-row"><span>Debt / equity</span><strong>Needs balance sheet</strong></div>
          <div className="data-row"><span>Float / short interest</span><strong>Needs a holdings feed</strong></div>
          <p>Missing data stays unavailable — never read as zero or as a positive/negative finding.</p>
        </article>

        <article className="card detailcard">
          <h3>Economic &amp; Event Calendar</h3>
          <div className="data-row"><span>Next earnings</span><strong>{fnd.nextEarnings || 'Needs an events feed'}</strong></div>
          <div className="data-row"><span>Fed / rates events</span><strong>Calendar feed not connected</strong></div>
          <div className="data-row"><span>Inflation / jobs releases</span><strong>Calendar feed not connected</strong></div>
          <div className="notice">Event dates need a sourced, timestamped calendar feed, which isn’t wired on free data.</div>
        </article>

        <article className="card detailcard" style={{ gridColumn: '1/-1' }}>
          <div className="results-top"><div><h3>Market Context · Reference Only</h3><p className="subtitle">Market-wide regime, index performance, breadth, sector heatmap and industry-group rankings have one source of truth: the Market tab.</p></div><button className="linkbtn" onClick={() => onNav('market')}>Open Market dashboard →</button></div>
          <p className="subtitle">This page does not repeat or independently classify the overall market. The seven-factor O’Neil interpretation lives in CAN SLIM.</p>
        </article>

        <article className="card detailcard" style={{ gridColumn: '1/-1' }}>
          <div className="results-top"><div><h3>News &amp; Catalysts</h3><p className="subtitle">Headline, source, publication time, catalyst category and relevance.</p></div><span className="tag">No live news feed</span></div>
          <div className="empty"><b>No per-ticker news feed connected</b>Free filings don’t carry a news stream. A news provider (headline, source, timestamp, catalyst label) would populate this honestly — until then it stays empty rather than showing invented headlines.</div>
        </article>

        <article className="card detailcard" style={{ gridColumn: '1/-1' }}>
          <h3>Data Provenance &amp; Confidence</h3>
          <div className="detailgrid">
            <div className="metric"><small>Company financials</small><strong>{fnd.available ? 'SEC EDGAR · live' : 'Not available'}</strong></div>
            <div className="metric"><small>Market cap &amp; price</small><strong>Yahoo · live</strong></div>
            <div className="metric"><small>News source</small><strong>Not connected</strong></div>
            <div className="metric"><small>As-of</small><strong>{fnd.asOf || a.asOf || '—'}</strong></div>
          </div>
          <p>This tab owns company fundamentals and valuation, computed from SEC filings and the live price. Market-wide data belongs to the Market tab; cash flow, balance sheet, forward estimates and news need feeds beyond free filings.</p>
        </article>
      </div>
    </div>
  );
}
