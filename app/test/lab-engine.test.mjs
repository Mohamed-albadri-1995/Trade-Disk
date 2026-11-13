// Lab — the strategy simulator and the backtest report: fills, stops, targets and the
// cases where a backtest can quietly flatter itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, validateStrategy } from '../core/lab/evaluate.mjs';
import { report } from '../core/lab/report.mjs';
import { runBacktest } from '../core/lab/backtest.mjs';

const DAY = 86400, T0 = Date.UTC(2026, 0, 5) / 1000;
// bars from [o,h,l,c] rows, one per day
const mk = (rows) => rows.map(([o, h, l, c], i) => ({ t: T0 + i * DAY, o, h, l, c, v: 1000 }));
// enter long when the close crosses above `level`
const strat = (risk = {}, extra = {}) => ({
  side: 'long',
  entry: { logic: 'AND', rules: [{ left: { kind: 'price', source: 'close' }, op: 'cross_above', right: { kind: 'const', value: 100 } }] },
  risk, ...extra,
});
const flat = (n, px = 99) => Array.from({ length: n }, () => [px, px + 0.5, px - 0.5, px]);

test('desk fill: enters at the next open; stop and target priced off the decision close', () => {
  const bars = mk([...flat(3), [99, 101, 99, 101], [102, 103, 101.5, 102.5], [102.5, 104.5, 102, 104]]);
  const { trades } = simulate(bars, strat({ sl: { type: 'points', value: 2 }, tp: { type: 'points', value: 3 } }), { fill: 'desk' });
  assert.equal(trades.length, 1);
  const t = trades[0];
  assert.deepEqual([t.entry, t.stop, t.exit, t.reason, t.entryBar, t.exitBar], [102, 99, 104, 'TP', 4, 5]);
  assert.equal(t.r, +((104 - 102) / (102 - 99)).toFixed(3));
});

test('close fill: the entry bar’s own high and low cannot hit the brackets (no look-ahead)', () => {
  // decision bar closes at 101 but its high was 110 — a target at 104 must NOT be filled on it
  const bars = mk([...flat(3), [99, 110, 99, 101], [101, 101.5, 100.5, 101], [101, 101.2, 100.8, 101]]);
  const { trades } = simulate(bars, strat({ sl: { type: 'points', value: 5 }, tp: { type: 'points', value: 3 } }), { fill: 'close' });
  assert.equal(trades.length, 1);
  assert.equal(trades[0].reason, 'open', 'the target was only reached BEFORE the entry');
  assert.equal(trades[0].entry, 101);
});

test('close fill on the last bar is reported as an open position, not dropped', () => {
  const bars = mk([...flat(3), [99, 101, 99, 101]]);
  const { trades } = simulate(bars, strat({ sl: { type: 'points', value: 2 } }), { fill: 'close' });
  assert.deepEqual(trades.map((t) => [t.reason, t.entry, t.exit]), [['open', 101, 101]]);
});

test('a bar that reaches both stop and target counts as a stop (the backtest must not flatter)', () => {
  const both = [102, 106, 98, 103];                         // after entry at 102: stop 99, target 105 — both inside this bar
  const bars = mk([...flat(3), [99, 101, 99, 101], both, [103, 103, 103, 103]]);
  const risk = { sl: { type: 'points', value: 2 }, tp: { type: 'points', value: 4 } };
  assert.equal(simulate(bars, strat(risk), { fill: 'desk' }).trades[0].reason, 'SL');
  assert.equal(simulate(bars, strat({ ...risk, stop_first: false }), { fill: 'desk' }).trades[0].reason, 'TP', 'optimistic order only on request');
});

test('a bar that opens beyond the target fills the target at that open', () => {
  const bars = mk([...flat(3), [99, 101, 99, 101], [101, 101.5, 100.5, 101], [108, 109, 97, 100]]);
  const t = simulate(bars, strat({ sl: { type: 'points', value: 2 }, tp: { type: 'points', value: 4 } }), { fill: 'desk' }).trades[0];
  assert.deepEqual([t.reason, t.exit], ['TP', 108]);
});

test('a gap through the stop fills at the open, not at the stop', () => {
  const bars = mk([...flat(3), [99, 101, 99, 101], [101, 101.5, 100.5, 101], [95, 96, 94, 95]]);
  const t = simulate(bars, strat({ sl: { type: 'points', value: 2 } }), { fill: 'desk' }).trades[0];
  assert.deepEqual([t.reason, t.exit], ['SL', 95]);
});

test('a trailing indicator stop moves on the last closed bar, never the bar it is tested on', () => {
  // trail = lowest low of 1 bar. Entry at bar 4's open. Bar 5's low is 104, so the stop
  // ENTERING bar 6 is 104, and bar 6 (low 103.5) stops out there. Using each bar's own low
  // would have set a 104 stop during bar 5 and "hit" it on that same bar (exit at bar 5).
  const bars = mk([...flat(3), [99, 101, 99, 101], [101, 105, 100.8, 105], [105, 106, 104, 105.8], [105.8, 108, 103.5, 107.5], [107.5, 108, 107, 108]]);
  const s = strat({ sl: { type: 'prim', anchor: 'lowest', source: 'low', params: { length: 1 } } });
  const t = simulate(bars, s, { fill: 'desk' }).trades[0];
  assert.deepEqual([t.reason, t.exit, t.exitBar], ['trail', 104, 6]);
});

test('costs are charged on both sides of every trade', () => {
  const bars = mk([...flat(3), [99, 101, 99, 101], [102, 103, 101.5, 102.5], [102.5, 104.5, 102, 104]]);
  const t = simulate(bars, strat({ sl: { type: 'points', value: 2 }, tp: { type: 'points', value: 3 } }), { fill: 'desk', costBps: 10 }).trades[0];
  assert.equal(t.gross, +((104 / 102 - 1) * 100).toFixed(4));
  assert.equal(t.ret, +(t.gross - 0.2).toFixed(4));
});

test('validation catches a strategy that cannot be run as written', () => {
  assert.equal(validateStrategy(strat()).ok, true);
  assert.match(validateStrategy({ ...strat(), side: 'up' }).errors.join(), /side/);
  assert.match(validateStrategy(strat({ targets: [{ fraction: 0.5, r_multiple: 2 }] })).errors.join(), /needs a stop/);
  assert.match(validateStrategy(strat({ sl: { type: 'points', value: 1 }, targets: [{ fraction: 0.7, r_multiple: 1 }, { fraction: 0.6, r_multiple: 2 }] })).errors.join(), /over 1/);
});

// ── report ──
const tr = (ret, i, o = {}) => ({ ret, r: ret / 2, reason: ret ? (ret > 0 ? 'TP' : 'SL') : 'exit', side: 'long', symbol: 'A', entry_ts: T0 + i * DAY, exit_ts: T0 + (i + 1) * DAY, bars_held: 1, ...o });

test('report: open positions stay out of the win rate; the numbers add up', () => {
  const r = report([tr(4, 0), tr(-2, 1), tr(0, 2), tr(9, 3, { reason: 'open' })]);
  assert.deepEqual([r.headline.trades, r.headline.wins, r.headline.losses, r.headline.breakeven], [3, 1, 1, 1]);
  assert.equal(r.headline.profitFactor, 2); assert.equal(r.headline.netProfit, 2);
  assert.equal(r.open.length, 1);
  assert.equal(r.equity.end, +(100 * 1.04 * 0.98).toFixed(2));
  assert.ok(r.warnings.some((w) => /still open/.test(w)) && r.warnings.some((w) => /small sample/.test(w)));
});

test('report: Sharpe annualises a calendar-daily series by 365', () => {
  const trades = Array.from({ length: 80 }, (_, i) => tr(i % 2 ? 1 : -0.5, i));
  const r = report(trades);
  const curve = [100]; for (const t of trades) curve.push(curve.at(-1) * (1 + t.ret / 100));
  const rets = curve.slice(1).map((e, i) => e / curve[i] - 1);
  const m = rets.reduce((a, b) => a + b, 0) / rets.length, sd = Math.sqrt(rets.reduce((a, x) => a + (x - m) ** 2, 0) / rets.length);
  assert.ok(Math.abs(r.ratios.sharpe - m / sd * Math.sqrt(365)) < 0.05, `${r.ratios.sharpe} vs ${m / sd * Math.sqrt(365)}`);   // the curve is kept in cents
});

// ── backtest runner ──
test('backtest: only trades entered inside the range count; account sizing risks the set budget', async () => {
  const rows = [...flat(70), [99, 101, 99, 101], [102, 103, 101.5, 102.5], [102.5, 104.5, 102, 104], ...flat(10, 104)];
  const bars = mk(rows);
  const day = (i) => new Date((T0 + i * DAY) * 1000).toISOString().slice(0, 10);
  const run = (start, acct) => runBacktest({ strategy: strat({ sl: { type: 'points', value: 2 }, tp: { type: 'points', value: 3 } }),
    universe: { symbols: ['abc'] }, start, end: day(rows.length - 1), fill: 'desk', accounting: acct }, { getBars: async () => ({ bars }) });
  assert.equal((await run(day(60), { mode: 'unit' })).trades.length, 1);
  assert.equal((await run(day(72), { mode: 'unit' })).trades.length, 0, 'entry before the range start is warm-up, not a trade');
  const acct = await run(day(60), { mode: 'account', startEquity: 10000, riskPct: 1 });
  const t = acct.trades[0];
  assert.equal(t.symbol, 'ABC');
  assert.equal(t.shares, Math.floor(100 / 3));                // $100 risk / $3 per share
  assert.equal(t.pnl, Math.round(t.shares * 2 * 100) / 100);  // +$2 a share
});
