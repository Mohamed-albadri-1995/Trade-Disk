// Trade-Disk — Radar's daily register (the "sticky screener"). A stock that shows
// up on a screener today STAYS on that screener's list until the end of the trading
// day, even if a later scan no longer returns it: it is kept and marked "not live
// now". Every scan refreshes the live data of EVERY stock on the list — the ones the
// scan returned (live now) and the ones carried over (re-quoted from TradingView),
// so the whole list is always current. Each stock keeps its first-seen and last-live
// times. The register is per account, per screener, per ET trading day, persisted in
// radar_register (which also becomes the historical daily record the Lab can backtest).

import * as tv from '../providers/tradingview.mjs';
import { COLUMNS, toCard } from './screeners.mjs';

const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const COLORS = ['', 'blue', 'purple', 'orange', 'green'];
// Today's date in the US market's timezone (YYYY-MM-DD) — the trading day the list belongs to.
export const etDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const etTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' }) + ' ET' : null);

// Run one screener (built-in or custom) and merge its results into today's register.
// `spec` = { key, filters, sort, limit }. Returns the full merged list for the UI.
export async function runScreener(sb, uid, spec) {
  const { key, filters, sort, limit = 50 } = spec;
  const { rows } = await tv.scan({ filters, columns: COLUMNS, sort, range: [0, Math.min(100, limit)] });
  const liveCards = rows.map((r, i) => ({ card: toCard(r, i), sym: r._sym }));
  const liveTickers = new Set(liveCards.map((l) => l.card.t));

  const day = etDay();
  const now = new Date().toISOString();
  const existing = chk(await sb.from('radar_register').select('ticker, sym, card, first_seen, last_live').eq('day', day).eq('screener', key));
  const prevBy = Object.fromEntries(existing.map((e) => [e.ticker, e]));

  const toWrite = [];
  // 1) the stocks this scan returned — live now, data fresh from the scan
  for (const { card, sym } of liveCards) {
    const prev = prevBy[card.t];
    toWrite.push({ owner_id: uid, day, screener: key, ticker: card.t, sym: sym || prev?.sym || null,
      card, live: true, first_seen: prev?.first_seen || now, last_live: now, updated_at: now });
  }
  // 2) the stocks carried over from earlier today — not live now, but KEPT and their
  //    data re-quoted so the list stays current (data of all stocks updated each scan)
  const carried = existing.filter((e) => !liveTickers.has(e.ticker));
  const refreshed = {};
  if (carried.length) {
    try {
      const q = await tv.quote(carried.map((c) => c.sym).filter(Boolean), COLUMNS);
      for (const r of q.rows) refreshed[r.ticker] = toCard(r);
    } catch { /* re-quote failed → keep last-known data rather than drop the stock */ }
  }
  for (const e of carried) {
    toWrite.push({ owner_id: uid, day, screener: key, ticker: e.ticker, sym: e.sym,
      card: refreshed[e.ticker] || e.card, live: false, first_seen: e.first_seen, last_live: e.last_live, updated_at: now });
  }

  if (toWrite.length) chk(await sb.from('radar_register').upsert(toWrite, { onConflict: 'owner_id,day,screener,ticker' }));

  // Build the response list: live names first, then carried-over, each by activity
  // score; stamp first-seen / last-live for the card and the analysis hero.
  const stocks = toWrite.map((r) => ({
    ...r.card, live: r.live,
    firstSeen: r.first_seen, lastLive: r.last_live,
    firstSeenEt: etTime(r.first_seen), lastLiveEt: etTime(r.last_live),
  }));
  stocks.sort((a, b) => (b.live === a.live ? (b.s || 0) - (a.s || 0) : (b.live ? 1 : -1)));
  stocks.forEach((c, i) => { c.color = COLORS[i % COLORS.length]; });
  return { stocks, liveCount: liveCards.length, count: stocks.length, day };
}

// Read today's register for a screener without running a scan (page revisit).
export async function readRegister(sb, key) {
  const day = etDay();
  const rows = chk(await sb.from('radar_register').select('*').eq('day', day).eq('screener', key));
  const stocks = rows.map((r) => ({ ...r.card, live: r.live, firstSeen: r.first_seen, lastLive: r.last_live, firstSeenEt: etTime(r.first_seen), lastLiveEt: etTime(r.last_live) }));
  stocks.sort((a, b) => (b.live === a.live ? (b.s || 0) - (a.s || 0) : (b.live ? 1 : -1)));
  stocks.forEach((c, i) => { c.color = COLORS[i % COLORS.length]; });
  return { stocks, liveCount: stocks.filter((s) => s.live).length, count: stocks.length, day };
}

// The first-seen / last-live stamps for one ticker today (for the analysis hero).
export async function tickerStamps(sb, ticker) {
  const day = etDay();
  const rows = chk(await sb.from('radar_register').select('screener, live, first_seen, last_live').eq('day', day).eq('ticker', ticker));
  if (!rows.length) return null;
  const firstSeen = rows.map((r) => r.first_seen).sort()[0];
  const lastLive = rows.map((r) => r.last_live).sort().at(-1);
  return { firstSeen, lastLive, firstSeenEt: etTime(firstSeen), lastLiveEt: etTime(lastLive), liveNow: rows.some((r) => r.live) };
}
