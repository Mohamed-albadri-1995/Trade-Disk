# The journal

**Above:** [ARCHITECTURE.md](../../ARCHITECTURE.md) §4.6.

**Talks to:**
- the [front door](../02-front-door/FRONT-DOOR.md) (`/journal/`);
- the [desk](../03-desk/DESK.md), whose scheduler starts each account's sync;
- the [data sources](../08-data-sources/DATA-SOURCES.md): Alpaca fills and orders, and bars;
- the [shared record](../09-shared-record/SHARED-RECORD.md): the facts, the market state
  and the R1 row known at a trade's entry;
- [qp](../05-qp/QP.md): the chart of a trade;
- its own [file](../04-files/FILES.md).

---

## 1. What it is

Every real trade, after the fact: what was bought and sold, at what prices, in
what size, against what stop, under what market, for what result. Then the
patterns across trades: by hour, weekday, price, size, side and setup.

It answers the question the tools' records do not: **how do my actual trades
go?** The tools' records measure what the screeners find; the journal measures
what the trader did with it.

It is its own program, with its own file, because it shares nothing live with
the tools.

**What it owns:**
- the accounts and their broker connectors;
- the instruments, and the executions;
- the trades, with their executions, stops, fees, setups and notes;
- each trade's snapshot at its entry;
- the day notes.

**What it never does:**
- place an order: the desk places none;
- grade or size a trade for execution;
- keep a timer of its own: each sync is started by the desk.

---

## 2. The diagram

```mermaid
flowchart TB
  FD["front door · /journal/"] --> PAGE
  JOBS["desk scheduler"] -->|"starts each account's sync"| SYNC
  subgraph JR["journal · Node · port 3100"]
    subgraph IN["three doors in"]
      SYNC["<b>broker connectors</b><br/>read-only · one per broker"]
      FILES["<b>file upload</b><br/>presets + column-mapping"]
      HAND["<b>manual entry</b>"]
    end
    PAIR["<b>one pairing engine</b><br/>executions → round trips<br/>flat-to-flat FIFO · de-dup · reversals split"]
    SNAP["<b>the entry snapshot</b><br/>what was known at the entry, nothing later"]
    PAGE["<b>the page</b><br/>8 tabs · filters · formulas computed once<br/>trade cards · setups · import report"]
  end
  SYNC -->|"executions"| PAIR
  FILES -->|"executions"| PAIR
  HAND --> PAIR
  PAIR --> SNAP
  PAIR --> PAGE
  SNAP --> PAGE
  SYNC -->|"read-only"| SRC["each broker"]
  SNAP -->|"1-minute and daily bars"| BARS["bar sources"]
  SNAP -->|"facts · market state · R1 row, as of the entry"| PG[("shared record")]
  PAGE -->|"📈 the trade's real instants"| QP["qp"]
  JR ==>|"only writer"| JF[("the journal's file")]
  classDef prog fill:#dbeafe,stroke:#1d4ed8,color:#111;
  classDef store fill:#f3f4f6,stroke:#6b7280,color:#111;
  classDef ext fill:#ffffff,stroke:#9ca3af,stroke-dasharray: 5 5,color:#111;
  class SYNC,FILES,HAND,PAIR,SNAP,PAGE prog;
  class PG,JF store;
  class FD,JOBS,SRC,BARS,QP ext;
```

---

## 3. Its parts

| Part | Job | Detail |
|---|---|---|
| **trades in** | the three doors a trade arrives through: read-only broker connectors synced on a schedule; file upload (per-broker presets or a generic column-mapping wizard); manual entry. Each produces **executions**, covering stocks, options, futures, forex and crypto | [IMPORT.md](IMPORT.md) |
| **the pairing engine** | one engine, for every door, turns executions into round trips — flat-to-flat, FIFO, reversals split — once; a de-dup key hierarchy and a split/merge override mean a re-import updates and never duplicates | [IMPORT.md](IMPORT.md) |
| **stops and fees** | the stop from the broker's stop order, the strategy's exit plan, or the trader; fees per execution, from the broker or the account's fee rule (labelled estimated) | [IMPORT.md](IMPORT.md) |
| **the entry snapshot** | the price structure from bars up to the entry minute; the facts, the market state and the R1 row as known at the entry; MAE and MFE between the entry and the exit | [REVIEW.md](REVIEW.md) |
| **the page** | eight tabs (Overview, Calendar, Time, Risk, Stats, Setups, Trades, Import) and three filters; every number computed in one place; the trade cards; the setup statistics; the 📈 chart link | [REVIEW.md](REVIEW.md) |

---

## 4. Contracts

**The program:** Node, `journal/server.js`, on port 3100 of the box, behind
the front door at `/journal/`.

**It owns the journal's file, `data/journal/journal.db`.** The target tables
are below. Today the trades live in `journal_trades`, with the setups, day
notes and fee profiles; the old app's leftover tables are not carried
([FILES.md](../04-files/FILES.md) §3.5).

| Table | Key |
|---|---|
| `accounts`, `connectors` (keys in the secret file `data/journal/journal-accounts.json`) | id; account |
| `instruments` (type + per-class metadata) | id |
| `executions` | account, external id |
| `trades` | id (stable) |
| `trade_executions` | trade, execution |
| `import_batches` (for undo) | id |
| `setups` | id |
| `trade_snapshots` | trade |
| `day_notes` | day |

| It reads | From |
|---|---|
| executions (activities, orders, Flex reports, statements) | each broker, through its connector, read-only ([DATA-SOURCES.md](../08-data-sources/DATA-SOURCES.md)) |
| 1-minute and daily bars | the bar sources ([DATA-SOURCES.md](../08-data-sources/DATA-SOURCES.md)) |
| facts, the market state and the R1 row, as of the entry | the shared record |

| Routes, behind `/journal/` | Do |
|---|---|
| `GET /api/journal/trades` (filters); `GET /api/journal/trades/:id` | trades; one trade with its executions and its snapshot |
| `PATCH /api/journal/trades/:id`; `POST /api/journal/trades` | stop, target, fees, setup, notes, tags; manual entry |
| `POST /api/journal/trades/:id/split`, `…/merge` | the manual pairing override |
| `POST /api/journal/import`; `…/import/mapping`; `DELETE …/imports/:id` | a file in (preview, then report); save a column mapping; undo one batch |
| `GET/POST/DELETE /api/journal/accounts…`, `…/connectors…`, `…/test` | accounts and connectors; no secret is ever returned |
| `POST /api/journal/sync` | one sync of the due connectors, started by the desk's scheduler |
| `GET/POST/PATCH /api/journal/setups`; `GET /api/journal/stats` (filters) | setups; every number of the page, computed in one place |

---

## 5. When it fails

| Event | What happens |
|---|---|
| an account's fetch fails | recorded with its reason; the account waits for its next turn; the sync's run record says which account failed |
| the journal is down | the desk is unaffected; the scheduler records the failed sync and alerts |
| a file has rows the parser cannot read | the import report lists every skipped row with its reason; nothing is dropped silently |
| the shared record is down | the snapshot waits and says so; trades still import |

---

## 6. Built on

**The old desk.** [legacy/journal/](../../legacy/journal/README.md), documented
from the code with every import format run on a scratch database:
- [PAGE](../../legacy/journal/PAGE.md): every tab and formula;
- [ACCOUNTS](../../legacy/journal/ACCOUNTS.md): the Alpaca accounts and their
  pairing;
- [IMPORT](../../legacy/journal/IMPORT.md): the file formats, and what was
  tested;
- [ANALYSIS](../../legacy/journal/ANALYSIS.md): the technical snapshot,
  conditions, grading;
- [DATA-MODEL](../../legacy/journal/DATA-MODEL.md);
- [OPERATIONS](../../legacy/journal/OPERATIONS.md): start-up, the fetch timer,
  the tests;
- [KNOWN-ISSUES](../../legacy/journal/KNOWN-ISSUES.md): D-J1 to D-J20.

**What failed there:**
- **File imports mispaired scale-ins and scale-outs, lost TradingView shorts,
  and duplicated on re-import** (D-J1 to D-J7). Fixed by one engine (step 11).
- **No trade has a stop,** so every R is empty (D-J9).
- **Times were clock strings,** with a fixed −05:00 offset and one date per
  trade (D-J8, D-J10, D-J12). Fixed by real instants (step 4).
- **The snapshot and the grading half never worked** (D-J13, D-J14).
- **No fees for most sources** (D-J15).
- **The server's numbers differed from the page's** (D-J17).
- **None of the 84 journal tests covered the file importer.**

**The import, redesigned.** The old three methods (an Alpaca-only sync, four
hard-coded file parsers, API-only hand entry) are replaced with the de-facto
trading-journal standard — read-only broker connectors, file upload with a
column-mapping wizard, manual entry on the page, and one FIFO pairing engine with
a de-dup key hierarchy, split/merge and import-undo, across every asset class
([IMPORT.md](IMPORT.md)).

---

## 7. Status

| Part | Status |
|---|---|
| the page and its formulas; Alpaca accounts on a schedule | **built** (legacy, kept) |
| real New York instants | **built** (step 4) |
| the running-position pairing kernel; the Alpaca connector | **built** (legacy), now the base of the connector model |
| stops; the entry snapshot from the shared record; MAE and MFE | **to build** |
| the import redesign — more connectors (IBKR, Tastytrade, MetaTrader, futures-file), file upload with column-mapping, manual entry on the page, FIFO, the de-dup key hierarchy, split/merge, undo, per-asset-class P&L | **to build** ([IMPORT.md](IMPORT.md)) |
| the sync started by the desk's scheduler | **to build** (step C). Today the journal runs its own minute timer |
| one condition system over the snapshot; setup statistics | **to build** ([REVIEW.md](REVIEW.md)) |
