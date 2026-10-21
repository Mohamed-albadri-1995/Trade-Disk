import React, { useState, useEffect } from 'react';
import { api } from './api.js';

// Industry Group Leadership (O'Neil "L") — fetched on its own because the S&P 500
// ranking is computed in the background and cached daily. While it builds, the panel
// polls; once it lands it renders the ranked groups. RS colouring: strong green, weak red.
function rsCls(v) { return v == null ? undefined : v >= 80 ? 'positive' : v <= 40 ? 'negative' : undefined; }

function GroupsPanel() {
  const [g, setG] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true, tries = 0, timer;
    const poll = () => {
      api.groups().then((res) => {
        if (!live) return;
        setG(res); setErr(false);
        if (res && res.computing && tries++ < 20) timer = setTimeout(poll, 4000);
      }).catch(() => { if (live) setErr(true); });
    };
    poll();
    return () => { live = false; clearTimeout(timer); };
  }, []);

  const rows = g?.groups || [];
  return (
    <section className="market-block">
      <div className="block-head">
        <div><h2>Industry Group Leadership · O’Neil L</h2><p className="subtitle">S&amp;P 500 ranked by industry-group relative strength — the group where the median stock is strongest is where leadership is forming.</p></div>
        {rows.length ? <span className="tag">{g.totalGroups} groups · {g.mappedSymbols} stocks</span> : <span className="tag">Live engine</span>}
      </div>
      {err ? (
        <div className="empty"><b>Couldn’t load group leadership</b>The ranking service didn’t respond — try again shortly.</div>
      ) : !rows.length ? (
        <div className="empty"><b>{g?.computing ? 'Computing group leadership…' : 'Loading…'}</b>{g?.computing ? 'Ranking the S&P 500 by industry-group relative strength (first run of the day — about a minute). It’ll appear here when ready.' : 'Reading the latest group ranking.'}</div>
      ) : (
        <>
          <div className="notice">Groups are GICS sub-industries within the S&amp;P 500 — our scope, not IBD’s proprietary 197-group model. RS is each stock’s IBD-style weighted 3/6/9/12-month return, percentiled 1–99 within the universe; groups rank by member median RS.{g.asOf ? ` · Updated ${g.asOf}` : ''}{g.computing ? ' · refreshing…' : ''}</div>
          <div className="table-wrap">
            <table className="market-table">
              <thead><tr><th>Rank</th><th>Industry group</th><th>Grade</th><th>Members</th><th>Median RS</th><th>% &gt; 80</th><th>Leaders (RS)</th></tr></thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.group}>
                    <td>{x.rank}</td>
                    <td className="group-name">{x.group}<small style={{ display: 'block', color: 'var(--muted)' }}>{x.sector}</small></td>
                    <td><strong className={rsCls(x.pct)}>{x.letter}</strong> <span style={{ color: 'var(--muted)' }}>· {x.pct}</span></td>
                    <td>{x.members}</td>
                    <td><strong className={rsCls(x.median_rs)}>{x.median_rs}</strong></td>
                    <td className={rsCls(Math.round(x.share_over_80 * 100))}>{Math.round(x.share_over_80 * 100)}%</td>
                    <td>{x.leaders.map((l) => `${l.symbol} ${l.rs}`).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

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
        <div className="block-head"><div><h2>Market Regime</h2><p className="subtitle">{live ? 'Long-term bias, mid-term stage and the final regime — computed from SPY moving averages and Bollinger position.' : 'Long-term bias, mid-term stage and the final regime.'}</p></div></div>
        <article className="card market-summary" style={{ padding: '15px' }}>
          <div className="market-context-regime">
            <span className="market-context-dot" style={m.regime.bias === 'LONG' ? { background: '#7ab63e', borderColor: '#5d9e31' } : m.regime.bias === 'SHORT' ? { background: '#e06a6a', borderColor: '#bf484d' } : { background: '#e3ad5a', borderColor: '#b5812a' }}></span>
            <div><strong className={m.regime.outputClass} style={{ fontSize: '26px', letterSpacing: '-.4px', display: 'block', lineHeight: 1.1 }}>{m.regime.output}</strong><small style={{ color: 'var(--muted)' }}>{m.regime.bias} bias · {live ? 'live' : 'demo'}</small></div>
          </div>
          <div className="market-context-row"><span>Long term</span><strong className={m.model.long.valueClass}>{m.model.long.value}</strong></div>
          <div className="market-context-row"><span>Mid term</span><strong className={m.model.mid.valueClass}>{m.model.mid.value}</strong></div>
          <div className="market-context-row"><span>Short term</span><strong className={m.model.short.valueClass}>{m.model.short.value}</strong></div>
          <div className="market-context-row"><span>Bollinger</span><strong>{(m.regime.terms.find((t) => t[0] === 'Bollinger position') || [])[1] || '—'}</strong></div>
          <div className="market-context-row"><span>Directional bias</span><strong className={m.regime.biasClass}>{m.regime.bias}</strong></div>
          <p className="market-context-note">{m.regime.confidence}</p>
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

      <GroupsPanel />

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
