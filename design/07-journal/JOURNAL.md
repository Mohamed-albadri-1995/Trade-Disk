# The journal

**Above:** [ARCHITECTURE.md](../../ARCHITECTURE.md) §4.6.

**Detailed product requirements:** [REVIEW.md](REVIEW.md).  
**Trade capture requirements:** [IMPORT.md](IMPORT.md).

**Talks to:**
- the [front door](../02-front-door/FRONT-DOOR.md) (`/journal/`);
- the [desk](../03-desk/DESK.md), whose scheduler starts scheduled account syncs;
- the [data sources](../08-data-sources/DATA-SOURCES.md): connected-account fills and price bars, where available;
- the [shared record](../09-shared-record/SHARED-RECORD.md): entry-time facts and market context, when available and time-valid;
- [qp / TradeLab](../05-qp/QP.md): the chart of a trade;
- its own [file](../04-files/FILES.md).

---

## 1. What it is

The Trading Journal is an independent product in the Trade-Disk Trading Station. It records a trader's real trades and helps answer: **How do my actual trades perform, where is my risk, and what can I learn from my own history?**

It is sold independently and is also accessible from the complete Trading Station. It must work as a responsive website and an Android experience, with the same underlying records and calculation rules.

The journal is an analysis and record-keeping tool. It does not place orders or size trades for execution.

## 2. What it owns

- Accounts and connection metadata; credentials remain protected server-side.
- Source records and fills, with stable source identifiers.
- Canonical trades and their allocated fills.
- Entry/exit timestamps, quantity, prices, side, fees, stop, target and initial risk when known.
- Setups, tags, notes and daily trading plans.
- Technical snapshots captured as of entry, with the snapshot time and data provenance.
- MAE/MFE, R-multiples and exit-efficiency metrics where the required data exists.
- User preferences and calculation/data-quality status.

## 3. Main product areas

The complete screen-by-screen specification and analytics inventory are in [REVIEW.md](REVIEW.md).

1. **Overview:** performance summary, equity curve, drawdown and evidence-based insights.
2. **Calendar:** daily results, trade count and daily notes.
3. **Trades:** searchable list, filters, open/closed state and complete trade detail.
4. **Analytics:** performance, risk, time, symbols, setups, costs and behavioral/process review.
5. **Setups:** create and maintain setups; compare results and entry-time conditions.
6. **Notes / Trading plan:** daily planning and review.
7. **Accounts & capture:** redesigned acquisition methods, connection status and review reports.
8. **Settings:** timezone, display, data and privacy preferences.

## 4. Trade capture

Capture methods are deliberately being redesigned; the old format-specific importer UI is not a requirement. The new experience must make capture easy while preserving correct pairing, stable identifiers, duplicate prevention, transparent errors, open positions, partial fills, reversals and accurate fees. See [IMPORT.md](IMPORT.md).

All acquisition methods feed one canonical validation and pairing engine. They must not each calculate trades differently.

## 5. Analysis contract

The journal uses one shared calculation layer for all pages and exports. Its detailed metrics, formulas, visualizations, sample thresholds and additional analysis methods are specified in [REVIEW.md](REVIEW.md).

Important invariants:
- Net P&L includes applicable fees; gross and fees remain separately visible.
- Open/unrealized results are distinct from closed/realized results.
- R requires valid initial risk; no stop or risk is fabricated.
- Missing data is “unknown/unavailable,” not silently zero or misaligned.
- Entry snapshots use only information available at the entry; no future bars or future market context.
- Every analysis displays its eligible sample count and defines which trades are included.
- The same filter and trade set must produce the same number everywhere.

## 6. Integration boundaries

- TradeLab can display the relevant symbol/timeframe chart with correctly placed entry and exit marks when its data and route are available.
- Radar or screener results may provide contextual references, but the journal remains the source of truth for actual trades.
- The shared market record may enrich a trade only with a timestamped, entry-valid snapshot. Missing context must remain missing.
- The journal does not depend on Radar or TradeLab being available to record, edit or analyze the basic trade history.
- Future TradePilot integration must not silently mix simulated, algorithmic and manually executed trades; source and execution mode must be explicit.

## 7. Reliability and data integrity

- Repeated capture of the same source record must not create duplicates.
- Scale-ins, scale-outs, partial exits, reversals and open positions must be represented correctly.
- Overnight trades use full entry and exit timestamps, not a single date plus two clock times.
- Failed syncs and incomplete capture runs must be visible with reasons.
- A missing price bar or unavailable shared record must not block basic trade recording.
- A calculation failure must be visible and retryable; it must not leave stale output marked current.
- Credentials must never be returned to the client or written to logs.
- Backups and restores must cover journal records and document how connected accounts are re-authorized.

## 8. Delivery order

1. Finalize the journal product and capture documents before UI implementation.
2. Build the responsive design system and navigation for web and Android.
3. Implement the core data model, capture/pairing, timestamp, fee and data-quality correctness.
4. Implement Overview, Calendar, Trades and Trade detail.
5. Implement Performance, Risk, Time, Symbol and Setup analytics.
6. Implement notes, setup/condition management, exports and deeper review tools.
7. Validate every displayed metric against documented test cases and the same sample of trades.


## 10. Front door and responsive acceptance

The Journal is a tool inside Trade-Disk, not the Trade-Disk home page. The deployed experience must include a clear route back to the Trading Station home/front door and a dedicated Journal landing/overview route. A Journal-only overview must never masquerade as the whole product home.

At phone widths (320–640 CSS px), the layout must use the full viewport width, hide desktop-only side navigation, avoid fixed/minimum widths that create a large empty right-hand area, and keep cards, filters, tables, charts, and the bottom navigation within the viewport. Wide tables may scroll inside their own panel; the page itself must not overflow horizontally. At desktop widths, the sidebar and multi-column layouts may be used.

Acceptance checks: verify at 360px, 390px, 640px, 1024px and 1440px; confirm visible home/front-door navigation; confirm all Journal pages remain reachable; confirm no clipped content or page-level horizontal scroll on mobile; confirm the first screen communicates product identity and the user's next actions.

## 11. Status

This document describes the intended product, not a claim that every item is already built. The legacy implementation is documented under [legacy/journal/](../../legacy/journal/); known gaps and defects are retained as evidence for the rebuild. The redesigned acquisition methods remain open decisions until reviewed.
