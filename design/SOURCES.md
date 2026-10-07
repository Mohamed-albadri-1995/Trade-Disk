# Sources: the adapters

**Trunk section:** [§6.1 Sources](../ARCHITECTURE.md#61-sources).

**Talks to:** every domain that needs the outside world: Tools and screeners
(the scanner), the Card (quotes, short interest, borrow, news), the Market
(index and sector quotes), Research data (EDGAR, 13F, Polygon, index bars),
Registers (outcome bars), Quant (chart bars), the Journal (account fills,
bars), Platform (health).

**Built on:** [DATA-PIPELINE](../legacy/screeners/DATA-PIPELINE.md) (every call the
card pipeline makes, with endpoints and fallbacks),
[DATA-FEEDS](../legacy/qp/DATA-FEEDS.md) (qp's bar feeds, warm-up, cache limits,
borrow check), [DATACHECK](../legacy/screeners/DATACHECK.md) (judging each source
by its content), [CANSLIM](../legacy/qp/CANSLIM.md) §3.1 and §10.4 (the free
official sources for O'Neil data), [ACCOUNTS](../legacy/journal/ACCOUNTS.md) (the
journal's Alpaca calls).

---

## Contents

1. [Why adapters](#1-why-adapters)
2. [The adapter contract](#2-the-adapter-contract)
3. [Every source](#3-every-source)
4. [Bars: feeds, cache and limits](#4-bars-feeds-cache-and-limits)
5. [Fallback orders](#5-fallback-orders)
6. [Health: the data check made permanent](#6-health-the-data-check-made-permanent)
7. [Keys](#7-keys)
8. [What failed](#8-what-failed)
9. [Contracts](#9-contracts)
10. [How the rebuild is proven](#10-how-the-rebuild-is-proven)

---

## 1. Why adapters

In the old desk each source is called from inside the stage that needs it, in
every tool's process: the same ticker's short interest is fetched once per tool
that found it; a fallback order exists in one stage and not another; health is
known only when someone presses the data-check button. An adapter puts
everything about one endpoint family in one place (a provider with several
endpoints, such as Yahoo or Alpaca, has one adapter for each), and every
domain asks adapters for **facts**, never calling a source directly.

---

## 2. The adapter contract

Each adapter declares:

| Item | Meaning |
|---|---|
| `families` | the fact families it can produce |
| `request` | endpoint, method, headers, timeout |
| `auth` | none, a key (named in the secret store), a User-Agent |
| `limits` | requests per second or per day; batch size; time budget |
| `freshness` | how long a fact it produced stays fresh, per family |
| `parse` | turning the answer into fact values, with alignment and sanity checks |
| `honest null` | what `none` means (the source answered: nothing) and what `unavailable` means (could not ask), each with a reason |
| `health` | how its content is judged (ok, degraded, down), on a schedule |
| `fixtures` | recorded answers, including failures, for CI |

Every call is logged with its duration and result; each adapter keeps a
counter of calls, failures and the last error, shown on the health page.

---

## 3. Every source

| Adapter | Endpoint(s) | Auth | Families | Notes and quirks |
|---|---|---|---|---|
| **tv_scanner** | `POST scanner.tradingview.com/america/scan?label-product=screener-stock` | none; browser User-Agent, Origin and Referer of tradingview.com; 15 s | `candidates` (per screener), `quote` (32 columns, batches of 200 by symbol), index and sector-ETF quotes | **ignores unknown columns silently** (verify the column list); refuse a batch whose rows differ in length from the columns asked (D-S3); warn when two range windows are identical on most rows; `short_percentage_of_float` never filled; longer-window highs not split-adjusted |
| **tv_news** | `news-headlines.tradingview.com/v2/headlines` | none | `news` | — |
| **yahoo_quote** | `quoteSummary` | cookie and crumb from `fc.yahoo.com` | `short_interest` (fallback) | per symbol |
| **yahoo_news** | `query1.finance.yahoo.com/v1/finance/search` | none | `news` | — |
| **yahoo_bars** | chart API (1-minute, daily), with or without extended hours | none | bars | shallow 1-minute history (weeks); years of daily |
| **alpaca_data** | `data.alpaca.markets/v2/stocks/bars`, `/v1beta1/news` | key | bars (fallback), `news` (Benzinga) | IEX feed on the free plan: thin volume, about a week of intraday history, regular hours |
| **alpaca_assets** | assets API | key | `borrow` (shortable, easy to borrow) | **as of now only**: no history; a backtest applies today's flag and says so |
| **alpaca_account** | `GET /v2/account`, `GET /v2/account/activities/FILL` (paper or live base) | the account's own key, read-only | journal fills, key test | at most 50 pages × 100 fills per fetch today |
| **finra** | `cdn.finra.org/equity/regsho/monthly/shrt{date}.txt`, then the OTC biweekly paths | none | `short_interest` (shares short; % from the card's float) | **one file for every symbol**, fetched once per day; twice-monthly settlement |
| **nasdaq_si** | `api.nasdaq.com/api/quote/{t}/short-interest` | none | `short_interest` (fallback, two weeks of history) | per symbol |
| **nasdaq_regsho** | `nasdaqth{yyyymmdd}.txt` | none | `reg_sho` | per settlement day |
| **nyse_regsho** | NYSE threshold-securities download | none | `reg_sho` | per settlement day |
| **edgar** | `data.sec.gov/api/xbrl/companyfacts/CIK{…}.json`; `www.sec.gov/files/company_tickers.json`; submissions (SIC, 8-K items); `efts.sec.gov/LATEST/search-index` | a descriptive User-Agent (`EDGAR_UA`); 403 without it | `oneil_c`, `oneil_a`, `oneil_s` shares, `sic`, 8-K events, `news` (full-text search) | rate-limited; the five EDGAR traps ([ONEIL.md](ONEIL.md) §3.4); filings land weeks after quarter end |
| **sec_13f** | the SEC's quarterly Form 13F datasets (`SUBMISSION.tsv`, holdings) | User-Agent | `oneil_i` | quarterly, 45 days after quarter end; managers over $100M only |
| **polygon** | grouped daily (whole market); aggregates | key | `bars_universe`, bars | the free plan is end of day: no today's bars |
| **finnhub** | `finnhub.io/api/v1/company-news` | key | `news` | — |
| **google_news** | `news.google.com/rss/search` | none | `news` | asked only when the others return fewer than 2 items |
| **openfda** | drug approvals, device 510(k) / PMA | none | N events (planned) | — |
| **usaspending** | contract awards | none | N events (planned) | — |
| **broker_files** | uploaded TradingView, TTP, DXtrade files | — | journal fills | one parser per format, each with a sample file ([JOURNAL.md](JOURNAL.md)) |

---

## 4. Bars: feeds, cache and limits

**One loader shape for every consumer** (chart, strategies, backtests, alerts,
outcomes, the journal): a UTC time-indexed frame of open, high, low, close,
volume.

| Feed | Source | Strength | Weakness |
|---|---|---|---|
| `yahoo` | Yahoo | free, current, years of daily | shallow 1-minute history |
| `yahoo_ext` | Yahoo with pre- and after-market | one source, more hours | — |
| `polygon` | Polygon | deep history, extended hours, consolidated tape | free plan: no today's bars |
| `alpaca` | Alpaca IEX | live | thin IEX volume, short intraday history, regular hours |
| `hybrid` | Polygon history + Alpaca today | deep and today | **volume seam**: IEX volume is a fraction of Polygon's, which distorts every VWAP on the Alpaca part |
| `hybrid_yahoo` | Polygon history + Yahoo today | deep and today, both consolidated | — |

- **The default feed is chosen by hand** and stored as a setting; without a
  choice it is `yahoo`. It used to be inferred from "a Polygon key exists",
  and a key turned out not to mean the plan covered the data: every 1-minute
  request was refused while the platform called Polygon its best feed. No
  route has its own default (Q-N6).
- **Warm-up**: the fetch window is extended so every indicator has enough
  history before the first bar shown. **As of a day** hides every bar after it.
- **The cache** (Parquet, per feed): a ceiling (default 512 MB, trimmed to 70 %
  when over) and a free-disk floor (default 1 GB, trimmed hard below it), swept
  after every write. A full disk once stopped every program on the box.
- **Outcome bars** for R3 are stored once per ticker per day and shared by
  every tool ([REGISTERS.md](REGISTERS.md) §4.4).

---

## 5. Fallback orders

| Family | Order | Rule |
|---|---|---|
| `quote` | TradingView | the batch is refused on misalignment; the last quote stays with its age |
| `short_interest` | FINRA → Yahoo → Nasdaq | stop at the first plausible answer; record `shortSrc`; `basis = outstanding` when no float (understates) |
| `borrow` | Alpaca | `unavailable` never means "not shortable" |
| `reg_sho` | Nasdaq + NYSE | both asked; either listing counts |
| `news` | TradingView, Alpaca, Yahoo, EDGAR, Finnhub in parallel; Google when fewer than 2 items | the failing ones are named; the others still count |
| outcome bars | Yahoo → Alpaca | per ticker |
| chart bars | the chosen feed | never silently replaced |
| index bars (M) | Yahoo | — |
| whole-market bars (RS) | Polygon | — |

A second source for the same fact is **stored beside the first**, with the
priority recorded, never overwriting it (the F-21 lesson).

---

## 6. Health: the data check made permanent

The legacy data check asked each source for data that **cannot** legitimately
be empty and judged the content, when a button was pressed. In the new design
the same checks run **on a schedule** (each adapter at its own cadence, and all
of them before the open) and feed one health page:

| Check | down | degraded |
|---|---|---|
| TradingView scanner: `close > 0`, 50 rows | zero rows; first row has no usable price; fetch failed | — |
| news: every source for a liquid ticker | no stories from any | some sources failed (with the key named) |
| Alpaca key: the account | rejected (401/403) | — |
| bar feeds: 40 daily bars each | fetch failed; no data; under 15 rows; a close NaN or ≤ 0; every volume zero; last bar over 5 sessions old; out of order or duplicated; a one-day move over 25 % | over 5 % of sessions without volume |
| indexes ^GSPC, ^IXIC | as bar feeds; "M cannot be built" | — |
| **cross-source agreement** (the only check that catches a confidently wrong feed) | worst close difference over 0.5 % | under 3 shared sessions; fewer than 2 working feeds ("configure a second feed") |
| RS universe | no sessions; under 1,000 symbols | under 253 sessions |
| research facts | missing a required field | older than their clock allows, counted in trading sessions (M and groups: not from the last completed session; SIC: 14 days). The legacy check used 36 hours by the clock, which reads every weekend as stale |
| EDGAR | ticker map under 5,000; no quarters for a known filer; 403 | — |
| sector map | — | a card sector with no ETF mapping ([MARKET.md](MARKET.md) §4) |

Each failing check carries its **fix**. Checks run **inside the services' own
environment**, so they never report a different set of keys from the one in use
(the first live data check did). A red check sends an alert; amber shows on the
page.

---

## 7. Keys

| Key | Used by |
|---|---|
| Alpaca (data) | `alpaca_data`, `alpaca_assets` |
| each journal account's Alpaca key | `alpaca_account`, per account |
| Polygon | `polygon` |
| Finnhub | `finnhub` |
| EDGAR User-Agent | `edgar`, `sec_13f` |

All in **one secret store** (a file of mode 0600, or a managed store), read by
the services at start. Never in git, a log, a reply to a page or a backup. A
missing key makes its adapter `unavailable` with the reason "key not set", and
the health page names it. The Settings page can set and test keys (the legacy
page had no inputs: D-T4).

---

## 8. What failed

| ID | Fault | Prevented by |
|---|---|---|
| — | the same ticker fetched once per tool | facts fetched once, shared |
| D-S1 | short interest and borrow wiped on a re-quote | facts kept apart from the quote |
| D-S2, F-14 | a missing value read as a number or as bearish | the honest null |
| D-S3 | a column shift misaligning every field | the alignment check (kept) |
| Q-N6 | routes with their own Polygon default | no per-route defaults |
| — | "alpaca ok" printed daily while the key was refused | health judged by content (kept, and scheduled) |
| — | the data check ran only when pressed, and once from the wrong environment | scheduled, inside the services' environment |
| D-T4 | the fix lines point to a Settings section with no inputs | keys set and tested in Settings |
| — | a full disk from an unbounded cache | the cache limits (kept) |

---

## 9. Contracts

### Owns

| Table | Key |
|---|---|
| `source_calls` (counters, last error) | adapter, day |
| `health_checks` | check, instant |
| `bars_cache` (on disk, Parquet) | feed, ticker, timeframe, range |

### Serves

Facts to the card engine, the market engine, the research worker, register
jobs, quant and the journal, through the adapter interface: `fetch(family,
subjects, as_of?)` returning facts with status, source and `known_at`.

### Routes (desk-web)

| Route | Returns |
|---|---|
| `GET /api/health` | every check's latest result, with fixes |
| `POST /api/health/run` | run every check now |
| `GET /api/sources` | adapters, their calls, failures and last errors |
| `GET /api/cache`, `POST /api/cache/{sweep,clear}` | the bar cache |

---

## 10. How the rebuild is proven

1. **Fixtures for every adapter**, including a failure, a timeout and a
   malformed answer, run in CI.
2. **Call count.** On a normal morning, the number of short-interest,
   borrow and news calls falls to one per ticker per family, against one per
   tool today (measured from the logs).
3. **Health parity.** The scheduled checks give the same verdicts as the
   legacy data check on the same morning.
4. **Missing key test.** Remove the Polygon key: its adapter shows
   `unavailable · key not set`, the RS step reports it, nothing crashes.
