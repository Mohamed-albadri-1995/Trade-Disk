# Primitive Library and Indicator Builder

Parent: [QP](QP.md). Front-end: [FRONTEND-DESIGN](FRONTEND-DESIGN.md). Canonical behavior: [legacy library](../../legacy/qp/LIBRARY.md) and [primitive catalog](../../legacy/qp/CATALOG.md).

## One rule

No market math exists in the frontend. The approved QP primitive registry is the source of truth for chart, strategy preview, backtest and alerts. The UI displays registry metadata and calls QP services; it never creates a second calculation implementation.

## Catalog

Search, category and approval filters, favorites, and a detail view. Categories follow the runtime registry: moving averages, VWAP, volatility, oscillators, extremes, levels, structure, pivots, candles, trend and volume. Count and approval status come from runtime; do not permanently hardcode the historical count.

Each primitive detail shows canonical key, description, category, input kind (source or bars), valid sources, output names, parameter types/defaults/bounds, timeframe/session needs, warm-up and undefined periods, approval state, verification status and feed warnings.

Only approved primitives are eligible for production strategies. Draft/unverified items remain visible with a reason and are disabled for production composition.

## Add to chart

Choose primitive, configure required source and parameters, select overlay or lower pane where supported, choose color/style/visibility, add it and inspect its exact value at the crosshair. Multi-output primitives expose their named outputs rather than assuming a single line.

## Compose an indicator

Custom indicators are compositions of approved primitives and supported arithmetic expressions. Provide a node canvas and ordered-step alternative, typed ports, source/parameter editors, preview plot, value inspector, validation, dependency list, save, duplicate, rename and version history.

Reject cycles, incompatible types, invalid parameter bounds, missing output selection, unsupported operators and insufficient warm-up. Undefined values and division by zero remain missing values, never fabricated zeroes. A code/expression view may show the canonical composition but cannot execute arbitrary code or bypass approvals.

## States and acceptance

Approved, Draft/Unverified, Failed verification, Needs more history, Unavailable feed/session and No data are distinct.

- [ ] Search and filters reflect runtime registry.
- [ ] Approval state is server-sourced.
- [ ] Parameters enforce server-provided types and bounds.
- [ ] Multi-output primitives are selectable.
- [ ] Chart and strategy use the same implementation.
- [ ] No arbitrary code path bypasses the primitive library.
