# Journal frontend implementation status

This document records the current scope of the prototype in `journal/index.html`. It does not replace the product requirements in [JOURNAL.md](../../design/07-journal/JOURNAL.md), [REVIEW.md](../../design/07-journal/REVIEW.md), or [IMPORT.md](../../design/07-journal/IMPORT.md).

## Implemented in the frontend

- Responsive application shell with desktop sidebar, compact mobile navigation, and light/dark theme.
- Overview dashboard with demo performance cards, charts, and evidence/sample labels.
- Calendar with daily results and editable daily notes.
- Searchable/filterable trade ledger, sorting, trade detail/review, and manual demo-trade capture.
- Analytics sections for performance, risk, time, symbol, setup, costs, direction, and process review.
- Setups and conditions workspace, notes/reviews, reports/CSV export, and settings/data-quality status.
- Browser-local persistence for demo trades, notes, and theme preference.
- Automated inline-JavaScript syntax and core-shell checks through GitHub Actions.

## Explicit limitations

- Seed trades are synthetic examples. They are not real account history and must never be presented as actual results.
- Data is stored in the current browser's local storage. It does not sync between devices, provide account authentication, or constitute a server-side backup.
- The frontend has no broker connection, canonical fill-allocation service, live market feed, or server-side persistence.
- Partial fills, reversals, entry-time market snapshots, MAE/MFE from verified bars, and audit-history events require the production data model/services before they can be represented as verified facts.
- Account/connection status is explanatory prototype UI, not a live connector health check.
- Trade capture deliberately remains manual demo entry only while the acquisition UX is being redesigned. Do not reintroduce the legacy format-specific import interface.

## Data integrity rules

- Keep gross P&L, fees, and net P&L separate.
- Do not infer initial risk or an R-multiple when the required risk data is absent.
- Keep open trades distinct from closed/realized results.
- Keep synthetic data clearly labelled and make reset behavior explicit.
- Browser-local persistence is a prototype convenience, not a production storage or security boundary.

## Before production release

1. Connect the frontend to the application's authenticated server/API and canonical trade/fill model.
2. Implement duplicate-safe capture and correct partial-fill, partial-exit, reversal, fee, timestamp, and open-position handling.
3. Use the shared calculation layer for every page and export; add fixture-based calculation tests.
4. Populate entry snapshots and MAE/MFE only from timestamp-valid source data.
5. Add server-side audit events, sync/data-quality reporting, account deletion, and export verification.
6. Validate keyboard accessibility, small-screen layouts, and real browser interaction flows.
7. Verify the deployed URL after deployment; a successful source commit alone is not deployment verification.
