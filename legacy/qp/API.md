# qp API

Every route qp answers on `:8765`: 53 HTTP routes and one WebSocket, from
`quant-platform/chart/server.py`. Every route needs the desk's `td_auth`
cookie, except calls from the box itself.

Parameters are query strings unless marked *body* (JSON). Dates are
`YYYY-MM-DD`; `register` is `R1` or `Shortlist`, optionally with a tool
(`s3:R1`) or all tools merged (`*:R1`).

---

## Page and platform

| Method | Path | Parameters | Answer |
|---|---|---|---|
| GET | `/` | — | the page (never cached) |
| GET | `/api/health` | — | build, primitives, feeds with credentials, default feed |
| GET | `/api/tools` | — | the desk's programs, for the app bar |
| POST | `/api/settings/default-feed` | *body* `{feed}` | sets the default feed ([DATA-FEEDS.md](DATA-FEEDS.md)) |
| GET | `/api/primitives` | — | every primitive with its parameters, outputs and approval ([LIBRARY.md](LIBRARY.md)) |
| GET | `/api/oplog` | `limit` (200), `op`, `day`, `summary` | the operations log, newest first |

## Chart

| Method | Path | Parameters | Answer |
|---|---|---|---|
| GET | `/api/chart` | `symbol` (SPY), `tf` (5m), `days` (5), `feed` (polygon), `view` (all \| regular), `overlays` (JSON list of indicators), `asof` | candles and every indicator series |
| WS | `/ws/live` | the client sends its chart request once | the newest bar and each indicator's newest value, on an interval |

## Screener registers

| Method | Path | Parameters | Answer |
|---|---|---|---|
| GET | `/api/screener/health` | — | registers, options, whether the tools answer |
| GET | `/api/screener/sources` | `reload` | every configured tool and whether it is up, plus the picker options |
| GET | `/api/screener/dates` | `register` | the days that register holds; names any tool that did not answer |
| GET | `/api/screener/register` | `register`, `date` (latest) | compact cards for that day |

## Strategies

| Method | Path | Parameters | Answer |
|---|---|---|---|
| GET | `/api/strategies` | — | every saved strategy |
| POST | `/api/strategies` | *body* a strategy | create or update |
| GET | `/api/strategies/{sid}` | — | the exact stored JSON, with its derived exit protocol |
| POST | `/api/strategies/{sid}/tools` | *body* `{tools}` | assign tools only, without rewriting the strategy |
| DELETE | `/api/strategies/{sid}` | — | delete |
| POST | `/api/strategy/evaluate` | *body* `{strategy, symbol, tf, days, feed, view, asof, fill, rules}` | trades, markers, stop and target lines, entry/exit true now, preview stats |
| POST | `/api/strategy/test` | *body* `{node, symbol, tf, …}` | every bar where one rule or group holds |
| GET | `/api/strategy/explain` | `name`, `symbol`, `day`, `tf` (1m), `feed` (polygon) | the signal funnel: each entry step's true-bar count |
| GET | `/api/strategy/explain_scan` | `name`, `day`, `tf`, `feed`, `register` | the funnel over a whole register day, closest first |

## Backtests

| Method | Path | Parameters | Answer |
|---|---|---|---|
| POST | `/api/backtest` | *body* the run spec ([BACKTEST.md](BACKTEST.md)) | `{ok, id}` at once; refused while another runs |
| GET | `/api/backtest/{bid}` | `trades` (1) | status, progress, summary, trades |
| GET | `/api/backtests` | `brief` | every run, newest first |
| POST | `/api/backtest/{bid}/stop` | — | stop at the next symbol; a row nothing is running is marked interrupted |
| GET | `/api/backtest/{bid}/report` | — | the HTML report |
| GET | `/api/backtest/{bid}/stats.json` | — | every statistic |
| GET | `/api/backtest/{bid}/csv` | — | every trade with its register card flattened as `ctx_*` columns |
| GET | `/api/backtest/{bid}/journal.csv` | — | one row per trade |
| DELETE | `/api/backtest/{bid}` | — | delete the run and its trades |

## Alerts

| Method | Path | Parameters | Answer |
|---|---|---|---|
| POST | `/api/alerts/start` | `interval` (s) | start the watcher ([ALERTS-AND-PRINTS.md](ALERTS-AND-PRINTS.md)) |
| POST | `/api/alerts/stop` | — | stop |
| GET | `/api/alerts/status` | — | state, what it watches, errors |
| GET | `/api/alerts/recent` | `since_ts` | alerts newer than a time |

## Print sheets and exports

| Method | Path | Parameters | Answer |
|---|---|---|---|
| GET | `/api/r1/print` | `start`, `end` or `day`, `tf` (1m), `feed`, `overlays`, `register`, `days_before` (1), `days_after` (0), `cols` | HTML: one chart per ticker per day (150 at most) |
| GET | `/api/r1/swing` | as above, `tf` (1d), `lookback` (252) | HTML: the swing sheet |
| GET | `/api/r1/swing.csv` | as `/swing` | CSV, with `phase` and `pct_from_found` |
| GET | `/api/r1/csv` | as `/print` | CSV: one row per bar, a column per indicator |
| GET | `/api/r1/cards.csv` | `start`, `end` or `day`, `register` | CSV: every frozen card column |
| POST | `/api/pairs/parse` | *body* `{pairs}` | how a pasted list will be read |
| GET | `/api/pairs/print` | `pairs`, `tf` (5m), `feed`, `overlays`, `register`, `days_before` (1), `days_after` (1), `cols`, `height`, `trades` | HTML for a list of `symbol, date` pairs |
| GET | `/api/pairs/csv` | as `/pairs/print` | CSV |

## O'Neil / CANSLIM

Read by the screener tools' Market tab and cards ([CANSLIM.md](CANSLIM.md)).

| Method | Path | Parameters | Answer |
|---|---|---|---|
| GET | `/api/oneil/market` | `refresh`, `days` (500), `feed` (yahoo) | the market model (M) |
| GET | `/api/oneil/groups` | `refresh` | group ranks and rank-in-group (L) |
| GET | `/api/oneil/fundamentals` | `symbols`, `refresh`, `cached_only` | the C and A tables from EDGAR |
| GET | `/api/oneil/13f` | `refresh` | institutional holders and their direction (I) |
| GET | `/api/oneil/base` | `symbols`, `feed` (yahoo) | the base on a weekly chart |
| GET | `/api/oneil/ratings` | `symbols`, `feed`, `index` (^GSPC) | up/down volume, accumulation/distribution, RS line, divergence |
| GET | `/api/oneil/stock` | `symbols`, `feed` | what each stock did on the live distribution days |

## Data checks and the cache

| Method | Path | Parameters | Answer |
|---|---|---|---|
| GET | `/api/datacheck` | `symbol` (SPY) | every source judged ([DATACHECK.md](../screeners/DATACHECK.md)) |
| GET | `/api/feedcheck` | `symbol` | which feeds actually returned data |
| GET | `/api/cache` | — | bar cache size and free disk |
| POST | `/api/cache/clear` | *body* `{older_than_days?}` | delete cached bars |
| POST | `/api/cache/sweep` | — | trim to the limit now |
