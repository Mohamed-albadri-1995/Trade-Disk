// Trade-Disk — Radar data collection (the feature store). On each scheduled fire (or
// a manual run), it runs the screener and FREEZES the result for later model-building:
//  • radar_snapshot        — one row per stock at this time: the full card + live flag
//  • radar_snapshot_market — the whole market snapshot at this time
//  • radar_snapshot_facts  — the heavy per-stock analysis (hero + fundamental +
//                            technical + CAN SLIM), captured ONCE per day per stock
//                            (those are static/slow intraday, so one capture is complete)
// After the close, labels.mjs adds the outcomes. Everything is keyed by (day, screener,
// taken_at, ticker) so it can be sliced by screener OR by time — folders aren't needed.
//
// Runs with the service-role client (admin) so the scheduler can collect for an account
// with no signed-in request; every write is still stamped with that account's owner_id.

import * as radar from '../api/radar.mjs';
import { getMarket } from './market.mjs';
import { buildAnalysis } from './analysis.mjs';
import { etDay } from './register.mjs';

const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FACTS_PER_FIRE = 40; // cap the heavy per-stock analysis captures per fire

// Run one screener for one account and freeze the snapshot. `sb` is the client that
// owns the writes — the service-role (admin) client when the scheduler collects with no
// live session, or the user's own client for a manual "collect now". `withFacts`
// captures the per-stock analysis for names not yet captured today (throttled).
export async function collect(sb, uid, key, { withFacts = true } = {}) {
  if (!sb) throw new Error('data collection needs a database client');
  const takenAt = new Date().toISOString();
  const day = etDay();

  const res = await radar.scan(sb, uid, key, 60);              // runs the register + forces a market refresh
  if (res.error) return { ok: false, key, error: res.error };
  const stocks = res.stocks || [];

  // 1) frozen card per stock at this time
  if (stocks.length) {
    const rows = stocks.map((s) => ({ owner_id: uid, day, screener: key, taken_at: takenAt, ticker: s.t, live: !!s.live, card: s }));
    chk(await sb.from('radar_snapshot').insert(rows));
  }
  // 2) market status at this time
  const market = await getMarket(sb).catch(() => null);
  if (market) chk(await sb.from('radar_snapshot_market').upsert({ owner_id: uid, day, taken_at: takenAt, snapshot: market }));

  // 3) per-stock analysis facts, once per day per ticker
  let facts = 0;
  if (withFacts && stocks.length) {
    const have = new Set(chk(await sb.from('radar_snapshot_facts').select('ticker').eq('owner_id', uid).eq('day', day)).map((r) => r.ticker));
    const todo = stocks.filter((s) => !have.has(s.t)).slice(0, FACTS_PER_FIRE);
    for (const s of todo) {
      try {
        const a = await buildAnalysis(s.t, { scan: { n: s.n, sec: s.sec, cap: s.cap, capBand: s.capBand, tags: s.tags }, market });
        chk(await sb.from('radar_snapshot_facts').upsert({ owner_id: uid, day, ticker: s.t, taken_at: new Date().toISOString(), analysis: a }));
        facts++;
      } catch { /* a stock whose analysis fails is skipped; its card snapshot is still kept */ }
      await sleep(250);                                        // be gentle to Yahoo / SEC EDGAR
    }
  }
  return { ok: true, key, taken_at: takenAt, day, snapshots: stocks.length, live: res.liveCount, facts };
}

// What has been collected today, for the status panel.
export async function collectionStatus(sb, day = etDay()) {
  const chkc = async (t) => (await sb.from(t).select('ticker', { count: 'exact', head: true }).eq('day', day)).count || 0;
  const [snaps, facts, labels] = await Promise.all([chkc('radar_snapshot'), chkc('radar_snapshot_facts'), chkc('radar_snapshot_label')]);
  const times = chk(await sb.from('radar_snapshot_market').select('taken_at').eq('day', day).order('taken_at'));
  return { day, snapshotRows: snaps, facts, labels, snapshotTimes: times.map((t) => t.taken_at) };
}
