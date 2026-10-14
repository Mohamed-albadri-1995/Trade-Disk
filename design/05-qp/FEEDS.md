# QP Price Feeds and Data Quality

Parent: [QP](QP.md). Front-end: [FRONTEND-DESIGN](FRONTEND-DESIGN.md). Canonical behavior: [legacy feeds](../../legacy/qp/DATA-FEEDS.md).

## Feed selector

Expose only feed IDs returned by the service. Legacy options include yahoo, yahoo_ext, polygon, alpaca, hybrid and hybrid_yahoo; capabilities, history depth and live support vary by provider and plan. A credential existing does not prove the plan supports the requested interval.

Show the selected/default feed in chart status and backtest configuration. Feed choice is explicit and saved with the run.

## Data health

Show source, last bar timestamp, timezone, session coverage, live/history capability, stale status and error reason. Distinguish request failure, no bars, unsupported symbol, insufficient history, interval unavailable on plan, extended-hours unavailable, warm-up incomplete and successful data.

Backtest coverage summarizes day-symbol pairs with bars, empty responses, errors, missing register captures, insufficient warm-up and excluded pairs. Feed failure is not the same as a strategy condition that did not trigger.

## Historical correctness

Automatically request required warm-up. Warm-up bars are context, not eligible trade dates. Historical views hide bars after cutoff and do not use later-known values. Higher-timeframe operands use only the last completed higher-timeframe bar.

## Acceptance

- [ ] Feed capability is not guessed from credentials.
- [ ] Chart and run show the feed used.
- [ ] Warm-up and gaps are visible.
- [ ] Historical cutoff prevents future bars/facts.
