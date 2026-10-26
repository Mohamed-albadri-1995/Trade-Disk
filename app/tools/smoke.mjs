// Trade-Disk — proof the backend serves the EXACT record the view reads, and that
// the view's own metric formula computes from it. No HTTP needed.
import { openDb } from '../lib/db.mjs';
import * as journal from '../api/journal.mjs';

const db = openDb();
const { trades, accounts, setups, dayNotes } = journal.bundle(db);

// 1) shape check — every field the prototype's screens read must be present
const EXPECTED = ['id','symbol','side','setup','assetType','qty','entry','exit','risk','date',
  'status','adherence','fees','net','gross','mult','movePct','r','account','source','duration',
  'tags','thesis','notes','stop','target','plannedRR','initialRisk','emotions','batch','createdAt','updatedAt'];
const t0 = trades[0];
const missing = EXPECTED.filter(k => !(k in t0));
console.log(missing.length ? `MISSING FIELDS: ${missing.join(', ')}` : `OK shape — all ${EXPECTED.length} trade fields present`);
console.log(`counts: ${trades.length} trades, ${accounts.length} accounts, ${setups.length} setups, ${Object.keys(dayNotes).length} day note(s)`);

// 2) the view's exact metric formula (copied from the prototype's stats()) over the served data
const c = trades.filter(t => t.status === 'Closed');
const wins = c.filter(t => t.net > 0), loss = c.filter(t => t.net < 0);
const sum = c.reduce((a, t) => a + t.net, 0);
const winSum = wins.reduce((a, t) => a + t.net, 0), lossSum = Math.abs(loss.reduce((a, t) => a + t.net, 0));
const rs = c.filter(t => Number.isFinite(t.r)).map(t => t.r);
const overview = {
  netPnl: Math.round(sum * 100) / 100,
  winRate: +(c.length ? wins.length / c.length * 100 : 0).toFixed(1) + '%',
  profitFactor: lossSum ? +(winSum / lossSum).toFixed(2) : null,
  expectancy: Math.round(sum / c.length * 100) / 100,
  closed: c.length, open: trades.length - c.length,
  avgR: rs.length ? +(rs.reduce((a, b) => a + b, 0) / rs.length).toFixed(2) : null,
};
console.log('overview the view will show:', JSON.stringify(overview));
console.log('sample trade:', JSON.stringify({ id: t0.id, symbol: t0.symbol, side: t0.side, net: t0.net, r: t0.r, movePct: t0.movePct, account: t0.account }));
