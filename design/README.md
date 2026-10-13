# The design tree

The design of the Trade Desk, read from the top down. The top document,
[ARCHITECTURE.md](../ARCHITECTURE.md), draws the whole desk in one picture. Each
block of that picture has a numbered folder here, in the order of the picture,
holding the block's document and the documents of its parts. Every level gives
what the level below needs, and no more.

**PDFs:** every document has one in [pdf/](../pdf), under the same names;
[pdf/DESIGN.pdf](../pdf/DESIGN.pdf) holds all of them, in this order.

---

## The tree

| Level | Document | PDF | What it covers | State |
|---|---|---|---|---|
| **0** | [ARCHITECTURE.md](../ARCHITECTURE.md) | [PDF](../pdf/ARCHITECTURE.pdf) | the whole desk: what it is, the one picture, each block in a few lines, a trading day, the rules, status, decisions, risks | written |
| **1** | [01-box/BOX.md](01-box/BOX.md) | [PDF](../pdf/design/01-box/BOX.pdf) | the server, its memory, the supervisor, the deploy, the secrets | written |
| **1** | [02-front-door/FRONT-DOOR.md](02-front-door/FRONT-DOOR.md) | [PDF](../pdf/design/02-front-door/FRONT-DOOR.pdf) | the one address, the one login, routing to each program | written |
| **1** | [03-desk/DESK.md](03-desk/DESK.md) | [PDF](../pdf/design/03-desk/DESK.pdf) | the one program for every tool: its parts, how a tool's record is taken and measured, the day's clock | written |
| 2 | 03-desk/WEB.md | | how a page or an API call reaches its tool | to write |
| 2 | 03-desk/HOME.md | | the landing page, the lists across tools, Manage tools | to write |
| 2 | 03-desk/TOOL.md | | one running tool, end to end | to write |
| 3 | 03-desk/tool/SCREENERS.md | | its screeners and how it finds stocks | to write |
| 3 | 03-desk/tool/CARD.md | | the card: every field and its source | to write |
| 3 | 03-desk/tool/REGISTERS.md | | its daily record and the outcomes | to write |
| 3 | 03-desk/tool/LEARNING.md | | the score and the scorecard | to write |
| 3 | 03-desk/tool/PAGES.md | | its pages | to write |
| 2 | 03-desk/STOPPED-TOOLS.md | | a stopped tool's history | to write |
| 2 | 03-desk/MARKET.md | | the market read | to write |
| 2 | 03-desk/JOBS.md | | the scheduler, job by job | to write |
| **1** | [04-files/FILES.md](04-files/FILES.md) | [PDF](../pdf/design/04-files/FILES.pdf) | every file on the server, what it holds, its one writer | written |
| **1** | [05-qp/QP.md](05-qp/QP.md) | [PDF](../pdf/design/05-qp/QP.pdf) | qp: charts, strategies, backtests, signal alerts | written |
| 2 | 05-qp/CHART.md | | the page and the print sheets | to write |
| 2 | 05-qp/LIBRARY.md | | the checked indicators | to write |
| 2 | 05-qp/STRATEGIES.md | | trading rules and how they become trades | to write |
| 2 | 05-qp/BACKTEST.md | | the backtest | to write |
| 2 | 05-qp/SIGNAL-ALERTS.md | | signal alerts | to write |
| 2 | 05-qp/FEEDS.md | | price bars | to write |
| **1** | [06-research-worker/RESEARCH-WORKER.md](06-research-worker/RESEARCH-WORKER.md) | [PDF](../pdf/design/06-research-worker/RESEARCH-WORKER.pdf) | the O'Neil research job: what it works out, when it runs, who reads it | written |
| 2 | 06-research-worker/ONEIL.md | | the O'Neil method, letter by letter | to write |
| **1** | [07-journal/JOURNAL.md](07-journal/JOURNAL.md) | [PDF](../pdf/design/07-journal/JOURNAL.pdf) | the trader's real trades, after the fact | written |
| 2 | [07-journal/IMPORT.md](07-journal/IMPORT.md) | | redesigned trade capture, pairing and validation requirements | written — acquisition choices open |
| 2 | [07-journal/REVIEW.md](07-journal/REVIEW.md) | | full responsive journal UX, metrics, analysis methods and acceptance criteria | written |
| **1** | [08-data-sources/DATA-SOURCES.md](08-data-sources/DATA-SOURCES.md) | [PDF](../pdf/design/08-data-sources/DATA-SOURCES.pdf) | every outside source, its limits, its fallbacks, its health checks | written |
| **1** | [09-shared-record/SHARED-RECORD.md](09-shared-record/SHARED-RECORD.md) | [PDF](../pdf/design/09-shared-record/SHARED-RECORD.pdf) | the shared database: what it holds, its switches, where it lives | written |
| **1** | [10-backups/BACKUPS.md](10-backups/BACKUPS.md) | [PDF](../pdf/design/10-backups/BACKUPS.pdf) | the nightly backup, its check, the restore, the monthly rehearsal | written |
| **1** | [11-alerts/ALERTS.md](11-alerts/ALERTS.md) | [PDF](../pdf/design/11-alerts/ALERTS.pdf) | what reaches the phone, the health page, the outside check | written |
| **1** | [12-migration/MIGRATION.md](12-migration/MIGRATION.md) | [PDF](../pdf/design/12-migration/MIGRATION.pdf) | from today's desk to the design, step by step | written |

**Where it stands:** the top document and the block documents (levels 0 and 1)
are written and under the trader's review. Levels 2 and 3 are written after it.

---

## How each document is built

Every document has the same parts, in the same order
([ARCHITECTURE.md §12](../ARCHITECTURE.md#12-the-document-tree)):
1. **its place:** the document above it, and the blocks it talks to;
2. **what it is:** its job, what it owns, what it never does;
3. **its diagram;**
4. **its parts,** each with the document below it where there is one;
5. **its contracts:** files, tables, routes;
6. **when it fails;**
7. **built on:** what the old desk did and what failed there;
8. **status:** what is built, and the migration step that builds the rest.

**Names.** One folder per block, numbered in the order of the picture. The
block's document carries the block's name; its parts sit beside it, and a part
with parts of its own gets a folder of its own (`03-desk/tool/`).

## Around the tree

| Folder | Holds |
|---|---|
| [legacy/](../legacy) | the desk as it runs today, documented from its code: the evidence the design is built on |
| [archive/design-v1/](../archive/design-v1/README.md) | the first design, superseded on 2026-10-08; kept until levels 2 and 3 carry everything in it |
