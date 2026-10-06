# Methodology

What each tool hunts for, why its filters are what they are, and how it is
measured. One file, kept next to the code it describes.

Every tool runs the same software against different screeners. Each has its
own database, its own model and its own training history — nothing is shared,
so one tool's results cannot contaminate another's.

Eleven tools are registered (`tools.config.json` is the source of truth).
**Five run today**; the rest are **archived** — stopped, with their stored
registers still served read-only on their own ports, so qp can chart and
backtest everything they collected.

| Tool | Name | Status | Port |
|---|---|---|---|
| T1 | Swing trades after huge volume | running — the control | 3000 |
| T2 | Momentum | running | 3010 |
| T3 | Gappers | archived | 3020 |
| T4 | VWAP Reclaim | archived | 3030 |
| T5 | 20-Day Break | archived | 3040 |
| T6 | Unexplained Move | running | 3050 |
| T7 | Liquid Movers | running | 3060 |
| T8 | CANSLIM | archived — split into T10 and T11 on 2026-09-04 | 3070 |
| T9 | Stocks in Play | archived — the benchmark | 3080 |
| T10 | Growth Stock Breakout | archived (stopped 2026-09-21) | 3110 |
| T11 | Growth Stock Pullback | running | 3120 |

Run windows below are the shipped defaults; a window edited in the screener
builder on the box wins over them.

---

## What applies to everything

### The tradability floor

Four conditions are added to **every screener on every tool**, existing and
future, at the moment a scan is sent. They are not in any screener's rule list
because they are not in any screener — the scanner appends them on the way out.

| Rule | Why |
|---|---|
| price ≥ $1 | Below this the spread eats the trade. |
| average volume ≥ 1M shares/day | Below this you cannot get out at a price you chose. |
| ATR ≥ $1 | Below this there is not enough movement to pay for the risk. |
| ATR ≥ 3% of price | The same question relative to the stock. A $200 name with a $2 ATR clears the dollar test easily and still has only 1% of range to work with. |

Two deliberate exceptions. **T6's Unexplained Move** keeps the price floor and
drops the volume and both ATR legs: it hunts neglected names, where an
unexplained move happens and reverses. **T8's CANSLIM Universe** is label-only
(its matches never become cards), so it takes no floor.

Editable in **Settings** — `minPrice`, `minAvgVolume`, `minAtr`, `minAtrPct`.
Setting one to 0 switches that leg off. Changing it changes every screener at
once, which is the point of it living in one place.

### How success is measured

There is **no stop, no target and no exit**. This is on purpose: the question
being asked is "does this screener find stocks that move", which is the only
thing a screener can be held responsible for. Whether a move is tradable is a
question about setups, and comes after you know which screeners are worth
keeping.

For every card, at the end of the day:

```
entry = the OPEN of the entry-minute bar
hh    = highest high from that bar to the close
ll    = lowest low  from that bar to the close

upR   = (hh − entry) / ATR14      how far it ran your way
downR = (entry − ll) / ATR14      how far it went against you first
```

Both are positive numbers. ATR14 is built from daily bars **strictly before
today**, so nothing looks ahead. Bars are regular session only — pre-market and
after-hours spikes cannot inflate a result.

The **opening range** (09:30–09:35 high and low) is recorded for every card on
every tool, whether or not that tool trades it. The bars are already fetched, and
those two levels are the trigger for the one day-trading setup with published
evidence behind it — a month of data collected without them could not be asked
the question afterwards.

Two more things are recorded on every card so the month can be asked about them
later: **when it was found**, as minutes from the opening bell (negative before
it), and whether **another tool had shortlisted it**. Both reach r1 and r4, so
the scorecard and the model can use them.

> One caveat on the discovery time: cards captured before it existed have none,
> and the trainer fills a missing number with zero — which on this scale reads
> as "found exactly at the bell". Only rows from before this change are
> affected, and they are a shrinking minority as the month fills in. Nothing
> else uses zero as a real value here.

A **good move** is `upR ≥ 1.3`. The same threshold the model calls a win, so the
scorecard and the model are not grading on different curves.

Worked example — entry $10, high $12.50, low $9.40, ATR $1:
**upR 2.5, downR 0.6.**

### The learning moment

Each tool takes **one photo a day** of every card on screen, then measures how
far each ran from two entry times shortly after. Photo plus result is one
training row — the only thing the score model ever learns from.

A stock found after the photo still shows on screen and can be traded, but it
teaches the model nothing. The photo time therefore follows each tool's own
session, and always lands one minute after one of that tool's discovery scans,
so it freezes a fresh registry rather than the previous scan's.

### Discovery vs refresh

A screener's run window gates **discovery only** — whether new candidates are
added. Cards already on screen keep re-quoting every five minutes from 04:00 to
16:00 regardless, because a card found at 09:40 is still being watched at 15:00
and its price, VWAP, distances and tags have to keep up with the tape.

### Mirrors

Most tools ship a screener and its **mirror** — the same structural setup facing
the other way — so a month of data can answer "is this edge directional, or does
this screener just find movers?".

Mirroring is not blind operator inversion:

- **Directional rules flip sign**: `change > 5` becomes `change < −5`.
- **High/low pairs swap to their counterpart**: `close ≥ 1-month high` becomes
  `close ≤ 1-month LOW`. Inverting only the operator would give "below the
  monthly high", true of nearly every stock, screening for nothing.
- **Bounded oscillators reflect**: `RSI > 70` becomes `RSI < 30`, not `RSI < 70`.
- **Quality guards survive untouched**: `price > $1`, `volume > 2M`. Inverting a
  guard selects illiquid junk, not the bearish counterpart of the setup.

---

## T1 — Swing trades after huge volume · port 3000

**The control.** The original tool, and the only one with history: a month of
cards, the model trained on them, and the one edge measured out of them so far.

### Screeners — all three run all day

**Trend** — intraday trend continuation.

```
close ≥ 20                          established price, not a penny stock
close ≥ SMA5   and  close ≥ VWAP    above the short average and the day's average price
close|1W > VWAP|1W                  above the weekly VWAP
close|1M > VWAP|1M                  above the monthly VWAP
EMA50|1 > EMA120|1                  daily trend is up
close|1 ≥ EMA50|1                   holding the daily trend line
VWAP ≥ SMA75|5                      intraday VWAP above the 5-minute 75 average
relative_volume_intraday|5 > 3      volume arriving right now
relative_volume_10d_calc > 1.5      and elevated for the day
average_volume_90d_calc > 1M        liquid
```

Alignment across every timeframe at once — day, week, month, and the last few
minutes.

**Pre-Mkt** — pre-market participation.

```
premarket_volume > 1.5M      real pre-market trade, not an indication
relative_volume_10d_calc > 3
average_volume_10d_calc > 2M
close ≥ 1
```

**Big Move** — the crude one, and it works.

```
relative_volume_10d_calc > 10     ten times normal volume
close ≥ 2
average_volume_10d_calc > 2M
```

### Why T1 has no run windows

Pre-Mkt is built on `premarket_volume`, which stops moving at the bell — its
filters plainly say "pre-market only". It is still left running all day, on
purpose.

The one edge measured so far is the **overlap between Big Move and Pre-Mkt**:
54% of those cards made a good move against 13% for everything else
(Fisher p = 0.0015, spread over 11 days, survives dropping the two biggest
winners). That overlap is read off the cards frozen at 09:36. Giving Pre-Mkt the
window its filters suggest would stop it running in the 09:30–09:36 scans and
strip the Pre-Mkt tag off every frozen row — deleting the measurement rather
than improving it.

T1 stays exactly as it was, so the other tools have something to be compared
against.

**Capture:** photo 09:36, entries 09:37 / 09:40.

---

## T2 — Momentum · port 3010

**Looking for:** a stock in a clean daily uptrend breaking to a new monthly high.

```
SMA5|1 > EMA9|1 > EMA13|1 > EMA20|1     daily averages stacked fast-over-slow
close ≥ High.1M                          breaking the 1-month high
close ≥ 1
average_volume_10d_calc > 500K
```

**Why these filters.** The stack is a statement about the daily trend: each
faster average above the slower one means every recent period has been stronger
than the one before it. On its own that only says the stock has been rising —
the monthly-high break is what makes it an event rather than a description.

The stack barely moves intraday, so what the screener is really timing is the
break.

**Mirror:** stack inverted, `close ≤ Low.1M`. Breakdown from a downtrend.

**Window 09:00–10:00** (retimed on the trader's instruction; it ran 09:30–15:00,
then 09:30–12:00). Momentum positions here are closed by 10:30, so anything
found after 10:00 is a candidate nobody can take — it would fill the list and
train the model on setups nobody traded. Starting at 09:00 puts the list on
screen while there is still time to read it before the open.

**Capture:** photo 09:46, entries 09:47 / 09:51 — fifteen minutes past the open,
so a break that was one opening spike has already failed and is not in the
photo.

---

## T3 — Gappers · port 3020 (archived)

**Looking for:** a small-float stock gapping up on real pre-market volume.

```
premarket_change > 5                      gapping up at least 5%
premarket_volume > 500K                   people actually traded it
relative_volume_10d_calc > 2
close ≥ 1
float_shares_outstanding < 50M            small float
```

**Why these filters.** A gap with no pre-market volume is a quote, not a move —
it can vanish at the bell. The float cap is the deliberate part: a small float
is what lets a gap keep extending after the open, because there is not much
stock available to sell into the buying.

**Mirror:** `premarket_change < −5`, everything else identical. Gap down.

**Window 04:00–10:30.** `premarket_change` and `premarket_volume` freeze at the
bell — after that they are yesterday's numbers. Left running all day this
screener would re-report the same names until the close and none of it would be
new. It gets the pre-market plus the first hour, where a gap either continues or
fails.

**Capture:** photo 09:36, entries 09:37 / 09:40 — a gap is an opening trade.

---

## T4 — VWAP Reclaim · port 3030 (archived)

**Looking for:** a stock that sold off, then pushed back up through VWAP with
volume behind it. **The reversal tool.**

```
close crosses_above VWAP                  the reclaim itself
relative_volume_10d_calc > 2              volume behind it, not drift
close ≥ 1
average_volume_10d_calc > 1M
```

**Why these filters.** VWAP is where the average buyer of the day is even.
Crossing back above it flips that group from losing to winning, which is why
reclaims tend to run. Without the volume condition the cross is drift, and drift
across VWAP reverses as easily as it holds.

**Mirror:** `crosses_below`. The loss of VWAP.

**Window 09:45–15:30.** This is the tool that deliberately stays awake into the
afternoon, because reversals come late — the "move first, then reverse" case. It
starts at 09:45 rather than the bell because VWAP computed off the first few
prints is not yet a level anything is reclaiming, and stops at 15:30 because a
reclaim in the last half hour has no session left to resolve in.

**Capture:** photo 10:01, entries 10:02 / 10:06.

**Known limitation:** a cross is a moment, and discovery runs every 15 minutes
after 10:00. Some crosses will be missed between scans.

---

## T5 — 20-Day Break · port 3040 (archived)

**Looking for:** a break of the 20-day high — or, on the mirror, the 20-day low.

```
close ≥ High.1M                    at or through the one-month (~20-day) high
relative_volume_10d_calc > 1.5
close ≥ 1
average_volume_10d_calc > 500K
```

**Why these filters.** A month of range is a level people can see and have
traded against. It replaced the 52-week break (below), a level almost nothing
reaches on a given morning: that screener produced one frozen day in the whole
archive, and a screener that fires once a month cannot be measured.

**The news half is not a screener column.** TradingView returns a universe;
the catalyst is fetched per ticker afterwards and lands on the card. "With
supporting news" is a card filter on the setup (catalyst is not empty).

**Mirror:** `close ≤ Low.1M`. The support break, not "below the 20-day high".

**Window 09:30–16:00.** A month's range breaks on flow that arrives at any
hour, often late. Pre-market is excluded: a 20-day high printed on a handful of
thin shares is not a break.

**Kept, switched off — 52-Week Break:** `close ≥ price_52_week_high`,
`market_cap_basic > $1B`, `relative_volume_10d_calc > 1.5`,
`average_volume_10d_calc > 1M`. Kept so the days it produced stay attributable
to the definition behind them.

**Capture:** photo 09:46, entries 09:47 / 09:51.

---

## T6 — Unexplained Move · port 3050

**Looking for:** a stock that moved 15% in two hours with **no news behind it**,
expected to correct back. **The only mean-reversion setup on the desk** — every
other tool is looking for a move to continue.

```
change > 10        moved a lot today — a wide net, not the rule
close ≥ 1          a spread on a $0.30 stock eats the whole move
```

**The real rules run after the scan** (`src/sideA/preR0.js`), because the
scanner cannot express them:

- **The move is a rate:** at least **15% over a rolling 120 minutes** ending
  now, from intraday bars. TradingView's `change|120` is the change of a fixed
  120-minute candle (09:30–11:30, 11:30–13:30…), so it measures a different
  span depending on the clock and splits a move that straddles a boundary.
- **No news:** a card with any catalyst is dropped. Without this the screener
  returns every 15% mover, which is mostly news — the opposite of the idea.
- **The six-month trend is a safety layer, facing the other way:** a spike up
  is refused when the six months were clearly rising; a drop is refused when
  they were clearly falling. Read from daily closes that stop before the move —
  every TradingView trend column ends at today's price, so the move would land
  inside the measure meant to be independent of it.

**No volume or ATR floor** — only the $1 price floor stays (a spread on a
$0.30 stock eats the whole move). It hunts neglected names: a stock nobody
trades is exactly where an unexplained move happens and then reverses.

**Known blind spot:** a stock down 10% in the morning and up 15% since lunch is
flat on the day and does not pass the net, though it is the setup.

**Mirror:** `change < −10`; the same post-scan rules, facing down.

**Window 11:30–16:00.** Two hours of session must exist to measure the move.

**Kept, switched off — Overextended:** `RSI > 70`, `close ≥ EMA20`,
`relative_volume_10d_calc > 3`, `close ≥ 1`, `average_volume_10d_calc > 1M`
(mirror `RSI < 30`, `close ≤ EMA20`), window 10:00–16:00.

**Capture:** photo 10:16, entries 10:17 / 10:21 — inherited from Overextended.
That photo is taken **before this screener's 11:30 window opens**; see D-S9 in
[KNOWN-ISSUES.md](KNOWN-ISSUES.md).

---

## T7 — Liquid Movers · port 3060

**Looking for:** heavy real volume and real range, split by session. The only
tool that refuses thin stocks outright rather than as a side effect.

Its two screeners are **not** a mirror pair. Each is a complete setup for its own
session, and the sessions do not overlap, so a stock lands in one or the other.

**Pre-Market Gap** — 04:00–09:30

```
gap not between −3% and +3%           moving either way, at least 3%
ATR ≥ $1
average_volume_90d_calc ≥ 2M          normally liquid
premarket_volume > 1M                 and trading TODAY, not just quoted
close > $5                            the evidence-backed price floor
```

Direction-agnostic on purpose. TradingView has no absolute-value operator, so
"gap up or down 3%" is written as "outside −3%..+3%", which is the same set.

**After Open Volume** — 09:30–16:00

```
average_volume_10d_calc > 5M          a big liquid name — fixed all day
relative_volume_intraday|5 > 3        volume arriving NOW, measured against what
                                      this time of day usually does
volume > 10M shares                   the source recipe's condition, kept
change not between −3% and +3%        and actually moving
close > $5                            ten million shares of a $1.50 stock is
                                      $15M — a penny-stock frenzy, not liquidity
```

**On the ten-million-share rule.** `volume` is *cumulative shares traded so far
today* — zero at the bell, largest at the close — so as the only real condition
it was impossible in the morning and trivial by the afternoon, and the list
could only grow. It is kept, because it is the condition the source recipe asks
for, but it no longer carries the screener alone: a name must also be big
(a fixed ten-day average), moving 3%, and taking unusual volume *in the current
five minutes*. Those three mean the same at 09:40 as at 15:40.

The side effect is that this screener is naturally quiet early on — at 10:00
very few stocks have traded ten million shares. That is correct rather than a
fault: the rule asks what *has* traded, and at 10:00 the honest answer is "not
much yet".

`relative_volume_10d_calc` was removed outright, and that one is not a
judgement call: it divides day-to-date volume by a *full-day* average, so no
threshold makes it mean one thing all session, and unlike the ten-million rule
it is nobody's stated requirement.

Both take the **top 25**, not 50.

**Why these filters.** `volume` rather than average volume is the distinctive
choice: it asks what has traded *today*, so the screener only fires once real
participation has shown up.

**What was wrong with it.** This tool returned 75 names in a day, which is not a
short list of liquid movers. Four reasons, all now fixed.

The largest was the one above: both of its volume rules grew through the
session, so the list could only get longer. The price floor was
$1, so ten million shares of a $1.50 stock qualified — fifteen million dollars,
a penny-stock frenzy rather than liquidity; at $5 the same share count is fifty
million, and $5 is the one price floor in the research with published evidence
behind it. The gap screener asked only that a stock is *normally* liquid, never
that anything traded in the pre-market — a gap with no trade behind it is a
quote that can vanish at the bell. And each screener took the top 50 when the
evidence-backed recipe takes the top 20.

**Capture:** photo 09:36, entries 09:37 / 09:40. The pre-market screener is what
feeds training here — its candidates are all in by the bell. The after-open
screener finds tradable stocks all day, but they arrive after the photo and do
not train the model.

---

## T8 — CANSLIM · port 3070 (archived)

> **Retired.** Split on 2026-09-04 into T10 (the breakout) and T11 (the
> pullback), so each screener can be judged on its own — T8 ran all three
> against one database, so no register could say which one produced a result.
> T8 is archived; its registers stay readable for qp.
> Its shared ★ CANSLIM list (the cross-tag below) was removed on 2026-10-02:
> the O'Neil letters on every card (C A N S L I M, computed by qp and frozen
> into the registers as the `cs*` columns) replace it. The section is kept as
> the record of what T8 collected.

**Looking for:** O'Neil's growth criteria — a profitable, accelerating company
at a new high while leading the market. Deliberately slow: a handful of names
that stay interesting for months, not a daily hunt.

```
earnings_per_share_diluted_yoy_growth_fq ≥ 25     C — latest quarter, YoY
earnings_per_share_diluted_yoy_growth_fy ≥ 25     A — and not a one-quarter accident
total_revenue_yoy_growth_fq ≥ 15                  sales behind the earnings
close ≥ price_52_week_high                        N — at or through the 52-week high
Perf.6M > 30                                      L — leading
relative_volume_10d_calc > 1.5                    S — demand showing up today
total_shares_outstanding_fundamental < 1B         S — a cap on supply
market_cap_basic > $300M                          institutions cannot buy what does not trade
```

**Second screener — CANSLIM Pullback.** Same company quality, but back at its
50-day rather than breaking out: `close ≥ SMA50` and `close ≤ EMA20`. O'Neil
buys breakouts; the pullback is where the same name is usually cheaper. It is
not a mirror — the mirror of a growth screener would be a collapsing company,
which is not what this tool is for.

### What CANSLIM cannot be, honestly

| Letter | Status |
|---|---|
| **I** — institutional sponsorship | **Left out.** There is no dependable screener column for it. Faking it with something that merely sounds similar would be worse than its absence. |
| **M** — market in an uptrend | **Not a filter, on purpose.** It describes the whole market, not a stock. The regime engine already stamps it on every card; filtering on it here would hide candidates on weak days — exactly the days worth recording for the comparison later. |
| **L** — leader | **The weak link.** O'Neil's RS Rating is a percentile rank against every other stock, which a screener cannot compute. Six-month performance is a plain threshold, so a strong market lets more names through and a weak one fewer. It measures strength, not leadership. |

### The cross-tag (removed 2026-10-02)

CANSLIM matches are written to a shared list every other tool reads. When one of
those names turns up in an unrelated screener — a VWAP reclaim, a gap, a big
volume day — the card is tagged **★ CANSLIM** with how many days it has held its
place on the list.

Membership lasts **90 days** from the last time a name qualified, so it does not
drop off the day it stops printing a new high. Re-qualifying extends it without
resetting its age.

This is the only place tools see each other, and the shape of it matters: the
list is a **label, never a filter**. Reading it cannot add or remove a single
candidate from any screener, and a tool that cannot find or parse the file
scans normally with no tags. The isolation that matters — one tool's data never
deciding another tool's candidates — is intact.

`canslim` also travels into the registers as a yes/no field, so the model can
learn from it and the scorecard can be sliced by it.

**Capture:** photo 09:46, entries 09:47 / 09:51 — the same timing as T2, so the
two breakout tools stay directly comparable.

---

## T9 — Stocks in Play · port 3080 (archived)

**The benchmark, and deliberately the dumbest screener here.**

```
close > 5
```

That is its only rule. The tradability floor supplies the rest — average volume
≥ 1M, ATR ≥ $1, ATR ≥ 3% of price. Sort by relative volume, take the top 20.

No pattern. No direction. No structure. Just *what is unusually active today*.

**Why it exists.** Every other tool makes the same implicit claim: that some
structure — a stacked moving average, a VWAP reclaim, a 52-week break — finds
better movers than simply taking today's most active liquid names. Until this
tool there was nothing plain to test that claim against, because every tool was
clever.

At the end of the month the comparison reads directly:

```
T9  Stocks in Play      35% good moves     ← the number to beat
T2  MA Stack Breakout   52%                the structure is earning its keep
T4  VWAP Reclaim        34%                no better than doing nothing clever
```

**It is not a straw man.** In the one strong published day-trading result, the
edge came almost entirely from the relative-volume screen: dropping it took the
same strategy from a Sharpe of 2.81 to 0.48, below buy-and-hold. Ranking by
unusual volume is a hard benchmark.

**No mirror.** There is no direction to flip. The opposite of "unusually active"
is "quiet", which is not the other side of this setup — it is the absence of it.

**Nothing structural may ever be added to it.** The moment this screener says
something about trend or pattern it becomes another clever tool, and there is
nothing plain left to compare the clever ones against. A test enforces this.

**Capture:** photo 09:36, entries 09:37 / 09:40 — identical to T1 on purpose. A
different capture time would make every comparison partly a comparison of clocks
rather than of screeners.

---

## T10 — Growth Stock Breakout · port 3110 (archived)

T8's breakout screener on its own: the **CANSLIM** definition above, unchanged
(`close ≥ price_52_week_high` with the earnings, sales, RS-proxy, supply and
size rules). Stopped 2026-09-21 — the growth setup now runs on T11's pullback
alone. Archived, so everything it collected can still be charted and
backtested.

**Capture:** photo 09:46, entries 09:47 / 09:51 — inherited from T8, so its
history stays comparable with T8's.

---

## T11 — Growth Stock Pullback · port 3120

**Looking for:** a growth company pulling back inside its uptrend — holding the
50-day but back under the 20-day.

```
earnings_per_share_diluted_yoy_growth_fq ≥ 25     C — latest quarter, YoY
earnings_per_share_diluted_yoy_growth_fy ≥ 25     A — last full year
Perf.6M > 30                                      L — leading (a proxy)
close ≥ SMA50                                     the uptrend is intact
close ≤ EMA20                                     but it has pulled back
market_cap_basic > $300M
```

**Why these filters.** O'Neil buys breakouts; the pullback is where the same
name is usually cheaper. Not a mirror — the mirror of a growth screener would
be a collapsing company. The limits of the letters are in *What CANSLIM cannot
be, honestly* under T8. Each card also carries the full O'Neil reading
(C A N S L I M, computed by qp), frozen into the registers as the `cs*`
columns.

**Window 09:30–16:00**, top 50.

**Capture:** photo 09:46, entries 09:47 / 09:51 — inherited from T8.

---

## The unified shortlist

Every tool keeps its own shortlist — each is a separate experiment. But the
trader is one person with one account, so **anything shortlisted on any tool
appears on the unified list, by design**. There is nothing to opt into.

A name three tools picked independently is a different proposition from one
that appeared on a single list, and that is the question the list exists to
answer. It used to be a panel on the landing page; since 2026-09-04 it shows
only as the badge below and through `/api/shortlist/all-tools`
([PAGES.md](PAGES.md)).

Each tool publishes its own shortlist whenever it changes — the auto-rule, a
manual star, an export — so the union is never behind. On a card, a name another
tool has starred shows **★ also T1 T7**. That badge never touches this tool's
own star: `inShortlist` stays this tool's decision, and it is the one the model
reads.

The same rule as every shared file: a **view, never a filter**. Reading it cannot
add or remove a candidate, change a score, or alter a register row anywhere.

---

## Reading the scorecard

**Analysis → Screener scorecard**, per screener, over every captured day:

| Column | Meaning |
|---|---|
| Cards / Days | sample size — under 20 cards or 5 days is left unjudged |
| Median R | half its cards did better than this |
| Avg R | average move up from the entry (every screener is graded on the up move today, including bearish ones: D-S12) |
| Avg −R | average move against you first (stored positive) |
| ≥1.3R | share of cards that made a good move |
| ≥2R | share that made a big one |
| **Days hit** | share of days that produced at least one good move |
| Verdict | keep / watch / drop |

### Two comparisons, on the comparison page

Both are on `/screeners/compare` ([PAGES.md](PAGES.md)), reached by its
address. **Compare every screener** pulls every tool's scorecard into one table and ranks
every screener against **Stocks in Play** — the plain list. A screener has to
beat it by 5 points to count, because a month gives a few dozen cards each and
two or three points on that sample is noise. Entry A and entry B are both
selectable. While T9 is stopped the page has no benchmark (D-S14).

Its limit, stated plainly: the plain list samples liquid stocks over $5, and
some tools deliberately sample elsewhere — small floats, billion-dollar
companies — so part of any gap is a difference of universe rather than of
screener. It is still the right question, because the alternative is trading a
screener with nothing to compare it to; just do not read a 3-point gap as proof.

**Does direction matter?** pairs each screener with its own mirror. This is the
cleaner of the two, and the reason the mirrors exist: a screener and its
opposite-facing twin run in the same window over the same universe by
construction, so what separates them is direction and little else. Three
outcomes:

| Verdict | Meaning |
|---|---|
| **directional** | one side clearly beats the other — the direction is doing real work |
| **both sides work** | it finds movers; the direction is decoration. Worth knowing before trading it one way. |
| **neither beats the plain list** | the pair is noise whichever way it faces |

**Days hit is the column that decides.** A screener whose good moves all landed
on two wild days has a flattering average and is not something anyone can plan
around, so a *keep* needs both a rate and a spread of days.

Each screener is compared against **its own tool's** pooled baseline. Comparing
across tools compares universes — one samples two-dollar small caps, another
samples billion-dollar companies — not screeners.

---

## Order of work

1. **Collect.** Run the tools for about a month. Nothing to decide yet.
2. **Cut.** Read the scorecard. Delete the screeners that do not find movers.
3. **Then setups.** Only for the screeners that survived, work out which entry,
   stop and target suit what they find. That is the question the current
   measurement deliberately does not answer.
