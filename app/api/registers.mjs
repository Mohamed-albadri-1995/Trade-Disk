// Trade-Disk — the register browser API. Open a screener's register for a specific
// day (the stocks it surfaced that day) and chart any of them on that exact day. The
// catalog + daily history are the migrated record (radar_screen_catalog / radar_history);
// the chart's intraday bars come from Polygon (cache-first, same polygon_bars cache the
// backtest uses). Everything rides the signed-in user's RLS-scoped client.

import { bars as fetchBars, hasKey } from '../providers/polygon.mjs';

const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const clock = (m) => { if (m == null) return null; const t = 570 + m; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(((t % 60) + 60) % 60).padStart(2, '0')}`; };

async function polyKey(sb) {
  const d = chk(await sb.from('app_setting').select('value').eq('key', 'polygon_api_key').limit(1));
  return (d[0]?.value || '').trim();
}

// The screens that have a recorded register (with their day window + size).
export async function screens(sb) {
  return chk(await sb.from('radar_screen_catalog')
    .select('screen,name,src,status,first_day,last_day,days,members')
    .order('members', { ascending: false }));
}

// The distinct days a screen surfaced anything, newest first (for the day picker).
export async function days(sb, screen) {
  screen = String(screen || '').trim();
  if (!screen) throw new Error('pick a screen');
  const seen = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('radar_history').select('day').eq('screen', screen).order('day', { ascending: false }).range(from, from + 999);
    if (error) throw new Error('radar_history: ' + error.message);
    for (const r of (data || [])) seen.set(r.day, (seen.get(r.day) || 0) + 1);
    if (!data || data.length < 1000) break;
  }
  return [...seen.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([day, n]) => ({ day, n }));
}

// The stocks a screen surfaced on one day, in first-seen order.
export async function day(sb, screen, dayStr) {
  screen = String(screen || '').trim(); dayStr = String(dayStr || '').trim();
  if (!screen || !dayStr) throw new Error('screen and day are required');
  const rows = chk(await sb.from('radar_history').select('ticker,first_seen_min,facts').eq('screen', screen).eq('day', dayStr));
  return rows
    .map((r) => ({ ticker: r.ticker, firstSeenMin: r.first_seen_min, firstSeen: clock(r.first_seen_min), name: r.facts?.name || r.facts?.n || null }))
    .sort((a, b) => (a.firstSeenMin ?? 1e9) - (b.firstSeenMin ?? 1e9) || (a.ticker < b.ticker ? -1 : 1));
}

// Intraday bars for one ticker on one day, at a minute interval (1/5/15). Cache-first:
// returns cached bars instantly, else fetches once from Polygon and caches them.
export async function intradayBars(sb, uid, ticker, dayStr, interval) {
  ticker = String(ticker || '').trim().toUpperCase(); dayStr = String(dayStr || '').trim();
  interval = ['1', '5', '15'].includes(String(interval)) ? String(interval) : '1';
  if (!ticker || !dayStr) throw new Error('ticker and day are required');
  const cached = chk(await sb.from('polygon_bars').select('bars').eq('ticker', ticker).eq('day', dayStr).eq('interval', interval).limit(1))[0];
  if (cached) return { ticker, day: dayStr, interval, bars: cached.bars || [], cached: true };
  const key = await polyKey(sb);
  if (!hasKey(key)) return { ticker, day: dayStr, interval, bars: [], error: 'Add your Polygon API key first (in the Lab → Backtest tab).' };
  let r;
  try { r = await fetchBars(ticker, dayStr, key, +interval); }
  catch (e) { return { ticker, day: dayStr, interval, bars: [], error: String(e.message || e) }; }
  if (r.rateLimited) return { ticker, day: dayStr, interval, bars: [], rateLimited: true };
  const got = r.bars || [];
  chk(await sb.from('polygon_bars').upsert(
    { owner_id: uid, ticker, day: dayStr, interval, bars: got, n: got.length, fetched_at: new Date().toISOString() },
    { onConflict: 'owner_id,ticker,day,interval' }));
  return { ticker, day: dayStr, interval, bars: got, cached: false };
}
