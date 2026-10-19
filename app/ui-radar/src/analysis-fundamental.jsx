import React from 'react';

// The Fundamentals & News tab — company financials, valuation, events and
// stock-specific news. Reproduced verbatim from the prototype's static markup; in
// the prototype these are fixed illustrative demo values (no per-stock computation),
// and the real product reads a stock_fundamental_read_snapshot (PAGES.md §3.5).
// Broad-market data has one home: the Market tab (linked, never repeated here).

const NEWS = [
  { mark: 'AI', markCls: '', kicker: 'Company / Product', time: '2h ago · demo', h: 'Illustrative headline: demand outlook for AI infrastructure remains a key driver', p: 'Potential relevance: product demand and forward revenue expectations. Verify against the original company release or news source.', tags: [['Catalyst: demand', ''], ['Source unverified', '']] },
  { mark: '$', markCls: 'purple', kicker: 'Analyst / Estimates', time: '5h ago · demo', h: 'Illustrative headline: analysts review estimates after quarterly results', p: 'Potential relevance: consensus revisions. An estimate change is not a reported company result.', tags: [['Catalyst: estimates', ''], ['Demo only', '']] },
  { mark: '!', markCls: 'gold', kicker: 'Industry / Regulation', time: '1d ago · demo', h: 'Illustrative headline: semiconductor supply-chain and export policy remain watch items', p: 'Potential relevance: supply, market access and risk. No specific event or current policy claim is being made.', tags: [['Risk watch', 'gold'], ['Source unverified', '']] },
];

export function Fundamental({ onNav }) {
  return (
    <div id="fundamental" className="pane">
      <div className="page-head">
        <div><div className="eyebrow">Company performance, valuation &amp; catalysts</div><h2>Fundamentals &amp; News</h2><p className="subtitle">Understand the company’s financial health, valuation, earnings/events and stock-specific news. Broad market conditions live in the separate Market tab.</p></div>
        <span className="tag">Fictional demo data</span>
      </div>
      <div className="detailgrid">
        <article className="card detailcard" style={{ gridColumn: '1/-1' }}>
          <h3>Company &amp; Valuation Snapshot</h3>
          <div className="detailgrid">
            <div className="metric"><small>Market Capitalization</small><strong>$3.15T</strong></div>
            <div className="metric"><small>P/E · TTM</small><strong>68.4×</strong></div>
            <div className="metric"><small>Forward P/E</small><strong>42.1×</strong></div>
            <div className="metric"><small>Price / Sales</small><strong>27.5×</strong></div>
            <div className="metric"><small>Enterprise Value</small><strong>$3.10T</strong></div>
            <div className="metric"><small>PEG</small><strong>1.8</strong></div>
          </div>
          <p>All values are fictional examples. Real ratios must display their calculation basis, reporting period, currency, source and as-of date.</p>
        </article>
        <article className="card detailcard">
          <h3>Revenue &amp; Earnings</h3>
          <div className="data-row"><span>Revenue growth YoY</span><strong className="positive">+24% · demo</strong></div>
          <div className="data-row"><span>EPS growth YoY</span><strong className="positive">+38% · demo</strong></div>
          <div className="data-row"><span>Net income trend</span><strong>Improving · demo</strong></div>
          <div className="data-row"><span>Quarterly revenue</span><strong>$30.0B · demo</strong></div>
          <div className="data-row"><span>Annual revenue trend</span><strong>Increasing · demo</strong></div>
          <p>Quarterly and annual periods should be separated; reported results must not be mixed with estimates.</p>
        </article>
        <article className="card detailcard">
          <h3>Profitability &amp; Cash Flow</h3>
          <div className="data-row"><span>Gross margin</span><strong>73.6% · demo</strong></div>
          <div className="data-row"><span>Operating margin</span><strong>61.4% · demo</strong></div>
          <div className="data-row"><span>Net margin</span><strong>55.1% · demo</strong></div>
          <div className="data-row"><span>Return on equity</span><strong>24.0% · demo</strong></div>
          <div className="data-row"><span>Operating cash flow</span><strong>$— · not populated</strong></div>
          <div className="data-row"><span>Free cash flow</span><strong>N/A</strong></div>
        </article>
        <article className="card detailcard">
          <h3>Balance Sheet &amp; Financial Health</h3>
          <div className="data-row"><span>Cash &amp; equivalents</span><strong>N/A in this demo</strong></div>
          <div className="data-row"><span>Total debt</span><strong>N/A in this demo</strong></div>
          <div className="data-row"><span>Current ratio</span><strong>N/A</strong></div>
          <div className="data-row"><span>Debt / equity</span><strong>N/A</strong></div>
          <div className="data-row"><span>Share dilution</span><strong>Requires verified history</strong></div>
          <p>Missing data stays N/A. It must not be interpreted as zero or as a positive/negative finding.</p>
        </article>
        <article className="card detailcard">
          <h3>Valuation &amp; Peer Context</h3>
          <div className="data-row"><span>Forward P/E vs peers</span><strong>Peer set required</strong></div>
          <div className="data-row"><span>Price / sales vs history</span><strong>Historical series required</strong></div>
          <div className="data-row"><span>Analyst estimates</span><strong>Separate from reported results</strong></div>
          <div className="data-row"><span>Key business risks</span><strong>Competition · cycle · execution</strong></div>
          <div className="notice">A ratio alone does not determine whether a stock is cheap or expensive. Peer, growth and historical context matter.</div>
        </article>
        <article className="card detailcard" style={{ gridColumn: '1/-1' }}>
          <div className="results-top"><div><h3>Market Context · Reference Only</h3><p className="subtitle">Market-wide regime, index performance, breadth, sector heatmap and industry-group rankings have one source of truth: the Market tab.</p></div><button className="linkbtn" onClick={() => onNav('market')}>Open Market dashboard →</button></div>
          <p className="subtitle">This stock page does not repeat or independently classify the overall market. Company-specific exposure and risks remain in Fundamentals; the seven-factor O’Neil interpretation remains in CAN SLIM.</p>
        </article>
        <article className="card detailcard">
          <h3>Economic &amp; Event Calendar</h3>
          <div className="data-row"><span>Next earnings</span><strong>Date not verified</strong></div>
          <div className="data-row"><span>Fed / rates events</span><strong>Calendar feed not connected</strong></div>
          <div className="data-row"><span>Inflation / jobs releases</span><strong>Calendar feed not connected</strong></div>
          <div className="data-row"><span>Corporate events</span><strong>Not populated in demo</strong></div>
          <div className="notice">Event dates must be sourced and timestamped. No calendar or alert integration is active in this prototype.</div>
        </article>
        <article className="card detailcard" style={{ gridColumn: '1/-1' }}>
          <div className="results-top"><div><h3>News &amp; Catalysts</h3><p className="subtitle">Headline, source, publication time, catalyst category and relevance. Example headlines are fictional placeholders.</p></div><span className="tag">No live news feed</span></div>
          <div className="news-list">
            {NEWS.map((n, i) => (
              <div className="news-item" key={i}>
                <div className={`news-mark ${n.markCls}`}>{n.mark}</div>
                <div className="news-copy">
                  <div className="news-meta"><span>{n.kicker}</span><span>{n.time}</span></div>
                  <h4>{n.h}</h4>
                  <p>{n.p}</p>
                  <div className="news-tags">{n.tags.map(([t, cls], j) => <span className={`chip ${cls}`} key={j}>{t}</span>)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="notice">Each real headline should link to its original source and show source name, timestamp/time zone, ticker relevance and catalyst label. Demo headlines are not real news.</div>
        </article>
        <article className="card detailcard" style={{ gridColumn: '1/-1' }}>
          <h3>Data Provenance &amp; Confidence</h3>
          <div className="detailgrid">
            <div className="metric"><small>Company financial data</small><strong>Not connected</strong></div>
            <div className="metric"><small>News source</small><strong>Not connected</strong></div>
            <div className="metric"><small>Corporate/event calendar</small><strong>Not connected</strong></div>
            <div className="metric"><small>Freshness timestamp</small><strong>Demo only</strong></div>
          </div>
          <p>This tab owns company fundamentals, valuation, company events and stock-specific news. Market-wide data belongs to the separate Market tab. All values are illustrative and no provider integrations are connected.</p>
        </article>
      </div>
    </div>
  );
}
