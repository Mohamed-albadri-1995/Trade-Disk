# From today's desk to the new one

**Trunk section:** [§10 From today's desk to this one](../ARCHITECTURE.md#10-from-todays-desk-to-this-one).

How to get from the desk that runs today to the design, **without a rewrite and
without stopping the desk**. Each step ships on its own, keeps the desk working,
is checked against the old desk before the old part is switched off, and can be
undone.

**Built on:** [the earlier rebuild draft](../legacy/architecture/REBUILD-ARCHITECTURE.md),
the legacy known issues ([screeners](../legacy/screeners/KNOWN-ISSUES.md),
[qp](../legacy/qp/KNOWN-ISSUES.md), [journal](../legacy/journal/KNOWN-ISSUES.md)), and
the "how the rebuild is proven" section of every design leaf.

---

## 1. The rules of the migration

1. **The old desk keeps running** until the new part has matched it for a set
   period (a week, unless stated).
2. **Compare, then switch.** Every step has a parity check against the old
   desk; differences are explained (a fixed fault) or fixed.
3. **One step at a time**, each a pull request through CI.
4. **Reversible.** Each step says how to go back.
5. **The research record is sacred.** No R1, R3 or shortlist row of any tool,
   running or archived, is lost; every import is checked by row counts.

---

## 2. The steps

| # | Step | Domain(s) | Changes | Parity check | Undo | Risk |
|---|---|---|---|---|---|---|
| 1 | **CI** | platform | every test (Jest, qp `run_all`) runs on every pull request; red blocks a merge | a failing test blocks | remove the workflow | none |
| 2 | **One front door** | platform | Cloudflare Tunnel or Caddy with TLS; the same login; every other port closed | outside port scan shows only 443; every page works through the door | reopen the ports | low · needs a domain |
| 3 | **Checks on save** | tools | capture vs windows; `r1 < A < B`; tested selectivity; fix D-S9 (move T6's photo after 11:30, or its window earlier) and D-S10 (startup repairs) | T6's current setting refused | revert | low |
| 4 | **Trading calendar and real instants** | platform, journal, registers | one calendar; UTC instants; fixes D-J8, D-J10, D-J12 in the current journal and qp's chart link | a June morning trade's bars and marks land right | revert | low |
| 5 | **The database and the fact store** | platform, sources, card | Postgres (or SQLite, one writer per file); the adapters; tools read short interest, borrow and news from the shared facts | cards from old and new paths compared field by field for a week; calls per ticker fall to one | tools read their own fetches again | medium |
| 6 | **The market engine** | market | one market state per scan for every tool; hot state persisted; the sector map completed | regimes, stages and scores equal the old tools' for a week (before the corrections) | tools compute their own again | low–medium |
| 7 | **The research worker** | research data | the O'Neil chain leaves qp; facts with dates; cards and the Market tab read facts | facts equal qp's files for a week; with qp stopped, cards and the tab unchanged | cards read qp's files again | medium |
| 8 | **One scheduler** | platform | every job as a row with run history and alerts; the systemd timer and pm2 cron retired | jobs run side by side for a week with identical results; a missed run alerts | the old schedulers again | medium |
| 9 | **Tools as rows** | tools, card, registers | one discovery engine for every tool; tool cards; R1 photos in the database; the archive retired; the benchmark (T9) restarted | per tool, R1 compared row by row for a week before its old process stops | per tool: restart the old process | the largest · per tool |
| 10 | **Learning rebuilt** | learning | the new model and the direction-aware scorecard; scorer processes retired | walk-forward reports; the scorecard reproduces legacy numbers for bullish screeners | the old scorecard | medium |
| 11 | **The journal rebuilt** | journal | one pairing engine; fills, stops, fees; new parsers; snapshots from the fact store | every import case that failed now passes; legacy Alpaca trades re-derived and compared | the old journal (its database is kept) | medium |
| 12 | **Quant on the database** | quant | registers and facts read as of a day from the database; one fill model for alerts; alert history | past backtests re-run with identical trades; alert bars equal backtest bars | read over HTTP again | medium |
| 13 | **Backup and one-command restore** | platform | verified nightly dumps, Parquet, models; `desk restore`; monthly rehearsal | three monthly rehearsals pass before the old backup is retired | the old backup keeps running until then | medium |
| 14 | **One web shell** | platform | one origin, one app bar, phone first, ⓘ on every label | every page reachable from the bar | — | low |

Steps 1–4 are safe on their own and fix the known faults with the highest
cost. Steps 5–8 remove most duplicated work and risk. Step 9 is where the
per-tool memory cost goes away.

---

## 3. Importing the old data

Done once, at step 9 for each tool (step 11 for the journal, step 12 for qp),
following the map in [DATA-MODEL.md](DATA-MODEL.md) §4:

| Source | Into | Check |
|---|---|---|
| each tool's `r1_frozen`, `r3a`, `r3b`, `shortlist`, `screeners`, `settings`, `scheduler_jobs` (running and archived tools) | `r1_photos`, `r3_outcomes`, `shortlist`, `screeners` + version 1, `settings`, `jobs` | row counts per tool, register and day; a sample of rows compared field by field |
| `r4a_train` / `r4b_train` uploads | `r4_uploads` | row counts |
| each tool's `r2_market_snapshots` | `market_states` (old days) | row counts |
| `data/oneil-*.json`, `industry-map.json` | `facts` as of their dates | counts per family |
| `~/.qp/platform.db` | `strategies`, `strategy_versions`, `backtests`, `backtest_trades` | counts; a re-run of a sample of backtests |
| `data/journal/journal.db` | `accounts`, `fills`, `trades`, `setups`, `day_notes` | counts; Alpaca trades re-derived and compared |

Old rows that lack something the new schema records (screener versions, a
market state id, an O'Neil status frozen at the time) are imported with that
field marked **unknown**, never guessed.

---

## 4. What stays exactly as it is

- The research method: one photo a day per tool, entries A and B, outcomes in
  ATR, the 1.3 good-move line, the benchmark, the mirrors.
- Every card field, every Market-tab section, every source and its fallback
  order: their home changes, their content does not.
- Each tool's results, model and history isolated from every other.
- "A label, never a filter" for every shared fact.
- The O'Neil method as built; quant's verified library and engine.
- The one password and the nightly backup to R2, until their replacements have
  proven themselves.

---

## 5. Decisions needed before starting

From the trunk ([§11](../ARCHITECTURE.md#11-decisions-that-are-yours)): where it
runs, Postgres or SQLite, a domain name, how far to go, and which push service
to use. Step 3 also needs one decision of its own: **T6's photo**. Either move
the photo after 11:30 (and its entries with it), or open its window earlier.
