// Radar — the screener definitions, the card mapping and the builder translator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREENERS, COLUMNS, listScreeners, getScreener, toCard } from '../core/screeners.mjs';
import { conditionsToFilters, RUNNABLE_METRICS, LENGTHS } from '../core/screenerTranslate.mjs';
import { FILTER_MAP, OPERATORS, newCondition, FIXED_LENGTH, tzToSave, tzToShow, tzOptions, deviceZone } from '../ui-radar/src/screener-builder.js';

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

test('toCard keeps every number finite when a stock is down 100%', () => {
  const c = toCard(row({ close: 0.01, change: -100 }));
  for (const v of [c.abs, ...c.changeLine]) assert.ok(Number.isFinite(v));
});

test('market cap label does not round a 1.5B company up to 2B', () => {
  const cap = (n) => toCard(row({ market_cap_basic: n })).cap;
  assert.deepEqual([1.5e9, 999.6e6, 5e9, 25.4e9, 9.96e9, 3.21e12, 450e6, 2.5e6, 999.4e3, 12345].map(cap),
    ['1.5B', '1B', '5B', '25B', '10B', '3.21T', '450M', '2.5M', '999400', '12345']);
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
// The conditions go through newCondition first — exactly what the builder does on load,
// including its default lengths — so this proves the round trip, not just the raw data.
const sameRules = (key) => {
  const s = getScreener(key);
  const norm = (fs) => fs.map((f) => `${f.left} ${f.operation} ${f.right}`).sort();
  const t = conditionsToFilters(s.conditions.map((c) => newCondition(c)));
  assert.deepEqual(t.unsupported, []);
  assert.deepEqual(norm(t.filters), norm(s.filters));
};
test('builder version = running version: Volume Surges', () => sameRules('volume-surges'));
test('builder version = running version: Growth Pullback', () => sameRules('growth-pullback'));
test('builder version = running version: Pre-Market Movers', () => sameRules('premarket-movers'));
test('builder version = running version: MA Stack Breakout', () => sameRules('ma-stack-breakout'));
test('builder version = running version: Trend Leaders', () => sameRules('trend-leaders'));

test('translator: value, compare, timeframe and Between conditions', () => {
  const { filters, unsupported } = conditionsToFilters([
    { metric: 'Close', operator: '≥', mode: 'value', value: '20', timeframe: 'Daily' },
    { metric: 'EMA', operator: '>', mode: 'filter', length: 9, timeframe: '5 minutes', compareMetric: 'SMA', compareLength: 50, compareTimeframe: 'Weekly' },
    { metric: 'RSI', operator: 'Between', mode: 'value', value: 70, upper: 30, timeframe: 'Daily', length: '' },
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
  assert.equal(filters.length, 0);
  assert.equal(unsupported.length, 6);
  assert.deepEqual(conditionsToFilters(null), { filters: [], unsupported: [] });
});

test('translator: Between with an empty bound is rejected', () => {
  const r = conditionsToFilters([{ metric: 'Close', operator: 'Between', mode: 'value', value: 1, upper: '' }]);
  assert.equal(r.filters.length, 0);
});

test('translator: Between against another metric is rejected', () => {
  const r = conditionsToFilters([{ metric: 'Close', operator: 'Between', mode: 'filter', compareMetric: 'SMA', compareLength: 50 }]);
  assert.equal(r.filters.length, 0);
});

test('translator: an indicator honours its length, and refuses one the scanner lacks', () => {
  const left = (c) => conditionsToFilters([{ operator: '>', mode: 'value', value: 1, ...c }]);
  assert.equal(left({ metric: 'RSI', length: 7 }).filters[0].left, 'RSI7');
  assert.equal(left({ metric: 'RSI', length: 14 }).filters[0].left, 'RSI');
  assert.equal(left({ metric: 'RSI' }).filters[0].left, 'RSI');
  assert.equal(left({ metric: 'CCI', length: 20 }).filters[0].left, 'CCI20');
  assert.equal(left({ metric: 'VWMA', length: 20, timeframe: 'Weekly' }).filters[0].left, 'VWMA|1W');
  assert.match(left({ metric: 'CCI', length: 14 }).unsupported[0].reason, /CCI 20 only/);
  assert.match(left({ metric: 'RSI', length: 8 }).unsupported[0].reason, /RSI 2, 3, 4/);
  assert.equal(left({ metric: 'WMA', length: 20 }).unsupported.length, 1, 'the scanner has no WMA at all');
  for (const [m, n] of Object.entries(FIXED_LENGTH)) assert.deepEqual(LENGTHS[m], [n], `builder default for ${m} matches the scanner`);
});

test('translator: a moving-average length the scanner does not have is reported', () => {
  const r = conditionsToFilters([
    { metric: 'EMA', operator: '>', mode: 'value', value: 1, length: 37 },
    { metric: 'SMA', operator: '>', mode: 'value', value: 1, length: 5.5 },
    { metric: 'Close', operator: '>', mode: 'filter', compareMetric: 'EMA', compareLength: 11 },
    { metric: 'Close', operator: '>', mode: 'filter', compareMetric: 'EMA', compareLength: 120 },
  ]);
  assert.deepEqual(r.filters, [{ left: 'close', operation: 'greater', right: 'EMA120' }]);
  assert.equal(r.unsupported.length, 3);
  assert.match(r.unsupported[0].reason, /EMA length 37 is not available — the live scanner has EMA 2, 3, 5/);
});

test('time zone: "Device local time" is saved as the device’s real zone and shown back as device', () => {
  const zone = deviceZone();
  assert.equal(tzToSave('device'), zone); assert.equal(tzToSave(undefined), zone);
  assert.equal(tzToSave('UTC'), 'UTC'); assert.equal(tzToSave('America/New_York'), 'America/New_York');
  assert.equal(tzToShow('device'), 'device'); assert.equal(tzToShow(null), 'device'); assert.equal(tzToShow('UTC'), 'UTC');
  assert.equal(tzOptions('UTC').length, 3);
  assert.deepEqual(tzOptions('Asia/Tokyo').at(-1), ['Asia/Tokyo', 'Asia/Tokyo'], 'a zone saved elsewhere is still selectable');
});

test('everything the translator can run exists in the builder', () => {
  const missing = RUNNABLE_METRICS.filter((m) => !FILTER_MAP[m]);
  assert.deepEqual(missing, []);
});

test('the builder offers every operator the translator can run', () => {
  for (const op of ['>', '≥', '<', '≤', '=', '≠', 'Between']) assert.ok(OPERATORS.includes(op));
});
