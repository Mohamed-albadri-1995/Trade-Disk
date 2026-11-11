# Radar review — 2026-11-11

Scope: the Radar back end (`api/radar.mjs`, `api/registers.mjs`, `core/screeners.mjs`,
`core/screenerTranslate.mjs`, `core/register.mjs`, `core/collect.mjs`, `core/labels.mjs`,
`core/scheduler.mjs`, `core/technicals.mjs`, `core/analysis.mjs`, the TradingView / Yahoo /
Polygon providers, the Radar routes in `server.mjs`) and the pure logic in `ui-radar/src`.
Not reviewed: `core/market.mjs`, `core/oneilGroups.mjs`, `providers/edgar.mjs`,
`providers/news.mjs`, and the React screens themselves.

Run the tests: `cd app && npm install && npm test` (no network, no database needed).
52 tests: 36 pass; 16 are marked `todo` — each one is a bug below, written as the test that
will pass once it is fixed. "Live" means checked against the real TradingView scanner.

## Fix first

1. **One bad web address stops the whole app.** `GET /%E0%A4%A` (no sign-in needed) throws in
   `serveStatic` (`server.mjs:230`) with nothing catching it; Node exits, taking the scheduler
   with it. Reproduced. Test: `radar-server` "malformed web address".
2. **Scheduled scans can mix accounts.** `readRegister` and `tickerStamps` (`core/register.mjs`)
   do not filter by owner. Page requests are protected by database row security, but the
   scheduler uses the service-role client, which bypasses it. When a scheduled scan fails,
   `scan()` falls back to `readRegister`, gets every account's list, and `collect` freezes it
   into this account's snapshot. Only matters with more than one account.
3. **Custom screeners can silently return nothing.** The translator emits any moving-average
   length (`EMA37`); the scanner only has some lengths and answers "0 stocks" with no error
   (live). Also live, on AAPL: `WMA…`, `VWMA…`, `High.1W`/`Low.1W` (Week high/low) and
   `dividend_yield_recent` come back empty, so those "runnable" metrics do not work.
4. **Schedules in "Device local time" fire on New York time.** `device` is the default in the
   page, but the scheduler treats anything that is not `UTC` as US Eastern
   (`core/scheduler.mjs`). A user outside Eastern time gets scans at the wrong hours.
5. **The Polygon key is readable by every signed-in user.** It is stored in `app_setting`,
   whose read policy is "any authenticated user" (`db/supabase/schema.sql:271`).

## Wrong results

6. **MA Stack Breakout in the builder is a different screener.** It runs on 1-minute averages
   but loads into the builder as Daily. The code comment only admits this for Trend Leaders
   (which also drops two intraday rules).
7. **RSI is not Wilder's**, although the comment says so: it averages the last 14 changes with
   no smoothing (66.7 vs 55.1 on the test series), so it will not match TradingView.
8. **Builder indicator length is ignored** for RSI/ATR/ADX/CCI/ROC (RSI 7 runs as RSI 14).
9. **"Between" bugs:** an empty bound runs as 0; Between against another metric sends a
   request TradingView rejects (HTTP 400, live).
10. **Intraday bars are cached forever, even partial or empty.** Opening today's chart
    mid-session stores an incomplete day that is then served as final (`api/registers.mjs`).
11. **A custom screener can take a built-in's id**, overwriting that built-in's schedule with a
    row that never runs (`saveScreenerConfig` trusts the id from the page).
12. **Six runnable metrics are missing from the builder library** (Premarket volume/change,
    Month high/low, Week high/low), so a loaded built-in previews as "undefined (Daily)".
13. **Accumulation flag is false for a stock with no down days**; a −100% day puts `Infinity`
    on the card; market cap rounds 1.5B to "2B" and 999.6M to "1000M".

## Smaller, not covered by a test

- Scheduler: no US market holidays; the one-minute timer can drift across a minute boundary
  and skip one due scan; the after-close labels run is remembered only in memory.
- Labels: a 5-minute bar with a missing high/low is counted as 0 (`Math.min` over nulls).
- `technicals`: the "today's bar is still forming" test uses the UTC date, so from the close to
  8pm ET the finished session is still treated as partial.
- `buildAnalysis` caches per ticker only, so the name/sector/market context of whoever asked
  first is served to everyone for 8 minutes; the cache never shrinks.
- `limit` on scan/preview accepts negative numbers.
- `tools/radar-smoke.mjs` and `tools/smoke.mjs` still call the old SQLite API and crash;
  `app/README.md` still describes SQLite with "no external services" and TradeLab as not built.
