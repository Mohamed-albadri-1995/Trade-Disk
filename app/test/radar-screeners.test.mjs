// Radar — the screener definitions, the card mapping and the builder translator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREENERS, COLUMNS, listScreeners, getScreener, toCard } from '../core/screeners.mjs';
import { conditionsToFilters, RUNNABLE_METRICS } from '../core/screenerTranslate.mjs';
import { FILTER_MAP, OPERATORS } from '../ui-radar/src/screener-builder.js';

const row = (o) => ({ ticker: 'ABC', description: 'Abc Corp', close: 110, change: 10, relative_volume_10d_calc: 6,
  market_cap_basic: 5e9, sector: 'Tech', industry: 'Software', premarket_change: 3, ATR: 5.5,
  EMA9: 108, EMA13: 106, EMA20: 104, EMA50: 100, ...o });

test('toCard maps a scanner row to the card the screen renders', () => {
  const c = toCard(row({}));
  assert.equal(c.t, 'ABC'); assert.equal(c.n, 'Abc Corp');
  assert.equal(c.p, 110); assert.equal(c.c, 10);
  assert.equal(c.abs, 10);                       // 110 was 100 before a +10% day
  assert.deepEqual(c.changeLine, [100, 110]);
  assert.equal(c.adr, 5);                        // ATR 5.5 on 110
  assert.equal(c.pm, 0.6);                       // 3% pre-market move / 5% ADR
  assert.equal(c.sec, 'Software'); assert.equal(c.capBand, 'mid'); assert.equal(c.cap, '5B');
  assert.equal(c.ema, true); assert.equal(c.stacked, true);
  assert.deepEqual(c.tags, ['Pre-Market', 'High RVOL', 'Big Move']);
});

test('toCard score is the documented activity heuristic, clamped to 5..99', () => {
  assert.equal(toCard(row({ change: 0, relative_volume_10d_calc: 1 })).s, 50);
  assert.equal(toCard(row({ change: 10, relative_volume_10d_calc: 6 })).s, 95);
  assert.equal(toCard(row({ change: 80, relative_volume_10d_calc: 30 })).s, 99);
  assert.equal(toCard(row({ change: -60, relative_volume_10d_calc: 1 })).s, 5);
});

test('toCard survives a row with missing values', () => {
  const c = toCard({ ticker: 'X' });
  assert.equal(c.p, 0); assert.equal(c.c, 0); assert.equal(c.s, 50);
  assert.equal(c.cap, '—'); assert.equal(c.capBand, ''); assert.equal(c.sec, '—');
  assert.equal(c.ema, false); assert.equal(c.stacked, false); assert.deepEqual(c.tags, []);
  for (const v of [c.abs, c.adr, c.pm, c.r, ...c.changeLine]) assert.ok(Number.isFinite(v), 'no NaN on a card');
});

test('toCard keeps every number finite when a stock is down 100%', { todo: 'prev close divides by zero → Infinity on the card' }, () => {
  const c = toCard(row({ close: 0.01, change: -100 }));
  for (const v of [c.abs, ...c.changeLine]) assert.ok(Number.isFinite(v));
});

test('market cap label does not round a 1.5B company up to 2B', { todo: 'capFmt rounds billions and millions to whole numbers (1.5B → "2B", 999.6M → "1000M")' }, () => {
  assert.equal(toCard(row({ market_cap_basic: 1.5e9 })).cap, '1.5B');
  assert.equal(toCard(row({ market_cap_basic: 999.6e6 })).cap, '1.00B');
});

test('every built-in screener is well formed and only sorts/filters on real fields', () => {
  assert.equal(new Set(SCREENERS.map((s) => s.key)).size, SCREENERS.length);
  for (const s of SCREENERS) {
    assert.ok(s.name && s.note && s.sort?.sortBy && s.filters.length, s.key);
    assert.equal(getScreener(s.key), s);
    for (const f of s.filters) assert.ok(['greater', 'egreater', 'less', 'eless'].includes(f.operation), `${s.key}: ${f.operation}`);
    assert.equal(conditionsToFilters(s.conditions).unsupported.length, 0, `${s.key}: builder conditions must all translate`);
  }
  assert.deepEqual(listScreeners().map((s) => s.key), SCREENERS.map((s) => s.key));
  assert.equal(new Set(COLUMNS).size, COLUMNS.length);
});

// Loading a built-in into the builder must reproduce the screener that actually runs.
const sameRules = (key) => {
  const s = getScreener(key);
  const norm = (fs) => fs.map((f) => `${f.left} ${f.operation} ${f.right}`).sort();
  // the real rule sets carry a redundant lower price floor; drop exact duplicates of a field/op
  assert.deepEqual(norm(conditionsToFilters(s.conditions).filters), norm(s.filters));
};
test('builder version = running version: Volume Surges', () => sameRules('volume-surges'));
test('builder version = running version: Growth Pullback', () => sameRules('growth-pullback'));
test('builder version = running version: Pre-Market Movers', { todo: 'the running rules also carry close ≥ 0.5 (redundant with close ≥ 1); harmless but not identical' }, () => sameRules('premarket-movers'));
test('builder version = running version: MA Stack Breakout', { todo: 'runs on 1-minute averages (SMA5|1 > EMA9|1 …) but the builder version uses Daily — a different screener, not mentioned in the code comment' }, () => sameRules('ma-stack-breakout'));
test('builder version = running version: Trend Leaders', { todo: 'documented gap: two intraday rules (VWAP ≥ SMA75|5, 5-min relative volume > 3) are dropped and the 1-minute EMA rules become Daily' }, () => sameRules('trend-leaders'));

test('translator: value, compare, timeframe and Between conditions', () => {
  const { filters, unsupported } = conditionsToFilters([
    { metric: 'Close', operator: '≥', mode: 'value', value: '20', timeframe: 'Daily' },
    { metric: 'EMA', operator: '>', mode: 'filter', length: 9, timeframe: '5 minutes', compareMetric: 'SMA', compareLength: 50, compareTimeframe: 'Weekly' },
    { metric: 'RSI', operator: 'Between', mode: 'value', value: 70, upper: 30, timeframe: 'Daily' },
    { metric: 'Sector', operator: '=', mode: 'value', value: 'Finance', timeframe: 'Daily' },
  ]);
  assert.deepEqual(unsupported, []);
  assert.deepEqual(filters, [
    { left: 'close', operation: 'egreater', right: 20 },
    { left: 'EMA9|5', operation: 'greater', right: 'SMA50|1W' },
    { left: 'RSI', operation: 'in_range', right: [30, 70] },
    { left: 'sector', operation: 'equal', right: 'Finance' },
  ]);
});

test('translator reports what it cannot run instead of dropping it silently', () => {
  const { filters, unsupported } = conditionsToFilters([
    { metric: 'Float', operator: '>', mode: 'value', value: 1 },
    { metric: 'Close', operator: 'Crosses above', mode: 'value', value: 1 },
    { metric: 'Close', operator: '>', mode: 'value', value: '' },
    { metric: 'Close', operator: '>', mode: 'value', value: 'abc' },
    { metric: 'Close', operator: 'Between', mode: 'value', value: 1, upper: '' },
    { metric: 'Close', operator: '>', mode: 'filter', compareMetric: 'MACD' },
  ]);
  assert.equal(filters.length, 1, 'Between with an empty upper bound becomes [0,1] — see the todo below');
  assert.equal(unsupported.length, 5);
  assert.deepEqual(conditionsToFilters(null), { filters: [], unsupported: [] });
});

test('translator: Between with an empty bound is rejected', { todo: 'Number("") is 0, so "Between 1 and (blank)" runs as 0..1' }, () => {
  const r = conditionsToFilters([{ metric: 'Close', operator: 'Between', mode: 'value', value: 1, upper: '' }]);
  assert.equal(r.filters.length, 0);
});

test('translator: Between against another metric is rejected', { todo: 'emits in_range with a field name on the right; TradingView answers HTTP 400' }, () => {
  const r = conditionsToFilters([{ metric: 'Close', operator: 'Between', mode: 'filter', compareMetric: 'SMA', compareLength: 50 }]);
  assert.equal(r.filters.length, 0);
});

test('translator: a non-MA indicator honours its length', { todo: 'RSI/ATR/ADX/CCI/ROC ignore the length the builder shows (RSI length 7 runs as RSI 14)' }, () => {
  const r = conditionsToFilters([{ metric: 'RSI', operator: '>', mode: 'value', value: 70, length: 7 }]);
  assert.equal(r.filters[0].left, 'RSI7');
});

test('translator: a moving-average length the scanner does not have is reported', { todo: 'any length is emitted (EMA37, SMA5.5); the live scanner has no such field and silently returns 0 stocks' }, () => {
  const r = conditionsToFilters([{ metric: 'EMA', operator: '>', mode: 'value', value: 1, length: 37 }]);
  assert.equal(r.filters.length, 0); assert.equal(r.unsupported.length, 1);
});

test('everything the translator can run exists in the builder', { todo: 'Premarket volume, Premarket change, Month high/low and Week high/low are runnable (and used by the built-ins) but missing from the builder library, so a loaded built-in previews as "undefined (Daily)"' }, () => {
  const missing = RUNNABLE_METRICS.filter((m) => !FILTER_MAP[m]);
  assert.deepEqual(missing, []);
});

test('the builder offers every operator the translator can run', () => {
  for (const op of ['>', '≥', '<', '≤', '=', '≠', 'Between']) assert.ok(OPERATORS.includes(op));
});
