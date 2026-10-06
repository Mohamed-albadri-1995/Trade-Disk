# Choices made on the trader's word — and how to undo each

Kept because the trader asked (2026-09-28): *"remember them, maybe I will ask
you to reverse them again."* Each entry says what was chosen, why, where it
lives, and the one change that reverses it.

## Set by the trader in qp (not in code)

| Choice | Where | To reverse |
|---|---|---|
| **Test: minimum stop distance 0.3 %** — refuses a trade whose stop is closer than 0.3 % of the price (XNCR 2026-09-28: a 0.1 % stop, capped at the whole account, lost $1,886 against $500 of risk). | qp → Strategy **Test** → *Min stop %* = `0.3` → Save | clear the *Min stop %* box and save |

## In code

| Date | Choice | Where | To reverse |
|---|---|---|---|
| 09-28 | **No invented 2R target.** A strategy with no target and no exit rule rides its stop to the 15:50 close. | `chart/exit_protocol.py` (the `runner_fraction = 1.0` block) | delete the `runner_fraction = 1.0` block; in the target-less leg set `'tp_kind': 'rule' if has_exit_rules else 'default_r'` (with `has_exit_rules = bool(((s.get('exit') or {}).get('rules')) or [])`); in `validate`, warn `no target in the strategy — the screener supplies 2R` for a `default_r` leg |
| 09-28 | **A target on an indicator line is not placeable** — no broker can hold a line. RubberBand (L/S), Second Chance, Back$ide carry an order error. | `chart/exit_protocol.py` `validate` (`anchored_tp` → `order_errors`) | move that message back to `warnings` |
| 09-28 | **A stop is always a price**, never a percent/distance stop (the engine never trails a pct stop). | `chart/exit_protocol.py` `exit_plan` (`_trail_of`) | none sensible — it would be a stop the backtest never had |
| 09-28 | **The backtest fills at the broker's cents** (stop rounded towards the entry, targets to the nearest cent). | `chart/strategy.py` `broker_stop` / `broker_target` | — (no broker takes sub-penny prices) |
| 09-28 | **A breach of a line-anchored stop fills at the bar's close** in the backtest, not at the line. | `chart/strategy.py` `line_touch` | fill at `slv` instead of `close[j]` |
| 09-28 | **One order function.** Share count, position cap, ratio, per-order cap, money left, minimum shares (3), whole-share legs, the stop and targets in cents, and the broker's refusals are all `plan_order`; the backtest books its orders per trade. | `quant-platform/chart/order_plan.py` | — |
| 09-28 | **The backtest sizes on the configured account size** (`size_basis: 'fixed'`): risk % and the position cap read the account size, not a running balance; money = account size × ratio. | `chart/backtest.py` `size_basis` | send `size_basis: 'equity'` in the backtest spec to compound again |
| 09-28 | **Minimum shares (3)** — under it nothing is booked. | `chart/order_plan.py` `MIN_SHARES`; per run `min_shares` | set `min_shares` to 1 |
| 09-28 | **next_open / desk: the fill minute comes from the clock**, not from the next bar in the data (EFX had no 09:34 bar; the backtest took a 09:33 decision as a 09:35 fill). | `chart/strategy.py` (`live_fill or next_open`) | — (it was a bug) |
| 09-29 | **The day's trade cap counts only trades that were sized** — a trade refused for money or minimum shares uses no slot. | `chart/backtest.py` `_cap_after_sizing` | call `desk_caps` with the cap again |
| 10-01 | **A strategy's shape has a size.** Under the size that gives every priced leg a share, the plan is refused (`shape`) rather than silently dropping a leg (Test needs 10 shares). | `chart/order_plan.py` `shape_min_shares` | delete the `shape` refusal in `_fit` |
| 10-02 | **T8's shared ★ CANSLIM list is retired** — its writer, the badge, `/screeners/canslim`, `/api/canslim` and the `canslim` register column. The O'Neil letters on every card replace it; T8 stays archived. | removed files: `src/sideA/canslim.js`, `src/routes/canslim.js`, `public/canslim.html` | restore those three from the commit before "One login for every program; retire T8's CANSLIM list", re-add the `canslim` stage in `src/pipeline.js`, and start T8 |
| 10-02 | **One password for every program.** | `src/auth/`, `chart/auth.py`; mounted in `src/index.js`, `src/archive/server.js`, `journal/server.js`, `chart/server.py` | remove the four mount lines (not recommended: the ports are public) |
| 10-02 | **T1 keeps its name** "Swing trades after huge volume" although it seeds Big Move / Pre-Mkt / Trend (D-S6: "it's ok like this"). | `tools.config.json` | rename from Manage tools |
