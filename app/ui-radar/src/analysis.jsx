import React, { useState, useEffect } from 'react';
import { money } from './lib.js';
import { api } from './api.js';
import { Overview } from './analysis-overview.jsx';
import { Technical } from './analysis-technical.jsx';
import { Canslim } from './analysis-canslim.jsx';
import { Fundamental } from './analysis-fundamental.jsx';

// The live broad-market snapshot, as a compact card in the hero's right column.
// It replaces the old Overview "Market Context" section: one home for the summary,
// and a tap opens the full Market dashboard. Fed by the same live market snapshot.
function HeroMarket({ mkt, onNav }) {
  const bias = mkt.bias;
  const dot = bias === 'LONG' ? { background: '#7ab63e', borderColor: '#5d9e31' }
    : bias === 'SHORT' ? { background: '#e06a6a', borderColor: '#bf484d' }
      : { background: '#e3ad5a', borderColor: '#b5812a' };
  const cls = (v, pos, neg) => (v === pos ? 'positive' : v === neg ? 'negative' : undefined);
  return (
    <button type="button" className="hero-market" onClick={() => onNav('market')} title="Open the Market dashboard">
      <div className="hero-market-head">
        <span className="hero-market-dot" style={dot}></span>
        <div><strong>{String(mkt.output || '').replace(/_/g, ' ')}</strong><small>Market · {bias || '—'} bias · live</small></div>
      </div>
      <div className="hero-market-rows">
        <span>Long <b className={cls(mkt.long, 'BULLISH', 'BEARISH')}>{mkt.long || '—'}</b></span>
        <span>Mid <b className={cls(mkt.mid, 'UPTREND', 'DOWNTREND')}>{mkt.mid || '—'}</b></span>
        <span>Short <b className={cls(mkt.short, 'BULLISH', 'BEARISH')}>{mkt.short || '—'}</b></span>
      </div>
      <span className="hero-market-link">Market dashboard →</span>
    </button>
  );
}

// A compact grid of the most-glanced-at live numbers, filling the centre of the hero
// so the header reads as one organised block instead of two clusters with a gap.
function HeroStats({ t, f }) {
  const num = (v, d, suf = '') => (v == null || !isFinite(v) ? '—' : (+v).toFixed(d) + suf);
  const signed = (v) => (v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '') + (+v).toFixed(1) + '%');
  const tone = (v) => (v == null || !isFinite(v) ? undefined : v >= 0 ? 'positive' : 'negative');
  const items = [
    ['Market cap', t.marketCapStr || '—'],
    ['P/E · TTM', f?.pe != null ? num(f.pe, 1, '×') : '—'],
    ['Rev · YoY', signed(f?.revenueYoyPct), tone(f?.revenueYoyPct)],
    ['RSI (14)', num(t.rsi14, 0)],
    ['Rel vol', num(t.rvol20, 1, '×')],
    ['3-mo return', signed(t.mom3mPct), tone(t.mom3mPct)],
  ];
  return (
    <div className="hero-stats">
      {items.map(([label, val, cls]) => (
        <div className="hero-stat" key={label}><small>{label}</small><strong className={cls || undefined}>{val}</strong></div>
      ))}
    </div>
  );
}

// The stock hero — identity + live price/change on the left, a live key-stats grid in
// the centre, and the model score + live market snapshot on the right. Price and daily
// change come from the live Yahoo bars once loaded (a.technical); until then the card's
// own values fill in so the header never flashes empty.
function Hero({ s, a, saved, onToggleStar, onNav, onToast }) {
  const live = a?.technical;
  const price = live && live.price != null ? live.price : s.p;
  const prev = live?.prevClose;
  const abs = prev != null ? price - prev : s.abs;
  const chgPct = prev != null && prev !== 0 ? (price / prev - 1) * 100 : s.c;
  const up = chgPct >= 0;
  return (
    <section className="panel stockhero">
      <div className="hero-top">
        <div className="hero-identity">
          <div className="hero-logo" id="heroLogo">{s.mark}</div>
          <div style={{ minWidth: 0 }}>
            <h1 className="hero-name" id="heroName">{s.t} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· {s.n}</span></h1>
            <div className="hero-meta"><span>{s.sec || 'US equity'}</span><span>·</span><span className="tag">US Stocks</span>{a?.asOf ? <span className="metric-note" style={{ margin: 0 }}>{a.live ? 'Live · ' : ''}Updated {a.asOf}</span> : null}</div>
            <div className="hero-price"><strong>{money(price)}</strong><span className={`change${up ? '' : ' negative'}`}>{up ? '+' : '−'}{Math.abs(abs).toFixed(2)} ({up ? '+' : '−'}{Math.abs(chgPct).toFixed(2)}%)</span></div>
            <div className="hero-chips">
              {(Array.isArray(s.tags) ? s.tags : []).map((t) => <span className="chip" key={t}>{t}</span>)}
              {s.sec ? <span className="chip gold">{s.sec}</span> : null}
            </div>
          </div>
        </div>
        {live ? <HeroStats t={live} f={a?.fundamental} /> : <div className="hero-stats hero-stats-loading" aria-hidden="true"></div>}
        <div className="hero-aside">
          <div className="hero-controls">
            <button className="iconbtn" id="favoriteBtn" aria-label="Toggle favorite" style={{ color: saved ? 'var(--yellow)' : undefined }} onClick={() => onToggleStar(s.t)}>{saved ? '★' : '☆'}</button>
            <button className="iconbtn" aria-label="Share" onClick={() => onToast('Share action is a visual placeholder.')}>⇧</button>
            <div className="hero-score"><strong id="heroScore">{s.s}</strong><span>/ 100 · Model score</span></div>
          </div>
          {a?.overview?.market ? <HeroMarket mkt={a.overview.market} onNav={onNav} /> : null}
        </div>
      </div>
    </section>
  );
}

const TABS = [['overview', 'Overview'], ['technical', 'Technical'], ['canslim', 'CAN SLIM'], ['fundamental', 'Fundamentals & News']];

// The analysis workspace — a stock in four tabs. Opened from a stock card. The deep
// per-stock data is fetched live (Yahoo + SEC EDGAR) and handed to each tab.
export function Analysis({ stock, saved, onToggleStar, onNav, onToast }) {
  const [tab, setTab] = useState('overview');
  const [a, setA] = useState(null);     // the live analysis snapshot
  const [err, setErr] = useState(null);
  const t = stock && stock.t;

  useEffect(() => { setTab('overview'); }, [t]);
  useEffect(() => {
    if (!t) return;
    let live = true;
    setA(null); setErr(null);
    api.analysis(t, { name: stock.n, sec: stock.sec, cap: stock.cap, capBand: stock.capBand, tags: (stock.tags || []).join(',') })
      .then((res) => { if (!live) return; res && res.error ? setErr(res.error) : setA(res); })
      .catch((e) => { if (live) setErr(String(e.message || e)); });
    return () => { live = false; };
  }, [t]);

  if (!stock) return null;
  const loading = !a && !err;

  return (
    <section id="analysis" className="screen active">
      <div className="backline">
        <button className="ghost" onClick={() => onNav('screener')}>← Back to Screener</button>
        <span className="tag">Analysis Workspace</span>
        {a?.live
          ? <span className="demo" style={{ color: '#5df0b7', borderColor: '#1a6555', background: '#0c302a' }}>● LIVE · YAHOO + EDGAR</span>
          : err
            ? <span className="demo">DATA UNAVAILABLE</span>
            : <span className="demo">Loading live data…</span>}
      </div>
      <Hero s={stock} a={a} saved={saved} onToggleStar={onToggleStar} onNav={onNav} onToast={onToast} />
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} className={`tab${tab === id ? ' active' : ''}`} data-tab={id} onClick={() => { setTab(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{label}</button>
        ))}
      </div>
      {err ? <div className="empty"><b>Couldn’t load live data for {stock.t}</b>{err} — try again shortly.</div> : null}
      {tab === 'overview' && <Overview stock={stock} a={a} loading={loading} onToast={onToast} setTab={setTab} onNav={onNav} />}
      {tab === 'technical' && <Technical stock={stock} a={a} loading={loading} onNav={onNav} onToast={onToast} />}
      {tab === 'canslim' && <Canslim stock={stock} a={a} loading={loading} />}
      {tab === 'fundamental' && <Fundamental stock={stock} a={a} loading={loading} onNav={onNav} />}
    </section>
  );
}
