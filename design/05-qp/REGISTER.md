# Register Browser and Radar Bridge

Parent: [QP](QP.md). Front-end contract: [FRONTEND-DESIGN](FRONTEND-DESIGN.md). Evidence: [legacy register model](../../legacy/screeners/REGISTERS.md) and [legacy QP page](../../legacy/qp/PAGE.md).

## Purpose

Register is the bridge from Radar/screener tool history into QP Lab. Each tool owns its own daily capture history. QP provides a read-only browser, historical chart inspection and selection of a historical register as a backtest universe. It must not rewrite records or merge tools unless the user explicitly chooses a union.

## Layout

- Tool selector: T1, T2 and other tool IDs supplied by the desk, with display name and availability.
- Register selector: R1 daily frozen photo, Shortlist and other register kinds the service confirms.
- Date picker and previous/next available capture controls; show New York date and exact capture time where available.
- Capture count, search, sort, schema-supported filters, table/card view and pagination.
- Stock rows display only fields actually available: ticker, captured price, change, score/bias, sector and capture time where present.
- Primary actions: Open chart as of this date; Use as backtest universe.

## Historical inspection

Selecting a stock opens the shared QP chart at the selected historical date. Set an as-of cutoff and hide later bars and later-known facts. Label the context clearly, e.g. "Historical view · T1 · R1 · 12 Dec 2025". Live mode is disabled. Returning restores tool, register, date, filters, page and scroll position.

The register represents what that tool captured, not every stock that traded or could have been found. R1 is a frozen daily photo; R0 is a live registry and must not be presented as historical R1. Shortlist is a distinct list.

## Backtest handoff

Use as backtest universe opens Backtest Lab and preselects tool ID and register type. Copy a date into the run range only when the user explicitly selects use date as start/end; otherwise preserve the current range. Each date in the backtest uses the selected tool's frozen register for that date.

Example: T1 from 2025-01-01 through 2026-01-01 uses T1's own daily register on every eligible day. It does not use T1's current list for the entire year and never includes T2 unless the user explicitly selects both. Display effective universe and missing capture dates before Run.

## States

| State | UI |
|---|---|
| Loading | preserve date/tool; skeleton rows |
| Available with rows | count, capture time, searchable list |
| Available but empty | explicit no stocks captured message |
| Missing capture | explicit no historical capture for tool/date |
| Tool unavailable | service error and retry |
| Partial data | identify missing fields/records |
| No chart bars | keep selected register row and explain feed/history limits |

## Acceptance

- [ ] T1 and T2 can be browsed independently by date.
- [ ] Stock opens the chart with the selected historical cutoff.
- [ ] Returning restores register context.
- [ ] T1-only backtest uses T1's daily membership.
- [ ] Empty register and missing capture are distinct.
- [ ] No future bars/facts appear in historical inspection.
- [ ] Effective universe is inspectable before Run.
