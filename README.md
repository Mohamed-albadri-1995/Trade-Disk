# Trade Desk: documentation

The full description of the Trade Desk, written from its code
(`Tade-desk-server`) so it can be read by a person and used to build a better
version from scratch.

The desk is three programs on one box:

| Program | Does | Documents |
|---|---|---|
| **Screener tools** | watch the market through TradingView screeners, build a card per stock, freeze a daily photo, measure what moved | [screeners/](screeners/README.md) |
| **qp** | charts, strategies and backtests on the stocks the tools found; builds the O'Neil/CANSLIM data | next phase |
| **Journal** | every trade after the fact: imports, P&L, statistics | after qp |

How the programs connect, the login, backups, deployment and the landing page
come last, once each program is documented on its own.

## Phases

1. **Screener tools**: done, in [screeners/](screeners/README.md).
2. qp, with its indicator library.
3. The journal.
4. The links between the programs and the system-wide pages.

Each document says which code it was written from. Where the code and a
document disagreed, the code was taken as the truth and the disagreement was
recorded in that program's `KNOWN-ISSUES.md`.
