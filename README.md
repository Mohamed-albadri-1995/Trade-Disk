# Trade Desk: documentation

The design of the Trade Desk as it should be built, and the full record of
the desk as it runs today, from which that design is built.

## Start here: the trunk

**[ARCHITECTURE.md](ARCHITECTURE.md)** ([PDF](pdf/ARCHITECTURE.pdf)) is the
whole desk in one document: what it is for, the ten domains, the running
parts, the data, each domain's design, a trading day end to end, the rules
that apply everywhere, deployment, backup and restore, and the migration.

Every other document is a leaf of one of its sections. Its
[document map](ARCHITECTURE.md#12-the-document-map) lists them all.

## The two kinds of leaf

| Folder | Holds | State |
|---|---|---|
| [design/](design/README.md) | the new design, one document per domain. Each carries the old design in full (every field, source and calculation), what failed, the new design and its contracts | written one by one |
| [legacy/](legacy/) | the desk as it runs today, documented from its code: [screener tools](legacy/screeners/README.md), [qp](legacy/qp/README.md) (with its indicator library's code), [journal](legacy/journal/README.md), [today's architecture](legacy/architecture/ARCHITECTURE.md) | complete |

Each legacy document says which code it was written from. Where the code and
an older document disagreed, the code was taken as the truth, and the
disagreement was recorded in that program's `KNOWN-ISSUES.md`.
