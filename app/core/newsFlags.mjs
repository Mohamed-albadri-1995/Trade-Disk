// Trade-Disk — the card's "news in the last 24h" flag. A scan can return up to 100
// stocks and one news lookup takes about half a second, so the lookups never hold up a
// scan: the scan stamps each card with whatever is already known here, then (in the
// background) the missing tickers are looked up and the day's register rows are updated,
// so the flags appear on the next read of the list (the page re-reads it every minute).
// Known answers are kept for 15 minutes.

import { news } from '../providers/news.mjs';

const TTL_MS = 15 * 60 * 1000;
const cache = new Map();   // ticker → { at, has }
// Background lookups are off inside the test runner (a test calls warmNews itself).
export const background = { enabled: !process.env.NODE_TEST_CONTEXT };

// true / false when known and still fresh, null when not looked up yet.
export function cachedNews(ticker) {
  const c = cache.get(ticker);
  return c && Date.now() - c.at < TTL_MS ? c.has : null;
}

export async function newsFlag(ticker, name = null) {
  const known = cachedNews(ticker);
  if (known != null) return known;
  const r = await news(ticker, { name, maxAgeHours: 24, limit: 1 }).catch(() => null);
  const has = !!(r && r.items && r.items.length);
  cache.set(ticker, { at: Date.now(), has });
  if (cache.size > 2000) cache.delete(cache.keys().next().value);
  return has;
}

// Look up every stock not yet known (five at a time), then set news:true on the
// register rows of this account/day/screener that have fresh news. Returns how many
// rows changed.
export async function warmNews(sb, uid, key, day, stocks) {
  const todo = (stocks || []).filter((s) => cachedNews(s.t) == null);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(5, todo.length) }, async () => {
    while (i < todo.length) { const s = todo[i++]; await newsFlag(s.t, s.n); }
  }));
  const { data, error } = await sb.from('radar_register').select('ticker, card').eq('owner_id', uid).eq('day', day).eq('screener', key);
  if (error) return 0;
  let changed = 0;
  for (const row of data || []) {
    const has = cachedNews(row.ticker);
    if (has == null || !!row.card?.news === has) continue;
    await sb.from('radar_register').update({ card: { ...row.card, news: has } })
      .eq('owner_id', uid).eq('day', day).eq('screener', key).eq('ticker', row.ticker);
    changed++;
  }
  return changed;
}
export const _resetNewsCache = () => cache.clear();
