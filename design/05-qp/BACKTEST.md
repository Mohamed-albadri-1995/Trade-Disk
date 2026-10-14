# Backtest Lab

Parent: [QP](QP.md). Front-end: [FRONTEND-DESIGN](FRONTEND-DESIGN.md) and [Register](REGISTER.md). Canonical behavior: [legacy backtest](../../legacy/qp/BACKTEST.md).

## Position

Backtest is a first-class workspace in the QP tool strip and is also reachable from Strategy through Run Backtest. It is not a small results card hidden in a strategy form.

## Configuration

1. **Strategy:** saved strategy and immutable version; display side, intended tools and validation state.
2. **Universe:** fixed symbols, one tool's historical register, or an explicitly selected union of tools.
3. **Register:** tool ID, register type, date range, historical membership semantics, extra symbols and missing dates.
4. **Market data:** timeframe, feed, session, New York calendar, warm-up and as-of behavior.
5. **Fill and costs:** supported fill model, spread/slippage/commission and supported per-share fees/minimums.
6. **Capital and sizing:** starting equity, accounting method, sizing, risk and supported daily caps.
7. **Filters:** only engine-supported filters. Flag when a value is not historically available.
8. **Validation and run:** Validate, Run, Stop at next symbol, progress, resume/reopen and failure reason.

For a T1-only run from 2025-01-01 through 2026-01-01, each day uses T1's own frozen register for that day. Do not use today's T1 list for the whole year and do not silently include T2. Show effective universe and missing-register dates before run.

## Results

Tabs: Overview; Equity and Drawdown; Trades; By Symbol; By Setup; Universe; Coverage and Diagnostics; Configuration; Compare; Export. Metrics come from the service, never fabricated frontend calculations. Open a trade to jump to exact entry/exit bars and inspect fill prices, costs, stop/target path, exit reason and qualifying register membership.

Each run stores exact strategy version, config, universe, feed choices, costs, status, coverage and results. Open positions stay separate from closed-trade win-rate calculations. Missing bars, missing captures, excluded pairs and warm-up are reported. Compare runs with changed assumptions highlighted. Exports include assumptions, not only metrics.

## Run states

Draft, Validating, Ready, Running, Completed, Completed with gaps, Failed, Stopped and Interrupted. A second run while one is active must show the running ID and follow the backend contract; never silently run parallel jobs.

## Acceptance

- [ ] T1-only yearly run uses T1 daily historical membership.
- [ ] Tool/register and effective universe are explicit.
- [ ] Version and settings are frozen per run.
- [ ] Stop/recovery status is visible.
- [ ] Open trades are separate from closed stats.
- [ ] Data coverage and exclusions are visible.
- [ ] Chart inspection matches stored trade timestamps/fills.
