# qp scripts and tools

Every helper script that works on qp: what question it answers or what job
it does. Run from `quant-platform/` (with `set -a && . ./.env && set +a`
when it needs keys) unless the path starts at the repo root. Each file's
header has its full usage.

---

## Run and keys

| Script | Does |
|---|---|
| `deploy/qp-restart.sh` (repo root) | makes the running qp the one in this checkout, through pm2 only ([OPERATIONS.md](OPERATIONS.md)) |
| `deploy/qp.config.js` (repo root) | qp's pm2 settings |
| `scripts/sync-qp-env.js` (repo root) | copies the desk's Alpaca pair from `data/keys.json` into `quant-platform/.env`, on every deploy |

## The nightly chain and its parts

| Script | Does |
|---|---|
| `deploy/run_daily.py` | the nightly CANSLIM chain (timer `qp-daily`) |
| `deploy/run_backfill.py` | one-shot backfills |
| `deploy/run_edgar.py` | the first full EDGAR pass for the C and A tables |
| `deploy/run_13f.py` | builds I (institutional holders) on its own |
| `deploy/run_sic.py` | classifies the market into SIC industries and ranks the groups |
| `deploy/run_status.py` | what the CANSLIM chain has, and what it is missing |
| `deploy/run_fields.py AAPL NVDA` | every CANSLIM field for real tickers, with the reason for each blank |

## The library

| Script | Does |
|---|---|
| `tools/compare_server.py --port 8767` | the verification page: qp's value beside TradingView's, and the Approve button ([LIBRARY.md](LIBRARY.md)) |
| `tools/gen_catalog.py` | regenerates `docs/CATALOG.md` from the registry |

## Strategies

| Script | Does |
|---|---|
| `tools/check_strategies.py` | is every strategy written the standard way (a list where a list belongs, an anchored stop written once …) |
| `tools/explain_strategy.py` | a strategy in words: entry, stop, target, every scale-out leg |
| `tools/seed_from_db.py` | turns a strategy built in the browser into a bundled seed in git (the only copy in the repository) |
| `tools/recover_strategies.py` | finds strategies no longer in the database: in backtest snapshots, or in SQLite's free pages |

## Backtests

| Script | Question |
|---|---|
| `tools/audit_0935.py` | what did the 09:35 backtests actually do |
| `chart/rank_sweep.py` | which ranking metric suits a strategy, measured ([BACKTEST.md](BACKTEST.md)) |
| `scripts/exec-compare.js` (repo root) | which execution setting is best on your days, measured |
| `scripts/fill-compare.js` (repo root) | which strategies work, and how much of the answer was the fill assumption |
| `scripts/check-feeds.js` (repo root) | which feeds can serve a session, and which of them live |
| `chart/exports/or_vwap_0935.py` | a standalone, dependency-light reference implementation of the OR + VWAP 09:35 setup |

## Bar loaders (`tools/data/`)

`alpaca.py`, `polygon.py`, `yahoo.py`, `yahoo_ext.py`, `hybrid.py`,
`hybrid_yahoo.py` (one contract: `load(symbol, timeframe, start, end)` →
UTC OHLCV frame), `cache.py` (the cache and its limits), `borrow.py` (the
short-borrow check). See [DATA-FEEDS.md](DATA-FEEDS.md).

## Tests

`chart/tests/` holds qp's regression suite: 95 `logic_audit*.py` files, each
reproducing one past failure, plus focused `test_*.py` files (challenge,
feeds, position cap, minimum target, rank sweep, setup tools, trade marks,
whole shares). `python3 chart/tests/run_all.py` runs them. Every fix in
[KNOWN-ISSUES.md](KNOWN-ISSUES.md) names its test.
