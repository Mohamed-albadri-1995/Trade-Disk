import React from 'react';
import { money, sparkData, pmAdr, presetTitle, filterCount, CHECK_IDS } from './lib.js';

// The sparkline — same viewBox, point math and up/down colours as the prototype.
export function Spark({ points }) {
  const { coords, w, h, stroke } = sparkData(points);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={coords} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// The top bar: brand (also the way back to the Station), theme toggle, the live/demo
// badge, search, bell. The brand is a link home, so no separate Station button.
const LIVE_BADGE = { color: '#5df0b7', borderColor: '#1a6555', background: '#0c302a' };
export function Appbar({ theme, onToggleTheme, onSearch, onToast, badge, onNav }) {
  const live = !!badge?.live;
  return (
    <header className="appbar">
      <a className="brand" href="/" title="Back to the Trading Station" aria-label="Back to the Trading Station" style={{ textDecoration: 'none', color: 'inherit' }}><span className="logo">↗</span><span>Trade-Disk <em>· Screener</em></span></a>
      <div className="app-actions">
        <button className="iconbtn" id="themeBtn" aria-label="Toggle light or dark theme" title="Toggle light or dark theme" onClick={onToggleTheme}>{theme === 'dark' ? '☾' : '☀'}</button>
        {live
          ? <span className="demo" style={LIVE_BADGE} title={badge.title || ''}>● {badge.label}</span>
          : <span className="demo" title={badge?.title || ''}>● {badge?.label || 'DEMO DATA'}</span>}
        <button className="iconbtn" aria-label="Search" onClick={onSearch}>⌕</button>
        <button className="iconbtn" aria-label="Settings" title="Settings &amp; scan schedule" onClick={() => onNav && onNav('settings')}>⚙</button>
        <button className="iconbtn" aria-label="Notifications" onClick={() => onToast('Notifications are outside this frontend prototype.')}>♧</button>
      </div>
    </header>
  );
}

// The mobile bottom nav (hidden above 700px by the CSS, exactly as the prototype).
const NAV = [['screener', '⌕', 'Screener'], ['shortlist', '☆', 'Shortlist'], ['market', '◉', 'Market'], ['settings', '⚙', 'Settings']];
export function BottomNav({ screen, onNav }) {
  return (
    <nav className="bottomnav">
      {NAV.map(([id, icon, label]) => (
        <button key={id} className={screen === id ? 'active' : ''} data-screen={id} onClick={() => onNav(id)}><b>{icon}</b>{label}</button>
      ))}
    </nav>
  );
}

export const Footer = () => (
  <footer className="footer">Trade-Disk design prototype · fictional illustrative data · no backend or API connection · not investment advice</footer>
);

const TOAST_STYLE = {
  position: 'fixed', zIndex: 50, bottom: '78px', left: '50%', transform: 'translateX(-50%)',
  background: '#102c40', border: '1px solid #2d5d7b', color: '#eef8ff', padding: '10px 14px',
  borderRadius: '9px', boxShadow: 'var(--shadow)', fontSize: '12px', maxWidth: '90vw',
};
export const Toast = ({ msg }) => <div id="toast" className={msg ? '' : 'hide'} style={TOAST_STYLE}>{msg}</div>;

// One stock card. variant 'screener' shows PM/ADR + the indicator line; 'shortlist'
// shows Score and drops the indicator line — exactly as the two render functions do.
export function StockCard({ s, selected, saved, onOpen, onToggleStar, variant = 'screener' }) {
  return (
    <article className={`stockcard ${selected ? 'selected' : ''}`} role="button" tabIndex={0}
      aria-label={`Open ${s.t} analysis`}
      onClick={() => onOpen(s.t)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(s.t); } }}>
      <div className="stock-main">
        <div className={`stockmark ${s.color}`}>{s.mark}</div>
        <div style={{ minWidth: 0 }}>
          <div className="tickerline">
            <span className="ticker">{s.t}</span>
            <button className={`star ${saved ? 'on' : ''}`} aria-label={`${saved ? 'Remove' : 'Add'} ${s.t} favorite`}
              onClick={(e) => { e.stopPropagation(); onToggleStar(s.t); }}>{saved ? '★' : '☆'}</button>
          </div>
          <div className="company">{s.n}</div>
          <div className="stocktags">
            {s.tags.map((tag, i) => <span key={i} className={`chip ${i === 0 ? 'green' : i === 1 ? '' : 'gold'}`}>{tag}</span>)}
          </div>
        </div>
      </div>
      <div className="stock-price">
        <div className="priceval">{money(s.p)}</div>
        <div className="change">+{s.abs.toFixed(2)} (+{s.c.toFixed(2)}%)</div>
        <Spark points={s.changeLine} />
      </div>
      <div className="stock-detail">
        <div className="detailstats">
          <span>RVOL <b>{s.r.toFixed(1)}×</b></span>
          <span>ADR <b>{s.adr.toFixed(1)}%</b></span>
          {variant === 'shortlist'
            ? (<><span>Score <b>{s.s}</b></span><span>{s.sec}</span></>)
            : (<><span>PM/ADR <b>{pmAdr(s).toFixed(2)}×</b></span><span>Sector <b>{s.sec}</b></span></>)}
        </div>
        {variant !== 'shortlist' && (
          <div className="indicatorline">
            <span className="indicator">9MA</span><span className="indicator">20MA</span><span className="indicator">VWAP</span>
            <span className="indicator">{s.stacked ? '9 > 13 > 20 > 50' : 'Trend watch'}</span>
          </div>
        )}
      </div>
      <div className={`scorebox ${s.s < 70 ? 'mid' : ''}`}>{s.s}</div>
    </article>
  );
}

const CHECK_LABELS = {
  premarket: 'Pre-Market Movers', earnings: 'Earnings Catalyst', canslimfilter: 'CAN SLIM Setup',
  ema: 'Above 20 EMA', stacked: '9 > 13 > 20 > 50 EMA', hot: 'Hot Stocks', newsfilter: 'News in last 24h',
};

// The left filter panel — the approved screener layout, controlled by App state.
export function FilterPanel({ filters, setFilters, visibleCount, collapsed, screeners, onApply, onReset, onChangePreset, onLoadSaved, onToast }) {
  const set = (patch) => setFilters({ ...filters, ...patch });
  const setCheck = (id, v) => setFilters({ ...filters, checks: { ...filters.checks, [id]: v } });
  return (
    <aside className={`panel filters${collapsed ? ' collapsed' : ''}`} id="filterPanel">
      <div className="panel-title"><span>Filters</span><button className="linkbtn" onClick={onReset}>Reset</button></div>
      <div className="field">
        <label htmlFor="marketFilter">Market</label>
        <select id="marketFilter" className="select" value={filters.market} onChange={(e) => set({ market: e.target.value })}>
          <option>US Stocks</option><option>NASDAQ</option><option>NYSE</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="preset">ACTIVE SCREENER</label>
        <select id="preset" className="select" value={filters.preset} onChange={(e) => onChangePreset(e.target.value)}>
          {(screeners && screeners.length)
            ? screeners.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)
            : <option value={filters.preset}>Loading…</option>}
        </select>
        <small className="subtitle">Live market scan — pick a screener to run it</small>
      </div>
      <div className="field">
        <div className="rangehead"><label htmlFor="score">Min Model Score</label><strong id="scoreVal">{filters.score}</strong></div>
        <input className="range" id="score" type="range" min="40" max="95" value={filters.score} onChange={(e) => set({ score: +e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="rvol">Min Relative Volume</label>
        <input id="rvol" className="input" type="number" min="0" step="0.1" value={filters.rvol} onChange={(e) => set({ rvol: +e.target.value })} />
      </div>
      <div className="field">
        <label>Price Range ($)</label>
        <div className="rangegrid">
          <input id="minp" className="input" type="number" min="0" value={filters.minp} aria-label="Minimum price" onChange={(e) => set({ minp: +e.target.value })} />
          <span className="subtitle">to</span>
          <input id="maxp" className="input" type="number" min="0" value={filters.maxp} aria-label="Maximum price" onChange={(e) => set({ maxp: +e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="cap">Market Cap</label>
        <select id="cap" className="select" value={filters.cap} onChange={(e) => set({ cap: e.target.value })}>
          <option value="Any">Any</option><option value="small">Below $2B</option><option value="mid">$2B–$10B</option><option value="large">Above $10B</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="sector">Sector</label>
        <select id="sector" className="select" value={filters.sector} onChange={(e) => set({ sector: e.target.value })}>
          <option value="Any">Any sector</option><option>Semiconductors</option><option>Software</option><option>Computer Hardware</option><option>Automotive</option><option>Financial</option>
        </select>
      </div>
      <div className="checklist">
        {CHECK_IDS.map((id) => (
          <label key={id} className="check"><input type="checkbox" id={id} checked={filters.checks[id]} onChange={(e) => setCheck(id, e.target.checked)} /> {CHECK_LABELS[id]}</label>
        ))}
      </div>
      <button className="primary" onClick={onApply}>Apply Filters</button>
      <div className="countline"><span id="filterSummary">{visibleCount} stocks match</span><span>Score &amp; tags illustrative</span></div>
      <div className="saved">
        <div className="panel-title"><h3>Saved Screens</h3><button className="linkbtn" onClick={() => onToast('Save-screen management is not part of this prototype.')}>＋</button></div>
        <div className="savedrow"><span>Trend Leaders</span><button onClick={() => onLoadSaved('trend-leaders')}>↗</button></div>
        <div className="savedrow"><span>Growth Pullback</span><button onClick={() => onLoadSaved('growth-pullback')}>↗</button></div>
      </div>
    </aside>
  );
}

// The mobile filters toggle (hidden above 700px). filterCount mirrors updateFilterCount.
export function FiltersToggle({ checks, collapsed, onToggle }) {
  return (
    <button className="filters-toggle" id="filtersToggle" onClick={onToggle}>
      <span>☷ &nbsp; Filters <span id="filterCount">{filterCount(checks)} active</span></span>
      <span id="filterToggleText">{collapsed ? 'Show ↓' : 'Hide ↑'}</span>
    </button>
  );
}

export { presetTitle };
