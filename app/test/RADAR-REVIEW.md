# Radar review — 2026-11-11

Scope: the Radar back end (`api/radar.mjs`, `api/registers.mjs`, `core/screeners.mjs`,
`core/screenerTranslate.mjs`, `core/register.mjs`, `core/collect.mjs`, `core/labels.mjs`,
`core/scheduler.mjs`, `core/technicals.mjs`, `core/analysis.mjs`, the TradingView / Yahoo /
Polygon providers, the Radar routes in `server.mjs`) and the pure logic in `ui-radar/src`.
Not reviewed: `core/market.mjs`, `core/oneilGroups.mjs`, `providers/edgar.mjs`,
`providers/news.mjs`, and the React screens themselves.

Run the tests: `cd app && npm install && npm test` (no network, no database needed).
88 tests, all passing. "Live" means checked against the real TradingView scanner.

## Fixed

1. **One bad web address stopped the whole app.** `GET /%E0%A4%A` (no sign-in) made Node
   exit. The server now answers 400, and no request error can end the process.
2. **Scheduled scans could mix accounts.** `readRegister` / `tickerStamps` now take the
   account and filter by it, so the service-role client the scheduler uses is scoped too.
3. **Custom screeners silently returning nothing.** The translator now knows the lengths the
   scanner really has (live, 2026-11-11) and reports any other one with the list:
   SMA/EMA 2, 3, 5–10, 12–15, 20, 21, 25, 26, 30, 34, 40, 50, 55, 60, 75, 89, 100, 120, 144,
   150, 200, 250, 300; RSI 2, 3, 4, 5, 7, 9, 10, 14, 20, 21, 30; VWMA 20, ATR 14, ADX 14,
   CCI 20, ROC 9 only; WMA does not exist. Week high/low now use the 5-day fields and
   Dividend yield uses `dividends_yield_current` (the old field names were empty).
4. **"Device local time" fired on New York time.** The page now saves the device's real time
   zone and the scheduler reads each schedule in its own zone. A schedule saved before this
   change still holds `device` and keeps running on US Eastern until it is saved again.
5. **Built-ins in the builder = the built-ins that run.** MA Stack Breakout and Trend Leaders
   now load with their real 1-minute / 5-minute rules; all five match rule for rule (live:
   same result counts). Eight metrics the built-ins needed were added to the builder library.
6. **RSI** is now Wilder's, matching other platforms. Indicator length is honoured.
7. **"Between"** with an empty bound, or against another filter, is reported instead of run.
8. **Intraday bars** are cached only for a finished day that has bars.
9. **A custom screener can no longer take a built-in's id.**
10. **Card details:** market cap shows 1.5B (not "2B"), a −100% day no longer puts `Infinity`
    on the card, and a stock with no down days counts as accumulating.
11. **Scheduler:** skips NYSE holidays (2026–2027 listed in `core/scheduler.mjs` — extend
    yearly) and ticks three times a minute so a drifting timer cannot step over a due scan.
12. **Smaller:** the daily bar counts as "still forming" only before 16:00 ET; a negative or
    junk `limit` falls back to 50; the analysis cache is capped at 500 tickers;
    `tools/radar-smoke.mjs` (it called the old SQLite API and crashed) is removed.

## Second pass — builder, schedule, cards, Market tab

Checked each against live data (TradingView scanner and Yahoo) as well as by test.

**Builder**
13. **"OR" was ignored** — every condition was ANDed. OR now runs (AND binds tighter:
    `a AND b OR c` is `(a AND b) OR c`); live: 121 + 778 stocks = 899 for the OR of two rules.
14. **A timeframe on a daily-only metric matched nothing.** Performance, week/month high/low,
    pre-market, market cap, valuation, growth and classification metrics exist only on the
    daily view; the timeframe is now ignored for them. Intraday relative volume exists only
    on 5 minutes and always uses it. All 47 runnable metrics × 9 timeframes were swept live.
15. **Reported instead of mis-run:** text metrics (Sector, Industry, Exchange, Country) with
    anything but = / ≠ (the scanner answers HTTP 400); "Percentage distance" mode (it ran as
    a plain value compare); an indicator Source other than Close (it was ignored).

**Schedule** — a tick is now testable end to end: a due window scans, updates the register
and freezes the snapshot, per account and per time zone, once per minute, not on weekends
or holidays (`test/radar-live-paths.test.mjs`).

**Cards**
16. **A falling stock showed "+-1.20 (+-4.00%)" in green.** Sign and colour now follow the move.
17. **Pre-market high / low / range were always 0** and PM/ADR was an approximation; they now
    come from the scanner. ADR% uses the scanner's average daily range (ATR as fallback), and
    the $ change is the scanner's own.
18. **The "Earnings" filter could never match** (nothing set the tag). Cards now carry an
    Earnings tag when the next report is today or within 7 days.
19. **The scanner's data is 15 minutes delayed** (`update_mode: delayed_streaming_900`, the
    free feed). This cannot be changed here; the header now says "15-MIN DELAYED" instead of
    implying real time. Live check: card prices matched Yahoo allowing for that delay.

**Market tab**
20. **During the session it showed yesterday.** Today's forming bar was dropped, so prices and
    day changes were the prior close until 8pm ET. It now uses the live bar (live check: SPY
    price and day % equal Yahoo's); only the distribution-day count waits for the close.
21. **Not refreshed on time.** The snapshot is rebuilt after 2 minutes during the session (10
    outside it), and the open page re-reads it every minute; before, it loaded once and
    changed only when a scan was run by hand.
22. **A reader who could not store the snapshot got the old one** although a fresh one had
    just been built. The fresh one is now returned, kept in memory, and built once for
    concurrent readers.

## Third pass — the items left open after the second

23. **Shortlist tab** now shows every starred stock, quoted fresh by ticker
    (`/api/radar/shortlist-cards`), whichever screener it came from.
24. **The screener list refreshes itself**: once a minute the page re-reads today's saved
    list for the screener on screen (it does not run a scan), so stocks found by a
    scheduled scan appear without pressing Run. Applied filters are kept.
25. **News filter works.** Each card's "news in the last 24h" flag is looked up in the
    background after a scan (Yahoo news search, about half a second per stock, answers kept
    15 minutes) and written into the day's list, so it shows on the next refresh — a scan
    never waits for it (`core/newsFlags.mjs`).
26. **CAN SLIM filter works.** The flag is set when quarterly and annual EPS are both up 25%
    or more — the same earnings test the Growth Pullback screener uses. It is that test
    only, not a full CAN SLIM score.
27. **Outcome labels run twice**: after the 16:00 ET close and again after 20:00 ET, so
    stocks first seen by an after-hours window are labelled.
28. **Builder names**: Sector, Industry, Exchange and Country offer the scanner's exact names
    as a pick-list (`core/reference/tv-classification.json`, captured from the scanner
    2026-11-12) and typed text is matched case-insensitively; an unknown name is reported
    with the closest matches. The "Indicator type" selector on a moving average is removed
    (the filter already is the type).
29. **Sparkline** now follows the day: previous close → pre-market close → open → last.

## Fourth pass — in a real browser, as the owner

Radar was driven in headless Chromium through the real server and real code, with live
market data and an in-memory database in place of Supabase (`test/e2e/`; nothing touches
the hosted project). Every screen loaded with no page or console errors.

30. **The sidebar filters were prototype leftovers.** "Market" (NASDAQ / NYSE) did nothing;
    "Sector" offered five fixed names that never matched a real card; "Pre-Market Movers"
    was ticked by default and did nothing; and pressing Apply silently added a minimum
    activity of 60, relative volume of 2 and a $5–$500 price range. Now: Market filters by
    exchange, Sector lists the industries in the results on screen, Pre-Market works, every
    numeric filter starts off, and Reset keeps the screener on screen. Browser check: Growth
    Pullback 5 cards → "Above 20 EMA" 0 (correct: that screener is below it) → Reset 5.
31. **The header said LIVE at 3am.** It now reads MARKET CLOSED / PRE-MARKET / AFTER-HOURS
    outside the session.
32. **Light theme:** the selected analysis tab was dark text on blue; now white.
33. **Accounts (database, applied 2026-11-12):** a user can no longer set or change their own
    role or plan, and new accounts are members, not owners. The two existing accounts keep
    their owner role (`db/supabase/2026-11-12-profile-role-lock.sql`).

## Still open

- **Finish the Polygon key move.** Done on the hosted database (2026-11-12): `app_secret`
  exists, holds the key, and signed-in users cannot read it. Not done: the old readable row
  in `app_setting` is still there, because the deployed app still runs the old code and
  reads it. After this branch is deployed, delete that row (step 2 in
  `db/supabase/2026-11-11-app-secret.sql`).
- **Re-save the five schedules.** All five saved schedules hold `device` as their time zone,
  so they keep running on US Eastern until each is opened and saved again from the page.
- **Provider keys in `source_group.keys` are readable by every signed-in user** (same
  problem the Polygon key had). No key is stored there today, so nothing is exposed yet;
  move them to `app_secret` before the first one is saved.
- **Supabase Auth: leaked-password protection is off** (the project's only security
  advisory besides the intended policy-less `app_secret`). Turn it on in the dashboard:
  https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- `buildAnalysis` caches per ticker only, so the name/sector context of whoever asked first
  is served to everyone for 8 minutes.
- The after-close labels run is remembered only in memory (a restart after 16:05 ET runs it
  again; harmless, it overwrites the same rows).
- `tools/smoke.mjs` (Journal) still calls the old SQLite API and crashes; most of
  `app/README.md` still describes the SQLite build.
