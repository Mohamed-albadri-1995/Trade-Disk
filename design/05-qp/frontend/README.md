# QP Lab frontend concept

Open the [interactive frontend prototype](index.html).

This is a static design prototype for the chart-centered QP workspace. It includes:
- Chart-centered desktop layout and responsive mobile layout.
- Light/dark theme toggle.
- Indicator, condition and strategy builder surfaces.
- Backtest Lab configuration and a first-class results/diagnostics area.
- Register bridge for T1/T2, historical date selection, stock inspection and backtest handoff.
- Alerts, data-quality and coverage states.

## Important boundary

This prototype is not connected to the QP API or Radar databases. Chart lines, primitive examples and register rows are illustrative. Backtest actions deliberately do not fabricate performance results. The production frontend must consume the runtime QP primitive registry, canonical strategy evaluator, actual historical register service and backtest endpoints. See [FRONTEND-DESIGN.md](../FRONTEND-DESIGN.md) and [REGISTER.md](../REGISTER.md).

## Review order

1. Global shell and theme/responsive behavior.
2. Register T1/T2 historical selection and as-of chart flow.
3. Backtest universe and date-range semantics.
4. Primitive/condition/strategy editing states.
5. Result diagnostics, versioning, alert history and empty/error states.
