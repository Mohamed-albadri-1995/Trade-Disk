# Screener tools: known issues

Open findings for the screener tools after the 2026-10 review, and the ones
fixed during it. Every fix landed with a test that failed first. The
documents that describe each area are linked from [README.md](README.md).

## Open: need a decision

| # | Severity | What | Where | The decision |
|---|---|---|---|---|
| F-16 | MED | Sector bias is lopsided: the score runs about −39 to +100, so 1 of 5 bullish conditions can read BULLISH while BEARISH needs 0 of 5 | `src/sideD/sectors.js` | Centre the score on 0 (−100..+100); the hot-sector thresholds (60/40/20) are tuned to today's scale and would need re-tuning with it |
| D-S9 | MED (data) | T6's photo (R1) is set for 10:16, but its Unexplained Move screener only starts at 11:30 — the capture time was inherited from Overextended, the screener it replaced, and its recorded reason still talks about RSI. If neither was changed on the box, R1 is frozen before T6 has found anything, so T6 trains on nothing | `tools.config.json` (T6 `captureAt`), `src/sideA/seedScreeners.js` (T6 window) | Check on the box first (`cat data/tools.local.json`, and T6's window in its screener builder) — a hand edit may already cover it. If not: move the photo after the window opens (e.g. 11:46 / entries 11:47 and 11:51), or open the window earlier |
| D-D1 | MED (data) | The scorer is off on every tool (`scorer: off (by config)`), so every card's score is blank and the shortlist auto-rule (top 5 with score ≥ 70) never adds anything — only manual stars reach the shortlist | deploy-tools.sh, `src/sideF/shortlist.js` | Turn a scorer on for the tools that have enough training rows, or retire the auto-rule and the score column |
| D-D2 | LOW (data) | The training rows (R4A/R4B) carry fewer columns than R1: no CANSLIM `cs*`, no week/quarter/year ranges, no days to cover. The values are in R1 for the same day | `src/warehouse/registers.js` | Add them to R4 (changes the training columns from that day on — the P-1 consideration), or leave R4 as is and join R1 when needed |
| D-D3 | LOW (data) | R2's O'Neil columns are read from today's file when the register is exported, so an old R2 day shows today's O'Neil status, not that day's | `src/warehouse/registers.js` (R2) | Freeze the O'Neil status into the snapshot when it is taken |
| D-D5 | LOW (logic) | The mid-term stage counts six signals, but two are repeats of the other two ("1H" proxies use the daily close > SMA20 and SMA5 > SMA20), so it runs on four facts with two counted twice | `src/sideD/regime.js` | Use real hourly data, or count the four distinct checks and re-tune the stage rules |
| P-1 | LOW (naming) | R4A/R4B call the R1 price `price936` while R1 is captured at 09:36, 09:46 or 10:01 per tool (no look-ahead) | `src/warehouse/` | Renaming a stored training column splits the data set; probably leave it |

## Open: to do

| # | Severity | What | Where |
|---|---|---|---|
| D-D4 | LOW | R3 stores the opening range (09:30–09:35 high/low) for every card but no register exports it, though METHODOLOGY says it is recorded for every card | `src/warehouse/registers.js` (R3A/R3B) |
| D-D6 | LOW (display) | The Market tab's group table marks "rolled up" only for the two-rung roll-up and its note still describes a single step; a one-rung roll-up (to the SIC industry group) shows as an ordinary industry. The card shows both correctly | `public/index.html` `renderGroupTable` |
| D-D7 | LOW (text) | Two messages are out of date: the card's short-interest tooltip says Yahoo first then FINRA (the code tries FINRA, Yahoo, then Nasdaq), and `/api/market/oneil` tells you to check `systemctl status qp-chart` (qp runs under pm2) | `public/index.html`, `src/routes/market.js` |
| D-T1 | LOW (settings) | 31 settings keys are accepted by `POST /api/settings` but nothing in the screener tool reads them: `trading_*` and its `trading_sideA_*` aliases, `grading_*` (the journal reads its own copy), `analysis*`, `aiApiKey`/`aiModel` (seeded, no inputs). See [SETTINGS.md](SETTINGS.md) | `src/routes/settings.js` `SETTING_RULES`, `src/db/index.js` seed |
| D-T2 | LOW (settings) | The hot-sector and sector-bias keys are read as `value \|\| default`, so a saved 0 acts as the default (`coolOffDays 0` → 2, `hotFloorThreshold 0` → 20, `sectorBearishThreshold 0` → −20), though the validator accepts 0 | `src/sideD/sectors.js` |
| D-T3 | LOW (text) | The Regime Sub-Table Threshold help says "Default: 10"; the seeded value is 150 (10 is only the fallback when the row is missing) | `public/index.html` Scorer section |
| D-T4 | LOW (text) | The API Keys section says Finnhub "used to live here" but the news code still asks Finnhub when a key exists; the data check's fix lines point to "Settings > API Keys", which has no inputs (keys go in `data/keys.json`) | `public/index.html`, `src/routes/datacheck.js` |
| D-T5 | LOW (text) | The Tradability floor title says "every screener, every tool", but the values live in each tool's own database: changing T2's floor does not change T7's | `public/index.html` |
| D-T6 | LOW (jobs) | A job's id is its name, and the R1 and Auto-Rule names include the capture time, so changing a tool's capture time gives those jobs new ids: a custom schedule or "off" set on them is dropped | `src/scheduler.js` |
| D-S10 | LOW (screeners) | Startup repairs run on every restart; those guarded by "the field is empty" (default run windows) or "the rule is missing" (T7's added rules, its limit capped at 25) put back a window you cleared or a rule you removed, without saying so | `src/sideA/seedScreeners.js` |
| D-S11 | LOW (text) | The Analysis tab says "Service (port 3001)" (T1 only; each scorer is on its tool's port + 1), "start service on EC2: `python3 server.py`" (it runs under pm2) and that training means exporting CSVs and running `processor.py` (the Train button does it); the Warehouse picker says "R1 — Frozen 9:36" on every tool | `public/index.html` |
| D-S12 | MED (data) | The screener scorecard grades every screener on `upR`, the move up, including bearish screeners (most mirrors), so their verdicts and the mirror comparison are backwards | `src/analysis/screenerReport.js` |
| D-S13 | LOW | `data/shortlist-all.json` is read, changed and written back by every tool; two publishes in the same instant can drop one tool's change until its next publish | `src/sideF/globalShortlist.js` |
| D-S14 | MED | The benchmark tool (T9, Stocks in Play) is stopped, and the archive answers only `/api/warehouse/*`, so `/screeners/compare` has no benchmark and every stopped tool's screeners are missing from it | `src/archive/server.js`, `public/compare.html` |
| D-S15 | LOW (display) | The Screener tab never refreshes by itself; cards on screen are as old as the last page load, tab switch or Run Scan, though the server re-quotes them every 5 minutes | `public/index.html` |

## Fixed in the 2026-10 review

| # | What was wrong | Test |
|---|---|---|
| F-21 | The industry map flipped between SIC (nightly, market-wide) and TradingView labels (every scan): a scan replaced a SIC entry and dropped its code, so the morning's group ranks put the stocks on screen into thin groups. Both sources were deliberate — TradingView labels came first; SIC replaced them because groups built from screener output ranked a stock against what the screeners caught. The fix keeps that decision: SIC wins, TradingView fills only the gaps | `tests/industryMap.sicWins.test.js` |
| T8 | T8's shared ★ CANSLIM list was frozen and fading with T8 stopped. Retired: the list, its badge, its page and `/api/canslim` are gone; the O'Neil letters on every card replace it. T8's registers stay archived | `tests/home.levels.test.js`, `tests/pipeline.stages.test.js` |
| D-S6 | Not a fault: T1's name "Swing trades after huge volume" vs its Big Move / Pre-Mkt / Trend screeners is kept as is on the trader's word (2026-10-02) | — |
| D-S3 | The 5-minute refresh mapped a misaligned TradingView answer and shifted every field on every card | `tests/sideG.misaligned.test.js` |
| F-19 | `getFeed()` threw on a database without `trading_brokers`, so every Alpaca bar request failed (T6 dropped all candidates) | `tests/alpaca.feed.test.js` |
| F-15 | The data check's news line was always "down" | `tests/datacheck.news.test.js` |
| F-18 | The breakout list named the wrong tickers (also written into R2) | `tests/sideD.breakouts.test.js` |
| R-1, F-12 | `/export/all` was unreachable; `/import` reported rows it never wrote | `tests/warehouse.routes.test.js` |
| F-1 | The compare page crashed as soon as a tool had data | `tests/compare.page.test.js` |
| D-S5 | The CANSLIM page described a daily run while T8 was stopped (page since retired with the list) | — |
| D-S8 | Unexplained Move dropped every candidate on its first scan | `tests/preR0.firstScan.test.js` |
| D-S4 | Clicking a ticker without tv.js threw and locked scrolling | `tests/index.openChart.test.js` |
| F-14 | Missing TradingView inputs became numbers (a fabricated "<0.5" pre-market band on ~1 card in 11, −100 % gaps) | `tests/sideB.missingInputs.test.js` |
| F-17 | Hot sectors counted scans instead of trading days (hot after 15 minutes) | `tests/sideD.hotByDay.test.js` |
| F-13 | A range filter mirrored to the same range | `tests/screenerStore.mirrorRange.test.js` |
