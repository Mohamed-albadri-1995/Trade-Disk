// Radar — the builder's AND/OR and timeframe rules, the full card, the Market
// snapshot's freshness, and a scheduled run end to end (schedule → scan → snapshot).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeDb, stubFetch, tvRow } from './helpers.mjs';
import { conditionsToFilters } from '../core/screenerTranslate.mjs';
import { COLUMNS, toCard, delayOf } from '../core/screeners.mjs';
import * as tv from '../providers/tradingview.mjs';
import * as radar from '../api/radar.mjs';
import { buildSnapshot, getMarket, sessionOpen, staleMs, _resetMarketMemo } from '../core/market.mjs';
import { tick } from '../core/scheduler.mjs';
import { etDay } from '../core/register.mjs';

const V = (metric, operator, value, extra = {}) => ({ metric, operator, mode: 'value', value, timeframe: 'Daily', join: 'AND', ...extra });

// ── builder ──
test('builder: AND binds tighter than OR — a AND b OR c becomes two groups', () => {
  const t = conditionsToFilters([V('Close', '>', 500), V('Volume', '>', 1e6, { join: 'OR' }), V('Close', '<', 1)]);
  assert.deepEqual(t.filters, []);
  assert.deepEqual(t.anyOf, [
    [{ left: 'close', operation: 'greater', right: 500 }, { left: 'volume', operation: 'greater', right: 1e6 }],
    [{ left: 'close', operation: 'less', right: 1 }],
  ]);
  // no OR → plain list, no groups; an OR next to a condition that cannot run collapses
  assert.equal(conditionsToFilters([V('Close', '>', 1), V('Close', '<', 9)]).anyOf, undefined);
  const lone = conditionsToFilters([V('Close', '>', 1, { join: 'OR' }), V('Float', '>', 1)]);
  assert.deepEqual([lone.filters.length, lone.anyOf, lone.unsupported.length], [1, undefined, 1]);
});

test('builder: OR groups are sent to the scanner inside the universe gate', async () => {
  const f = stubFetch(() => ({ json: { data: [] } }));
  try {
    await tv.scan({ filters: [], anyOf: [[{ left: 'close', operation: 'greater', right: 500 }], [{ left: 'close', operation: 'less', right: 1 }]], columns: ['close'], sort: {} });
    await tv.scan({ filters: [{ left: 'close', operation: 'greater', right: 1 }], columns: ['close'], sort: {} });
  } finally { f.restore(); }
  const [withOr, plain] = f.calls.map((c) => c.body.filter2);
  assert.equal(withOr.operator, 'and'); assert.equal(withOr.operands.length, 2);
  assert.deepEqual(withOr.operands[0].operation, plain, 'the stock-universe gate is still applied');
  assert.equal(withOr.operands[1].operation.operator, 'or');
  assert.deepEqual(withOr.operands[1].operation.operands[1], { operation: { operator: 'and', operands: [{ expression: { left: 'close', operation: 'less', right: 1 } }] } });
});

test('builder: a timeframe is ignored where the scanner only has a daily value', () => {
  const left = (m, tf) => conditionsToFilters([V(m, '>', 1, { timeframe: tf })]).filters[0].left;
  assert.equal(left('Market cap', 'Weekly'), 'market_cap_basic');
  assert.equal(left('Perf 6M', '5 minutes'), 'Perf.6M');
  assert.equal(left('Premarket volume', '1 hour'), 'premarket_volume');
  assert.equal(left('Intraday relative volume', 'Daily'), 'relative_volume_intraday|5');
  assert.equal(left('Close', 'Weekly'), 'close|1W', 'price and indicators keep their timeframe');
  assert.equal(left('Relative volume', '5 minutes'), 'relative_volume_10d_calc|5');
});

test('builder: what cannot run is reported — text comparisons, % distance, other sources', () => {
  const why = (c) => conditionsToFilters([c]).unsupported[0]?.reason || 'RUNS';
  assert.match(why(V('Sector', '>', 'Finance')), /= or ≠/);
  assert.match(why(V('Sector', 'Between', 'a', { upper: 'b' })), /= or ≠/);
  assert.match(why({ ...V('Sector', '=', ''), mode: 'filter', compareMetric: 'Industry' }), /= or ≠/);
  assert.equal(why(V('Sector', '≠', 'Finance')), 'RUNS');
  assert.match(why({ ...V('Close', '>', 5), mode: 'percent', percent: 10 }), /percentage-distance/);
  assert.match(why(V('EMA', '>', 5, { length: 20, source: 'HL2' })), /source "HL2"/);
  assert.equal(why(V('EMA', '>', 5, { length: 20, source: 'Close' })), 'RUNS');
  assert.equal(why(V('Close', '>', 5, { source: 'HL2' })), 'RUNS', 'source only matters for indicators');
});

test('builder: a saved custom screener with OR runs through the scan API', async (t) => {
  const f = stubFetch((url, body) => ({ json: { data: body.symbols?.tickers || !url.includes('tradingview') ? [] : [tvRow('NASDAQ:AAA', COLUMNS, { close: 600, change: 1 })] } })); t.after(f.restore);
  const db = fakeDb({ radar_screener: [{ owner_id: 'u1', id: 'scr-1', kind: 'custom', name: 'Either', conditions: [V('Close', '>', 500, { join: 'OR' }), V('Close', '<', 1)] }] });
  const r = await radar.scan(db, 'u1', 'scr-1');
  assert.deepEqual(r.stocks.map((s) => s.t), ['AAA']);
  assert.equal(f.calls[0].body.filter2.operands[1].operation.operator, 'or');
});

// ── the full card ──
const NOW = Date.parse('2026-11-11T15:00:00Z');
const full = (o = {}) => ({ ticker: 'NVDA', description: 'NVIDIA Corporation', close: 175.59, change: 3.967, change_abs: 6.7,
  relative_volume_10d_calc: 0.7, average_volume_10d_calc: 2e8, market_cap_basic: 4.23e12, sector: 'Electronic Technology', industry: 'Semiconductors',
  premarket_change: 2.297, premarket_volume: 16e6, premarket_high: 178.36, premarket_low: 172.46, ATR: 8.6, ADR: 6.89,
  EMA9: 187.3, EMA13: 192.9, EMA20: 199.8, EMA50: 210.4, earnings_release_next_date: NOW / 1000 + 5 * 86400, update_mode: 'delayed_streaming_900', ...o });

test('card: every field comes from the scan, none left as a placeholder', () => {
  const c = toCard(full(), 0, NOW);
  assert.deepEqual(c, {
    t: 'NVDA', n: 'NVIDIA Corporation', p: 175.59, c: 3.97, abs: 6.7, s: 54, r: 0.7,
    adr: 3.92,                                   // $6.89 average daily range on $175.59
    pm: 0.86,                                    // $5.90 pre-market range / $6.89 normal day
    pmHigh: 178.36, pmLow: 172.46, pmRange: 5.9, pmPct: 2.3,
    cap: '4.23T', capBand: 'large', sec: 'Semiconductors', mark: 'N', color: '',
    tags: ['Pre-Market', 'Earnings'], ema: false, stacked: false, news: false, cs: false,
    changeLine: [168.89, 175.59],
  });
});

test('card: a falling stock has a negative change and its previous close above the price', () => {
  const c = toCard(full({ close: 90, change: -10, change_abs: -10 }), 0, NOW);
  assert.deepEqual([c.c, c.abs, c.changeLine], [-10, -10, [100, 90]]);
  assert.ok(c.tags.includes('Big Move'));
});

test('card: the Earnings tag covers today through the next 7 days only', () => {
  const tag = (days) => toCard(full({ earnings_release_next_date: NOW / 1000 + days * 86400 }), 0, NOW).tags.includes('Earnings');
  assert.deepEqual([-2, -0.5, 0, 3, 7, 8].map(tag), [false, true, true, true, true, false]);
  assert.equal(toCard(full({ earnings_release_next_date: null }), 0, NOW).tags.includes('Earnings'), false);
});

test('card: scan results say how delayed the scanner data is', () => {
  assert.equal(delayOf([full()]), 15);
  assert.equal(delayOf([{ update_mode: 'streaming' }]), 0);
  assert.equal(delayOf([]), null); assert.equal(delayOf([{ ticker: 'X' }]), null);
});

// ── the Market snapshot ──
const DAY = 86400;
// 260 daily bars per symbol ending at `lastSec`; the last (today's) close is +2% on the day
const yahooSeries = (lastSec) => {
  const ts = Array.from({ length: 260 }, (_, i) => lastSec - (259 - i) * DAY);
  const close = ts.map((_, i) => (i === 259 ? 204 : i === 258 ? 200 : 100 + i * 0.3));
  return { chart: { result: [{ meta: {}, timestamp: ts, indicators: { quote: [{ open: close, high: close.map((c) => c + 1), low: close.map((c) => c - 1), close, volume: ts.map(() => 1e6) }] } }] } };
};

test('market: during the session the tab shows today’s move, not yesterday’s', async (t) => {
  const now = Date.parse('2026-11-11T17:00:00Z');                     // Wednesday 12:00 ET
  const f = stubFetch(() => ({ json: yahooSeries(Date.parse('2026-11-11T14:30:00Z') / 1000) })); t.after(f.restore);
  const snap = await buildSnapshot(now);
  const spy = snap.indexes.find((i) => i.sym === 'SPY');
  assert.equal(spy.price, '$204.00'); assert.equal(spy.changes[0].v, '+2.00%');
  assert.equal(snap.indexes.length, 5); assert.equal(snap.heatmap.length, 15);
  assert.equal(snap.builtAt, new Date(now).toISOString()); assert.match(snap.asOf, /Nov 11, 2026.*12:00.*ET/);
  assert.equal(f.calls.length, 20, 'one request per index and sector ETF');
});

test('market: refresh window is 2 minutes while the market trades, 10 otherwise', () => {
  assert.equal(sessionOpen(Date.parse('2026-11-11T14:30:00Z')), true);    // 09:30 ET
  assert.equal(sessionOpen(Date.parse('2026-11-11T14:29:00Z')), false);
  assert.equal(sessionOpen(Date.parse('2026-11-11T21:00:00Z')), false);   // 16:00 ET
  assert.equal(sessionOpen(Date.parse('2026-11-14T17:00:00Z')), false);   // Saturday
  assert.equal(staleMs(Date.parse('2026-11-11T17:00:00Z')), 120000);
  assert.equal(staleMs(Date.parse('2026-11-11T23:00:00Z')), 600000);
});

test('market: a fresh stored snapshot is served as is; a stale one is rebuilt and stored', async (t) => {
  _resetMarketMemo();
  const f = stubFetch(() => ({ json: yahooSeries(Math.floor(Date.now() / 1000) - DAY) })); t.after(f.restore);
  const fresh = fakeDb({ radar_market: [{ id: 1, snapshot: { tag: 'stored' }, as_of: new Date(Date.now() - 30e3).toISOString() }] });
  assert.equal((await getMarket(fresh)).tag, 'stored');
  assert.equal((await getMarket(fresh, { force: true })).tag, 'stored', 'a forced refresh still waits 60s');
  assert.equal(f.calls.length, 0);
  const stale = fakeDb({ radar_market: [{ id: 1, snapshot: { tag: 'old' }, as_of: new Date(Date.now() - 3600e3).toISOString() }] });
  const snap = await getMarket(stale);
  assert.equal(snap.live, true); assert.equal(snap.tag, undefined);
  assert.ok(stale.log.some((q) => q.table === 'radar_market' && q.op === 'upsert'));
});

test('market: a reader who may not store the snapshot still gets the fresh one, built once', async (t) => {
  _resetMarketMemo();
  const f = stubFetch(() => ({ json: yahooSeries(Math.floor(Date.now() / 1000) - DAY) })); t.after(f.restore);
  const old = { id: 1, snapshot: { tag: 'old' }, as_of: new Date(Date.now() - 3600e3).toISOString() };
  const readOnly = () => {                                              // row security refuses the write
    const db = fakeDb({ radar_market: [old] }); const from = db.from;
    db.from = (n) => { const q = from(n); q.upsert = () => ({ then: (r) => r({ data: null, error: { message: 'denied' } }) }); return q; };
    return db;
  };
  const [a, b] = await Promise.all([getMarket(readOnly()), getMarket(readOnly())]);
  assert.equal(a.live, true); assert.equal(a, b, 'concurrent readers share one build');
  assert.equal(f.calls.length, 20);
  assert.equal(await getMarket(readOnly()), a, 'and the next reader gets the in-memory copy');
  assert.equal(f.calls.length, 20);
});

test('market: if the live build fails the last good snapshot is kept', async (t) => {
  _resetMarketMemo();
  const f = stubFetch(() => ({ status: 500, json: {} })); t.after(f.restore);
  const db = fakeDb({ radar_market: [{ id: 1, snapshot: { tag: 'old' }, as_of: new Date(Date.now() - 3600e3).toISOString() }] });
  assert.equal((await getMarket(db)).tag, 'old');
  assert.equal(await getMarket(fakeDb()), null);
});

// ── a scheduled run, end to end ──
const scheduleDb = () => fakeDb({
  app_setting: [{ key: 'mode', value: 'personal' }],
  radar_screener: [
    { owner_id: 'u1', id: 'volume-surges', kind: 'builtin', windows: [{ start: '09:30', end: '10:00', every: 15 }], timezone: 'America/New_York' },
    { owner_id: 'u1', id: 'scr-1', kind: 'custom', name: 'Mine', conditions: [V('Close', '>', 5)], windows: [{ start: '17:30', end: '18:00', every: 15 }], timezone: 'Asia/Riyadh' },
    { owner_id: 'u2', id: 'premarket-movers', kind: 'builtin', windows: [{ start: '08:00', end: '09:00', every: 5 }], timezone: 'America/New_York' },
    { owner_id: 'u2', id: 'growth-pullback', kind: 'builtin', windows: [], timezone: 'UTC' },
  ],
});
const marketFetch = () => stubFetch((url, body) => (url.includes('tradingview')
  ? { json: { data: body.symbols?.tickers ? [] : [tvRow('NASDAQ:AAA', COLUMNS, { description: 'AAA', close: 10, change: 5 })] } }
  : { status: 500, json: {} }));

test('schedule: at 09:30 New York the due schedules scan, store the register and freeze a snapshot', async (t) => {
  _resetMarketMemo();
  const f = marketFetch(); t.after(f.restore);
  const db = scheduleDb();
  const at = new Date('2026-11-11T14:30:10Z');                          // Wed 09:30 ET = 17:30 Riyadh
  const run = await tick(db, at);
  assert.deepEqual(run.fired.sort(), ['u1|scr-1', 'u1|volume-surges'], 'the ET window and the Riyadh window are both due; 08:00–09:00 is over');
  await run.done;
  const snaps = db.tables.radar_snapshot;
  assert.deepEqual(snaps.map((s) => [s.owner_id, s.screener, s.ticker, s.day]).sort(), [['u1', 'scr-1', 'AAA', etDay()], ['u1', 'volume-surges', 'AAA', etDay()]]);
  assert.equal(db.tables.radar_register.length, 2);
  assert.ok(db.tables.radar_register.every((r) => r.owner_id === 'u1' && r.live === true && r.card.t === 'AAA'));

  // the timer ticks three times a minute: the same minute must not fire twice
  const again = await tick(db, new Date('2026-11-11T14:30:40Z'));
  assert.deepEqual(again.fired, []);
  // 09:31 is not on the 15-minute grid; 09:45 is
  assert.deepEqual((await tick(db, new Date('2026-11-11T14:31:00Z'))).fired, []);
  const next = await tick(db, new Date('2026-11-11T14:45:00Z'));
  assert.deepEqual(next.fired.sort(), ['u1|scr-1', 'u1|volume-surges']); await next.done;
  assert.equal(db.tables.radar_snapshot.length, 4, 'a second frozen snapshot');
  assert.equal(db.tables.radar_register.length, 2, 'the register is updated in place');
});

test('schedule: nothing runs on a weekend, a holiday, or with no service-role client', async (t) => {
  const f = marketFetch(); t.after(f.restore);
  for (const iso of ['2026-11-14T14:30:00Z', '2026-11-26T14:30:00Z']) assert.deepEqual((await tick(scheduleDb(), new Date(iso))).fired, []);
  assert.deepEqual((await tick(null, new Date('2026-11-12T14:30:00Z'))).fired, []);
  assert.equal(f.calls.length, 0);
});

// ── shortlist cards, news / CAN SLIM flags, exact names, sparkline, labels ──
import { warmNews, cachedNews, _resetNewsCache } from '../core/newsFlags.mjs';
import { CLASSIFICATION } from '../core/screenerTranslate.mjs';
import { runScreener, readRegister } from '../core/register.mjs';

test('shortlist: every starred stock comes back as a card, whichever screener found it', async (t) => {
  const f = stubFetch((url, body) => ({ json: { data: [
    tvRow('OTC:IBM', COLUMNS, { description: 'IBM otc line', close: 1 }),
    tvRow('NYSE:IBM', COLUMNS, { description: 'IBM', close: 250, change: 1 }),
    tvRow('NASDAQ:NVDA', COLUMNS, { description: 'NVIDIA', close: 175, change: -2, change_abs: -3.5 })] } })); t.after(f.restore);
  const db = fakeDb({ app_setting: [{ key: 'mode', value: 'personal' }], radar_shortlist: ['NVDA', 'GONE', 'IBM'].map((ticker) => ({ owner_id: 'u1', ticker })) });
  const r = await radar.shortlistCards(db);
  assert.deepEqual(r.stocks.map((s) => [s.t, s.p, s.c]), [['NVDA', 175, -2], ['IBM', 250, 1]], 'shortlist order; the listed line beats the OTC one');
  assert.deepEqual(r.missing, ['GONE']);
  assert.deepEqual(f.calls[0].body.filter, [{ left: 'name', operation: 'in_range', right: ['NVDA', 'GONE', 'IBM'] }]);
  assert.deepEqual(await radar.shortlistCards(fakeDb()), { stocks: [], missing: [] });
  assert.equal(f.calls.length, 1, 'an empty shortlist makes no request');
});

test('news flag: looked up off the scan, written to the day’s list, then stamped on later scans', async (t) => {
  _resetNewsCache();
  const fresh = { title: 'AAA wins big contract', link: 'https://x/1', publisher: 'Wire', providerPublishTime: Math.floor(Date.now() / 1000) - 3600, relatedTickers: ['AAA'] };
  const f = stubFetch((url, body) => {
    if (url.includes('tradingview')) return { json: { data: body.symbols?.tickers ? [] : [tvRow('NASDAQ:AAA', COLUMNS, { description: 'AAA Corp', close: 10, change: 5 }), tvRow('NASDAQ:BBB', COLUMNS, { description: 'BBB Corp', close: 10, change: 1 })] } };
    return { json: { news: url.includes('AAA') ? [fresh] : [] } };       // the news search
  }); t.after(f.restore);
  const db = fakeDb();
  const spec = { key: 'volume-surges', filters: [], sort: {} };
  const first = await runScreener(db, 'u1', spec);
  assert.deepEqual(first.stocks.map((s) => s.news), [false, false], 'not known yet — the scan does not wait for news');
  assert.equal(await warmNews(db, 'u1', spec.key, first.day, first.stocks), 1);
  assert.equal(cachedNews('AAA'), true); assert.equal(cachedNews('BBB'), false);
  const list = await readRegister(db, spec.key, 'u1');
  assert.deepEqual(list.stocks.map((s) => [s.t, s.news]), [['AAA', true], ['BBB', false]], 'the saved list now carries the flag');
  const second = await runScreener(db, 'u1', spec);
  assert.equal(second.stocks.find((s) => s.t === 'AAA').news, true, 'and a later scan keeps it');
  const searches = f.calls.filter((c) => !c.url.includes('tradingview')).length;
  await warmNews(db, 'u1', spec.key, first.day, first.stocks);
  assert.equal(f.calls.filter((c) => !c.url.includes('tradingview')).length, searches, 'known answers are not looked up again');
});

test('card: CAN SLIM flag = quarterly and annual EPS both up 25% or more', () => {
  const cs = (q, y) => toCard(full({ earnings_per_share_diluted_yoy_growth_fq: q, earnings_per_share_diluted_yoy_growth_fy: y }), 0, NOW).cs;
  assert.deepEqual([cs(30, 40), cs(25, 25), cs(30, 10), cs(-5, 60), cs(null, 40), cs(undefined, undefined)], [true, true, false, false, false, false]);
});

test('card: the sparkline follows the day — previous close, pre-market close, open, last', () => {
  assert.deepEqual(toCard(full({ premarket_close: 172.77, open: 172.8 }), 0, NOW).changeLine, [168.89, 172.77, 172.8, 175.59]);
  assert.deepEqual(toCard(full({ open: 172.8 }), 0, NOW).changeLine, [168.89, 172.8, 175.59]);
});

test('builder: a sector / industry / exchange / country is matched to the scanner’s exact name', () => {
  const run = (metric, value) => conditionsToFilters([V(metric, '=', value)]);
  assert.equal(run('Sector', '  electronic technology ').filters[0].right, 'Electronic Technology');
  assert.equal(run('Exchange', 'nasdaq').filters[0].right, 'NASDAQ');
  assert.equal(run('Country', 'united states').filters[0].right, 'United States');
  assert.match(run('Sector', 'tech').unsupported[0].reason, /did you mean .*Electronic Technology/);
  assert.match(run('Industry', 'zzzz').unsupported[0].reason, /not a industry name the scanner knows$/);
  assert.deepEqual(radar.classification(), CLASSIFICATION);
  assert.ok(CLASSIFICATION.Sector.length >= 20 && CLASSIFICATION.Industry.length >= 100 && CLASSIFICATION.Exchange.includes('NYSE'));
});

test('schedule: outcome labels run after the close and again after the after-hours session', async (t) => {
  const bars = [{ t: Date.parse('2026-11-12T15:00:00Z') / 1000, o: 10, h: 12, l: 9, c: 11, v: 5 }];
  const yahoo = { chart: { result: [{ meta: {}, timestamp: bars.map((b) => b.t), indicators: { quote: [{ open: [10], high: [12], low: [9], close: [11], volume: [5] }] } }] } };
  const f = stubFetch(() => ({ json: yahoo })); t.after(f.restore);
  const db = scheduleDb(); db.tables.radar_snapshot = [{ owner_id: 'u1', day: '2026-11-12', ticker: 'AAA' }];
  const at = (hm) => tick(db, new Date(`2026-11-12T${hm}:00Z`));          // Thursday; ET = UTC−5
  const count = () => f.calls.length;
  await (await at('20:30')).done; assert.equal(count(), 0, '15:30 ET — before the close, no labels');
  await (await at('21:05')).done; assert.equal(count(), 1, '16:05 ET — labels run');
  await (await at('21:06')).done; assert.equal(count(), 1, 'only once');
  const late = await tick(db, new Date('2026-11-13T01:05:00Z')); await late.done;   // 20:05 ET, same ET day
  assert.equal(count(), 2, '20:05 ET — labels run again for late arrivals');
  // (the real table is keyed by account + day + ticker, so the second run overwrites the first)
  assert.ok(db.tables.radar_snapshot_label.every((l) => l.ticker === 'AAA' && l.high === 12 && l.day === '2026-11-12'));
});
