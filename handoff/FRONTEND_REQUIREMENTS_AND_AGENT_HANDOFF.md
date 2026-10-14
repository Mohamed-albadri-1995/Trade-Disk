# Frontend requirements and design-document agent handoff

**Repository:** `Mohamed-albadri-1995/Trade-Disk`  
**Base ref:** `ccr-27e01e90-a59zbq`  
**Purpose:** Give the next agent one branch containing the existing architecture/frontend-design documents and a clear, bounded task to reconcile them with the approved frontend.

## Start here

1. Read the repository `README.md` and `ARCHITECTURE.md`.
2. Read `design/README.md`.
3. Read `design/02-front-door/FRONT-END-DESIGN.md` for the current homepage/frontend design.
4. Read these contracts before editing:
   - `design/03-desk/tool/CARD.md`
   - `design/03-desk/MARKET.md`
   - `design/03-desk/tool/REGISTERS.md`
   - `design/09-shared-record/SHARED-RECORD.md`
   - `design/04-files/FILES.md`
   - `design/03-desk/tool/SCREENERS.md`
   - `design/03-desk/tool/PAGES.md`
   - relevant data-source and research-worker contracts linked from those documents.
5. Check the branch's actual files and approved frontend artifact before treating any requirement as confirmed. Do not infer approval from this handoff alone.

## Frozen frontend requirements

### Application destinations and navigation

- Screener is the primary landing destination.
- Screener presets/configurations such as T1/T2/T7 belong inside the Screener experience; they are stable IDs for configurations, not market-data fields.
- Keep Shortlist.
- Keep a standalone broad-market Market dashboard.
- Stock Analysis Workspace has four tabs: Overview, Technical, CAN SLIM / O’Neil, and Fundamental · Market · News.
- The stock-specific Fundamental · Market · News tab is not the standalone Market dashboard.
- Settings manages custom screener configurations.
- Do not add News or More as bottom-navigation tabs. Verify and document how Market and Settings are reached; do not mislabel every destination as a bottom tab.

### Overview

The intended compact Overview inventory is: Chart snapshot, Volume & Float, Range, Recent News, CAN SLIM · O’Neil summary, Themes, Market Context, Price, EMAs, ATR & Move, and Pre-Market Range. Do not number the sections. **Score Breakdown is excluded from Overview.**

Overview is a summary, not a duplicate analysis engine:
- Technical owns detailed charts, timeframes, price/volume evidence, indicators, moving averages, ranges, volatility and support/resistance.
- CAN SLIM / O’Neil owns the seven-factor assessment and supporting evidence; Overview is a projection of that same assessment.
- Fundamental · Market · News owns company financials, valuation, company-relevant events, headlines and catalysts.
- Recent News and Market Context are summaries of the authoritative stock-specific facts, not independent computations.
- The final Overview inventory must be checked against the approved prototype and any newer explicit product decision. If a newer source conflicts with this list, record the conflict and mark it OPEN rather than silently choosing.

### Technical and CAN SLIM

- Technical is for the selected stock: chart/candles and available timeframes; session price/volume; EMA/SMA; RSI/MACD/stochastic where available; ATR/ADR; range position; premarket; support/resistance; and source, timeframe, parameters, timestamps and data-quality status.
- CAN SLIM / O’Neil owns C/A/N/S/L/I/M assessments, grades, evidence, caveats and missing-data reasons.
- O’Neil M and industry-group L are read from their designated research producer; a page must not independently calculate them.

### Standalone Market dashboard

Include the approved market-level groups:
- SPY, QQQ, DIA, IWM and VIX with daily and weekly changes.
- Short-, mid- and long-term model components, six signal contributions/checks where defined by the approved model, and the resulting regime/stance.
- Sector heatmap with sector ETF, daily/weekly changes, relative strength, bias, score, ADX and status where supported.
- Industry-group rankings with rank, group, grade/percentile, member count, median RS, percentage over 80, 3-month performance and leaders where supported.
- Breadth, distribution/volatility context and theme watch.
- Narrow layouts should keep sector/group data readable as tables, horizontally scrollable where needed.

Do not invent calculation formulas, provider coverage, freshness guarantees or production values. The current frontend prototype uses clearly labeled illustrative/demo values and does not implement live market calculations.

### Custom screener builder

- Show saved custom screeners before opening the create/edit form.
- Support create, edit and delete with confirmation.
- Filter library should represent field-to-value and field-to-field comparisons, percentage-distance operators where applicable, AND/OR grouping, timeframe/indicator parameters, multiple independent run windows, per-window interval and timezone.
- Expressiveness examples include RSI(14, 1D) > 60, Close > SMA(50, 1D), 10% above SMA50 and within 3% of the 52-week high.
- These are configuration requirements, not proof that a live engine evaluates them.
- Browser-local persistence is acceptable for the prototype. Do not implement live scans, background jobs, alerts or a backend in this design-reconciliation pass.

## Data and architecture invariants

1. Every tool has its own R0/live list. Do not merge all tools' R0s into one universal results list.
2. Preserve tool isolation: one tool does not consume another tool's results as its own.
3. One authoritative producer/writer per fact family. Multiple UI consumers do not imply duplicate stored facts.
4. Global market regime and a stock's sector-specific bias are separate facts. A card's sector bias must relate to that stock's sector and the applicable market snapshot.
5. Keep screener IDs, definition versions, match provenance, capture times and result snapshots traceable.
6. Preserve historical “known at the time” truth; do not replace old snapshots with current values.
7. Distinguish raw facts, derived values, research interpretations and display-only composition.
8. Missing/stale/unavailable/unverified values must be represented honestly with source/as-of/data-quality details where relevant; never silently convert missing values to zero or a directional verdict.
9. Shared Record is not automatically the primary owner of every frontend field. Tool-specific experiment/results stay tool-owned; shared facts and justified copies must have a named writer and a stated purpose.
10. Do not add storage fields solely because a value appears in more than one UI location.

## Required work from the design-document agent

1. Verify the exact files on this branch and inspect the approved frontend artifact. Do not assume the handoff alone proves all details are approved.
2. Build a field-by-field reconciliation matrix with: frontend field/group; UI location; authoritative producer/source; freshness/as-of; current document/table/register; consumers; conflict/gap; minimal proposed change; status (confirmed/open).
3. Reconcile in dependency order: Card → Market/global vs stock-specific context → registers R0/R1/R2/R3/R4/Shortlist → Shared Record and file ownership.
4. Preserve the current architecture wherever it serves the frontend. Propose the smallest justified change for real conflicts.
5. Mark unresolved decisions OPEN with the exact question and why it matters. Do not invent schema columns, calculations, providers or guarantees.
6. Update only the design documents needed for a consistent contract. Keep diagrams, links, field tables and cross-references aligned. Check whether maintained PDFs must be regenerated and do not leave Markdown/PDF contracts inconsistent.
7. Report changed paths, decisions made, open questions, validation performed and work explicitly not performed.

## Out of scope

No backend/API implementation, production database migration, market-data provider integration, production scoring, scheduler, live scan execution or real alert delivery. This branch is a design/handoff baseline, not a production release.

## Important limitation

This document is a handoff and checklist, not a claim that every requirement has already been reconciled against the complete approved prototype. The agent must verify actual files and resolve conflicts before declaring the requirements frozen.
