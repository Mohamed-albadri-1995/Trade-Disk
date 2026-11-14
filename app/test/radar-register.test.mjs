// Radar — the TradingView provider, the sticky daily register and the scan API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeDb, stubFetch, tvRow } from './helpers.mjs';
import * as tv from '../providers/tradingview.mjs';
import { COLUMNS } from '../core/screeners.mjs';
import { runScreener, readRegister, tickerStamps, etDay } from '../core/register.mjs';
import * as radar from '../api/radar.mjs';

const spec = { key: 'volume-surges', filters: [{ left: 'close', operation: 'greater', right: 1 }], sort: { sortBy: 'change', sortOrder: 'desc' } };
const live = (t, change) => tvRow(`NASDAQ:${t}`, COLUMNS, { description: t, close: 10, change, relative_volume_10d_calc: 2, ATR: 1 });
// a scanner that answers a filter scan with `scanRows` and a symbol quote with `quoteRows`
const scanner = (scanRows, quoteRows = []) => stubFetch((url, body) =>
  ({ json: { totalCount: 1, data: body.symbols?.tickers ? quoteRows : scanRows } }));

test('provider: maps rows by column position and keeps the full symbol', async () => {
  const f = stubFetch(() => ({ json: { totalCount: 7, data: [tvRow('NYSE:IBM', ['close', 'change'], { close: 5, change: 1 })] } }));
  try {
    const r = await tv.scan({ filters: [], columns: ['close', 'change'], sort: {} });
    assert.deepEqual(r, { totalCount: 7, rows: [{ ticker: 'IBM', _sym: 'NYSE:IBM', close: 5, change: 1 }] });
    assert.deepEqual(f.calls[0].body.range, [0, 50]);
  } finally { f.restore(); }
});

test('provider: refuses misaligned rows and HTTP errors', async () => {
  let f = stubFetch(() => ({ json: { data: [{ s: 'NYSE:IBM', d: [1] }] } }));
  try { await assert.rejects(tv.scan({ filters: [], columns: ['close', 'change'], sort: {} }), /refusing misaligned/); } finally { f.restore(); }
  f = stubFetch(() => ({ status: 429, json: {} }));
  try { await assert.rejects(tv.scan({ filters: [], columns: ['close'], sort: {} }), /HTTP 429/); } finally { f.restore(); }
});

test('provider: quote with no symbols makes no request', async () => {
  const f = stubFetch(() => { throw new Error('should not fetch'); });
  try { assert.deepEqual(await tv.quote([null, ''], ['close']), { rows: [] }); assert.equal(f.calls.length, 0); } finally { f.restore(); }
});

test('register: a stock that drops off the scan stays on the list, marked not live, re-quoted', async () => {
  const db = fakeDb();
  let f = scanner([live('AAA', 5), live('BBB', 9)]);
  let r1; try { r1 = await runScreener(db, 'u1', spec); } finally { f.restore(); }
  assert.deepEqual(r1.stocks.map((s) => s.t), ['BBB', 'AAA']);          // by score
  assert.equal(r1.liveCount, 2); assert.equal(r1.day, etDay());

  // second scan: only CCC is live; AAA and BBB are carried and BBB gets a fresh quote
  f = scanner([live('CCC', 1)], [live('BBB', -3)]);
  let r2; try { r2 = await runScreener(db, 'u1', spec); } finally { f.restore(); }
  assert.deepEqual(f.calls[1].body.symbols.tickers.sort(), ['NASDAQ:AAA', 'NASDAQ:BBB']);
  assert.deepEqual(r2.stocks.map((s) => [s.t, s.live]), [['CCC', true], ['AAA', false], ['BBB', false]]);
  assert.equal(r2.count, 3); assert.equal(r2.liveCount, 1);
  const bbb = r2.stocks.find((s) => s.t === 'BBB'), aaa = r2.stocks.find((s) => s.t === 'AAA');
  assert.equal(bbb.c, -3, 'carried stock shows the re-quoted change');
  assert.equal(aaa.c, 5, 'a stock the quote did not return keeps its last data');
  assert.equal(bbb.firstSeen, r1.stocks.find((s) => s.t === 'BBB').firstSeen, 'first-seen never moves');
  assert.match(bbb.firstSeenEt, /ET$/);
  assert.equal(db.tables.radar_register.length, 3, 'one row per stock per day, not one per scan');

  // third scan: AAA is back → live again, same first-seen
  f = scanner([live('AAA', 6)], []);
  let r3; try { r3 = await runScreener(db, 'u1', spec); } finally { f.restore(); }
  const a3 = r3.stocks.find((s) => s.t === 'AAA');
  assert.equal(a3.live, true); assert.equal(a3.firstSeen, aaa.firstSeen);
});

test('register: a failed re-quote keeps the carried stocks rather than dropping them', async () => {
  const db = fakeDb();
  let f = scanner([live('AAA', 5)]);
  try { await runScreener(db, 'u1', spec); } finally { f.restore(); }
  f = stubFetch((url, body) => (body.symbols?.tickers ? { status: 500, json: {} } : { json: { data: [] } }));
  let r; try { r = await runScreener(db, 'u1', spec); } finally { f.restore(); }
  assert.deepEqual(r.stocks.map((s) => [s.t, s.live, s.c]), [['AAA', false, 5]]);
});

test('register: limit is capped at 100 rows', async () => {
  const f = scanner([]);
  try { await runScreener(fakeDb(), 'u1', { ...spec, limit: 5000 }); assert.deepEqual(f.calls[0].body.range, [0, 100]); } finally { f.restore(); }
});

test('register: runScreener only reads and writes its own account', async () => {
  const db = fakeDb({ radar_register: [{ owner_id: 'other', day: etDay(), screener: spec.key, ticker: 'ZZZ', sym: 'NYSE:ZZZ', card: { t: 'ZZZ', s: 99 }, live: true, first_seen: 'x', last_live: 'x' }] });
  const f = scanner([live('AAA', 5)]);
  let r; try { r = await runScreener(db, 'u1', spec); } finally { f.restore(); }
  assert.deepEqual(r.stocks.map((s) => s.t), ['AAA']);
});

const twoAccounts = () => fakeDb({ radar_register: ['u1', 'u2'].map((o) => (
  { owner_id: o, day: etDay(), screener: spec.key, ticker: o === 'u1' ? 'MINE' : 'THEIRS', card: { t: o, s: 50 }, live: true, first_seen: '2026-01-01T14:00:00Z', last_live: '2026-01-01T15:00:00Z' })) });

test('register: readRegister returns only the asking account', async () => {
  const r = await readRegister(twoAccounts(), spec.key, 'u1');
  assert.deepEqual(r.stocks.map((s) => s.t), ['u1']);
  assert.equal((await tickerStamps(twoAccounts(), 'THEIRS', 'u1')), null);
});

test('register: tickerStamps gives first-seen / last-live across screeners, null when unseen', async () => {
  const db = fakeDb({ radar_register: [
    { day: etDay(), screener: 'a', ticker: 'AAA', live: false, first_seen: '2026-01-05T14:40:00Z', last_live: '2026-01-05T15:00:00Z' },
    { day: etDay(), screener: 'b', ticker: 'AAA', live: true, first_seen: '2026-01-05T14:35:00Z', last_live: '2026-01-05T15:30:00Z' }] });
  const s = await tickerStamps(db, 'AAA');
  assert.equal(s.firstSeen, '2026-01-05T14:35:00Z'); assert.equal(s.lastLive, '2026-01-05T15:30:00Z'); assert.equal(s.liveNow, true);
  assert.equal(s.firstSeenEt, '09:35 AM ET');
  assert.equal(await tickerStamps(db, 'NOPE'), null);
});

// ── the scan API ──
const personal = (extra = {}) => fakeDb({ app_setting: [{ key: 'mode', value: 'personal' }], ...extra });

test('scan: unknown screener and commercial mode return an error, not a throw', async (t) => {
  const f = stubFetch(() => ({ json: { data: [] } })); t.after(f.restore);
  assert.match((await radar.scan(personal(), 'u1', 'no-such-screener')).error, /unknown screener/);
  const r = await radar.scan(fakeDb({ app_setting: [{ key: 'mode', value: 'commercial' }] }), 'u1', 'volume-surges');
  assert.match(r.error, /Personal mode/); assert.equal(f.calls.length, 0, 'no TradingView call in commercial mode');
});

test('scan: when the live scan fails, today’s saved list is returned marked stale — this account’s only', async (t) => {
  const db = personal({ radar_register: [{ owner_id: 'u2', day: etDay(), screener: 'volume-surges', ticker: 'ZZZ', card: { t: 'ZZZ', s: 99 }, live: true, first_seen: 'x', last_live: 'x' }, { owner_id: 'u1', day: etDay(), screener: 'volume-surges', ticker: 'AAA', card: { t: 'AAA', s: 60 }, live: true, first_seen: 'x', last_live: 'x' }] });
  const f = stubFetch((url) => (url.includes('tradingview') ? { status: 503, json: {} } : { status: 500, json: {} })); t.after(f.restore);
  const r = await radar.scan(db, 'u1', 'volume-surges');
  assert.equal(r.stale, true); assert.match(r.scanError, /HTTP 503/);
  assert.deepEqual(r.stocks.map((s) => s.t), ['AAA']);
});

test('scan: a junk or negative limit falls back to 50, a large one is capped at 100', async (t) => {
  const f = stubFetch(() => ({ json: { data: [] } })); t.after(f.restore);
  for (const lim of [-5, 'abc', null, 0]) await radar.scan(personal(), 'u1', 'volume-surges', lim);
  await radar.scan(personal(), 'u1', 'volume-surges', 9999);
  await radar.previewConditions(personal(), { conditions: [{ metric: 'Close', operator: '>', mode: 'value', value: 1 }], limit: -3 });
  const scans = f.calls.filter((c) => c.url.includes('tradingview') && !c.body.symbols?.tickers);
  assert.deepEqual(scans.map((c) => c.body.range[1]), [50, 50, 50, 50, 100, 50]);
});

test('shortlist: toggle adds then removes', async () => {
  const db = fakeDb();
  assert.deepEqual(await radar.toggleShortlist(db, 'u1', 'NVDA'), { ticker: 'NVDA', saved: true });
  assert.deepEqual(await radar.shortlist(db), ['NVDA']);
  assert.deepEqual(await radar.toggleShortlist(db, 'u1', 'NVDA'), { ticker: 'NVDA', saved: false });
  assert.deepEqual(await radar.shortlist(db), []);
});

test('screener config: save, list, schedule a built-in, delete', async () => {
  const db = fakeDb();
  await assert.rejects(radar.saveScreenerConfig(db, 'u1', { name: '  ' }), /name is required/);
  const saved = await radar.saveScreenerConfig(db, 'u1', { id: 'scr-1', name: ' Mine ', conditions: [{ metric: 'Close' }], windows: [{ start: '09:30', end: '10:00', every: 5 }] });
  assert.deepEqual(saved.custom.map((c) => [c.id, c.name, c.filters]), [['scr-1', 'Mine', ['Close']]]);
  await assert.rejects(radar.saveSchedule(db, 'u1', 'nope', {}), /unknown screener/);
  const s = await radar.saveSchedule(db, 'u1', 'volume-surges', { windows: [{ start: '09:30', end: '09:45', every: 5 }], timezone: 'UTC' });
  assert.equal(s.schedules['volume-surges'].timezone, 'UTC'); assert.equal(s.custom.length, 1);
  assert.equal((await radar.deleteScreenerConfig(db, 'u1', 'scr-1')).custom.length, 0);
  assert.equal((await radar.screenerConfigs(db)).schedules['volume-surges'].windows.length, 1, 'deleting a custom screener leaves built-in schedules');
});

test('screener config: a custom screener cannot take a built-in’s id', async () => {
  const db = fakeDb();
  await radar.saveSchedule(db, 'u1', 'volume-surges', { windows: [{ start: '09:30', end: '09:45', every: 5 }] });
  await assert.rejects(radar.saveScreenerConfig(db, 'u1', { id: 'volume-surges', name: 'Clash' }), /built-in screener/);
  assert.equal((await radar.screenerConfigs(db)).schedules['volume-surges']?.windows.length, 1);
});
