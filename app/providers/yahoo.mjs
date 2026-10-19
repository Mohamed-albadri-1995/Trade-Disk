// Trade-Disk — Yahoo Finance provider (free, personal-use only). Pulls the daily
// price bars that Radar's free groups (price/volume/range/indicators) and the
// company name are built from, for the watchlist tickers. One public endpoint, no
// API key. The feed switch (core/sources.mjs) keeps Yahoo out of commercial mode.
//
// Plain fetch, no proxy knowledge: on a normal machine it goes straight to Yahoo;
// in a proxied sandbox Node 22.21+ reads HTTPS_PROXY when NODE_USE_ENV_PROXY=1.

const CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/';

// One ticker → { meta, bars:[{t,o,h,l,c,v}] }, bars oldest→newest. Throws on error.
export async function chart(symbol, { range = '1y', interval = '1d' } = {}) {
  const u = `${CHART}${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const res = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
  const j = await res.json();
  const r = j?.chart?.result?.[0];
  if (!r) throw new Error(`Yahoo ${symbol}: ${j?.chart?.error?.description || 'no data'}`);
  const q = r.indicators?.quote?.[0] || {};
  const bars = (r.timestamp || [])
    .map((t, i) => ({ t, o: q.open?.[i], h: q.high?.[i], l: q.low?.[i], c: q.close?.[i], v: q.volume?.[i] }))
    .filter((b) => b.c != null && b.h != null && b.l != null); // drop empty holiday bars
  return { meta: r.meta || {}, bars };
}

// Several tickers at once (all in flight — Yahoo is fine with a handful). Returns
// { out: { symbol → {meta,bars} } for the ones that worked, errors: [{symbol,error}] }.
export async function charts(symbols, opts) {
  const out = {}, errors = [];
  await Promise.all(symbols.map(async (s) => {
    try { out[s] = await chart(s, opts); }
    catch (e) { errors.push({ symbol: s, error: String(e.message || e) }); }
  }));
  return { out, errors };
}
