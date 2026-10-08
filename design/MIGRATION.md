# From today's desk to the new one

**Trunk section:** [§10 From today's desk to this one](../ARCHITECTURE.md#10-from-todays-desk-to-this-one).

How to get from the desk that runs today to the design, **without a rewrite and
without stopping the desk**.

**Status on 2026-10-08:** steps 1–14 are merged and deployed (§2a). They built
the data half of the design. The program half is steps 15–20 (§6). Each step ships on its own, keeps the desk working,
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
| 7 | **The research worker** | research data | the O'Neil chain leaves qp; facts with dates; new tickers covered within minutes; cards and the Market tab read facts | facts equal qp's files for a week; with qp stopped, cards and the tab unchanged | cards read qp's files again | medium |
| 8 | **One scheduler** | platform | every job as a row with run history and alerts; the systemd timer and pm2 cron retired | jobs run side by side for a week with identical results; a missed run alerts | the old schedulers again | medium |
| 9 | **Tools as rows** | tools, card, registers | one discovery engine for every tool; tool cards; R1 photos in the database; the archive retired; the benchmark (T9) restarted | per tool, R1 compared row by row for a week before its old process stops | per tool: restart the old process | the largest · per tool |
| 10 | **Learning rebuilt** | learning | the new model and the direction-aware scorecard; the legacy scoring code retired | walk-forward reports; the scorecard reproduces legacy numbers for bullish screeners | the old scorecard | medium |
| 11 | **The journal rebuilt** | journal | one pairing engine; fills, stops, fees; new parsers; snapshots from the fact store | every import case that failed now passes; legacy Alpaca trades re-derived and compared | the old journal (its database is kept) | medium |
| 12 | **Quant on the database** | quant | registers and facts read as of a day from the database; one fill model for alerts; alert history | past backtests re-run with identical trades; alert bars equal backtest bars | read over HTTP again | medium |
| 13 | **Backup and one-command restore** | platform | verified nightly dumps, Parquet, models; `desk restore`; monthly rehearsal | three monthly rehearsals pass before the old backup is retired | the old backup keeps running until then | medium |
| 14 | **One web shell** | platform | one origin, one app bar, phone first, ⓘ on every label | every page reachable from the bar | — | low |

Steps 1–4 are safe on their own and fix the known faults with the highest
cost. Steps 5–8 remove most duplicated work and risk. Step 9 is where the
per-tool memory cost goes away.

---

## 2a. Where each step stands (2026-10-08)

Merged in the server repository (pull requests #5–#21) and deployed to the box
on 2026-10-08. All eleven tools' history was imported into Postgres with
0 differences.

| # | Status | What was built | What is left |
|---|---|---|---|
| 1 | **done** | Jest and qp `run_all` on every pull request, with a Postgres 16 service | — |
| 2 | **built** | `desk-gateway` (one port, every program by path); `scripts/setup-domain.sh` (DuckDNS + Caddy HTTPS) | the trader sets up the domain and closes the other ports |
| 3 | **done** | capture times checked against the screeners' windows on save; startup repairs run once | T6's photo time: the trader's decision |
| 4 | **done** | one calendar (`src/calendar.js`); New York instants; jobs skip closed days and the hours after an early close | — |
| 5 | **in shadow** | the fact store (`facts`, `facts_latest`, `source_calls`, `fact_parity`) for short interest, borrow and news | switch on per family, if `source_calls` shows the tools share enough tickers |
| 6 | **in shadow** | one market read per scan (`market_states`), hot sectors persisted (`hot_sector_days`) | parity weeks, then on; then the two corrections of MARKET.md §5.4 |
| 7 | **in shadow** | `research/worker.py`: the O'Neil readings as dated facts; new tickers within minutes | parity, then on; the chain leaves qp's timer when `retire-old-schedulers.sh` runs |
| 8 | **partly** | every run recorded (`job_runs`), ntfy alerts on failed, missed or hung jobs, The Night (chain, then backup) on T1 | still one scheduler per tool: step 15 |
| 9 | **partly** | 9a: tools, versioned screeners, R1, R3, shortlist in Postgres, dual-written; 9b–9c: the discovery engine and its per-tool switch | the processes, the archive, tool cards, T9: steps 15–17. The engine saves no requests here (§5a) |
| 10 | **prepared** | the scorecard (Wilson intervals, direction-aware), the training set, an empty model slot | the model, when the trader chooses one: step 20 |
| 11 | **done, in part** | every broker file read as fills and paired by one engine (D-J1–D-J7 fixed) | stops, trade snapshots from the fact store |
| 12 | **partly** | alerts on the strategy's own fill model, alert history kept (live); registers from `/db/<tool>` (built, off) | facts "as of a day" for qp; past backtests re-run against the database |
| 13 | **done** | a verified Postgres dump in every nightly backup, `desk.js restore`, a monthly rehearsal | Parquet exports (the registers still go up as CSV) |
| 14 | **partly** | one origin through the gateway | phone-first pages and ⓘ on every label: step 19 |

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

*(Taken; their outcomes are in [the trunk's §11](../ARCHITECTURE.md#11-decisions-that-are-yours).)*

From the trunk ([§11](../ARCHITECTURE.md#11-decisions-that-are-yours)): where it
runs, Postgres or SQLite, a domain name, how far to go, and which push service
to use. Step 3 also needs one decision of its own: **T6's photo**. Either move
the photo after 11:30 (and its entries with it), or open its window earlier.


---

## 5a. What building steps 1–14 taught

1. **Measure a saving before building for it.** The discovery engine merges
   only byte-identical requests. This desk's tools all have different
   screeners, so it saves no TradingView calls, and while it compares it
   doubles them. It stays off (`discoveryMode off`) until desk-worker needs one
   scan loop (step 15).
2. **Fact sharing depends on overlap.** `source_calls` counts the requests
   against the real calls per family and day; each family is switched on, or
   left off, on those numbers.
3. **Shadow first was right.** The import found no difference, and the first
   deploy changed nothing the trader uses. It also meant the first steps gave
   little the trader could see. The program half must end each step with
   something visible.
4. **The visible gain is in the program half:** memory on the 1 GB box, a
   stopped tool that is just a row, and live pages.

---

## 6. Part 2: the program half (steps 15–20)

Asked for by the trader on 2026-10-08. The rules of §1 still hold: each step
ships on its own, is compared before the old part stops, and can be undone.

| # | Step | Changes | Parity check | Undo | Risk |
|---|---|---|---|---|---|
| 15 | **One desk-worker** | one Node process runs every tool's schedule: its screeners (the same requests as today), the card pipeline, the refresh, R1–R3 captures and the shortlist rule. A tool becomes a row: the per-process singletons (`TOOL_ID`, the database handle, the live list) become one context per tool | per tool, the worker's R1 photo equals the old process's, row by row, for a week, one tool at a time | per tool: start its old process again | the largest |
| 16 | **One desk-web** | one Node process serves every tool's pages and API under `/tools/T<n>/` (the gateway's paths); the archive is retired, as stopped tools are served from the record | every route of every tool returns the same JSON from desk-web as from the old process | the gateway points back at the per-tool processes | medium |
| 17 | **The record switched on** | `registersMode on` (Postgres becomes the record; the SQLite files are kept read-only for a month), `quantRegistersMode on`, `marketMode on`, and the fact families that earned it; qp reads facts as of a day | the parity pages clean for two weeks first | each switch back to shadow | medium |
| 18 | **Pages that use it** | a health page (jobs, sources, last backup, what is alerting), a scorecard page per tool and screener, live updates on open pages | each page against its API | additive | low |
| 19 | **Phone first, ⓘ everywhere** | every page readable on a phone; every label's ⓘ works by tap (CARD.md §5.6) | every page at 430 px wide | — | low |
| 20 | **The model** | when the trader chooses one (LEARNING.md §6) | a walk-forward Brier score better than the tool's base rate | the empty slot again | medium |

**Memory, the reason for 15 and 16.** Today the five tool processes and the
archive take about 70–95 MB each. Two programs replace six; the box keeps its
1 GB and gains the room the nightly peak needs.

**Left over from steps 1–14, and where it goes:** retiring the archive (16),
restarting T9 (after 15), tool cards (15), trade stops and snapshots (after 17),
facts as of a day for qp (17), Parquet exports (with 17), the market corrections
(after 17's market switch).
