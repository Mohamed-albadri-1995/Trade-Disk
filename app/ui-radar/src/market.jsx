import React from 'react';

// The standalone Market dashboard. It renders the materialized market_snapshot the
// API serves (MARKET.md §3.5) and never recomputes anything. The data (indexes,
// O'Neil model layers, final regime, sector heatmap, group leadership, breadth and
// themes) comes from the snapshot; the headings, notices and footnotes are the
// prototype's fixed chrome, reproduced verbatim.
export function Market({ snapshot, onNav, onToast }) {
  if (!snapshot) {
    return (
      <section id="market" className="screen active">
        <div className="page-head"><div><div className="eyebrow">Broad-market context</div><h1>Market</h1><p className="subtitle">A structured view of major-index direction, market stage, final regime and sector leadership.</p></div></div>
        <section className="panel results"><div className="empty"><b>Loading the market snapshot…</b>Reading the market_snapshot read model from the API.</div></section>
      </section>
    );
  }
  const m = snapshot;
  return (
    <section id="market" className="screen active">
      <div className="page-head">
        <div>
          <div className="eyebrow">Broad-market context</div>
          <h1>Market</h1>
          <p className="subtitle">A structured view of major-index direction, market stage, final regime and sector leadership.</p>
        </div>
        <div className="market-head-actions">
          <span className="demo">DEMO SNAPSHOT · NOT LIVE</span>
          <span className="tag">Illustrative snapshot · {m.asOf}</span>
        </div>
      </div>

      <section className="market-block">
        <article className="card market-scan-card">
          <div className="market-scan-main">
            <span className="market-scan-icon">⚡</span>
            <div>
              <div className="layer-kicker">MARKET SCAN</div>
              <h2>{m.scan.title}</h2>
              <p className="subtitle">Scheduled window {m.scan.window} · last demo scan {m.scan.lastScan} · {m.scan.examples} example stocks</p>
            </div>
          </div>
          <div className="market-scan-actions">
            <span className="tag">Scan status · demo</span>
            <button className="primary market-run" onClick={() => onToast('Demo only: scan execution requires the server scanner and is not connected.')}>▶ Run Scan</button>
          </div>
        </article>
      </section>

      <div className="notice market-notice"><strong>Demo data only.</strong> The values below are fictional UI examples. This page does not calculate the regime or fetch market data. Production classifications must be supplied by the server according to the Market specification.</div>

      <section className="market-block">
        <div className="block-head"><div><h2>Market Index Dashboard</h2><p className="subtitle">Close, daily change and weekly change · matching periods across each instrument</p></div><span className="tag">5 instruments</span></div>
        <div className="index-grid">
          {m.indexes.map((ix) => (
            <article className="card index-card" key={ix.sym}>
              <div className="index-top"><strong>{ix.sym}</strong><span>{ix.name}</span></div>
              <div className="index-price">{ix.price}</div>
              <div className="index-changes">
                {ix.changes.map((ch, i) => (
                  <React.Fragment key={i}><b className={ch.c || undefined}>{ch.v}</b><span>{ch.label}</span></React.Fragment>
                ))}
              </div>
            </article>
          ))}
        </div>
        <p className="market-footnote">Close values and changes are fictional. VIX is a volatility index, not an ETF share price. Changes are displayed only; no calculations are performed in the UI.</p>
      </section>

      <section className="market-block">
        <div className="block-head"><div><h2>M · O’Neil Market Model — Should You Be Buying at All?</h2><p className="subtitle">Short-term bias, mid-term trend structure, long-term direction and final regime are separate assessments.</p></div></div>
        <div className="market-layer-grid">
          {['short', 'mid', 'long'].map((k) => {
            const L = m.model[k];
            return (
              <article className="card market-layer" key={k}>
                <div className="layer-kicker">{L.kicker}</div>
                <h3>{L.title}</h3>
                <div className={`regime-value ${L.valueClass}`}>{L.value}</div>
                <p>{L.note}</p>
                <div className="signal-list">
                  {L.signals.map(([label, value, cls], i) => (
                    <div key={i}><span>{label}</span><b className={cls || undefined}>{value}</b></div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="market-block">
        <div className="block-head"><div><h2>Final Market Regime</h2><p className="subtitle">Final classification combines long-term bias and mid-term stage; this demo shows the documented output, not a browser calculation.</p></div></div>
        <article className="card final-regime">
          <div>
            <span className="layer-kicker">REGIME MATRIX OUTPUT</span>
            <h2 className={m.regime.outputClass}>{m.regime.output}</h2>
            <p>{m.regime.terms.map(([label, value], i) => (
              <React.Fragment key={i}>{i > 0 ? ' + ' : ''}{label} <b>{value}</b></React.Fragment>
            ))}</p>
          </div>
          <div className="regime-bias">
            <span>Directional bias</span>
            <strong className={m.regime.biasClass}>{m.regime.bias}</strong>
            <small>{m.regime.confidence}</small>
          </div>
        </article>
      </section>

      <section className="market-block">
        <div className="block-head"><div><h2>Sector Heatmap</h2><p className="subtitle">Sector and ETF performance, relative strength versus SPY, bias, score, ADX and heat status. All values are illustrative demo data.</p></div><span className="tag">15 demo groups</span></div>
        <div className="table-wrap">
          <table className="market-table">
            <thead><tr><th>Sector / Group</th><th>ETF</th><th>Daily</th><th>Week</th><th>RS Day</th><th>RS Week</th><th>Bias</th><th>Score</th><th>ADX</th><th>Status</th></tr></thead>
            <tbody>
              {m.heatmap.map((row, ri) => (
                <tr key={ri}>{row.cells.map((c, ci) => <td key={ci} className={c.c || undefined}>{c.t}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="market-footnote">RS Day / RS Week are relative performance fields from the supplied legacy example. The bias, score and HOT status are displayed as provided, not recalculated in this frontend. They can disagree with raw daily returns because the documented engine uses additional trend inputs.</p>
      </section>

      <section className="market-block">
        <div className="block-head"><div><h2>Industry Group Leadership · O’Neil L</h2><p className="subtitle">Separate from sector ETF strength. Group rank, percentile, member count, median RS, share of members above 80 and individual leaders.</p></div><span className="tag">Example taxonomy · not IBD official</span></div>
        <div className="notice">These are the prototype’s group definitions, not IBD’s proprietary 197-group classification. Membership and ranks depend on the source universe. Groups with fewer than six ranked members should be rolled up to their SIC major group and labelled.</div>
        <div className="table-wrap">
          <table className="market-table">
            <thead><tr><th>Rank</th><th>Industry group</th><th>Percentile / grade</th><th>Members</th><th>Median RS</th><th>Over 80</th><th>3-mo</th><th>Leaders (RS)</th></tr></thead>
            <tbody>
              {m.groups.map((row, ri) => (
                <tr key={ri}>{row.cells.map((c, ci) => <td key={ci} className={c.c || undefined} colSpan={c.colspan || undefined}>{c.t}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="market-footnote">The legacy text reports 6,859 symbols mapped to 397 industries and 175 groups with six or more members. Those counts are illustrative source claims, not verified production data.</p>
      </section>

      <section className="market-block">
        <div className="block-head"><div><h2>Market Breadth, Volatility &amp; Themes</h2><p className="subtitle">Additional context panels; values remain illustrative until a verified data source is connected.</p></div></div>
        <div className="market-bottom-grid">
          <article className="card detailcard">
            <h3>Market Breadth</h3>
            <div className="breadth-meter">
              <div><span>Advancing stocks</span><b>{m.breadth.advancing}</b></div>
              <i><em style={{ width: m.breadth.advancing }}></em></i>
              <div><span>Declining stocks</span><b>{m.breadth.declining}</b></div>
              <i><em style={{ width: m.breadth.declining }}></em></i>
              <div><span>Unchanged</span><b>{m.breadth.unchanged}</b></div>
              <i><em style={{ width: m.breadth.unchanged }}></em></i>
            </div>
            <div className="data-row"><span>Distribution days</span><strong>{m.breadth.distribution}</strong></div>
            <div className="data-row"><span>Volatility</span><strong>{m.breadth.volatility}</strong></div>
          </article>
          <article className="card detailcard">
            <h3>Theme Watch</h3>
            <div className="theme-watch">
              {m.themes.map((t, i) => (
                <div key={i}>
                  <span className={`theme-dot ${t.dot}`}></span>
                  <div><b>{t.name}</b><small>{t.note}</small></div>
                  <strong className={t.statusClass || undefined}>{t.status}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <div className="market-endnote">Market dashboard designed from the Market specification. Frontend-only demonstration: no API, server logic, or live market feed is connected.</div>
    </section>
  );
}
