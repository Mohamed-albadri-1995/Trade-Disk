// Trade-Disk — Radar ingestion (solo mode). Refreshes the watchlist's free-group
// fields — price, change, relative volume, ADR%, the EMA/stack flags, the sparkline
// and the company name — from whatever provider the Price group is set to, honouring
// the feed switch (core/sources.mjs). The paid-group fields (fundamentals, growth,
// events) plus score, pre-market, sector and market cap stay as seeded until a paid
// adapter is wired (P4). Demo mode is a deliberate no-op: reseed to reset the demo.

import { all, run } from '../lib/db.mjs';
import { getMode, activeFor } from './sources.mjs';
import * as yahoo from '../providers/yahoo.mjs';
import { derive } from '../providers/compute.mjs';

const round = (v, n) => (v == null ? null : +Number(v).toFixed(n));
const pct = (a, b) => (b ? +(((a - b) / b) * 100).toFixed(2) : 0);

// Which provider feeds the Price group right now (the first active one the running
// mode allows). Returns { id } when live, or { id, blocked, reason } when it can't run.
function pricePrider(db) {
  const first = activeFor(db, 'price')[0];
  if (!first || first.id === 'demo') return { id: 'demo' };
  if (!first.usable) return { id: first.id, blocked: true, reason: `${first.id} is not licensed for commercial use — pick a licensed provider in Admin.` };
  if (first.needsKey && !first.hasKey) return { id: first.id, blocked: true, reason: `${first.id} needs an API key — add it in Admin.` };
  return { id: first.id };
}

// Refresh the whole watchlist from the live price feed. Returns a small report.
export async function refresh(db) {
  const tickers = all(db, `SELECT t FROM radar_stock ORDER BY sort`).map((r) => r.t);
  if (!tickers.length) return { updated: 0, note: 'No watchlist rows — seed the demo first.' };

  const p = pricePrider(db);
  if (p.id === 'demo') return { provider: 'demo', updated: 0, note: 'Demo mode — switch the Price group to Yahoo in Admin, then refresh.' };
  if (p.blocked) return { provider: p.id, updated: 0, error: p.reason };
  if (p.id !== 'yahoo') return { provider: p.id, updated: 0, note: `${p.id} needs a paid adapter — not wired yet.` };

  const { out, errors } = await yahoo.charts(tickers, { range: '1y', interval: '1d' });
  let updated = 0;
  for (const t of tickers) {
    const d = out[t];
    if (!d || !d.bars.length) continue;
    const m = d.meta, bars = d.bars;
    const price = m.regularMarketPrice ?? bars[bars.length - 1].c;
    // Daily change is vs the prior session's close — the second-to-last daily bar.
    // (meta.chartPreviousClose is the close before the whole range window, not yesterday.)
    const prev = bars.length > 1 ? bars[bars.length - 2].c : (m.chartPreviousClose ?? price);
    const der = derive(bars);
    run(db, `UPDATE radar_stock SET n=COALESCE(?,n), p=?, c=?, abs=?, r=COALESCE(?,r),
             adr=COALESCE(?,adr), ema=?, stacked=?, change_line=? WHERE t=?`,
      m.longName || m.shortName || null,
      round(price, 2), pct(price, prev), round(price - prev, 2),
      der.r, der.adr, der.ema ? 1 : 0, der.stacked ? 1 : 0, JSON.stringify(der.changeLine), t);
    updated++;
  }
  const at = new Date().toISOString();
  run(db, `INSERT INTO app_setting (key,value) VALUES ('radar_refreshed_at',?)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value`, at);
  return { provider: 'yahoo', mode: getMode(db), updated, failed: errors, at };
}

// CLI: `node core/ingest.mjs` (or `npm run refresh` from app/).
if (import.meta.filename === process.argv[1]) {
  const { openDb } = await import('../lib/db.mjs');
  const db = openDb();
  console.log(JSON.stringify(await refresh(db), null, 2));
}
