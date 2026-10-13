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
| 2 | [03-desk/WEB.md](03-desk/WEB.md) | [PDF](../pdf/design/03-desk/WEB.pdf) | how a page or an API call reaches its tool | written |
| 2 | [03-desk/HOME.md](03-desk/HOME.md) | [PDF](../pdf/design/03-desk/HOME.pdf) | the landing page, the lists across tools, Manage tools | written |
| 2 | [03-desk/TOOL.md](03-desk/TOOL.md) | [PDF](../pdf/design/03-desk/TOOL.pdf) | one running tool, end to end | written |
| 3 | [03-desk/tool/SCREENERS.md](03-desk/tool/SCREENERS.md) | [PDF](../pdf/design/03-desk/tool/SCREENERS.pdf) | its screeners and how it finds stocks | written |
| 3 | [03-desk/tool/CARD.md](03-desk/tool/CARD.md) | [PDF](../pdf/design/03-desk/tool/CARD.pdf) | the card: every field and its source | written |
| 3 | [03-desk/tool/REGISTERS.md](03-desk/tool/REGISTERS.md) | [PDF](../pdf/design/03-desk/tool/REGISTERS.pdf) | its daily record and the outcomes | written |
| 3 | [03-desk/tool/LEARNING.md](03-desk/tool/LEARNING.md) | [PDF](../pdf/design/03-desk/tool/LEARNING.pdf) | the score and the scorecard | written |
| 3 | [03-desk/tool/PAGES.md](03-desk/tool/PAGES.md) | [PDF](../pdf/design/03-desk/tool/PAGES.pdf) | its pages | written |
| 2 | [03-desk/STOPPED-TOOLS.md](03-desk/STOPPED-TOOLS.md) | [PDF](../pdf/design/03-desk/STOPPED-TOOLS.pdf) | a stopped tool's history | written |
| 2 | [03-desk/MARKET.md](03-desk/MARKET.md) | [PDF](../pdf/design/03-desk/MARKET.pdf) | the market read | written |
| 2 | [03-desk/JOBS.md](03-desk/JOBS.md) | [PDF](../pdf/design/03-desk/JOBS.pdf) | the scheduler, job by job | written |
| **1** | [04-files/FILES.md](04-files/FILES.md) | [PDF](../pdf/design/04-files/FILES.pdf) | every file on the server, what it holds, its one writer | written |
| **1** | [05-qp/QP.md](05-qp/QP.md) | [PDF](../pdf/design/05-qp/QP.pdf) | qp: charts, strategies, backtests, signal alerts | written |
| 2 | [05-qp/CHART.md](05-qp/CHART.md) | [PDF](../pdf/design/05-qp/CHART.pdf) | the page and the print sheets | written |
| 2 | [05-qp/LIBRARY.md](05-qp/LIBRARY.md) | [PDF](../pdf/design/05-qp/LIBRARY.pdf) | the checked indicators | written |
| 2 | [05-qp/STRATEGIES.md](05-qp/STRATEGIES.md) | [PDF](../pdf/design/05-qp/STRATEGIES.pdf) | trading rules and how they become trades | written |
| 2 | [05-qp/BACKTEST.md](05-qp/BACKTEST.md) | [PDF](../pdf/design/05-qp/BACKTEST.pdf) | the backtest | written |
| 2 | [05-qp/SIGNAL-ALERTS.md](05-qp/SIGNAL-ALERTS.md) | [PDF](../pdf/design/05-qp/SIGNAL-ALERTS.pdf) | signal alerts | written |
| 2 | [05-qp/FEEDS.md](05-qp/FEEDS.md) | [PDF](../pdf/design/05-qp/FEEDS.pdf) | price bars | written |
| **1** | [06-research-worker/RESEARCH-WORKER.md](06-research-worker/RESEARCH-WORKER.md) | [PDF](../pdf/design/06-research-worker/RESEARCH-WORKER.pdf) | the O'Neil research job: what it works out, when it runs, who reads it | written |
| 2 | [06-research-worker/ONEIL.md](06-research-worker/ONEIL.md) | [PDF](../pdf/design/06-research-worker/ONEIL.pdf) | the O'Neil method, letter by letter | written |
| **1** | [07-journal/JOURNAL.md](07-journal/JOURNAL.md) | [PDF](../pdf/design/07-journal/JOURNAL.pdf) | the trader's real trades, after the fact | written |
| 2 | [07-journal/IMPORT.md](07-journal/IMPORT.md) | [PDF](../pdf/design/07-journal/IMPORT.pdf) | how trades come in | written |
| 2 | [07-journal/REVIEW.md](07-journal/REVIEW.md) | [PDF](../pdf/design/07-journal/REVIEW.pdf) | the page and the analysis | written |
| **1** | [08-data-sources/DATA-SOURCES.md](08-data-sources/DATA-SOURCES.md) | [PDF](../pdf/design/08-data-sources/DATA-SOURCES.pdf) | every outside source, its limits, its fallbacks, its health checks | written |
| **1** | [09-shared-record/SHARED-RECORD.md](09-shared-record/SHARED-RECORD.md) | [PDF](../pdf/design/09-shared-record/SHARED-RECORD.pdf) | the shared database: what it holds, its switches, where it lives | written |
| **1** | [10-backups/BACKUPS.md](10-backups/BACKUPS.md) | [PDF](../pdf/design/10-backups/BACKUPS.pdf) | the nightly backup, its check, the restore, the monthly rehearsal | written |
| **1** | [11-alerts/ALERTS.md](11-alerts/ALERTS.md) | [PDF](../pdf/design/11-alerts/ALERTS.pdf) | what reaches the phone, the health page, the outside check | written |
| **1** | [12-migration/MIGRATION.md](12-migration/MIGRATION.md) | [PDF](../pdf/design/12-migration/MIGRATION.pdf) | from today's desk to the design, step by step | written |

**Where it stands:** **every document in the tree is now written** — level 0 (the
trunk), level 1 (the blocks), level 2 (the parts) and level 3 (the documents
under `03-desk/tool/`). The level-0 and level-1 documents are under the trader's
review; levels 2 and 3 follow the same eight-part plan and carry the full detail
from `legacy/` and `archive/design-v1/`. Every document has a PDF in
[pdf/](../pdf), and [pdf/DESIGN.pdf](../pdf/DESIGN.pdf) holds them all in reading
order.

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
