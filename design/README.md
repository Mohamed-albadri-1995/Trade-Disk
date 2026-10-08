# The design tree

The design of the Trade Desk, read from the top down. The trunk,
[ARCHITECTURE.md](../ARCHITECTURE.md), draws the whole desk in one picture. Each
block of that picture has a document here, and each part of a block has a
document below it. Every level gives what the level below needs, and no more.

**PDFs:** every document has one in [pdf/](../pdf/), in the same tree;
[pdf/DESIGN.pdf](../pdf/DESIGN.pdf) holds all of them, in this order.

---

## The tree

| | Document | PDF | What it covers | State |
|---|---|---|---|---|
| **0** | [ARCHITECTURE.md](../ARCHITECTURE.md) | [PDF](../pdf/ARCHITECTURE.pdf) | the whole desk: its blocks, how they share data, a trading day, the rules, the box, status, decisions, risks | written |
| **1** | [box/BOX.md](box/BOX.md) | [PDF](../pdf/design/box/BOX.pdf) | the machine, its memory, the supervisor, the deploy, the secrets | written |
| 1 | [front-door/FRONT-DOOR.md](front-door/FRONT-DOOR.md) | [PDF](../pdf/design/front-door/FRONT-DOOR.pdf) | the address, TLS, routing by path, the one login | written |
| 1 | [desk/DESK.md](desk/DESK.md) | [PDF](../pdf/design/desk/DESK.pdf) | the desk: one program for every tool, a context per tool | written |
| 2 | desk/WEB.md | | how a page or an API call reaches its tool | to write |
| 2 | desk/HOME.md | | the landing page, the lists across tools, Manage tools | to write |
| 2 | desk/TOOL.md | | one running tool, end to end | to write |
| 3 | desk/tool/SCREENERS.md | | screeners, windows, versions, discovery | to write |
| 3 | desk/tool/CARD.md | | the card: fact families, fields, the pipeline | to write |
| 3 | desk/tool/REGISTERS.md | | R0–R4, the shortlist, the photo | to write |
| 3 | desk/tool/LEARNING.md | | the score and the scorecard | to write |
| 3 | desk/tool/PAGES.md | | the tool's pages and its API | to write |
| 2 | desk/STOPPED-TOOLS.md | | a stopped tool's history, read-only | to write |
| 2 | desk/MARKET.md | | the market read: regime, sectors, hot sectors | to write |
| 2 | desk/JOBS.md | | the scheduler and the desk jobs | to write |
| 1 | [files/FILES.md](files/FILES.md) | [PDF](../pdf/design/files/FILES.pdf) | every file on the box, its tables, its one writer | written |
| 1 | [quant/QUANT.md](quant/QUANT.md) | [PDF](../pdf/design/quant/QUANT.pdf) | qp: charts, strategies, backtests, signal alerts | written |
| 2 | quant/CHART.md | | the page and the print sheets | to write |
| 2 | quant/LIBRARY.md | | the verified indicators | to write |
| 2 | quant/STRATEGIES.md | | the strategy engine: rules, fills, the order | to write |
| 2 | quant/BACKTEST.md | | the backtest: universes, honesty, the report | to write |
| 2 | quant/SIGNAL-ALERTS.md | | live signal alerts | to write |
| 2 | quant/FEEDS.md | | bars: feeds, warm-up, the cache | to write |
| 1 | [research/RESEARCH-WORKER.md](research/RESEARCH-WORKER.md) | [PDF](../pdf/design/research/RESEARCH-WORKER.pdf) | the research worker: the O'Neil facts, with their dates | written |
| 2 | research/ONEIL.md | | the O'Neil method, letter by letter | to write |
| 1 | [journal/JOURNAL.md](journal/JOURNAL.md) | [PDF](../pdf/design/journal/JOURNAL.pdf) | the journal: every real trade, after the fact | written |
| 2 | journal/IMPORT.md | | fills, files, the pairing engine | to write |
| 2 | journal/REVIEW.md | | the page, the analysis, the entry snapshot | to write |
| 1 | [outside/SOURCES.md](outside/SOURCES.md) | [PDF](../pdf/design/outside/SOURCES.pdf) | every outside source and its adapter | written |
| 1 | [outside/SHARED-RECORD.md](outside/SHARED-RECORD.md) | [PDF](../pdf/design/outside/SHARED-RECORD.pdf) | the shared record: every table | written |
| 1 | [outside/BACKUPS.md](outside/BACKUPS.md) | [PDF](../pdf/design/outside/BACKUPS.pdf) | backup, restore, rehearsal | written |
| 1 | [outside/ALERTS.md](outside/ALERTS.md) | [PDF](../pdf/design/outside/ALERTS.pdf) | alerts to the phone, and the health page | written |
| 1 | [MIGRATION.md](MIGRATION.md) | [PDF](../pdf/design/MIGRATION.pdf) | from today's desk to the design, step by step | written |

**Where it stands:** the trunk and layer 1 are written and under the trader's
review. Layers 2 and 3 are written after it.

---

## How each document is built

Every document has the same parts, in the same order
([ARCHITECTURE.md §12](../ARCHITECTURE.md#12-the-document-tree)):
1. **its place:** the document above it, and the blocks it talks to;
2. **what it is:** its job, what it owns, what it never does;
3. **its diagram;**
4. **its parts,** each with the document below it where there is one;
5. **its contracts:** files, tables, fact families, routes;
6. **when it fails;**
7. **built on:** what the old desk did and what failed there;
8. **status:** what is built, and the migration step that builds the rest.

## Around the tree

| Folder | Holds |
|---|---|
| [legacy/](../legacy/) | the desk as it runs today, documented from its code: the evidence the design is built on |
| [archive/design-v1/](../archive/design-v1/README.md) | the first design, superseded on 2026-10-08; kept until layers 2 and 3 carry everything in it |
