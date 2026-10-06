# qp: known issues

Open findings for qp after the 2026-10 review, and the qp findings fixed
during it. Every fix landed with a test that failed first. The documents for
each area are linked from [README.md](README.md).

## Open

| # | Severity | What | Where |
|---|---|---|---|
| Q-N9 | MED (signals) | The alert watcher evaluates with the `close` fill while backtests default to `desk`, so an alert can fire on a different bar from the one a backtest of the same strategy trades; the `live` fill built to make them agree is now used by nothing | `chart/alerts.py` `_default_eval` |
| Q-N4 | LOW | The backtest's CANSLIM gate has no control on the page; it can be set only through the API | `chart/static/index.html` |
| Q-N5 | LOW (ops) | The nightly CANSLIM job runs from a systemd timer installed by hand (hard-coded user and path); a box without it silently goes stale, visible only as stale files in the data check | `quant-platform/deploy/qp-daily.*` |
| Q-N6 | LOW | Several routes default to `feed=polygon` when none is passed (`/api/chart`, `/api/strategy/explain`, the print sheets), not the desk's default feed; the page always passes one | `chart/server.py` |
| Q-N7 | LOW | `risk.breakeven_after_target` is reported on the order plan but the engine never moves the stop, so a strategy using it is backtested without it | `chart/exit_protocol.py`, `chart/strategy.py` |
| Q-N1 | LOW (text) | `chart/README.md` describes rising/falling as a least-squares slope with `min_strength`; the engine uses the v3 rule (direction, `min_pct`, 75 % consistency) and ignores `min_strength` | `quant-platform/chart/README.md` |
| Q-N2 | LOW (text) | `chart/README.md` names primitives that do not exist (`candle.body_pct`, `upper_wick_pct`, `lower_wick_pct`: composed with `expr` now) and a single `SCREENER_URL` (qp reads every tool from the registry) | `quant-platform/chart/README.md` |
| Q-N8 | LOW (text) | `quant-platform/README.md` says the compare tool offers three feeds and that Polygon becomes the default when its key exists; it offers six, and the default is chosen by hand (yahoo when unset) | `quant-platform/README.md` |
| Q-N3 | LOW (text) | The strategy Stage help says Ready means "trusted to place real orders from"; the desk no longer places orders | `chart/static/index.html` |
| Q-N10 | LOW (text) | `qp-restart.sh` says, when qp is down, that "the manager cannot evaluate exit rules or move trailing stops without it": the order manager no longer exists | `deploy/qp-restart.sh` |
| F-31/32 | LOW | The Pine ports differ from qp on runner scope and an unfrozen stop | `pine/` |

## Fixed in the 2026-10 review

| # | What was wrong | Test |
|---|---|---|
| Q-P | A qp restart could take minutes (2026-10-06: 3 min 20 s, three failed starts in pm2's count). Its start-up check refused the port while connections the old qp had accepted still lingered, reading a finished restart as another server. The check now refuses only a listening server | `logic_audit79.py` |
| L2-1 | With a screener down, qp's date list came back empty without saying why; it now names the source that did not answer, in the API, both pickers and the no-days messages | `logic_audit112.py` |
| F-20 | `monday_high/low` and pre-market `day_open` saw the future in a backtest | `logic_audit105.py` |
| F-23 | Yahoo daily reach was capped at a year (measured: 5 years), so CANSLIM N/S failed on yahoo | `logic_audit106.py` |
| F-26 | The backtest's CANSLIM gate read the entry day's own close | `logic_audit107.py` |
| F-27 | An unreadable market model blocked pairs, and the failure was cached | `logic_audit108.py` |
| F-28 | As-of earnings dropped a quarter once it was re-reported a year later | `logic_audit109.py` |
| F-22 | The chart's signal watcher was fixed to polygon (a day behind) | `logic_audit110.py` |
| F-25 | `rank_sweep --backtest` found no stop on stored trades | `test_rank_sweep.py` |
| Q-11 | Saving a strategy dropped "fix at entry", turning a fixed stop into a trailing one | `ui_runtime.js` |
| Q-R | Not a fault: qp's error log (read 2026-10-02) shows only clean shutdown/start pairs, one per deploy, and no tracebacks — pm2 counts the restarts a deploy asks for. Two "Invalid HTTP request" lines are internet scanners on port 8765 (S-1, now closed by the login) | — |
