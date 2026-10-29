import React, { useState, useEffect } from 'react';
import { money } from './lib.js';
import { api } from './api.js';
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

const CS_LABELS = { C: 'Earn.', A: 'Annual', N: 'New', S: 'Supply', L: 'Leader', I: 'Funds', M: 'Market' };

// The decision summary that used to be the Overview tab, now living under the hero:
// the seven-factor CAN SLIM strip (a tap opens the full evidence review) and the
// theme chips. The price chart moved to Technical, so it isn't repeated here.
function HeroSummary({ a, setTab }) {
  const strip = a?.canslim?.strip || [];
  const themes = a?.overview?.themes || [];
  if (!strip.length && !themes.length) return null;
  return (
    <div className="hero-summary">
      <div className="hero-sub">
        <div className="hero-sub-title"><span>CAN SLIM · O’Neil</span><button className="linkbtn" onClick={() => setTab('canslim')}>Evidence →</button></div>
        <button type="button" className="hero-factors" onClick={() => setTab('canslim')} title="Open the CAN SLIM evidence review">
          {strip.map(([x, , warn]) => <span key={x} className={`factor ${warn ? 'warn' : ''}`}><b>{x}</b><small>{CS_LABELS[x] || x}</small></span>)}
        </button>
      </div>
      <div className="hero-sub">
        <div className="hero-sub-title"><span>Themes</span></div>
        <div className="themechips">{themes.length ? themes.map((t, i) => <span key={i}>{t}</span>) : <span>—</span>}</div>
      </div>
    </div>
  );
}

// The stock hero — now the whole decision summary (the Overview tab folded in):
// identity + live price (left), a live key-stats grid (centre), the model score +
// live market snapshot (right), and a full-width summary row underneath with the
// CAN SLIM factor strip and themes. Price and daily change come from the live Yahoo
// bars once loaded (a.technical); until then the card's own values fill in.
function Hero({ s, a, saved, onToggleStar, onNav, onToast, setTab }) {
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
          <div className="hero-id-body">
            <h1 className="hero-name" id="heroName">{s.t} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· {s.n}</span></h1>
            <div className="hero-meta"><span>{s.sec || 'US equity'}</span><span>·</span><span className="tag">US Stocks</span>{a?.asOf ? <span className="metric-note" style={{ margin: 0 }}>{a.live ? 'Live · ' : ''}Updated {a.asOf}</span> : null}
              {(a?.stamps?.firstSeenEt || s.firstSeenEt) ? <span className="tag stamp-tag" title="When this stock first showed up on a screener today, and the last scan it was live in">◷ First seen {a?.stamps?.firstSeenEt || s.firstSeenEt} · {(a?.stamps ? a.stamps.liveNow : s.live) ? 'live now' : `last live ${a?.stamps?.lastLiveEt || s.lastLiveEt || '—'}`}</span> : null}</div>
            <div className="hero-price"><strong>{money(price)}</strong><span className={`change${up ? '' : ' negative'}`}>{up ? '+' : '−'}{Math.abs(abs).toFixed(2)} ({up ? '+' : '−'}{Math.abs(chgPct).toFixed(2)}%)</span></div>
            <div className="hero-chips">
              {(Array.isArray(s.tags) ? s.tags : []).map((t) => <span className="chip" key={t}>{t}</span>)}
            </div>
          </div>
        </div>
        {live ? <HeroStats t={live} f={a?.fundamental} /> : <div className="hero-stats hero-stats-loading" aria-hidden="true"></div>}
        <div className="hero-aside">
          <div className="hero-controls">
            <button className="iconbtn" id="favoriteBtn" aria-label="Toggle favorite" style={{ color: saved ? 'var(--yellow)' : undefined }} onClick={() => onToggleStar(s.t)}>{saved ? '★' : '☆'}</button>
            <button className="iconbtn" aria-label="Share" title="Copy a shareable summary" onClick={() => {
              const txt = `${s.t}${s.n ? ' ' + s.n : ''} · ${money(price)} (${up ? '+' : '−'}${Math.abs(chgPct).toFixed(2)}%) · Trade-Disk Radar\n${window.location.href}`;
              (navigator.clipboard?.writeText(txt) || Promise.reject())
                .then(() => onToast(`Copied ${s.t} summary to clipboard`))
                .catch(() => onToast('Clipboard not available in this browser'));
            }}>⇧</button>
            <div className="hero-score" title="Activity = % change + relative volume. A transparent heuristic, not a prediction or trained model."><strong id="heroScore">{s.s}</strong><span>/ 100 · Activity</span></div>
          </div>
          {a?.overview?.market ? <HeroMarket mkt={a.overview.market} onNav={onNav} /> : null}
        </div>
        <HeroSummary a={a} setTab={setTab} />
      </div>
    </section>
  );
}

const TABS = [['technical', 'Technical'], ['canslim', 'CAN SLIM'], ['fundamental', 'Fundamentals & News']];

// The analysis workspace — a stock in four tabs. Opened from a stock card. The deep
// per-stock data is fetched live (Yahoo + SEC EDGAR) and handed to each tab.
export function Analysis({ stock, saved, onToggleStar, onNav, onToast }) {
  const [tab, setTab] = useState('technical');
  const [a, setA] = useState(null);     // the live analysis snapshot
  const [err, setErr] = useState(null);
  const t = stock && stock.t;

  useEffect(() => { setTab('technical'); }, [t]);
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
      <Hero s={stock} a={a} saved={saved} onToggleStar={onToggleStar} onNav={onNav} onToast={onToast} setTab={setTab} />
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} className={`tab${tab === id ? ' active' : ''}`} data-tab={id} onClick={() => { setTab(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{label}</button>
        ))}
      </div>
      {err ? <div className="empty"><b>Couldn’t load live data for {stock.t}</b>{err} — try again shortly.</div> : null}
      {tab === 'technical' && <Technical stock={stock} a={a} loading={loading} onNav={onNav} onToast={onToast} />}
      {tab === 'canslim' && <Canslim stock={stock} a={a} loading={loading} />}
      {tab === 'fundamental' && <Fundamental stock={stock} a={a} loading={loading} onNav={onNav} />}
    </section>
  );
}
