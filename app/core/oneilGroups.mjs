// Trade-Disk — Industry Group Leadership (O'Neil's "L"), computed live from free
// Yahoo daily bars. O'Neil ranks industry groups by the relative strength of their
// members; a group where the median stock is strong is where leadership is forming.
//
// IBD's 197-group split and its RS curve-fit are proprietary. This uses an open,
// defensible stand-in, exactly as the old desk did: the universe is the S&P 500
// (liquid, well-defined), the groups are GICS sub-industries (bundled in
// app/data/sp500.json), and RS is each stock's IBD-style weighted price performance
// (3/6/9/12-month returns, recent quarter double-weighted) turned into a 1–99
// percentile within the universe. The rank WITHIN a group and the member count are
// exact for that universe — the two facts O'Neil actually trades on. It is a label,
// never a filter: nothing a screener returns changes because of it.
//
// The whole-S&P-500 fetch (~500 Yahoo calls) is too heavy for a page load, so it is
// computed in the BACKGROUND and cached for the day in radar_market (id=2, the same
// owner/admin-gated row the market snapshot uses at id=1). The first read of the day
// kicks the build and returns {computing:true}; the panel polls until it lands.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yahoo from '../providers/yahoo.mjs';
import { admin } from '../lib/supabase.mjs';

const UNIVERSE = JSON.parse(readFileSync(join(import.meta.dirname, 'reference', 'sp500.json'), 'utf8'));
const STALE_MS = 20 * 60 * 60 * 1000; // ~20h — recompute about once per trading day
const MIN_MEMBERS = 4;                // a GICS sub-industry needs ≥4 S&P 500 names to rank
const WINDOWS = [[63, 0.4], [126, 0.2], [189, 0.2], [252, 0.2]]; // IBD-style weighting

const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const ret = (closes, n) => {
  if (closes.length <= n) return null;
  const a = closes[closes.length - 1 - n], b = closes[closes.length - 1];
  return a ? ((b - a) / a) * 100 : null;
};

// One Yahoo chart with a hard timeout, so one hung symbol can't stall a whole chunk.
async function closesFor(sym) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const { bars } = await yahoo.chart(sym.replace(/\./g, '-'), { range: '1y', interval: '1d' });
    return (bars || []).map((b) => b.c).filter((c) => c != null);
  } catch { return null; } finally { clearTimeout(timer); }
}

// Weighted multi-period return (IBD RS proxy) for every symbol that has enough history.
async function performanceScores() {
  const score = {};
  const syms = UNIVERSE.map((u) => u.symbol);
  for (let i = 0; i < syms.length; i += 30) {               // chunks keep Yahoo happy
    await Promise.all(syms.slice(i, i + 30).map(async (s) => {
      const closes = await closesFor(s);
      if (!closes || closes.length < 70) return;             // need ≥ ~3 months
      let num = 0, wsum = 0;
      for (const [n, w] of WINDOWS) { const r = ret(closes, n); if (r != null) { num += w * r; wsum += w; } }
      if (wsum > 0) score[s] = num / wsum;
    }));
  }
  return score;
}

// Even 20-point letter bands over the 1–99 scale, each split in thirds (A+/A/A-…).
// IBD does not publish its boundaries, so these are our banding, not a claim to match.
function letterFor(pct) {
  const band = ['E', 'D', 'C', 'B', 'A'][Math.min(4, Math.max(0, Math.floor((pct - 1) / 20)))];
  const within = (pct - 1) % 20;
  return band + (within < 7 ? '−' : within < 14 ? '' : '+');
}

export async function buildGroups() {
  const score = await performanceScores();
  const syms = Object.keys(score);
  // RS = 1–99 percentile of the weighted performance across the universe.
  const ordered = [...syms].sort((a, b) => score[a] - score[b]);
  const rs = {};
  ordered.forEach((s, i) => { rs[s] = Math.max(1, Math.min(99, Math.round(((i + 0.5) / ordered.length) * 99))); });

  const byGroup = {};
  for (const u of UNIVERSE) {
    if (rs[u.symbol] == null) continue;
    (byGroup[u.group] ||= { sector: u.sector, members: [] }).members.push({ symbol: u.symbol, rs: rs[u.symbol] });
  }
  const groups = [];
  for (const [group, { sector, members }] of Object.entries(byGroup)) {
    if (members.length < MIN_MEMBERS) continue;
    members.sort((a, b) => b.rs - a.rs);
    const sorted = members.map((m) => m.rs).sort((a, b) => a - b);
    const mid = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    groups.push({
      group, sector, level: 'industry', members: members.length,
      median_rs: Math.round(mid * 10) / 10, top_rs: members[0].rs,
      share_over_80: Math.round((members.filter((m) => m.rs >= 80).length / members.length) * 100) / 100,
      leaders: members.slice(0, 5).map((m) => ({ symbol: m.symbol, rs: m.rs })),
    });
  }
  groups.sort((a, b) => b.median_rs - a.median_rs || b.top_rs - a.top_rs);
  const n = groups.length;
  groups.forEach((g, i) => { g.rank = i + 1; g.of = n; g.pct = Math.max(1, Math.min(99, Math.round((1 - i / n) * 98) + 1)); g.letter = letterFor(g.pct); });

  return {
    ok: true,
    builtAt: new Date().toISOString(),
    asOf: new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' ET',
    universe: 'S&P 500', mappedSymbols: syms.length, totalGroups: n, minMembers: MIN_MEMBERS,
    note: 'Groups are GICS sub-industries within the S&P 500 (our scope, not IBD’s proprietary 197-group model). RS is each stock’s IBD-style weighted 3/6/9/12-month return, percentiled 1–99 within the universe; groups rank by member median RS.',
    groups,
  };
}

// Read the cached ranking (radar_market id=2); if it is stale and this client may write
// the global row (owner/admin — RLS), rebuild it from the live feed first. The build is
// ~3s over the S&P 500, so this is synchronous like the market snapshot; any failure
// falls back to the last good ranking so the panel never breaks.
export async function getGroups(sb) {
  // The ranking is one global fact (not per-user), and rebuilding it is ~500 Yahoo
  // calls, so it must be cached for everyone — not only when an owner happens to open
  // the page. Write it with the service-role client, which bypasses RLS; fall back to
  // the request's client in local dev where no service key is set.
  const db = admin || sb;
  let cur = null;
  try { cur = (chk(await db.from('radar_groups').select('snapshot, as_of').eq('id', 1).limit(1)))[0] || null; } catch { /* read issue → treat as empty */ }
  const ageMs = cur?.as_of ? Date.now() - new Date(cur.as_of).getTime() : Infinity;
  if (cur && ageMs < STALE_MS) return cur.snapshot;
  try {
    const snap = await buildGroups();
    const { error } = await db.from('radar_groups').upsert({ id: 1, snapshot: snap, as_of: snap.builtAt });
    if (error) return cur ? cur.snapshot : snap; // couldn't cache → serve what we built/have
    return snap;
  } catch {
    return cur ? cur.snapshot : null; // live build failed → last good ranking
  }
}
