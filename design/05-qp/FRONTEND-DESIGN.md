# QP Front-End Design

Parent: [QP](QP.md). Related: [LIBRARY](LIBRARY.md), [STRATEGIES](STRATEGIES.md), [BACKTEST](BACKTEST.md), [REGISTER](REGISTER.md), [SIGNAL-ALERTS](SIGNAL-ALERTS.md), [FEEDS](FEEDS.md).

## 1. Purpose and boundary

This document completes the chart-centered QP Lab design. It extends the established design rather than replacing it with a new product shell. The chart remains the main work surface. The right inspector changes between Indicators, Conditions, Strategy, Backtest, Alerts and Register. Register is a first-class bridge from Radar/screener tools' historical records into chart inspection and backtesting.

The frontend is a control and inspection surface. It does not calculate market facts itself, own screener history, run its own scheduler, or place orders. Market calculations come from the approved QP primitive registry and the canonical strategy evaluator.

## 2. Global shell

### Desktop

- Top bar: Trade-Disk mark; symbol search; timeframe; chart style; Indicators; Conditions; Strategy; prominent Backtest; Alerts; layout save/load; theme; settings; export.
- Left drawing rail: crosshair, trend line, ray, horizontal/vertical line, text, rectangle, measure, zoom, magnet and drawing list.
- Center chart: candles/bars/line/area/Heikin Ashi; OHLCV legend; overlays; independent lower panes; signal/entry/exit markers; volume; time/price scales; crosshair; historical cutoff.
- Right inspector: resizable tabs for Indicators, Conditions, Strategy, Backtest, Alerts and Register. Preserve tab state when switching.
- Lower resizable area: backtest results, trade list, diagnostics, logs or print preview. It may collapse so the chart remains readable.
- Status line: symbol, interval, feed, session, as-of time, last bar time and data health.

### Mobile

- Chart is the default and uses the full viewport width.
- Symbol, timeframe, theme and More remain reachable; secondary tools use a horizontal tool strip.
- Builder and Register open as full-screen sheets, never squeezed into a narrow side panel.
- Backtest results use full-screen tabs: Summary, Equity, Trades, Diagnostics and Configuration.
- Register selection preserves tool, register, date, filters, page and scroll position when opening a chart and returning.
- Sticky Save, Validate and Run actions where appropriate. No hover-only controls.
- No page-level horizontal overflow; wide tables scroll within their own panel.

## 3. Visual system and themes

Use the approved reference's dense, professional charting aesthetic: deep navy/near-black panels, fine borders, subtle grid, rounded 8–12px corners, bright blue primary actions, green positive/success, red negative/error, amber warnings, and distinct orange, purple and pink indicator colors. Avoid excessive glow and oversized empty gutters.

Light and dark modes share the same information architecture and component geometry. Theme applies to chart, panels, menus, dialogs, tables, errors and plots. Persist user preference and respect OS preference on first visit. Never use color alone to communicate state.

Use tabular numerals for prices and metrics, clear hierarchy, compact but legible labels, and touch targets of at least 40px on mobile.

## 4. QP navigation

QP's focused tool strip is Chart (base surface), Indicators, Conditions, Strategy, Backtest, Alerts, Register and Print/Export under More. Do not bring back the unrelated legacy Chart/Screener/Journal product navigation inside QP. Trade-Disk home and Journal remain outside QP, under the product front-door design.

## 5. Indicator Builder

- Searchable catalog grouped by canonical primitive categories and runtime approval state.
- Primitive details: canonical key, description, source/bars input kind, outputs, parameter types/defaults/bounds, timeframe/session requirements, warm-up, undefined periods, approval and TradingView comparison status.
- Only approved primitives may be used in production strategies.
- Custom indicators compose approved primitives and supported expressions. Provide a visual node canvas and ordered-step alternative, typed ports, parameter editing, preview, value inspection, validation, dependencies and save/version actions.
- Reject incompatible types, cycles, invalid bounds, missing outputs and unsupported operators. Do not execute arbitrary code or bypass approvals.
- Support overlay/lower-pane placement, output selection, plot color/style and visibility. Crosshair reveals the exact primitive value.

## 6. Condition Builder

A condition is a canonical rule or nested group, not free-form text. A rule row contains left operand, operator, operator-specific parameters, right operand only when required, timing, offsets, enable/disable and test.

Operands: approved primitive and output, price field, time field in New York time, constant, supported arithmetic expression, and trade-aware fields only for exit rules. Operators: gt, lt, ge, le, eq, neq, gt_pct, lt_pct, cross_above, cross_below, rising, falling, bounce_up and bounce_down. Unary operators must not show a misleading right operand.

Groups: AND, OR, ATLEAST(k) and THEN(window). Timing controls distinguish operand offset from rule-result offset and support for-bars/within-bars where the engine supports them. Missing, warm-up and out-of-session values follow canonical evaluator semantics; do not substitute zero.

Support nested groups, reorder, duplicate, enable/disable, undo/redo, validate, save reusable conditions and historical truth previews. Clicking a rule highlights its bars.

## 7. Strategy Builder

Sections: Identity; Entry; Exit; Risk and order plan; Fill model; Data requirements; Validation; Versions.

Identity includes name, description, Long/Short, Development/Ready, intended tool IDs and version. Entry and Exit use nested condition groups. Trade-aware operands are exit-only. Risk controls include only supported stops, targets, scale-out legs, sizing, entry windows and end-of-day behavior. Fill model is explicit and carried into preview, backtest and alert evaluation.

Validation blocks malformed rules, unknown or unapproved primitives, incompatible types, unknown tool IDs, invalid risk settings and unsupported features. Warnings explain sparse history, feed limits and unavailable historical facts. Saving changes creates a new immutable version. Backtests retain the exact version. Ready is a trader-controlled label, not a profitability guarantee. No order-placement controls exist.

## 8. Backtest Lab

Backtest is a first-class workspace in the top tool strip and is also accessible through Run Backtest in Strategy.

Configuration sections:
1. Strategy and frozen version.
2. Universe: fixed symbols, one tool's historical register, or an explicitly selected union of tools.
3. Register source: tool ID, register type, date range, membership semantics, extra symbols and missing-register dates.
4. Market data: timeframe, feed, session, New York trading calendar, warm-up and as-of rules.
5. Fill and costs: supported fill model, spread/slippage/commission and any supported per-share fees/minimums.
6. Capital and sizing: starting equity, accounting method, risk sizing and supported daily caps.
7. Filters: only engine-supported filters, with clear warnings if a value is not historically available.
8. Validation and run controls: Validate, Run, Stop at next symbol, progress, recovery and failure reason.

Results tabs: Overview; Equity and Drawdown; Trades; By Symbol; By Setup; Universe; Coverage and Diagnostics; Configuration; Compare; Export. Metrics come from the service, never from fabricated frontend calculations. Opening a trade moves the chart to its exact entry/exit bars and displays fill prices, costs, stop/target path, exit reason and register membership.

Every run records exact strategy version, configuration, universe, data/feed choices, costs, status, coverage and results. Open positions remain separate from closed-trade win rate. Missing bars, captures and excluded pairs are visible. Compare runs with changed settings highlighted. Exports include assumptions as well as metrics.

## 9. Register bridge

Register is a first-class historical browser over records owned by each Radar/screener tool. QP reads the register; it does not own or rewrite it.

Choose T1/T2/other available tool, register type (R1 daily frozen photo, Shortlist, or another type confirmed by the service), date, search, sort, supported filters, and table/card view. Show capture time, member count and availability. Fields are driven by the actual register schema; never invent absent fields.

Select a stock to load its chart with an as-of cutoff at the selected date. Hide later bars and later-known facts. Disable live mode while historical cutoff is active. Returning restores all register context.

Use as backtest universe opens Backtest Lab and preselects the selected tool/register. For a T1-only run from 2025-01-01 through 2026-01-01, each day uses T1's own frozen register for that day. Do not use today's list for the entire year and do not silently include T2. Show the effective universe before running.

An available empty register, missing capture, unavailable tool and feed with no bars are distinct states.

## 10. Alerts, print and shared states

Alerts show strategy/version, tool scope, symbol, signal bar/time, status, last cycle, notification state, history and errors. The desk scheduler starts cycles; the browser never owns the timer. Deduplicate according to backend policy. Alerts do not place orders.

Print/export supports a register day or selected list, one chart per symbol, timeframe, feed, overlays and date context. Report missing charts and result caps.

Every view has distinct loading, empty, stale, unavailable, partial and failed states. Show source, capture time, selected date and timezone wherever relevant. Search and pagination preserve context. No frontend market-math implementation may diverge from QP.

## 11. Acceptance checklist

- [ ] Chart and tabs work at 360, 390, 768, 1024 and 1440 CSS px.
- [ ] Both themes cover charts, tables, menus, dialogs, errors and mobile sheets.
- [ ] No page-level horizontal overflow on mobile.
- [ ] Primitive metadata and approval status come from runtime registry.
- [ ] All canonical operators, operand restrictions and group types are represented.
- [ ] Strategy version and run snapshot are explicit.
- [ ] T1/T2 historical register browsing and as-of chart work.
- [ ] A T1-only yearly backtest uses T1 daily membership, not today's list.
- [ ] Missing captures, feed gaps, warm-up and excluded pairs are visible.
- [ ] Preview, backtest and alerts share canonical evaluator/fill semantics.
- [ ] Alert history/deduplication and scheduler status are visible.
- [ ] No order placement is offered and sample data is clearly labeled.
