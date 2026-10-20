import React from 'react';

// The standalone Market dashboard. It renders the materialized market snapshot the
// API serves (MARKET.md §3.5) and never recomputes anything. When the snapshot is
// live (computed server-side from free Yahoo daily bars) the chrome says so; the
// seeded demo snapshot keeps the original "demo" labelling. The O'Neil 175-industry
// -group ranking needs the research engine, so while it is pending the view shows an
// honest placeholder rather than inventing numbers.
const LIVE_BADGE = { color: '#5df0b7', borderColor: '#1a6555', background: '#0c302a' };
const LIVE_NOTE = { borderColor: '#1a6555', background: '#0c302a', color: '#b9f5db' };

export function Market({ snapshot, onNav, onToast }) {
  if (!snapshot) {
    return (
      <section id="market" className="screen active">
        <div className="page-head"><div><div className="eyebrow">Broad-market context</div><h1>Market</h1><p className="subtitle">A structured view of major-index direction, market stage, final regime and sector leadership.</p></div></div>
        <section className="panel results"><div className="empty"><b>Loading the market snapshot…</b>Reading the market snapshot from the API.</div></section>
      </section>
    );
  }
  const m = snapshot;
  const live = !!m.live;
  return (
    <section id="market" className="screen active">
      <div className="page-head">
        <div>
          <div className="eyebrow">Broad-market context</div>
          <h1>Market</h1>
          <p className="subtitle">A structured view of major-index direction, market stage, final regime and sector leadership.</p>
        </div>
        <div className="market-head-actions">
          {live
            ? <span className="demo" style={LIVE_BADGE}>● LIVE · YAHOO</span>
            : <span className="demo">DEMO SNAPSHOT · NOT LIVE</span>}
          <span className="tag">{live ? 'Live snapshot' : 'Illustrative snapshot'} · {m.asOf}</span>
        </div>
      </div>

      <section className="market-block">
        <article className="card market-scan-card">
          <div className="market-scan-main">
            <span className="market-scan-icon">⚡</span>
            <div>
              <div className="layer-kicker">MARKET SCAN</div>
              <h2>{m.scan.title}</h2>
              <p className="subtitle">Scan window {m.scan.window} · last refreshed {m.scan.lastScan} · {m.scan.examples} live screeners</p>
            </div>
          </div>
          <div className="market-scan-actions">
            <span className="tag">{live ? 'Scans run on the Screener' : 'Scan status · demo'}</span>
            <button className="primary market-run" onClick={() => onNav('screener')}>▶ Open Screener</button>
          </div>
        </article>
      </section>

      {live
        ? <div className="notice market-notice" style={LIVE_NOTE}><strong>Live data.</strong> Index prices, the market model, final regime, sector heatmap and breadth are computed server-side from free Yahoo daily bars and refreshed when you open this page. Informational only — not investment advice.</div>
        : <div className="notice market-notice"><strong>Demo data only.</strong> The values below are fictional UI examples. This page does not calculate the regime or fetch market data. Production classifications must be supplied by the server according to the Market specification.</div>}

      <section className="market-block">
        <div className="block-head"><div><h2>Market Index Dashboard</h2><p className="subtitle">Close, daily change and weekly change · matching periods across each instrument</p></div><span className="tag">{m.indexes.length} instruments</span></div>
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
        <p className="market-footnote">{live ? 'Close and changes from Yahoo daily bars (completed sessions). VIX is a volatility index level, not an ETF share price.' : 'Close values and changes are fictional. VIX is a volatility index, not an ETF share price. Changes are displayed only; no calculations are performed in the UI.'}</p>
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
        <div className="block-head"><div><h2>Final Market Regime</h2><p className="subtitle">Final classification combines long-term bias and mid-term stage{live ? ', computed from SPY moving averages and Bollinger position.' : '; this demo shows the documented output, not a browser calculation.'}</p></div></div>
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
        <div className="block-head"><div><h2>Sector Heatmap</h2><p className="subtitle">Sector / ETF performance, relative strength versus SPY, trend bias, score, ADX and heat status{live ? '.' : '. All values are illustrative demo data.'}</p></div><span className="tag">{m.heatmap.length} sectors</span></div>
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
        <p className="market-footnote">{live ? 'RS Day / RS Week are the ETF return minus SPY’s over the same period. Bias, score and ADX(14) are computed from the ETF’s daily bars; score blends relative strength, trend and ADX.' : 'RS Day / RS Week are relative performance fields from the supplied legacy example. The bias, score and HOT status are displayed as provided, not recalculated in this frontend.'}</p>
      </section>

      <section className="market-block">
        <div className="block-head"><div><h2>Industry Group Leadership · O’Neil L</h2><p className="subtitle">Group rank, percentile, member count, median RS, share of members above 80 and individual leaders.</p></div><span className="tag">Research engine</span></div>
        {m.groupsPending || !m.groups?.length ? (
          <div className="empty"><b>Coming with the research engine</b>O’Neil’s 175-industry-group ranking classifies the whole market into groups and ranks them by relative strength — a dedicated engine, not a free feed. It isn’t wired yet, so this panel is intentionally empty rather than showing demo numbers. Sector-level leadership above is live.</div>
        ) : (
          <>
            <div className="notice">These are the prototype’s group definitions, not IBD’s proprietary classification. Membership and ranks depend on the source universe.</div>
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
          </>
        )}
      </section>

      <section className="market-block">
        <div className="block-head"><div><h2>Market Breadth, Volatility &amp; Themes</h2><p className="subtitle">{live ? 'Sector breadth, distribution days and live volatility; theme status from the sector leaders.' : 'Additional context panels; values remain illustrative until a verified data source is connected.'}</p></div></div>
        <div className="market-bottom-grid">
          <article className="card detailcard">
            <h3>Market Breadth</h3>
            <div className="breadth-meter">
              <div><span>Advancing sectors</span><b>{m.breadth.advancing}</b></div>
              <i><em style={{ width: m.breadth.advancing }}></em></i>
              <div><span>Declining sectors</span><b>{m.breadth.declining}</b></div>
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

      <div className="market-endnote">{live ? 'Market snapshot computed server-side from free Yahoo daily data, refreshed on read (MARKET.md §3.5). Personal-use data; the Trade-Disk tools place no orders.' : 'Market dashboard designed from the Market specification. Frontend-only demonstration: no API, server logic, or live market feed is connected.'}</div>
    </section>
  );
}
