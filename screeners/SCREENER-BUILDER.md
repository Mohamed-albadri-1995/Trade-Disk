# Screeners: how they are defined and run

What a screener is inside a tool today, how the **Screeners** tab builds one,
what is checked before it is saved, how a mirror is made, and how the
definitions are sent to TradingView. Written from
`src/sideA/screenerStore.js`, `tvScanner.js`, `tradable.js`,
`seedScreeners.js`, `screenerSummary.js`, `src/routes/screeners.js` and the
Screeners tab in `public/index.html`.

| For | Read |
|---|---|
| what each tool's screeners hunt for, and why | [METHODOLOGY.md](METHODOLOGY.md) |
| what happens to the matches after the scan | [DATA-PIPELINE.md](DATA-PIPELINE.md) |
| the tradability floor settings | [SETTINGS.md](SETTINGS.md) |
| the target design for the rebuilt builder | [IDEAS.md](IDEAS.md), part 2 |

---

## A screener is a row

Each tool keeps its screeners in its own database (table `screeners`). Tools
never share screeners.

| Field | Meaning |
|---|---|
| `key` | stable id, made from the name at creation (`ma-stack-breakout`). **It is stamped on every card the screener matches** (`screenerKeys`), so it never changes, not even on rename |
| `name` | what is shown; can be renamed freely |
| `filters` | the rules, a list of `{ left, operation, right }`: exactly the shape TradingView's own screener sends |
| `sort` | `{ sortBy, sortOrder }`, default change % high to low |
| `limit` | how many matches to take, default 50 |
| `runFrom`, `runTo` | the **run window** (New York time): the minutes it may scan. Empty = every scan |
| `checkFrom`, `checkTo` | the **check window**: when it is worth opening the tool. Empty = the run window |
| `mirrorOf` | the name of the screener this one mirrors |
| `labelOnly` | a **list** screener: its matches never become cards (below) |
| `enabled`, `pausedAt`, `pausedReason` | on/off, and when and why it was paused |

### A rule

`left` is a TradingView column, `operation` one of 15 operators, `right` a
number, a pair of numbers, or **another column**: that is what makes "price
above the 20-day EMA" or "SMA 5 above EMA 9" expressible.

A column can carry a timeframe after `|`: `EMA50|1` is the daily EMA 50,
`close|1W` the weekly close, `relative_volume_intraday|5` the 5-minute value.

**Operators:** is above, is above or equal, is below, is below or equal,
equals, does not equal, is between, is not between, crosses, crosses above,
crosses below, is above by %, is below by %, has, has none of.

**The 52 columns the builder offers:**

| Group | Columns |
|---|---|
| Price | close, open, day high, day low, change %, change from open %, gap %, VWAP |
| Averages | SMA 5, 20, 50, 200; EMA 9, 13, 20, 50, 120, 200 |
| Ranges | 1-month high/low, 3-month high/low, all-time high, 52-week high/low |
| Volume | relative volume (10-day), relative volume (5-minute), volume, average volume 10-day and 90-day, pre-market volume, pre-market change %, pre-market gap % |
| Size and short | market cap, float shares, short % of float, shares outstanding |
| Movement | ATR, performance week / month / 3-month / 6-month / year, RSI |
| Fundamentals (for CANSLIM) | EPS growth (latest quarter, last year, trailing 12 months), revenue growth (latest quarter, trailing 12 months), return on equity |
| Labels | sector, exchange |

TradingView silently **ignores a column it does not know**, which widens the
screener instead of failing. `node scripts/verify-tv-fields.js` checks every
offered column against TradingView.

---

## The Screeners tab

**The list** shows, per tool:

- when each screener runs, on a timeline, with the tool's capture minute
  ("learning moment") and why that time was chosen;
- the tradability floor, as one shared line ("applies to every screener",
  changed in Settings);
- each screener's rules in words, its window and its badges: **Paused**,
  **List only**, **Mirror of …**.

Each screener has **Rename**, **Mirror**, **Pause / Resume** and **Delete**.

**The editor** (+ New screener, or tap a screener):

| Field | |
|---|---|
| Name | e.g. "MA Stack Breakout" |
| Rules | "a stock must match all of them": field · condition · value, where the value is a number box or a column picker |
| Always added | the floor, shown read-only |
| Sort by, direction | the column that ranks the matches |
| Max results | the limit |
| Runs from / until (ET) | the run window |
| **Test on TradingView** | runs it now without saving (below) |

The check window, list-only and the mirror link are **not** in the editor:
they come from the seed definitions or the Mirror button.

---

## What is checked before saving

`validateDefinition()` refuses, with every reason listed:

- no name; no rules;
- a rule with an unknown column (the timeframe part is ignored when checking),
  an unknown operator or no value;
- "between" / "not between" without exactly two values;
- an unknown sort column;
- a run window with only one end, a time not in `HH:MM`, or a start not before
  its end.

Strict on purpose: a malformed rule sent to TradingView returns an empty list,
which looks exactly like "nothing matched today".

**Not checked** (see [IDEAS.md](IDEAS.md)): that the tool's capture minute
falls inside at least one screener's window (the D-S9 case), and that a rule
can match anything at all.

---

## Test

`POST /api/screeners/test` runs a definition **as it would really run**, the
floor included, without saving it. It answers:

- `count`: how many rows it would collect (capped at the limit);
- `totalCount`: how many stocks matched in total. **This is the number that
  shows how selective a rule is**: a rule that matches 4,000 stocks and one
  that matches 98 both "return 50";
- `ms`, and a sample of the first 10 matches.

---

## Mirrors

A mirror is the same setup facing the other way, used to test whether a
screener's direction is real ([IDEAS.md](IDEAS.md), part 3). **Mirror**
stores it as a new screener named "… (mirror)", linked by `mirrorOf`.

A mirror is **not** made by flipping every operator: a rule is either
directional or a quality guard.

| Rule | Mirrors to |
|---|---|
| a directional field (change, change from open, gap, pre-market change and gap, performance W/1M/3M/6M/Y) above a number | the operator flips **and** the number changes sign: `change > 5` → `change < −5` |
| a range on a directional field | negated: `3…10` → `−10…−3` |
| RSI (a 0–100 oscillator) | reflected around 50: `RSI > 70` → `RSI < 30`; a range is reflected too |
| a comparison of two columns | the operator flips and each side swaps to its counterpart: `close > 1-month high` → `close < 1-month low` (also 3-month, 52-week, day high/low) |
| anything else (price above $1, volume above 2M, cap, float …) | **unchanged**: it is a quality guard |
| equals, has, between on a non-directional field | unchanged |

The sort flips when it is on a directional field, so the mirror's strongest
matches sit at the top. The mirror keeps the same run and check windows,
because the pair must be measured over the same minutes.

`POST /api/screeners/preview-mirror` shows the mirror without saving it.

---

## Rename, pause, delete

- **Rename** changes the name only. The key stays, so last month's cards still
  point at the screener; any screener mirroring the old name is re-pointed.
- **Pause** stops it finding anything new. Nothing it found is touched: its
  cards keep its key and stay in every register and backtest. The pause time
  is set when it is paused, not on every save, so "paused since March" stays
  true while its rules are edited.
- **Delete** removes the row. Cards keep the key, but nothing then says what
  the key meant. Pausing is the safer choice.

---

## How a scan sends them

Every discovery scan ([MONITOR.md](MONITOR.md)) runs **every enabled screener whose
run window contains the current minute**, all at once (`tvScanner.js`). Each
becomes one request to TradingView's scanner
(`scanner.tradingview.com/america/scan`):

| Part | Value |
|---|---|
| `filter` | the screener's rules **plus the tradability floor** (`tradable.serverFilters`) |
| `filter2` | the base universe: common stocks, preferred stocks, depositary receipts, and funds that are not ETFs, mutual or closed-end funds; never pre-IPO |
| `columns` | the 32 columns every card is built from ([DATA-PIPELINE.md](DATA-PIPELINE.md)) |
| `sort`, `range` | the screener's sort, and `[0, limit]` |
| `markets` | `america` |

The floor is added at the server, not afterwards, because a screener asks for
its top N: filtering later would spend those N slots on stocks that were never
eligible. A local pass then drops what TradingView could not filter (ATR as %
of price).

Two exceptions:

| Screener | Floor |
|---|---|
| **list only** (`labelOnly`) | none: it decides membership of a list (e.g. a growth universe), not whether a stock can be day-traded today. Its matches go to `labels`, never to cards or registers |
| **neglected names** (keys `unexplained-move`, `unexplained-move-mirror`) | price floor only; the volume and dollar-ATR legs are dropped, because the setup is a stock nobody is trading yet |

**Checks on the answer:**
- if TradingView's columns come back misaligned, the screener returns
  nothing for that scan instead of shifting every field;
- if the week range equals the month range (or month equals quarter) on
  **every** one of at least 20 rows, an error is logged once: the columns are
  serving another window's values (one stock can do that, every stock cannot);
- a failed screener is logged and the others continue.

When no screener is due, the scan ends cleanly with nothing (a normal state
for most of the day on tools with windows).

---

## Where screeners come from

**Seeding.** On first start with an empty table, a tool is given the screener
set written for its id in `seedScreeners.js`. A tool with no set gets
**nothing** (not a copy of T1): an empty tool is visibly empty. Added tools
start empty and are built in the tab.

**Startup repairs.** On every start of a tool that already has screeners, a
series of keyed, one-time repairs run: renaming legacy keys, filling missing
run windows and check windows from the seed, repairing an old mirror,
tightening two T7 screeners, recording mirror links, re-timing T2's breakout,
installing replacement screeners (the old one is switched off and renamed,
never deleted), adding the CANSLIM universe list. Each is guarded so it runs
once, but see D-S10: some guards are "the field is empty", so a change you make
can be put back on the next restart.

---

## History and summaries

- `GET /api/screeners/history`: per screener, how many frozen R1 rows and days
  it has produced, and its last day. Says "error", never "no history", when
  it cannot read.
- `screenerSummary.js` turns the live rules into words for the `/screeners`
  page ("Price (close) above 1-month high · runs 09:30–10:30"), so a tool's
  description can never drift from what it actually runs.
- `GET /api/screeners/meta`: the fields and operators, from the validator's
  own lists, so the builder can never offer what the API would refuse.

---

## Found in this review

| # | What |
|---|---|
| D-S10 | Startup repairs run on every restart. Those guarded by "the field is empty" (default windows) or "the filter is missing" (T7's added rules, its limit capped at 25) **put back** a window you cleared or a rule you removed, without saying so |
| — | Definitions are not versioned: editing a rule changes what a key means for every past card (the rebuild rule in [IDEAS.md](IDEAS.md)) |
| — | The check window, list-only and mirror link cannot be set or changed in the editor |
