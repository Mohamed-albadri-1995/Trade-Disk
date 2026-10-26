// Trade-Disk — the per-stock analysis builder. Produces the live analysis snapshot
// the stock workspace renders (Overview / Technical / CAN SLIM / Fundamentals),
// computed from free sources: Yahoo daily bars (price action + technicals) and SEC
// EDGAR (company financials). Market-direction inputs come from the already-live
// market snapshot (core/market.mjs), passed in. Values that free data cannot source
// (forward P/E, PEG, float, short interest, institutional sponsorship, a true RS
// percentile, live news) are returned null, and the view shows them as "not on free
// data" rather than inventing numbers. Cached per ticker for a few minutes.

import * as yahoo from '../providers/yahoo.mjs';
import { technicals } from './technicals.mjs';
import * as edgar from '../providers/edgar.mjs';
import { news } from '../providers/news.mjs';

const TTL_MS = 8 * 60 * 1000;
const cache = new Map(); // ticker → { at, snap }

const r2 = (v) => (v == null || !isFinite(v) ? null : +(+v).toFixed(2));
const pct2 = (v) => (v == null || !isFinite(v) ? null : +(+v).toFixed(2));
function moneyCompact(v) {
  if (v == null || !isFinite(v)) return null;
  const a = Math.abs(v);
  if (a >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  return '$' + v.toFixed(0);
}
function volCompact(v) {
  if (v == null || !isFinite(v)) return null;
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return '' + Math.round(v);
}

// Three-month (~63 trading sessions) total return in %, for a simple relative-strength read.
function ret(bars, n) {
  if (!bars || bars.length <= n) return null;
  const a = bars[bars.length - 1 - n]?.c, b = bars[bars.length - 1]?.c;
  return a ? ((b - a) / a) * 100 : null;
}

export async function buildAnalysis(ticker, { scan = null, market = null } = {}) {
  const t = String(ticker).toUpperCase();
  const cached = cache.get(t);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.snap;

  const [{ bars }, fund] = await Promise.all([
    yahoo.chart(t, { range: '1y', interval: '1d' }),
    edgar.fundamentals(t).catch(() => ({ available: false })),
  ]);
  if (!bars || !bars.length) throw new Error(`no price bars for ${t}`);
  const tech = technicals(bars);
  // Fresh, stock-specific news (≤48h) from free sources — needs the resolved CIK and
  // name for exact matching, so it runs after fundamentals rather than alongside.
  const newsRes = await news(t, { name: scan?.n || fund?.name || t, cik: fund?.cik || null, maxAgeHours: 48, limit: 12 })
    .catch(() => ({ available: false, maxAgeHours: 48, items: [] }));

  const price = tech.price;
  const shares = fund?.sharesDiluted || null;
  const marketCap = shares && price ? price * shares : null;
  const pe = fund?.eps?.ttm > 0 && price ? price / fund.eps.ttm : null;
  const ps = marketCap && fund?.revenue?.ttm > 0 ? marketCap / fund.revenue.ttm : null;
  const mom3m = ret(bars, 63), mom6m = ret(bars, 126);

  // ── Market direction (M) + overview context, from the live market snapshot ──
  const regime = market?.regime || null;
  const model = market?.model || null;
  const sectorName = scan?.sec || null;

  // ── CAN SLIM factor read, from what free data supports ──
  const q = fund?.eps?.quarterly || [];
  const latestQ = q[q.length - 1] || null;
  const epsQ = latestQ?.yoyPct ?? null;
  const salesQ = fund?.revenue?.quarterly?.[fund.revenue.quarterly.length - 1]?.yoyPct ?? null;
  const epsCagr = fund?.epsAnnualCagr3yPct ?? null;
  const roe = fund?.roe ?? null;
  const near52 = tech.high52 ? ((price - tech.high52) / tech.high52) * 100 : null; // negative = below high
  const Cstatus = epsQ == null ? 'No data' : epsQ >= 25 ? 'Strong' : epsQ >= 0 ? 'Mixed' : 'Weak';
  const Astatus = epsCagr == null ? 'No data' : epsCagr >= 25 ? 'Strong' : epsCagr >= 10 ? 'Moderate' : 'Weak';
  const Nstatus = near52 == null ? 'No data' : near52 >= -5 ? 'Near highs' : near52 >= -15 ? 'In base' : 'Off highs';
  const Lstatus = mom3m == null ? 'No data' : mom3m >= 10 ? 'Leader' : mom3m >= 0 ? 'In line' : 'Laggard';
  const Mstatus = regime ? (regime.bias === 'LONG' ? 'Uptrend' : regime.bias === 'SHORT' ? 'Downtrend' : 'Range') : 'No data';
  const warnOf = (s) => ['Mixed', 'Weak', 'Off highs', 'Laggard', 'Downtrend', 'Range', 'No data'].includes(s);

  const snap = {
    ticker: t, name: scan?.n || fund?.name || t, asOf: new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' ET',
    live: true, source: 'Yahoo + SEC EDGAR',

    // Full daily OHLCV (the 1-year window) for the Technical tab's candlestick chart.
    bars: bars.map((b) => ({ t: b.t, o: r2(b.o), h: r2(b.h), l: r2(b.l), c: r2(b.c), v: b.v })),

    technical: {
      ...tech,
      marketCap, marketCapStr: moneyCompact(marketCap) || scan?.cap || null,
      volumeSessionStr: volCompact(tech.volumeSession), avgVol20Str: volCompact(tech.avgVol20),
      mom3mPct: pct2(mom3m), mom6mPct: pct2(mom6m),
    },

    fundamental: {
      available: !!fund?.available,
      marketCapStr: moneyCompact(marketCap) || scan?.cap || null,
      pe: r2(pe), forwardPe: null, ps: r2(ps), ev: null, peg: null,
      revenueTtmStr: moneyCompact(fund?.revenue?.ttm), revenueYoyPct: pct2(fund?.revenue?.yoyGrowthPct),
      revenueQoqYoyPct: pct2(fund?.revenue?.qoqYoyPct),
      epsTtm: r2(fund?.eps?.ttm), epsYoyPct: pct2(epsQ),
      netIncomeTtm: fund?.netIncome?.ttm ?? null, netIncomeTtmStr: moneyCompact(fund?.netIncome?.ttm),
      netMargin: pct2(fund?.margins?.net), grossMargin: null, operatingMargin: null, roe: pct2(roe),
      sharesDiluted: shares, sharesStr: volCompact(shares),
      annualEps: fund?.eps?.annual || [], annualRevenue: fund?.revenue?.annual || [],
      quarterlyEps: q, quarterlyRevenue: fund?.revenue?.quarterly || [],
      nextEarnings: null, source: fund?.source || 'SEC EDGAR', asOf: fund?.asOf || null,
      news: newsRes,
    },

    canslim: {
      strip: [
        ['C', Cstatus, warnOf(Cstatus)], ['A', Astatus, warnOf(Astatus)], ['N', Nstatus, warnOf(Nstatus)],
        ['S', shares ? 'Known' : 'No data', !shares], ['L', Lstatus, warnOf(Lstatus)],
        ['I', 'Not free', true], ['M', Mstatus, warnOf(Mstatus)],
      ],
      rsPercentile: null, mom3mPct: pct2(mom3m),
      C: { status: Cstatus, epsYoyPct: pct2(epsQ), salesYoyPct: pct2(salesQ), quarterly: q },
      A: { status: Astatus, epsCagr3yPct: pct2(epsCagr), roe: pct2(roe), annual: fund?.eps?.annual || [] },
      N: { status: Nstatus, high52: r2(tech.high52), distFromHighPct: pct2(near52) },
      S: { status: shares ? 'Known' : 'No data', sharesDiluted: shares, sharesStr: volCompact(shares), upDownVolRatio: tech.upDownVolRatio, accumulation: tech.accumulation },
      L: { status: Lstatus, mom3mPct: pct2(mom3m), mom6mPct: pct2(mom6m), sector: sectorName, rsPercentile: null },
      I: { status: 'Not on free data', note: 'Institutional 13F sponsorship needs a paid/holdings feed.' },
      M: { status: Mstatus, regime: regime?.output || null, bias: regime?.bias || null, distributionDays: market?.breadth?.distribution || null },
    },

    overview: {
      chart: bars.slice(-120).map((b) => r2(b.c)),
      themes: [scan?.sec, scan?.capBand === 'large' ? 'Large cap' : null, ...(Array.isArray(scan?.tags) ? scan.tags : [])].filter(Boolean),
      rsPercentile: null, mom3mPct: pct2(mom3m),
      market: regime ? { output: regime.output, bias: regime.bias, long: model?.long?.value, mid: model?.mid?.value, short: model?.short?.value } : null,
      news: [], // no free per-ticker news feed wired
    },
  };

  cache.set(t, { at: Date.now(), snap });
  return snap;
}
