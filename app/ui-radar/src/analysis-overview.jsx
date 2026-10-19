import React, { useState } from 'react';

// The Overview tab — the decision summary. It keeps only sections 1,4,5,6,7 (the
// prototype's sectionData): chart preview, news, the CAN SLIM summary, themes, and a
// market-context snapshot computed from the selected stock. Detailed metrics live in
// Technical; company data in Fundamentals.

const CHART_PATH = 'M0 120 L20 108 L40 116 L60 88 L80 96 L100 72 L120 84 L140 63 L160 72 L180 53 L200 62 L220 43 L240 55 L260 31 L280 44 L300 23 L320 34 L340 18 L360 27 L380 15 L400 22 L430 9 L460 14 L500 4';
const CS_LETTERS = ['C', 'A', 'N', 'S', 'L', 'I', 'M'];
const CS_LABELS = ['Earn.', 'Annual', 'New', 'Supply', 'Leader', 'Funds', 'Market'];

function sections(s, { onToast, setTab, onNav }) {
  return [
    { id: 1, title: 'Chart Snapshot', nav: 'Chart', desc: 'Compact price-path preview only. Full chart controls, candles, volume and timeframe analysis live in Technical Analysis.', content: (
      <>
        <div className="overview-snapshot-label">Price trend preview · illustrative; full chart controls live in Technical</div>
        <svg className="mini-chart" viewBox="0 0 500 145" preserveAspectRatio="none"><path d={CHART_PATH} fill="none" stroke="#19dfa0" strokeWidth="2.5" /></svg>
        <div className="data-row"><span>Chart timeframe</span><strong>1Y · Demo</strong></div>
      </>
    ) },
    { id: 4, title: 'Recent News', nav: 'News', desc: 'Three-line headline preview only. Company catalysts, event context, source details and the fuller news list live in Fundamental · Market · News.', content: (
      <>
        <div className="newsitem"><strong>{s.t} shares rise on strong AI / sector demand</strong><small>18m ago · Demo Newswire · source not connected</small></div>
        <div className="newsitem"><strong>Analysts review growth outlook after quarterly results</strong><small>2h ago · Demo Markets · fictional example</small></div>
        <div className="newsitem"><strong>Company roadmap update draws investor attention</strong><small>5h ago · Demo Markets · fictional example</small></div>
        <button className="linkbtn" onClick={() => onToast('External news links are not connected in this frontend prototype.')}>View all news →</button>
      </>
    ) },
    { id: 5, title: 'CAN SLIM · O’Neil', nav: 'CAN SLIM', desc: 'Compact seven-factor summary; open CAN SLIM for evidence.', content: (
      <>
        <div className="factorgrid">{CS_LETTERS.map((x, i) => <div key={x} className={`factor ${i === 2 || i === 6 ? 'warn' : ''}`}><b>{x}</b><small>{CS_LABELS[i]}</small></div>)}</div>
        <div className="data-row"><span>Relative Strength</span><strong>92 / 99 · Demo</strong></div>
        <div className="data-row"><span>7-factor summary</span><strong>78 / 100 · Demo</strong></div>
        <button className="linkbtn" onClick={() => setTab('canslim')}>Open full evidence review →</button>
      </>
    ) },
    { id: 6, title: 'Themes', nav: 'Themes', desc: 'Industry and technology tags, kept separate from scoring.', content: (
      <div className="themechips"><span>AI</span><span>Semiconductors</span><span>Data Centers</span><span>High Performance</span><span>Cloud Infrastructure</span><span>+2</span></div>
    ) },
    { id: 7, title: 'Market Context', nav: 'Market', desc: 'Compact market snapshot for the stock card. The Market tab owns the full regime model, index dashboard, sector heatmap and industry-group rankings.', content: (
      <>
        <div className="market-context-regime"><span className="market-context-dot"></span><div><strong>Extended Up</strong><small>LONG · illustrative demo</small></div></div>
        <div className="market-context-row"><span>Long term</span><strong className="positive">BULLISH</strong></div>
        <div className="market-context-row"><span>Mid term</span><strong>UPTREND</strong></div>
        <div className="market-context-row"><span>Short term</span><strong className="negative">BEARISH</strong></div>
        <div className="market-context-row"><span>Sector</span><strong className="positive">{s.sec} · BULLISH ▲ 48</strong></div>
        <div className="market-context-row"><span>Bias</span><strong><span className="market-context-auto">⦿ AUTO (long)</span></strong></div>
        <button className="linkbtn" onClick={() => onNav('market')}>Open Market dashboard →</button>
        <p className="market-context-note">Illustrative state only. Full market regime and sector metrics are maintained in the Market dashboard.</p>
      </>
    ) },
  ];
}

export function Overview({ stock, onToast, setTab, onNav }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const secs = sections(stock, { onToast, setTab, onNav });
  const toggle = (id) => setCollapsed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const jump = (id) => document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div id="overview" className="pane">
      <div className="notice analysis-ownership-note"><strong>Overview = decision summary.</strong> It keeps the chart preview, recent headlines, locked CAN SLIM summary, themes, links to the Market dashboard. The Overview has no score breakdown; scoring logic will be defined separately. All detailed price, volume, range, moving-average, momentum, volatility and pre-market metrics live only in Technical. Fundamental · Market · News owns company financials and catalysts.</div>
      <div className="sectionnav" id="sectionNav">
        {secs.map((s) => <button key={s.id} onClick={() => jump(s.id)}>{s.nav}</button>)}
      </div>
      <div className="overviewgrid" id="overviewGrid">
        {secs.map((s) => {
          const isCollapsed = collapsed.has(s.id);
          return (
            <article className="sectioncard" id={`section-${s.id}`} key={s.id}>
              <div className="sectionhead"><span>{s.title}</span><button className="linkbtn" aria-label={`Collapse ${s.title}`} onClick={() => toggle(s.id)}>{isCollapsed ? '＋' : '−'}</button></div>
              <div className={`sectionbody${isCollapsed ? ' collapsed' : ''}`}>
                <p className="subtitle" style={{ fontSize: '10px', margin: '0 0 8px' }}>{s.desc}</p>
                {s.content}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
