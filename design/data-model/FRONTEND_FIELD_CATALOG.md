# Frontend Field Catalog and Ownership

This catalog names the major fields implied by the current prototype and approved specs. Exact UI copy may change, but ownership and semantics should remain stable.

## Screener result card

| Field key | Display / meaning | Canonical owner | Read projection |
|---|---|---|---|
| `symbol`, `company_name`, `exchange` | Identity/header | `stock`, `stock_symbol` | `stock_card_snapshot` |
| `last_price`, `change_abs`, `change_pct` | Current quote and change | Quote observations / chosen quote snapshot | `stock_card_snapshot` |
| `chart_preview` | Compact sparkline | OHLCV series | `stock_card_snapshot` |
| `model_score` | Only if/when an approved score output exists | Future score module; no formula implied here | `stock_card_snapshot` + `screener_run_result` |
| `tags[]` | Setup/event/status tags | Respective modules; each tag needs a type/source | `stock_card_snapshot` |
| `relative_volume`, `adr_pct`, `pm_adr` | Liquidity/volatility snapshots | Technical/liquidity enrichers | `stock_card_snapshot` |
| `sector_name`, `sector_etf`, `stock_sector_bias` | Selected stock's mapped sector context | Sector membership + market sector snapshot | `stock_card_snapshot.stock_market_context_snapshot_id` |
| `ema_status`, `vwap_status` | Summary status only | Technical indicator snapshot | `stock_card_snapshot` |
| `favorite_state` | User's saved status | User-stock-list relation | Joined per user; never global |

## Overview

| UI section | Fields to serve | Owner/read contract |
|---|---|---|
| Header | ticker, name, exchange, price, change, approved score output if available, sector | `stock_card_snapshot` |
| Chart | lightweight preview series + timeframe/as-of | `stock_card_snapshot`; full bars on Technical |
| Volume & Float | current/average volume, RVOL, float, market cap, short float, days-to-cover | stock card snapshot; source facts remain separate |
| Range | 52-week low/high/position, range status | stock card snapshot; same range basis as Technical |
| Recent News | headline, publisher, published-at, verification state, article ID | news preview projection |
| CAN SLIM summary | C/A/N/S/L/I/M statuses, model version, missing-data flags | published CAN SLIM snapshot |
| Themes | theme keys/labels | stock-theme membership |
| Market Context | market regime/horizons, index summary, **selected stock's own sector name/ETF/bias/score**, stock-specific group reference if approved | stock-market-context projection linked to broad-market snapshot |
| Price | last/previous close/open/day high/day low/VWAP/5-day average when shown | stock card snapshot; detailed values on Technical |
| EMA | EMA 9/13/20/50 values if shown | stock card snapshot; full MA matrix on Technical |
| ATR & Move | ATR(14), ATR%, move/ATR, day range | stock card snapshot; full volatility detail on Technical |
| Pre-market | PM high/low/range/range%, PM/ADR | stock card snapshot; full details on Technical |

No Score Breakdown fields should be exposed in Overview. Do not infer an undocumented scoring formula from card scores.

## Technical tab

- Chart: stock ID, timeframe, session basis, adjustment basis, bars/series reference, legend, source status and as-of.
- Price/session: last price, previous close/PDC, open, high, low, VWAP, SMA5, gap values and calculation basis.
- Moving averages: type (SMA/EMA/WMA/VWMA), length, timeframe, source field, value, as-of, above/below/crossover status.
- Momentum: RSI(length), MACD(fast/slow/signal), histogram, stochastic(K/D/smoothing), ROC; every reading keyed by complete parameters + timeframe.
- Volume: session volume, average volume/lookback, RVOL, up/down ratio, OBV/accumulation-distribution if available.
- Volatility/range: ATR(length), ATR%, ADR(length), move/ATR, day/week/month/quarter/year/52-week/all-time range metrics.
- Extended hours: PMH/PML/range/range%, PM/ADR; session basis explicit.
- Structure: support/resistance/pivots/patterns/breakout confirmation/invalidation and multi-timeframe state.
- Data quality: source status, as-of, published-at, adjustment/session basis, calculation version and missing reason.

## Fundamentals & News tab

- Period financials: metric key, fiscal period, period end, reported date, numeric value, currency/unit, estimated/reported status and source.
- Valuation: ratio key, numeric value, basis, period/as-of, currency and source.
- Balance sheet/cash flow/profitability: raw facts and period context, not CAN SLIM factor grades.
- News: article ID, headline, publisher, URL, published-at, category, ticker relevance, verification status and why-it-matters annotation.
- Events: company/macro event ID, type, start/end, timezone, status and verification.
- Company exposure: stock-specific sensitivity/context, not the broad market dashboard tables.

## Market tab (one shared market snapshot)

- Indexes: SPY, QQQ, DIA, IWM, VIX; last/close value, daily %, weekly %, period labels and source status.
- Short-term model: label, score, confidence and six signal contribution rows.
- Mid-term model: stage label and all documented checks/evidence.
- Long-term model: label, 200-day MA comparison, golden-cross evidence, distance and reference instrument.
- Final regime: regime key/label, directional bias, confidence, rationale, model version.
- Sector rows: sector/ETF, daily %, week %, RS day, RS week, bias, score, ADX, status, source/as-of.
- Industry-group rows: rank, group, percentile/grade, member count, median RS, share RS>80, 3-month field, leaders and taxonomy version.
- Breadth/volatility/themes: advance/decline/unchanged counts, distribution days/window, VIX and theme watch.

## Screener definition and filter model

- Definition: `screener_id`, stable key (`T1`, `T2`, etc.), display name, owner, built-in/custom, definition version, enabled state.
- Filter tree: nested groups with `AND`/`OR`; condition stores filter key, operator, typed left/right operands, and optional distance percent.
- Indicator parameters: type, length/lookback, timeframe, source, session basis, smoothing/multiplier/period parameters where applicable.
- Field-vs-field examples: `close > SMA(50, 1D)`; `EMA(20, 1D) crosses_above EMA(50, 1D)`.
- Field-vs-value examples: `RSI(14, 1D) > 60`; `relative_volume(20, 1D) >= 2`.
- Relative distance examples: `close >= SMA(50, 1D) * 1.10`; `close within 3% of 52-week high`.
- Columns/sort: persisted visible columns, order, sort field and direction.
- Schedule: multiple independent windows; timezone, start/end, interval, enabled and optional exchange calendar.
- Run/result: immutable run ID, config version, start/end/status, market snapshot/as-of, result count and ranked stock results tied to stock-card snapshot IDs.

## Nullability and status

All values that can be absent are nullable. A missing value should have a source/status or missing reason when the UI needs to distinguish unavailable, unsupported, delayed, stale, not applicable, and not yet computed. Do not use `0` to mean missing. Boolean statuses should not default to false if the state is unknown.
