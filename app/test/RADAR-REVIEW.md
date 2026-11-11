# Radar review — 2026-11-11

Scope: the Radar back end (`api/radar.mjs`, `api/registers.mjs`, `core/screeners.mjs`,
`core/screenerTranslate.mjs`, `core/register.mjs`, `core/collect.mjs`, `core/labels.mjs`,
`core/scheduler.mjs`, `core/technicals.mjs`, `core/analysis.mjs`, the TradingView / Yahoo /
Polygon providers, the Radar routes in `server.mjs`) and the pure logic in `ui-radar/src`.
Not reviewed: `core/market.mjs`, `core/oneilGroups.mjs`, `providers/edgar.mjs`,
`providers/news.mjs`, and the React screens themselves.

Run the tests: `cd app && npm install && npm test` (no network, no database needed).
61 tests, all passing. "Live" means checked against the real TradingView scanner.

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

## Still open

- **Run the Polygon key migration.** The one shared key now lives in `app_secret`, which only
  the server can read (`core/polygonKey.mjs`). Until `db/supabase/2026-11-11-app-secret.sql`
  is run in Supabase and `SUPABASE_SERVICE_ROLE_KEY` is set on the server, the app keeps
  reading the old, readable `app_setting` row.
- **Every account is an owner.** `profile.role` defaults to `owner` and a user may update
  their own profile row, role included (`db/supabase/schema.sql:13,20`). So every "owner or
  admin only" rule — the feed switch, the Polygon key save — is open to any signed-in user.
- **The other provider keys are readable by every signed-in user.** They sit in
  `source_group.keys`, whose read policy is "any authenticated user" — the same problem the
  Polygon key had.
- `buildAnalysis` caches per ticker only, so the name/sector context of whoever asked first
  is served to everyone for 8 minutes.
- The after-close labels run is remembered only in memory (a restart after 16:05 ET runs it
  again; harmless, it overwrites the same rows).
- `tools/smoke.mjs` (Journal) still calls the old SQLite API and crashes; most of
  `app/README.md` still describes the SQLite build.
