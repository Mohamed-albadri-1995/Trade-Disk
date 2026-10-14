# Signal Alerts

Parent: [QP](QP.md). Front-end: [FRONTEND-DESIGN](FRONTEND-DESIGN.md). Canonical behavior: [legacy alerts](../../legacy/qp/ALERTS-AND-PRINTS.md) and [desk alerts](../11-alerts/ALERTS.md).

## Alerts workspace

Show strategy/version, tool/register scope, symbol, signal bar/time in New York time, status, last cycle, notification state, recent history and errors. Filters cover active/paused, tool, strategy, symbol and date. Selecting a signal opens the chart at its bar and reveals the conditions that fired.

Actions: enable/pause, inspect and view history. No order placement.

## Rules

- The desk scheduler starts cycles; the browser does not create its own timer.
- The service returns new signals; UI handles display and notification permission state.
- Deduplication follows backend policy, by strategy, symbol and signal bar.
- A failing symbol/strategy does not hide successful results.
- Preview, backtest and alerts share canonical evaluation and fill semantics.
- Historical alert detail keeps strategy version, symbol, bar/time, condition result and evaluation status.

## States and acceptance

Active, Paused, Waiting for cycle, Cycle running, No new signals, Completed with errors, Failed, Notification permission denied and Scheduler unavailable are distinct.

- [ ] History persists across refresh.
- [ ] Duplicate signals are not shown as new.
- [ ] One failing symbol does not hide other results.
- [ ] Alert chart opens at the correct context.
- [ ] UI reports scheduler health without running a separate timer.
