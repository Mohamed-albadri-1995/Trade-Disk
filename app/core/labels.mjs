// Trade-Disk — Radar outcome labels, collected after the close (or any time later —
// it reads from Yahoo, which keeps intraday history for weeks). For every stock seen
// on any screener that day it stores the day's open/high/low/close AND the full
// intraday 5-minute bar path. With the bar path, ANY forward label a model wants —
// the high/low/return from 9:40 (or any snapshot time) to the close, time-to-target,
// max favourable/adverse excursion — is computable offline from stored data. So the
// features (snapshots) and the outcomes (labels) join on (day, ticker).

import * as yahoo from '../providers/yahoo.mjs';
import { etDay } from './register.mjs';

const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const etDateOf = (tsSec) => new Date(tsSec * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

// Compute and store labels for every ticker an account collected on `day`. `sb` owns
// the writes (admin for the scheduler, the user's client for a manual run).
export async function computeLabels(sb, uid, day = etDay()) {
  if (!sb) return { ok: false, error: 'data labels need a database client' };
  const seen = chk(await sb.from('radar_snapshot').select('ticker').eq('owner_id', uid).eq('day', day));
  const tickers = [...new Set(seen.map((r) => r.ticker))];
  if (!tickers.length) return { ok: true, day, tickers: 0, labeled: 0 };

  let labeled = 0;
  for (let i = 0; i < tickers.length; i += 1) {
    const t = tickers[i];
    try {
      // ~1 month of 5-minute bars covers the day with headroom; filter to the ET day.
      const { bars } = await yahoo.chart(t, { range: '1mo', interval: '5m' });
      const dayBars = (bars || []).filter((b) => etDateOf(b.t) === day && b.c != null);
      if (!dayBars.length) { await sleep(150); continue; }
      const open = dayBars[0].o, close = dayBars[dayBars.length - 1].c;
      const high = Math.max(...dayBars.map((b) => b.h)), low = Math.min(...dayBars.map((b) => b.l));
      chk(await sb.from('radar_snapshot_label').upsert({
        owner_id: uid, day, ticker: t,
        open: +open?.toFixed(4) || null, high: +high.toFixed(4), low: +low.toFixed(4), close: +close.toFixed(4),
        bars: dayBars.map((b) => ({ t: b.t, o: +b.o?.toFixed(4), h: +b.h.toFixed(4), l: +b.l.toFixed(4), c: +b.c.toFixed(4), v: b.v })),
        computed_at: new Date().toISOString(),
      }));
      labeled++;
    } catch { /* skip a ticker whose bars can't be fetched; it can be back-filled later */ }
    await sleep(200);
  }
  return { ok: true, day, tickers: tickers.length, labeled };
}
