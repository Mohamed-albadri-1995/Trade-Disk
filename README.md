# Trade Desk: documentation

The design of the Trade Desk, and the record of the desk as it runs today, from
which the design is built.

## Start here

**[ARCHITECTURE.md](ARCHITECTURE.md)** ([PDF](pdf/ARCHITECTURE.pdf)): the whole
desk in one picture. It is the trunk of the design tree: every other design
document hangs below it, one per block, then one per part.

**The whole design in one PDF:** [pdf/DESIGN.pdf](pdf/DESIGN.pdf), in the order
of the tree.

## How this repository is organized

| Folder | Holds | State |
|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | the trunk: the whole desk, its blocks, how they share data, a trading day, the rules, the box, status, decisions, risks | written |
| [design/](design/README.md) | the tree below the trunk: one document per block, then one per part. Its README lists every document, its PDF and its state | blocks written; parts to write |
| [pdf/](pdf) | a PDF of every design document, in the same tree, and `DESIGN.pdf` with all of them | generated from the Markdown |
| [legacy/](legacy) | the desk as it runs today, documented from its code: [screener tools](legacy/screeners/README.md), [qp](legacy/qp/README.md) (with its indicator library's code), [journal](legacy/journal/README.md), [today's architecture](legacy/architecture/ARCHITECTURE.md) | complete |
| [archive/design-v1/](archive/design-v1/README.md) | the first design (two programs, one document per domain), superseded on 2026-10-08 | kept until the tree carries everything in it |

## The tree

- [ARCHITECTURE.md](ARCHITECTURE.md): the whole desk
  - [design/01-box/BOX.md](design/01-box/BOX.md): the machine, the supervisor, the deploy, the secrets
  - [design/02-front-door/FRONT-DOOR.md](design/02-front-door/FRONT-DOOR.md): the address, TLS, routing, the one login
  - [design/03-desk/DESK.md](design/03-desk/DESK.md): one program for every tool
  - [design/04-files/FILES.md](design/04-files/FILES.md): every file on the box and its one writer
  - [design/05-qp/QP.md](design/05-qp/QP.md): qp
  - [design/06-research-worker/RESEARCH-WORKER.md](design/06-research-worker/RESEARCH-WORKER.md): the O'Neil facts
  - [design/07-journal/JOURNAL.md](design/07-journal/JOURNAL.md): every real trade
  - [design/08-data-sources/DATA-SOURCES.md](design/08-data-sources/DATA-SOURCES.md): every outside source
  - [design/09-shared-record/SHARED-RECORD.md](design/09-shared-record/SHARED-RECORD.md): the shared record
  - [design/10-backups/BACKUPS.md](design/10-backups/BACKUPS.md): backup and restore
  - [design/11-alerts/ALERTS.md](design/11-alerts/ALERTS.md): alerts and the health page
  - [design/12-migration/MIGRATION.md](design/12-migration/MIGRATION.md): from today's desk to the design

The parts below each block: [design/README.md](design/README.md).

## About the legacy documents

Each legacy document says which code it was written from. Where the code and an
older document disagreed, the code was taken as the truth, and the disagreement
was recorded in that program's `KNOWN-ISSUES.md`.
