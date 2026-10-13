# Trade Desk: documentation

The design of the Trade Desk, and the record of the desk as it runs today, from
which the design is built.

## Start here

**[ARCHITECTURE.md](ARCHITECTURE.md)** ([PDF](pdf/ARCHITECTURE.pdf)): the top
document. What the desk is, the whole desk in one picture, and each block of
that picture in a few lines.

**The whole design in one PDF:** [pdf/DESIGN.pdf](pdf/DESIGN.pdf), in reading
order.

## How this repository is organized

| Folder | Holds | State |
|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | the top document | written |
| [design/](design/README.md) | one numbered folder per block of the picture, in its order: the block's document, then the documents of its parts. Its README lists every document, its PDF and its state | blocks and level-2 parts written; level 3 to write |
| [pdf/](pdf) | a PDF of every design document, under the same names, and `DESIGN.pdf` with all of them | generated from the documents |
| [legacy/](legacy) | the desk as it runs today, documented from its code: the evidence the design is built on | complete |
| [archive/design-v1/](archive/design-v1/README.md) | the first design, replaced on 2026-10-08 | kept until the new design carries everything in it |

## The design, block by block

1. [ARCHITECTURE.md](ARCHITECTURE.md): the whole desk
2. [design/01-box/BOX.md](design/01-box/BOX.md): the server, its memory, the supervisor, the deploy, the secrets
3. [design/02-front-door/FRONT-DOOR.md](design/02-front-door/FRONT-DOOR.md): the one address, the one login, routing to each program
4. [design/03-desk/DESK.md](design/03-desk/DESK.md): the one program for every tool
5. [design/04-files/FILES.md](design/04-files/FILES.md): every file on the server and its one writer
6. [design/05-qp/QP.md](design/05-qp/QP.md): qp: charts, strategies, backtests, signal alerts
7. [design/06-research-worker/RESEARCH-WORKER.md](design/06-research-worker/RESEARCH-WORKER.md): the O'Neil research
8. [design/07-journal/JOURNAL.md](design/07-journal/JOURNAL.md): the trader's real trades
9. [design/08-data-sources/DATA-SOURCES.md](design/08-data-sources/DATA-SOURCES.md): every outside source
10. [design/09-shared-record/SHARED-RECORD.md](design/09-shared-record/SHARED-RECORD.md): the shared database
11. [design/10-backups/BACKUPS.md](design/10-backups/BACKUPS.md): backup and restore
12. [design/11-alerts/ALERTS.md](design/11-alerts/ALERTS.md): alerts to the phone, and the health page
13. [design/12-migration/MIGRATION.md](design/12-migration/MIGRATION.md): from today's desk to the design

The parts below each block: [design/README.md](design/README.md).

## About the legacy documents

Each legacy document says which code it was written from. Where the code and an
older document disagreed, the code was taken as the truth, and the disagreement
was recorded in that program's `KNOWN-ISSUES.md`.
