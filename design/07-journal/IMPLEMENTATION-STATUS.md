# Front-end implementation status

This document records the current scope of the prototype in
`frontend-design/index.html` — the Trade-Disk **Trading Station home** and the
**Journal** workspace, in one static page. It does not replace the product
requirements in [FRONT-END-DESIGN.md](../02-front-door/FRONT-END-DESIGN.md),
[JOURNAL.md](JOURNAL.md), [REVIEW.md](REVIEW.md) or [IMPORT.md](IMPORT.md); it
says how much of them the prototype shows, and what is deliberately left to the
production services.

## Implemented in the frontend

**Trading Station home** ([FRONT-END-DESIGN.md](../02-front-door/FRONT-END-DESIGN.md))
- Blue Trade-Disk brand accent, light/dark, responsive hero and four-tool grid.
- The Journal is the one available tool (**Launch First**); Radar, TradeLab and
  TradePilot are shown as **Coming soon** and are non-navigable — no false
  launch action, no fabricated pricing or release dates.
- The workflow strip (Find · Analyze · Trade · Improve) and an honest footer.

**Journal workspace** ([REVIEW.md](REVIEW.md))
- Application shell with a desktop sidebar, a mobile bottom nav, and the Journal's
  own green product accent, light/dark.
- The eight page tabs: **Overview** (six tiles — net P&L, win rate, profit
  factor, expectancy, payoff, max drawdown — win% and long% rings, the equity
  curve, and the SQN / Kelly / recovery / consistency / streak strip),
  **Calendar** (daily results and editable day notes), **Time** (weekday, entry
  price and size, hold time), **Risk** (R-multiple and P&L distributions, the
  risk strip), **Stats** (grouped metrics, by-asset-class, top symbols),
  **Setups** (per-setup statistics), **Trades** (the ledger with the accounts and
  connectors panel above it), and **Import**.
- Trade detail: signed % move, editable setup / stop / target / fees / notes on
  the page, a 📈 chart link (opens TradeLab / qp — coming soon), and honest
  entry-snapshot / executions / history placeholders.

**Import — three doors, one engine** ([IMPORT.md](IMPORT.md))
- The accounts and connectors panel: read-only sources, each marked, with the
  "no credential that can trade" guarantee visible.
- Door 1 — broker connectors: the connector catalogue (Alpaca, IBKR Flex,
  Tastytrade, MetaTrader, Tradovate/NinjaTrader) with auth, transport and cadence.
  Illustrated, not live.
- Door 2 — file upload: a **working** generic column-mapping wizard — parse any
  CSV, map columns to the canonical fields, pick the date format and time zone,
  **preview the trades before commit**, see a per-row skip report, and **undo the
  batch** in one click. Pairing is flat-to-flat FIFO with scale-in/out averaging
  and reversal split.
- Door 3 — manual entry: an asset-aware form for stocks, options, futures, forex
  and crypto, with per-class multipliers.
- A de-dup check keeps a re-import from duplicating.

**Persistence**
- Browser-local storage for demo trades, import batches, notes, day notes and
  theme.

## Explicit limitations

- Seed trades are synthetic examples. They are not real account history and must
  never be presented as actual results.
- Data is stored in the current browser's local storage. It does not sync between
  devices, provide account authentication, or constitute a server-side backup.
- **Broker connectors are illustrated, not live.** A static page holds no
  credentials; connecting needs the production journal and a read-only credential
  stored server-side (mode 0600, never backed up). The file-upload path runs
  entirely in the browser.
- The pairing shown covers scale-ins, scale-outs and reversal splits for the
  file-upload demo; the production engine owns the full de-dup key hierarchy
  across a connector and a file on the same account, open-position look-back, and
  cross-account rules.
- Entry-time market snapshots, MAE/MFE from verified bars, and audit-history
  events require the production data model and services before they can be shown
  as verified facts.
- The 📈 chart link targets TradeLab (qp), which is **coming soon**.

## Data integrity rules

- Keep gross P&L, fees, and net P&L separate.
- Do not infer initial risk or an R-multiple when the required stop is absent —
  show "—", never a guessed number.
- Keep open trades distinct from closed/realized results.
- Keep synthetic data clearly labelled and make reset behavior explicit.
- Browser-local persistence is a prototype convenience, not a production storage
  or security boundary.

## Before production release

1. Connect the frontend to the authenticated server/API and the canonical
   trade/fill model behind the front door at `/journal/`.
2. Implement the full import engine from [IMPORT.md](IMPORT.md): the read-only
   connectors, the preset parsers, the de-dup key hierarchy, correct
   partial-fill / reversal / fee / timestamp / open-position handling, and
   per-asset-class P&L.
3. Use the shared calculation layer for every page and export; add fixture-based
   calculation tests.
4. Populate entry snapshots and MAE/MFE only from timestamp-valid source data.
5. Add server-side audit events, sync/data-quality reporting, account deletion,
   and export verification.
6. Validate keyboard accessibility, small-screen layouts, and real browser
   interaction flows at 360, 390, 640, 1024 and 1440 CSS px.
7. Verify the deployed URL after deployment; a successful source commit alone is
   not deployment verification.
