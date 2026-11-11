// Radar — technical indicators, the register browser, data collection and labels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeDb, stubFetch, tvRow, dailyBars } from './helpers.mjs';
import { technicals } from '../core/technicals.mjs';
import { ema, rvol, adrPct } from '../providers/compute.mjs';
import * as registers from '../api/registers.mjs';
import { collect, collectionStatus } from '../core/collect.mjs';
import { computeLabels } from '../core/labels.mjs';
import { etDay } from '../core/register.mjs';
import { windowDue, minuteIn, marketOpenDay, parts } from '../core/scheduler.mjs';
import { COLUMNS } from '../core/screeners.mjs';
import * as yahoo from '../providers/yahoo.mjs';

// ── indicators ──
test('technicals: empty or one-bar input gives an empty object, not a crash', () => {
  assert.deepEqual(technicals(null), {}); assert.deepEqual(technicals([]), {}); assert.deepEqual(technicals(dailyBars(1, () => 5)), {});
});

test('technicals: a steady uptrend reads as bullish, aligned, RSI 100, near its high', () => {
  const t = technicals(dailyBars(260, (i) => 100 + i));
  assert.equal(t.price, 359); assert.equal(t.prevClose, 358);
  assert.equal(t.bullish, true); assert.equal(t.alignment, true);
  assert.equal(t.rsi14, 100);
  assert.equal(t.sma5, 357); assert.equal(t.sma200, 259.5);
  assert.equal(t.high52, 360); assert.equal(t.low52, 107);
  assert.equal(t.roc20Pct, +((359 / 339 - 1) * 100).toFixed(2));
  assert.equal(t.atr14, 2); assert.equal(t.pivot, 359);
  assert.ok(t.rangePosPct.year > 99);
});

test('technicals: 50 up days in a row count as accumulation', () => {
  assert.equal(technicals(dailyBars(260, (i) => 100 + i)).accumulation, true);
});

test('technicals: a steady downtrend reads as bearish with RSI 0', () => {
  const t = technicals(dailyBars(260, (i) => 500 - i));
  assert.equal(t.bullish, false); assert.equal(t.alignment, false); assert.equal(t.rsi14, 0); assert.equal(t.macd.above, false);
});

test('technicals: short history leaves long indicators null instead of guessing', () => {
  const t = technicals(dailyBars(10, (i) => 10 + i));
  assert.equal(t.sma200, null); assert.equal(t.rsi14, null); assert.equal(t.macd, null); assert.equal(t.atr14, null);
});

test('technicals: RSI uses Wilder smoothing, as its comment says', () => {
  const closes = Array.from({ length: 120 }, (_, i) => 100 + 10 * Math.sin(i / 3) + (i % 7) - i * 0.05);
  // reference Wilder RSI(14)
  let g = 0, l = 0;
  for (let i = 1; i <= 14; i++) { const d = closes[i] - closes[i - 1]; d >= 0 ? g += d : l -= d; }
  g /= 14; l /= 14;
  for (let i = 15; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; g = (g * 13 + Math.max(d, 0)) / 14; l = (l * 13 + Math.max(-d, 0)) / 14; }
  const wilder = +(100 - 100 / (1 + g / l)).toFixed(1);
  const bars = closes.map((c, i) => ({ t: 1.7e9 + i * 86400, o: c, h: c + 1, l: c - 1, c, v: 1000 }));
  assert.equal(technicals(bars).rsi14, wilder);
});

test('compute: ema, relative volume and ADR', () => {
  assert.equal(ema([], 10), null); assert.equal(ema([5, 5, 5], 10), 5);
  assert.equal(rvol([{ v: 100 }, { v: 100 }, { v: 300 }]), 3); assert.equal(rvol([{ v: 1 }]), null);
  assert.equal(adrPct([{ h: 11, l: 10 }, { h: 21, l: 20 }]), 7.5); assert.equal(adrPct([]), null);
});

test('technicals: today’s bar counts as still forming only before the 16:00 ET close', () => {
  const bars = dailyBars(30, (i) => 50 + i, Date.parse('2026-01-05T14:30:00Z') / 1000);
  bars.forEach((b, i) => { b.v = i === 29 ? 5 : 1000; });       // today's volume so far is tiny
  const during = technicals(bars, Date.parse('2026-01-05T17:00:00Z'));   // 12:00 ET
  const after = technicals(bars, Date.parse('2026-01-05T21:30:00Z'));    // 16:30 ET, same UTC day
  assert.equal(during.volumeSession, 1000, 'mid-session: volume stats use the last finished day');
  assert.equal(after.volumeSession, 5, 'after the close: today is a finished session');
});

// ── the scheduler's clock ──
test('scheduler: a window fires on its start, every N minutes, through its end', () => {
  const w = { start: '09:30', end: '09:45', every: 5 };
  assert.deepEqual([569, 570, 571, 575, 585, 586, 590].map((m) => windowDue(m, w)), [false, true, false, true, true, false, false]);
  assert.equal(windowDue(600, { start: '10:00', end: '10:00' }), true);
  assert.equal(windowDue(603, { start: '10:00', end: '11:00', every: 0 }), false, 'a missing interval means every 5 minutes');
});

test('scheduler: each schedule is read in its own time zone', () => {
  const at = new Date('2026-01-05T14:30:00Z');                // 09:30 New York, 17:30 Riyadh
  assert.equal(minuteIn('America/New_York', at), 570);
  assert.equal(minuteIn('UTC', at), 870);
  assert.equal(minuteIn('Asia/Riyadh', at), 1050);
  for (const legacy of ['device', undefined, null, 'Not/AZone']) assert.equal(minuteIn(legacy, at), 570, `${legacy} → US Eastern`);
});

test('scheduler: weekends and NYSE holidays are skipped', () => {
  const day = (iso) => marketOpenDay(parts('America/New_York', new Date(iso)));
  assert.equal(day('2026-01-05T15:00:00Z'), true);            // Monday
  assert.equal(day('2026-01-03T15:00:00Z'), false);           // Saturday
  assert.equal(day('2026-11-26T15:00:00Z'), false);           // Thanksgiving
  assert.equal(day('2026-12-25T15:00:00Z'), false);
  assert.equal(day('2026-11-27T15:00:00Z'), true);            // early close still trades
});

// ── the register browser ──
test('register browser: a day lists stocks in first-seen order with clock times', async () => {
  const db = fakeDb({ radar_history: [
    { screen: 'T1', day: '2026-01-05', ticker: 'BBB', first_seen_min: 6, facts: { name: 'B Co' } },
    { screen: 'T1', day: '2026-01-05', ticker: 'AAA', first_seen_min: 6, facts: { n: 'A Co' } },
    { screen: 'T1', day: '2026-01-05', ticker: 'PRE', first_seen_min: -90, facts: null },
    { screen: 'T1', day: '2026-01-05', ticker: 'NUL', first_seen_min: null, facts: {} },
    { screen: 'T2', day: '2026-01-05', ticker: 'XXX', first_seen_min: 0, facts: {} }] });
  const r = await registers.day(db, ' T1 ', '2026-01-05');
  assert.deepEqual(r.map((x) => [x.ticker, x.firstSeen, x.name]),
    [['PRE', '08:00', null], ['AAA', '09:36', 'A Co'], ['BBB', '09:36', 'B Co'], ['NUL', null, null]]);
  await assert.rejects(registers.day(db, '', '2026-01-05'), /required/);
});

test('register browser: days are counted and listed newest first', async () => {
  const rows = [...Array(3).fill({ screen: 'T1', day: '2026-01-05' }), ...Array(2).fill({ screen: 'T1', day: '2026-01-06' }), { screen: 'T2', day: '2026-01-07' }];
  assert.deepEqual(await registers.days(fakeDb({ radar_history: rows }), 'T1'), [{ day: '2026-01-06', n: 2 }, { day: '2026-01-05', n: 3 }]);
  await assert.rejects(registers.days(fakeDb(), ''), /pick a screen/);
});

const polyDb = (extra = {}) => fakeDb({ app_setting: [{ key: 'polygon_api_key', value: 'k'.repeat(20) }], ...extra });
test('intraday bars: served from cache, else fetched once and cached; bad interval falls back to 1', async (t) => {
  const f = stubFetch(() => ({ json: { results: [{ t: 1767623400000, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 }] } })); t.after(f.restore);
  const db = polyDb();
  const a = await registers.intradayBars(db, 'u1', 'aapl', '2026-01-05', '7');
  assert.equal(a.interval, '1'); assert.equal(a.cached, false); assert.equal(a.ticker, 'AAPL');
  assert.deepEqual(a.bars, [{ t: 1767623400, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 }]);
  const b = await registers.intradayBars(db, 'u1', 'AAPL', '2026-01-05', 1);
  assert.equal(b.cached, true); assert.equal(f.calls.length, 1);
});

test('intraday bars: no key, rate limit and provider errors are reported, not cached', async (t) => {
  assert.match((await registers.intradayBars(fakeDb(), 'u1', 'AAPL', '2026-01-05', 5)).error, /Polygon API key/);
  let f = stubFetch(() => ({ status: 429, json: {} }));
  const db = polyDb();
  try { assert.equal((await registers.intradayBars(db, 'u1', 'AAPL', '2026-01-05', 5)).rateLimited, true); } finally { f.restore(); }
  f = stubFetch(() => ({ status: 403, json: {} }));
  try { assert.match((await registers.intradayBars(db, 'u1', 'AAPL', '2026-01-05', 5)).error, /HTTP 403/); } finally { f.restore(); }
  assert.equal((db.tables.polygon_bars || []).length, 0);
});

test('intraday bars: an empty or still-forming day is not cached forever', async (t) => {
  const f = stubFetch(() => ({ json: { results: [] } })); t.after(f.restore);
  const db = polyDb();
  await registers.intradayBars(db, 'u1', 'AAPL', '2026-01-05', 1);                     // a past day with no bars
  assert.equal((db.tables.polygon_bars || []).length, 0);
  f.restore();
  const g = stubFetch(() => ({ json: { results: [{ t: 1767623400000, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 }] } })); t.after(g.restore);
  const r = await registers.intradayBars(db, 'u1', 'AAPL', etDay(), 1);                 // today: returned, not stored
  assert.equal(r.bars.length, 1); assert.equal(r.cached, false);
  assert.equal((db.tables.polygon_bars || []).length, 0);
});

// ── data collection + labels ──
const collectFetch = () => stubFetch((url, body) => {
  if (url.includes('tradingview')) return { json: { data: body.symbols?.tickers ? [] : [tvRow('NASDAQ:AAA', COLUMNS, { description: 'AAA', close: 10, change: 5 })] } };
  return { status: 500, json: {} };   // Yahoo / EDGAR down → market + facts are skipped, the card snapshot is still kept
});

test('collect: freezes one snapshot row per stock, stamped with owner, day and time', async (t) => {
  const f = collectFetch(); t.after(f.restore);
  const db = fakeDb();
  const r = await collect(db, 'u1', 'volume-surges', { withFacts: false });
  assert.equal(r.ok, true); assert.equal(r.snapshots, 1); assert.equal(r.live, 1); assert.equal(r.facts, 0);
  const s = db.tables.radar_snapshot[0];
  assert.deepEqual([s.owner_id, s.day, s.screener, s.ticker, s.live, s.taken_at], ['u1', etDay(), 'volume-surges', 'AAA', true, r.taken_at]);
  assert.equal((await collectionStatus(db)).snapshotRows, 1);
  assert.deepEqual(await collect(db, 'u1', 'nope'), { ok: false, key: 'nope', error: 'unknown screener "nope"' });
  await assert.rejects(collect(null, 'u1', 'volume-surges'), /database client/);
});

const bar = (iso, o, h, l, c) => ({ t: Date.parse(iso) / 1000, o, h, l, c, v: 100 });
const yahooJson = (bars) => ({ chart: { result: [{ meta: {}, timestamp: bars.map((b) => b.t), indicators: { quote: [{ open: bars.map((b) => b.o), high: bars.map((b) => b.h), low: bars.map((b) => b.l), close: bars.map((b) => b.c), volume: bars.map((b) => b.v) }] } }] } });

test('labels: stores the day’s open/high/low/close and bar path, only for that ET day', async (t) => {
  const bars = [bar('2026-01-02T20:55:00Z', 9, 9, 9, 9), bar('2026-01-05T14:30:00Z', 10, 12, 9.5, 11), bar('2026-01-05T20:55:00Z', 11, 11.5, 8, 10.5), bar('2026-01-06T14:30:00Z', 20, 20, 20, 20)];
  const f = stubFetch(() => ({ json: yahooJson(bars) })); t.after(f.restore);
  const db = fakeDb({ radar_snapshot: [{ owner_id: 'u1', day: '2026-01-05', ticker: 'AAA' }, { owner_id: 'u1', day: '2026-01-05', ticker: 'AAA' }, { owner_id: 'u2', day: '2026-01-05', ticker: 'ZZZ' }] });
  const r = await computeLabels(db, 'u1', '2026-01-05');
  assert.deepEqual(r, { ok: true, day: '2026-01-05', tickers: 1, labeled: 1 });
  const l = db.tables.radar_snapshot_label[0];
  assert.deepEqual([l.ticker, l.open, l.high, l.low, l.close, l.bars.length], ['AAA', 10, 12, 8, 10.5, 2]);
  assert.deepEqual(await computeLabels(fakeDb(), 'u1', '2026-01-05'), { ok: true, day: '2026-01-05', tickers: 0, labeled: 0 });
});

test('yahoo provider: drops empty bars and surfaces provider errors', async () => {
  let f = stubFetch(() => ({ json: yahooJson([bar('2026-01-05T14:30:00Z', 1, 2, 0.5, 1.5), { t: 1, o: null, h: null, l: null, c: null, v: null }]) }));
  try { assert.equal((await yahoo.chart('AAA')).bars.length, 1); } finally { f.restore(); }
  f = stubFetch(() => ({ json: { chart: { result: null, error: { description: 'No data found' } } } }));
  try { await assert.rejects(yahoo.chart('AAA'), /No data found/); } finally { f.restore(); }
});

// ── the shared Polygon key ──
import { getPolygonKey, polygonKeyStatus, savePolygonKey } from '../core/polygonKey.mjs';
const KEY = 'pk_' + 'x'.repeat(20);
const user = (role = 'owner', extra = {}) => fakeDb({ profile: [{ id: 'u1', role }], ...extra });

test('polygon key: read from server-only storage, never from the table users can read', async () => {
  const vault = fakeDb({ app_secret: [{ key: 'polygon_api_key', value: KEY }] });
  const sb = user('member');
  assert.equal(await getPolygonKey(sb, { adminClient: vault, env: {} }), KEY);
  assert.deepEqual(await polygonKeyStatus(sb, { adminClient: vault, env: {} }), { hasKey: true, masked: 'pk_…xxx' });
  assert.ok(!sb.log.some((q) => q.table === 'app_secret'), 'the user’s client never touches app_secret');
  assert.equal(await getPolygonKey(sb, { adminClient: vault, env: { POLYGON_API_KEY: ' envkey ' } }), 'envkey');
  await assert.rejects(getPolygonKey(fakeDb(), { adminClient: vault, env: {} }), /sign in/, 'no verified profile → no key');
});

test('polygon key: before the migration (or with no service-role key) the old row still works', async () => {
  const sb = user('owner', { app_setting: [{ key: 'polygon_api_key', value: KEY }] });
  assert.equal(await getPolygonKey(sb, { adminClient: null, env: {} }), KEY);
  assert.equal(await getPolygonKey(sb, { adminClient: fakeDb(), env: {} }), KEY, 'empty app_secret → falls back');
});

test('polygon key: saving stores it privately, removes the readable copy, owners/admins only', async () => {
  const vault = fakeDb();
  const sb = user('owner', { app_setting: [{ key: 'polygon_api_key', value: 'old-key-old-key' }, { key: 'mode', value: 'personal' }] });
  const r = await savePolygonKey(sb, ` ${KEY} `, { adminClient: vault });
  assert.deepEqual(r, { ok: true, hasKey: true, masked: 'pk_…xxx', private: true });
  assert.equal(vault.tables.app_secret[0].value, KEY);
  assert.deepEqual(sb.tables.app_setting.map((x) => x.key), ['mode'], 'only the key row is removed');
  await assert.rejects(savePolygonKey(user('member'), KEY, { adminClient: vault }), /owner or admin/);
  const legacy = user('owner');
  assert.equal((await savePolygonKey(legacy, KEY, { adminClient: null })).private, false);
});
