# The screener pages and tabs

Every screen of the screener suite: the suite page that lists the tools, the
comparison page, and the eight tabs inside each tool. Written from
`public/screeners.html`, `public/compare.html`, `public/index.html`,
`src/stages.js` and `src/sideF/globalShortlist.js`.

The screens with a document of their own are linked; the rest are described
here in full.

---

## How you move

```
/                      which program (the landing page: screeners, qp, journal)
/screeners             which screener tool          ← the suite page
:30x0/scanner          one tool, its eight tabs     ← the tool app
/screeners/compare     every screener judged side by side
/screeners/manage      add, stop, delete tools      → TOOL-LIFECYCLE.md
```

Every page carries the same top bar naming the programs, and a ☀ button for a
high-contrast mode readable outdoors.

---

## The suite page (`/screeners`)

Answers one question: **which tool should I open now?**

| Part | Shows |
|---|---|
| Now bar | which tools are worth opening right now; when none is, which one opens next and at what time (measured on the market's clock from a tool, not the phone's) |
| Tool cards, grouped by stage | **Validated**, **Under study**, **Collecting data**; an empty group still says it is empty |
| On each card | name and purpose; its check window ("Check 08:00–09:30") and whether it is live; how many cards it has today; whether its scorer is ready; a folded summary of its screeners in words, generated from the live rules; the tradability floor once, with list-only screeners tagged |
| Sleeping scanners | tools outside their windows |
| Manage tools → | `/screeners/manage` ([TOOL-LIFECYCLE.md](TOOL-LIFECYCLE.md)) |

The list of tools comes from `/api/tools`, so a tool added on Manage tools
appears with no change to the page. Each tool is then probed directly
(`/health`, `/api/registry/today`, `/api/analysis/status`) every 30 seconds; a
tool that is down still gets a card, saying it is down.

### Stages (`src/stages.js`)

| Stage | When |
|---|---|
| collecting data | fewer than **15** frozen R1 days |
| under study | 15 days or more |
| validated | **only by hand**: time does not make a screener good |

The committed verdict is the tool's `stage` in `tools.config.json`; a manual
override is kept in `data/tool-stages.json` (`POST /api/tools/:id/stage`,
`auto` removes it). Each stage says why it is what it is: override, declared,
or day count. The suite page is served by one tool and can count only its
own days, so the other tools fall back to their recorded verdict.

---

## The comparison page (`/screeners/compare`)

Every screener of every tool in one table, each tool's own scorecard
(`/api/analysis/screener-report`) fetched and merged. Runs on arrival, with
entry A or B.

- **The benchmark** is T9's *Stocks in Play*. A screener **beats** it when its
  good-move rate is at least **5 points** higher, **loses** when 5 points
  lower; between is a draw.
- **Mirror pairs** are read side by side:
  - directional: one side ahead by 5 points or more;
  - both sides work: both beat the benchmark, so it finds movers, not a
    direction;
  - neither side beats the plain list.
- Judged screeners first, then by good-move rate; a screener with too little
  data is listed but never ranked above one that has earned its place.

No page links to it any more; it is reached by its address. See D-S14: the
benchmark tool is stopped, so this page currently has no benchmark.

---

## Inside a tool

The header carries:

| Control | Does |
|---|---|
| ⚡ tool name ▾ | switches to another tool (each opens on its own port) |
| ▶ Run Scan | a full scan now; says "Tool is paused — no scan run" when paused |
| ☀ | high contrast |
| check badge | `● CHECK NOW · until 10:30 ET`, or `check 09:00–10:30 ET`, from the tool's screeners; refreshed every minute |
| status | the last scan's result |

### The eight tabs

| Tab | What it is | Document |
|---|---|---|
| **Screener** | today's cards, filters and sort | [CARD.md](CARD.md), [CARD-FIELDS.md](CARD-FIELDS.md) |
| **Market** | indexes, O'Neil model, regime, sectors, groups | [MARKET-TAB.md](MARKET-TAB.md) |
| **Shortlist** | below | — |
| **Warehouse** | below | [REGISTERS.md](REGISTERS.md) |
| **Analysis** | below | [SCORING-TODAY.md](SCORING-TODAY.md) |
| **Screeners** | the screener builder | [SCREENER-BUILDER.md](SCREENER-BUILDER.md) |
| **Settings** | every setting, the data check, backups | [SETTINGS.md](SETTINGS.md), [DATACHECK.md](DATACHECK.md) |
| **Monitor** | the jobs and the last scan | [MONITOR.md](MONITOR.md) |

The **Screener** tab loads its cards when the page opens, when you return to
the tab, and after **Run Scan**. It does not refresh by itself (D-S15), even
though the server re-quotes the cards every 5 minutes.

---

## The Shortlist tab

Your starred stocks, one list per day.

- A day picker (newest first) and, per stock: ticker, score, price, change,
  sector, **method** (`auto` from the auto-rule, `manual` from your ★), and
  when it was added.
- Tap a stock to open its full card for that day: today's live card, or the
  frozen R1 card for a past day (`/api/card/:ticker?date=`). If the stock was
  not on the tool that day, it says so and offers the last day it was.
- **✕ Remove** takes it off that day's list.
- **📋 Copy to TradingView** downloads the day's list as a `.txt` file for
  TradingView's watchlist import: one symbol per line, with its exchange
  (`NASDAQ:AAPL`). The day is then marked exported, with the time.

Starring is the ☆ on each card (`POST /api/shortlist/toggle/:ticker`). The
auto-rule adds the top cards by score one minute before R1
([SETTINGS.md](SETTINGS.md)); with the scorer off it adds nothing (D-D1).

### The unified shortlist

Every tool **publishes** its own day's list to `data/shortlist-all.json`
whenever it changes; the union is what every tool reads. It is a view, never
a filter: nothing on one tool changes because of another tool's stars. It
appears on cards as **★ also T2 T7** ([CARD.md](CARD.md)) and through
`/api/shortlist/all-tools` (and `/export` as a symbol list). There is no page
for it since the suite page's shortlist panel was removed (2026-09-04).

Each tool rewrites only its own entry, but the file is read, changed and
written back by many processes, so two tools publishing in the same instant
can drop one change until that tool's next publish (D-S13).

---

## The Warehouse tab

The registers, by date ([REGISTERS.md](REGISTERS.md) has every column).

| Control | |
|---|---|
| Register | R0 live, R1 the photo, R2 market snapshots, R3A / R3B end of day, R4A / R4B merged training rows, Shortlist |
| Date | the dates that have data (R0 always shows today) |
| Table | sortable, 50 rows a page, ◀ Prev / Next ▶ |
| ⬇ CSV, ⬇ JSON | download that register day |
| ⚡ Capture R3 | runs the end-of-day capture now |

---

## The Analysis tab

Two halves: judging screeners, and the scorer.

### Screener scorecard

**Which screeners find stocks that move.** No stop, target or exit: how far
each card ran after the entry minute, in ATR. Entry A or B.

| Column | Meaning |
|---|---|
| Cards, Days | the sample |
| Median R, Avg R | the typical move in the card's favour (`upR`) |
| Avg −R | the average move against it first (`downR`) |
| Days hit | share of days with at least one good move (≥ 1.3 ATR): **the consistency** |
| Verdict | **keep**: good-move rate ≥ 35 % **and** days hit ≥ 50 %; **watch**: rate ≥ 25 % **or** days hit ≥ 40 %; **drop**: neither; **not enough data**: under 20 cards or 5 days |

Above the table: the **tool baseline** (all rows pooled), the comparison that
matters, because tools sample different universes.

Read from the training rows (`r4a_train` / `r4b_train`), so it covers every
captured day. See D-S12: every screener is graded on the **upward** move,
including bearish ones.

### The scorer

| Panel | Does |
|---|---|
| Python Scorer Service | is the tool's scorer reachable, is a model trained |
| Train Model | retrains from every stored training row (daily captures and uploads, one per date and ticker) |
| Export R4A / R4B | writes a day's training CSV on the server |
| Upload External Training Data | adds rows from your own R4A / R4B CSV (append or replace) |
| Model Factors | the factor tables of a trained base (B1–B6), and a download of all of them |

How the scorer works, and why it should be replaced:
[SCORING-TODAY.md](SCORING-TODAY.md). Some help text on this tab is out of date
(D-S11).

---

## Found in this review

| # | What |
|---|---|
| D-S11 | The Analysis tab still says "Service (port 3001)" (true for T1 only; each tool's scorer is on its port + 1), "start service on EC2: `python3 server.py`" (it runs under pm2), and that training means exporting CSVs and running `processor.py` by hand (the Train button does it). The Warehouse picker says "R1 — Frozen 9:36" for every tool |
| D-S12 | The scorecard grades every screener on `upR`, the move **up**. A bearish screener (most mirrors) is graded on how far its stocks rose, so its verdict is backwards |
| D-S13 | The unified shortlist file is read, changed and written by many processes; simultaneous publishes can lose one tool's change until its next publish |
| D-S14 | The benchmark (T9, Stocks in Play) is stopped. The archive answers only `/api/warehouse/*`, not `/api/analysis/screener-report`, so the comparison page has **no benchmark**, and every stopped tool's screeners are missing from it |
| D-S15 | The Screener tab does not refresh by itself; the cards on screen are as old as the last page load, tab switch or Run Scan |
