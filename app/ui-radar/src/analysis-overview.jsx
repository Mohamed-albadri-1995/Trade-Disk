import React, { useState } from 'react';

// The Overview tab — the decision summary: a live price-path preview, the CAN SLIM
// factor strip, themes, and a market-context snapshot pulled from the live Market
// dashboard. Detailed price metrics live in Technical; company data in Fundamentals.
// Per-ticker news needs a news feed, so that panel stays honestly empty here.

const CS_LABELS = { C: 'Earn.', A: 'Annual', N: 'New', S: 'Supply', L: 'Leader', I: 'Funds', M: 'Market' };

function pathOf(series, w = 500, h = 130, pad = 8) {
  const v = (series || []).filter((x) => x != null);
  if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const step = w / (v.length - 1);
  return v.map((c, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)} ${(h - pad - ((c - lo) / span) * (h - pad * 2)).toFixed(1)}`).join(' ');
}

function sections(a, { setTab, onNav }) {
  const strip = a?.canslim?.strip || [];
  const up = (a?.overview?.chart || []).slice(-1)[0] >= (a?.overview?.chart || [])[0];
  return [
    { id: 1, title: 'Chart Snapshot', nav: 'Chart', desc: 'Live close-price path (last ~120 sessions). Full indicators and ranges live in Technical.', content: (
      <>
        <svg className="mini-chart" viewBox="0 0 500 130" preserveAspectRatio="none"><path d={pathOf(a?.overview?.chart)} fill="none" stroke={up ? '#19dfa0' : '#ff6374'} strokeWidth="2.5" /></svg>
        <div className="data-row"><span>3-month return</span><strong className={(a?.overview?.mom3mPct ?? 0) >= 0 ? 'positive' : 'negative'}>{a?.overview?.mom3mPct == null ? '—' : (a.overview.mom3mPct >= 0 ? '+' : '') + a.overview.mom3mPct + '%'}</strong></div>
      </>
    ) },
    { id: 5, title: 'CAN SLIM · O’Neil', nav: 'CAN SLIM', desc: 'Seven-factor summary from live financials + market. Open CAN SLIM for the evidence.', content: (
      <>
        <div className="factorgrid">{strip.map(([x, , warn]) => <div key={x} className={`factor ${warn ? 'warn' : ''}`}><b>{x}</b><small>{CS_LABELS[x]}</small></div>)}</div>
        <div className="data-row"><span>3-month relative move</span><strong>{a?.canslim?.mom3mPct == null ? '—' : (a.canslim.mom3mPct >= 0 ? '+' : '') + a.canslim.mom3mPct + '%'}</strong></div>
        <button className="linkbtn" onClick={() => setTab('canslim')}>Open full evidence review →</button>
      </>
    ) },
    { id: 6, title: 'Themes', nav: 'Themes', desc: 'Sector and tag context, kept separate from scoring.', content: (
      <div className="themechips">{(a?.overview?.themes || []).map((t, i) => <span key={i}>{t}</span>)}{!a?.overview?.themes?.length ? <span>—</span> : null}</div>
    ) },
    // Market Context moved into the stock hero (top-right); the Market tab remains the
    // single source of truth for the full regime model, heatmap and rankings.
  ];
}

export function Overview({ a, loading, setTab, onNav }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  if (loading || !a) return <div id="overview" className="pane"><div className="empty"><b>Loading live analysis…</b>Fetching price history, financials and the market snapshot.</div></div>;
  const secs = sections(a, { setTab, onNav });
  const toggle = (id) => setCollapsed((prev) => { const nx = new Set(prev); nx.has(id) ? nx.delete(id) : nx.add(id); return nx; });
  const jump = (id) => document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div id="overview" className="pane">
      <div className="notice analysis-ownership-note"><strong>Overview = decision summary.</strong> Live price path, the CAN SLIM factor strip and themes; the market snapshot sits in the stock header above. Detailed price, volume, range and momentum metrics live in Technical; company financials in Fundamentals &amp; News.</div>
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
