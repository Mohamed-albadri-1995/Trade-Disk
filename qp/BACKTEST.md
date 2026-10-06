# Backtests

How qp replays a strategy over many days on the stocks the screener tools
actually found, the honesty rules it keeps, every setting of a run, the
accounting it can apply, and what it reports. Written from
`quant-platform/chart/backtest.py`, `report.py`, `rank_sweep.py`, `store.py`
and the Backtest section of `chart/static/index.html`.

Related: the strategy grammar and fill models ([STRATEGIES.md](STRATEGIES.md)),
the bar feeds ([DATA-FEEDS.md](DATA-FEEDS.md)), the CANSLIM letters as of a
day ([CANSLIM.md](CANSLIM.md)).

---

## What a run does

For every trading day in the range, and every symbol in that day's
universe, it calls **the same `strategy.evaluate()` the chart preview uses**,
as of that day. There is no separate backtest evaluator, so the preview and
the backtest cannot disagree.

- **One run at a time** (the box is small). A second start while one runs is
  refused with the number of the running one. A run can be stopped; it stops
  at its next symbol. Closing the page does not stop a run: reopening it picks
  the run up again. If qp itself restarts, the run is marked interrupted.
- Sequential: one (day, symbol) pair at a time, progress reported as the share
  of pairs done.
- **Every run stores a frozen copy of the strategies it ran**, so editing a
  strategy later never changes what an old result means.

---

## The universe

| `universe.kind` | Each day evaluates |
|---|---|
| `symbols` | the same fixed list every day |
| `register` | one register (R1 or Shortlist) **as that tool froze it that day** |
| `tools` | the registers of every tool assigned to the strategy (or named in the spec), unioned; with two books (a long and a short strategy) their tools are unioned too |

`extra_symbols` adds names to a register universe; their trades are marked
`_extra`, so "not on the register" stays visible.

---

## Honesty rules (all on by default)

| Rule | What it prevents |
|---|---|
| **As of the day.** Each (day, symbol) is evaluated with `asof` = that day; only trades **entered on that day** count. Warm-up days are context, never trades | look-ahead; double-counting warm-up signals |
| **The watchlist gate** (`scan_gate`): a trade the strategy took **before the scanner had found the stock** is dropped. `scan_gate: false` shows the old numbers on purpose. No effect on a `symbols` universe | trades no alert could have fired |
| **The desk fill** (`fill: desk`): next bar's open, levels from the decision close ([STRATEGIES.md](STRATEGIES.md)) | the optimistic `close` fill (the old default) |
| **Costs:** `cost_bps` per side (spread + slippage + commission; a round trip pays twice), and per-share fees with a per-order minimum | "a backtest without costs lies" |
| **Open at the end:** a position still open when its window ends is recorded as `open` with its unrealised return, **never mixed into the win rate** | flattering win rates |
| **Coverage, stated:** pairs evaluated, pairs whose feed returned no bars, pairs per scanning tool, how many each filter removed | a thin feed or one dominant tool passing for a strategy that rarely fires |

---

## The settings of a run

### What to test

| Spec | Meaning | Default |
|---|---|---|
| `strategy_id` / `strategy` / `strategies` | one strategy, or two books (long and short) | — |
| `universe` | above | register R1 |
| `start`, `end` | the date range | — |
| `tf` | bar timeframe (1m, 2m, 5m, 15m, 30m, 1h, 1d) | 5m |
| `feed` | bar feed ([DATA-FEEDS.md](DATA-FEEDS.md)) | polygon |
| `view` | `all` (extended hours) or `regular` | all |
| `fill` | `desk`, `next_open`, `close` | **desk** |
| `days` | warm-up sessions before each day (auto-extended) | 3 |
| `rules` | session rules: regular-hours entries, end-of-day close, entries per day | none |

### Filters and caps (opt-in)

| Spec | Does |
|---|---|
| `min_rvol` | In-Play filter: a pair is evaluated only if its relative volume, **measured by qp at the strategy's window start**, is above this (not the register's one-bar snapshot); below and unverifiable are counted apart |
| `canslim` | a gate on the CANSLIM letters **as known on that day** (`chart/canslim.py`); a rule naming a letter that cannot be rebuilt for a past day is refused before the run starts; blocked and unverifiable pairs are counted. **API only: the page has no control for it** (Q-N4) |
| `check_shortable` | drops shorts the broker would not lend (Alpaca). Alpaca keeps no borrow history, so **today's** flag is applied to a past day, and the report says so; a name it cannot answer for is kept and named |
| `rank_per_day` + metric | keep the best N signals a day. Metrics: `vwap_extension` (distance from decision price to stop, largest first: right only for a VWAP-anchored stop, the T2 setup), `tight_stop` (the same, smallest first), `reg_score` (the register's score), `rvol` (qp's RVOL at the window start). **No default: an unnamed or unknown metric is an error**, because the wrong one silently reshapes the strategy (backtest #231 lost 103 of 117 signals to it) |
| desk caps | **one entry per stock per day**, and a whole-run trades-per-day cap, applied in the order signals fired |

`chart/rank_sweep.py` runs the same selection over a finished run's trades
with every metric, to measure which one suits a strategy.

### Money: choose one accounting

| Block | Inputs | Answers |
|---|---|---|
| **unit** | none | per-trade % returns |
| **account** | `account_equity` (default 100,000 on the page), `risk_pct` (0.5) **or** `risk_usd` (not both), `max_position_pct`, `max_leverage` (1 = cash), `size_ratio` (this account's share of the standard size), `max_order_value`, `min_shares` | real money: shares from the stop so every stop-out loses the same %; equity **compounds** in trade order; trades with no usable stop are **excluded and counted**, never sized at 1 share; trades the buying power could not take are skipped and counted |
| **TTP** (prop firm, Trade The Pool defaults) | `fee_per_share`, `fee_min` per order, `shares` (fixed size, default 100), `min_profit_ps` | dollar P&L for a fixed size; the **min-profit rule**: a winner under `min_profit_ps` $/share does not count towards the target (losses always count), tested on the position's average across all its fills; every fill pays its own order fee |
| **challenge** (on top of an account run) | `challenge: {target_pct, max_dd_pct, basis: start \| peak}` | did the account reach the target **before** it ever touched the drawdown limit? Also walks a worst case in which every open position stops out at once, because a closed-trade curve cannot see a position that dipped and came back |

---

## What a run reports

| Route | Gives |
|---|---|
| `GET /api/backtest/{id}` | status, progress, summary, trades |
| `GET /api/backtests` | every run, newest first (`brief=1` for headlines only) |
| `GET /api/backtest/{id}/report` | a self-contained, phone-readable HTML report |
| `GET /api/backtest/{id}/stats.json` | every number in the report |
| `GET /api/backtest/{id}/csv` | every trade, with every register column of its card |
| `GET /api/backtest/{id}/journal.csv` | one row per trade for a spreadsheet or the journal |
| `POST /api/backtest/{id}/stop`, `DELETE /api/backtest/{id}` | stop, delete |

On the page, each trade in the list opens that symbol and day on the chart
with the run's own timeframe, feed, fill model and strategy. A filter
(`=`, `≠`, `>`, `<`, `in`, `has`; times as `hhmm`, `dur_min`, `dow`)
narrows the trades and the filtered CSV.

### The report (`report.py`)

Computed afterwards from the stored trades, so it can be re-run on any past
backtest. It says whether every number is in **dollars** (an account run) or
**unit %**.

| Section | Numbers |
|---|---|
| headline | trades, wins, losses, breakeven (exactly 0 is not a win), win rate, gross profit and loss, net profit, **profit factor** (none with no losing trade, never ∞), expectancy, average win and loss, payoff ratio, largest win and loss |
| R-multiples | total, average, best, worst, and the distribution in buckets. **R reads from net**, the same money as net profit; the gross total is shown beside it |
| holding time | average, longest, shortest, winners vs losers, total time in positions |
| splits | by side, by exit reason, by symbol, by day |
| equity and risk | the curve marked at **exit**, maximum drawdown in $ and %, its length, streaks |
| ratios | Sharpe, Sortino, Calmar from daily returns over **every session in the range** (flat days included), annualised and flagged as extrapolation on short samples |
| exposure | share of regular-hours minutes in a position |
| sample adequacy | each warning as a fact and its reason |
| the borrow check | states when "check shortable" was ticked but nothing was answered (backtest #355) |
| prop-firm detail | counted vs wasted profit under the min-profit rule |

---

## Found in this review

| # | What |
|---|---|
| Q-N4 | The CANSLIM gate exists in the engine but has no control on the page; it can only be set through the API |
