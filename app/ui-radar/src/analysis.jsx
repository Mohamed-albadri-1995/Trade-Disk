import React, { useState, useEffect } from 'react';
import { money } from './lib.js';
import { Overview } from './analysis-overview.jsx';
import { Technical } from './analysis-technical.jsx';
import { Canslim } from './analysis-canslim.jsx';
import { Fundamental } from './analysis-fundamental.jsx';

// The stock hero — identity, price, after-hours, chips, favourite and model score.
// openStock in the prototype updates identity/price/score only; the chips and
// exchange are the prototype's fixed demo values, reproduced as-is.
function Hero({ s, saved, onToggleStar, onToast }) {
  return (
    <section className="panel stockhero">
      <div className="hero-top">
        <div className="hero-identity">
          <div className="hero-logo" id="heroLogo">{s.mark}</div>
          <div style={{ minWidth: 0 }}>
            <h1 className="hero-name" id="heroName">{s.t} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· {s.n}</span></h1>
            <div className="hero-meta"><span>NASDAQ</span><span>·</span><span>{s.sec}</span><span className="tag">US Stocks</span></div>
            <div className="hero-price"><strong>{money(s.p)}</strong><span className="change">+{s.abs.toFixed(2)} (+{s.c.toFixed(2)}%)</span></div>
            <div className="afterhours">After hours <b>{money(s.p + 0.12)}</b> <span className="positive">+0.12 (+0.09%)</span> · Demo</div>
            <div className="hero-chips"><span className="chip">Big Move</span><span className="chip green">Pre-Market</span><span className="chip gold">Earnings</span><span className="chip">AI / Semiconductors</span></div>
          </div>
        </div>
        <div className="hero-controls">
          <button className="iconbtn" id="favoriteBtn" aria-label="Toggle favorite" style={{ color: saved ? 'var(--yellow)' : undefined }} onClick={() => onToggleStar(s.t)}>{saved ? '★' : '☆'}</button>
          <button className="iconbtn" aria-label="Share" onClick={() => onToast('Share action is a visual placeholder.')}>⇧</button>
          <div className="hero-score"><strong id="heroScore">{s.s}</strong><span>/ 100 · Model score</span></div>
        </div>
      </div>
    </section>
  );
}

const TABS = [['overview', 'Overview'], ['technical', 'Technical'], ['canslim', 'CAN SLIM'], ['fundamental', 'Fundamentals & News']];

// The analysis workspace — a stock in four tabs. Opened from a stock card.
export function Analysis({ stock, saved, onToggleStar, onNav, onToast }) {
  const [tab, setTab] = useState('overview');
  // Reset to Overview whenever a different stock is opened.
  useEffect(() => { setTab('overview'); }, [stock && stock.t]);
  if (!stock) return null;

  return (
    <section id="analysis" className="screen active">
      <div className="backline">
        <button className="ghost" onClick={() => onNav('screener')}>← Back to Screener</button>
        <span className="tag">Analysis Workspace</span>
        <span className="demo">ILLUSTRATIVE DATA</span>
      </div>
      <Hero s={stock} saved={saved} onToggleStar={onToggleStar} onToast={onToast} />
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} className={`tab${tab === id ? ' active' : ''}`} data-tab={id} onClick={() => { setTab(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{label}</button>
        ))}
      </div>
      {tab === 'overview' && <Overview stock={stock} onToast={onToast} setTab={setTab} onNav={onNav} />}
      {tab === 'technical' && <Technical stock={stock} onNav={onNav} onToast={onToast} />}
      {tab === 'canslim' && <Canslim stock={stock} />}
      {tab === 'fundamental' && <Fundamental onNav={onNav} />}
    </section>
  );
}
