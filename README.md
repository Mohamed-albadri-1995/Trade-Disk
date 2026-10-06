# Trade Desk: documentation

The full description of the Trade Desk, written from its code
(`Tade-desk-server`) so it can be read by a person and used to build a better
version from scratch.

The desk is three programs on one box:

| Program | Does | Documents |
|---|---|---|
| **Screener tools** | watch the market through TradingView screeners, build a card per stock, freeze a daily photo, measure what moved | [screeners/](screeners/README.md) |
| **qp** | charts, strategies and backtests on the stocks the tools found; also hosts the O'Neil computations that fill the screener cards and the Market tab | [qp/](qp/README.md), with the library's code |
| **Journal** | every trade after the fact: imports, P&L, statistics | next phase |

How the programs connect, the login, backups, deployment and the landing page
come last, once each program is documented on its own.

## Architecture

| Document | |
|---|---|
| [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) ([PDF](architecture/pdf/ARCHITECTURE.pdf)) | the desk as it runs today: the three programs, what they share, where everything lives |
| [architecture/REBUILD-ARCHITECTURE.md](architecture/REBUILD-ARCHITECTURE.md) ([PDF](architecture/pdf/REBUILD-ARCHITECTURE.pdf)) | the desk as it would be built from the beginning: principles, target design, migration steps |

The documents have their PDFs beside them: [screeners/pdf/](screeners/pdf/),
[qp/pdf/](qp/pdf/).

## Phases

1. **Screener tools**: done, in [screeners/](screeners/README.md).
2. **qp**, with its indicator library: done, in [qp/](qp/README.md).
3. The journal.
4. The links between the programs and the system-wide pages.

Each document says which code it was written from. Where the code and a
document disagreed, the code was taken as the truth and the disagreement was
recorded in that program's `KNOWN-ISSUES.md`.
