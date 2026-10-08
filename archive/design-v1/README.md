# The first design (archived)

> **Superseded on 2026-10-08** by the design tree: the trunk
> [ARCHITECTURE.md](../../ARCHITECTURE.md) and the documents below it in
> [design/](../../design/README.md). Do not build from this folder.
>
> **Why it is kept.** The documents below the tree's blocks (layers 2 and 3)
> are still being written, and this folder holds detail they will carry: every
> card field, register column, O'Neil rule and route. Once they carry all of
> it, this folder is removed; git history keeps it after that.

**What is here:**
- [ARCHITECTURE.md](ARCHITECTURE.md): the first trunk (two programs,
  desk-web and desk-worker; ten domains);
- one document per domain, listed below, with [MIGRATION.md](MIGRATION.md),
  the first migration plan (steps 1–20);
- [pdf/](pdf): their PDFs.

**What the tree changed:** one desk program for every tool instead of two;
each tool's results kept in its own file with a copy in the shared record;
documents by block and part instead of by domain. The desk's document,
[DESK.md](../../design/03-desk/DESK.md#why-one-program-not-two) says why.

## The leaves of the first design

One document per domain of the [architecture](ARCHITECTURE.md), plus the
schema, the API and the migration. What is built and what is left: the trunk's
[§0](ARCHITECTURE.md#0-where-the-build-stands-2026-10-08) and
[MIGRATION.md](MIGRATION.md) §2a and §6; each leaf opens with its build status. The trunk's
[document map](ARCHITECTURE.md#13-the-document-map) shows where each leaf
hangs and which legacy documents it builds on.

| Trunk section | Leaf | Covers |
|---|---|---|
| 6.1 | [SOURCES.md](SOURCES.md) | every external source behind an adapter; bar feeds and the cache; fallback orders; health; keys |
| 6.2 | [TOOLS-AND-SCREENERS.md](TOOLS-AND-SCREENERS.md) | every tool and screener rule by rule; the builder; discovery; lifecycle |
| 6.3 | [CARD.md](CARD.md) | the card: all 97 numbered legacy fields, fact families, the builder, presentation |
| 6.4 | [MARKET.md](MARKET.md) | the market read: regime, sectors, hot sectors, M and L on the tab |
| 6.5 | [ONEIL.md](ONEIL.md) | the O'Neil chain: every letter's rules, what was built, the research worker |
| 6.6 | [REGISTERS.md](REGISTERS.md) | R0–R4 and the shortlist, every column; the research record |
| 6.7 | [LEARNING.md](LEARNING.md) | the score and the scorecard |
| 6.8 | [QUANT.md](QUANT.md) | the library, strategies, backtests, alerts, print sheets |
| 6.9 | [JOURNAL.md](JOURNAL.md) | every real trade: accounts, fills, pairing, stops, the page |
| 6.10 | [PLATFORM.md](PLATFORM.md) | login, scheduler, settings, health, backup, restore, deploy, the page shell |
| 5 | [DATA-MODEL.md](DATA-MODEL.md) | every table, and where every legacy table goes |
| 4 | [API.md](API.md) | every route |
| 10 | [MIGRATION.md](MIGRATION.md) | the 14 steps, their checks and undo, the import of the old data |

Each domain leaf has the same five parts:

1. **Its place in the trunk**: the section it details, and the domains it
   talks to.
2. **The legacy design, in full**: every field, source, calculation and rule
   the old desk had, so nothing it knew is lost.
3. **What failed**: the faults found in the 2026-10 review, by ID.
4. **The new design**: how it is built, and why.
5. **Contracts**: the tables, fact families and routes it owns or reads, and
   how the rebuild is proven.
