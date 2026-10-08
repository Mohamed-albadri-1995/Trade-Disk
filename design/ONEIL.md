# Research data: the O'Neil chain

**Trunk section:** [§6.5 Research data](../ARCHITECTURE.md#65-research-data-the-oneil-chain).

> **Build status (2026-10-08).** Built, in shadow (`researchMode`): the research worker (`quant-platform/research/worker.py`) writes every per-ticker reading and the market model as dated facts. It covers new tickers within minutes and runs a provisional M during the session. The nightly chain still runs from qp's systemd timer until `scripts/retire-old-schedulers.sh` hands it to T1's The Night.

**Talks to:** Sources (§6.1: SEC EDGAR, Form 13F, Polygon, Yahoo, openFDA,
USASpending); the Card (§6.3), which shows the CANSLIM reading; the Market
(§6.4), which shows M and L; Quant (§6.8), whose backtest gate reads the same
facts as of a day.

**Built on:** [CANSLIM](../legacy/qp/CANSLIM.md), the deepest document of the
old desk: the traps, the exact rules and their provenance, the card and panel
specification (locked), the build phases and what each found;
[qp OPERATIONS](../legacy/qp/OPERATIONS.md) (the nightly chain);
[CARD-FIELDS](../legacy/screeners/CARD-FIELDS.md) #28–#88 (what reaches the card).
The code: `quant-platform/chart/oneil.py`, `relstrength.py`, `groups.py`,
`sic.py`, `edgar.py`, `f13.py`, `base.py`, `ratings.py`, `canslim.py`, and
`deploy/run_daily.py`.

---

## Contents

1. [What this domain is](#1-what-this-domain-is)
2. [The traps the method must avoid](#2-the-traps-the-method-must-avoid)
3. [The legacy method, letter by letter](#3-the-legacy-method-letter-by-letter)
4. [What was built, and what was not](#4-what-was-built-and-what-was-not)
5. [What failed](#5-what-failed)
6. [The new design](#6-the-new-design)
7. [Contracts](#7-contracts)
8. [How the rebuild is proven](#8-how-the-rebuild-is-proven)

---

## 1. What this domain is

William O'Neil's CAN SLIM is a method for finding leading growth stocks:
**C**urrent quarterly earnings, **A**nnual earnings, **N**ew (product,
management, industry conditions, price high out of a base), **S**upply and
demand, **L**eader or laggard, **I**nstitutional sponsorship, **M**arket
direction.

The desk reconstructs it from **free, official data**, names every
reconstruction as one (`rs`, never "IBD RS"), and uses it as a **label, never a
filter**: no tool's candidates change because of it. The results are card
fields and Market-tab sections; this domain computes them.

**Why this domain is separate.** Its facts are slow (filings, quarterly 13F,
whole-market rankings), heavy (thousands of companies, rate-limited sources)
and change at most once a day. They must never be computed inside a page
request or a scan, and they must not depend on the chart server being up.

---

## 2. The traps the method must avoid

Most CAN SLIM concepts have a plain-English name that means something else in
common use. Implementing the common reading produces numbers that look right
and measure a different thing. From [CANSLIM](../legacy/qp/CANSLIM.md) §1:

| Concept | What it is | What it is mistaken for |
|---|---|---|
| **RS Rating** | a percentile 1–99 of 12-month performance against **every other stock** | RSI, which compares a stock to its own range |
| **C** | current quarter EPS vs **the same quarter a year ago** | sequential quarters (reintroduces seasonality) |
| **A** | annual EPS growth over 3–5 years, plus ROE: durability | a longer C |
| **Distribution day** | one session: index down ≥ 0.2 % on **higher volume** | any down day |
| **Distribution count** | days **live** in a rolling 25-session window, with expiry | a running total |
| **A/D Rating** | a letter A–E from 13 weeks of price and volume | Chaikin's A/D index, an unbounded cumulative line |
| **Follow-through day** | a confirmation on **day 4+** of a rally attempt, big gain on higher volume | any strong up day |
| **N: new high** | price emerging from a **base** into new ground, on volume | any 52-week high |
| **Group rank** | rank of the stock's **industry group** | the sector (far too coarse) |
| **M** | a **rule-based state machine** over two indexes | a sentiment read or an MA cross |
| **RS line** | the plotted ratio stock ÷ index; "new high **before** price" is the tell | the RS Rating |
| **U/D volume ratio** | up-day volume ÷ down-day volume over 50 days | the A/D rating |
| **Base stage** | which base counted **from the market bottom** | any consolidation |
| **Group rank vs Group RS** | **one fact**: rank 63 of 197 *is* the 68th percentile *is* B+ | three measurements that could disagree |
| **RS within the group** | "RS 1 of 13": the stock ranked against its own group only | the RS Rating |
| **N: the new thing** | **three** things: product, management, **better industry conditions** | two things, and a news feed |

---

## 3. The legacy method, letter by letter

Every rule below carries over. Thresholds are **O'Neil's own numbers**, named
constants, printed beside any signal that fires
([CANSLIM](../legacy/qp/CANSLIM.md) §5).

### 3.1 M: the market model

A state machine over the **S&P 500 (^GSPC)** and the **Nasdaq Composite
(^IXIC)**, daily bars. Three published states (confirmed uptrend, uptrend under
pressure, market in correction) and one internal (rally attempt).

| Rule | Value | Provenance |
|---|---|---|
| Distribution day | close ≤ prior close × (1 − 0.002) **and** volume > prior volume **and** the market is in an uptrend | IBD's −0.2 % floor on O'Neil's plain "closes lower on higher volume" (set the floor to 0 for the plain form) |
| Stalling day | volume above the 25-day average or the prior day, gain under ~0.2 %, close in the lower half of the range: counts as distribution, flagged apart | IBD |
| Live window | 25 sessions | IBD; the tight end of O'Neil's "5–6 weeks" |
| Removal | after 25 sessions, **or** when the index **trades** (intraday high) 5 % above that day's close | IBD |
| Under pressure | 5 live distribution days | IBD |
| Correction | 6+ live, or a decisive break of the rally low | IBD |
| The bottom | the **lowest close** of the correction (not an intraday low) | the 2010 workshop |
| Rally day 1 | the session **after** that lowest close, up or down; a new lower close moves the bottom and restarts the count | the workshop |
| Follow-through | day **4 or later**, gain **≥ 1.7 %**, volume **> the prior session** (that is the whole test) | O'Neil's last figure (1 %, then 1.5 %, then 1.7 %) |
| Late follow-through | days 8–11 flagged late, beyond 11 very late: **flagged, never refused** | refusing creates a state the market can never leave |
| Status | counted **per index**, published as the **worse** of the two | "one index is enough" |

**Lesson recorded from the first live run.** An extra test (volume above the
50-day average) blocked the Nasdaq's August 2026 follow-through; the rally ran
to day 23 unconfirmed and the model said "correction" through a confirmed
rally. A rule stricter than the published one fails to the wrong answer, in
the direction of telling you not to buy. The 50-day comparison is reported
beside a follow-through, never decides it.

**Caveat, always shown:** about one follow-through in four fails. It is
necessary for a bottom, not sufficient.

### 3.2 RS: the relative strength rating

```
RS = 0.4·(P0/P63) + 0.2·(P0/P126) + 0.2·(P0/P189) + 0.2·(P0/P252)
```

63/126/189/252 trading days = 3/6/9/12 months, the latest quarter weighted
double; then **percentile-ranked 1–99 against every US stock**. Verified against
IBD's published formula. Two choices that make it match: the universe is the
whole market (Polygon grouped daily, every US ticker each session), and prices
are **split-adjusted** (a 2-for-1 split would otherwise score a leader at −50 %).

### 3.3 L: groups and the four levels of strength

| Level | The number | How | Answers |
|---|---|---|---|
| Market | the M state + the index RS line | §3.1; `index ÷ S&P 500` | buy at all? |
| Sector | rank of a coarse sector (planned: 1 of 33) | aggregate performance | which half of the market |
| **Group** | rank X of N | **median** member RS, membership by SIC | is this the leading group (O'Neil: ~37 % of a stock's move; sector ~12 %) |
| **Stock in group** | "RS 1 of 13" | the stock's RS ranked inside its group | leader or laggard |

**Membership** is the SIC code from EDGAR for every filer (TradingView labels
only where SIC has none, F-21). **Thin groups** (fewer than 6 ranked members,
`QP_GROUP_MIN_MEMBERS`) roll up one rung: 4-digit industry → 3-digit industry
group → 2-digit major group; dropped if still thin. Groups are ranked by median
RS; **percentile and letter** (A+ ≥ 94 … E) are derived from the rank, never
stored as separate facts. **Rotation**: rank now against rank 3 months ago.
**The divisor is stored with every rank** (IBD once went from 197 groups to
145); the card prints `63 of 197`, never a bare rank. **The honest limit**: our
group rank is ours, not IBD's, because membership differs; the rank within the
group and the member count are exact.

### 3.4 C and A: earnings, from EDGAR

From `data.sec.gov/api/xbrl/companyfacts/CIK{…}.json` (official, free, a
descriptive User-Agent; CIK ↔ ticker from `company_tickers.json`).

**C**: eight quarters of EPS, year-ago EPS, %Chg, sales, year-ago sales, %Chg,
after-tax margin; **accelerating** (each of the last 2–3 quarters' %Chg larger
than the one before); **beat +25 %** X of 8. **A**: fiscal years of EPS and
%Chg (with the year's price high and low), the year **rebuilt from four
quarters** to check against the filing, **3-year growth**, **stability** (the
wobble around trend, 0–99, low is good), **ROE** against O'Neil's **17 %**
floor.

**The five EDGAR traps**, each of which produces a normal-looking wrong number
([CANSLIM](../legacy/qp/CANSLIM.md) §17.1):

| # | Trap | Rule |
|---|---|---|
| 1 | C is year over year, never sequential | compare to the quarter one year back (within 45 days) |
| 2 | Q4 is usually not filed as a quarter | Q4 = FY − Q1 − Q2 − Q3, **only when all three are present**; when EPS and net income disagree in sign, Q4 is left out |
| 3 | the same period is filed more than once | the most recently **filed** value wins |
| 4 | a % from a negative base is not a number | `n/a (loss a year ago)`; capped at ±999 % |
| 5 | revenue lives under four tags | read all four, take one per period |

Filings land weeks after quarter end, so **every block carries its own as-of
date**.

### 3.5 N: the base, and what is new

**The weekly base** (weekly is not a display choice: a base is 7–65 weeks, and
daily bars drown every shape test in noise): weeks, depth, waves down (the
decline typically comes in three), **accumulation weeks** (heavy volume, no
price progress), **handle** (a controlled 2–8-week drift in the **upper half**
of the base: a handle that gives back half the cup is the cup failing), lip and
low with their weeks, **pivot**, % away, X of 6 checks. Needs 7 weekly bars.

**The RS line tell**: the RS line at a new high **while price is still in its
base** fires; both at new highs does not (that is arithmetic); the line off its
high does not. **Divergence**: the index made a new low in the window, the
stock did not, and the stock is above where it sat on the index's worst close;
"the index has not made a new low" is shown as a different answer from "it
followed the index down".

**N, what is new** (designed, phase 7, not built): see §4.

### 3.6 S: supply

Shares outstanding (EDGAR `dei:EntityCommonStockSharesOutstanding`, its basis
when not the cover figure, as-of); **share count change over about a year**,
always from the same tag (buying back / diluting / flat, or the reason there is
no rate); float (TradingView) and float as % of shares; short interest and days
to cover (from the card's short-interest facts); **U/D volume ratio** over 50
sessions; **A/D**: a bounded 13-week score (−1 … +1, normalised by the volume in
the window, comparable between stocks), banded to a letter that is **ours**
(IBD does not publish its boundaries), with the raw number beside it.

### 3.7 I: institutional sponsorship, from Form 13F

The SEC's quarterly 13F datasets. Counted as distinct **managers** by CIK,
unioned across every CUSIP of the issuer (stock, converts, options are one
company) and across a 13F-HR and its 13F-HR/A (one manager). Per quarter: the
holder count, **of N** managers who filed at all, and the **share of filers**.
**Direction is read from the share**, with a 3 % relative dead band: `rising`
(up over the year and still up), `peaked` (up over the year, newest quarter
down), `flat`, `falling`, `turning up`; only `rising` and `turning up` are
coloured bullish; the raw holder change is printed beside, uncoloured. Only
managers over $100M file, 45 days after quarter end: the lag is stated on
screen.

### 3.8 On each card: the market reflected

From [CANSLIM](../legacy/qp/CANSLIM.md) §14, four per-card readings, each a
different number on every card:

1. **Behaviour on the live distribution days**: on how many the stock's
   close-to-close return beat the index's, and the average difference, with the
   dates behind a tap; says so when there are none.
2. **Sessions since the follow-through**, banded early (< 25), established
   (25–150), late (> 150).
3. **Group rotation**: rank now vs 3 months ago, ▲ into / ▼ out of.
4. **The exposure implication**, in O'Neil's words.

---

## 4. What was built, and what was not

From the build manifest ([CANSLIM](../legacy/qp/CANSLIM.md) §12, §16):

| Phase | Delivered | State |
|---|---|---|
| 1 | M: the whole market model (M1–M10) | built |
| 2 | M on the Market tab and its per-card reflection | built |
| 3 | groups: RS, Grp, volume vs 50-day, `grp X of N`, `RS X of N`, the group table, rotation, % off high | built |
| 4 | A/D, U/D ratio, RS line tell, divergence | built |
| 5 | EDGAR C and A tables, shares outstanding, the weekly base | built |
| 6 | 13F I and FINRA S | I built; float estimate (S2) and funds / banks / management % (I3) not built |
| 7 | **the N pipeline** | **not built** |
| — | Composite (R1), EPS rating (R2), SMR (R5) | deferred: a composite without EPS and SMR would be a partial one wearing a complete name |
| — | group new highs / lows (L4), sector rank (L7), index RS line (M11) | not built |

**The N pipeline, as designed** ([CANSLIM](../legacy/qp/CANSLIM.md) §10):

```
HARVEST (24 months) → CLASSIFY (3 buckets) → REACT (price) → PERSIST (RS line) → SCORE → one line
```

| Step | Rule |
|---|---|
| Harvest | EDGAR 8-K **Item 5.02** (new management: structured, the item code is the classifier), **8.01 / 7.01** (product announcements), **1.01** (material agreements); **openFDA** approvals, 510(k), PMA; **USASpending** contract awards; the group's rank rising (new industry conditions, computed). News APIs corroborate, never trigger |
| Classify | keep new product/service, new management, new contract, better industry conditions. **Drop** analyst notes, index changes, earnings releases (that is C and A), splits, buybacks, dividends, lawsuits, short reports. **Route** secondary offerings to S |
| React | on the event date + 2 sessions: the move in multiples of the stock's 20-day ATR, volume against its 50-day average. **No move beyond 1 ATR on normal volume: dropped** |
| Persist | the RS line today against the event day: higher 1.0, flat 0.5, lower 0.2 |
| Score | `N_event = W(class) × R × D(age) × P`; N = the best event, 0–100. Class weights: product 1.00, management 0.90, contract 0.80, industry conditions 0.70, a new high alone 0.40. Age decay: 0–3 months 1.0, 3–6 months 0.9, 6–12 months 0.7, 12–24 months 0.4, older 0. Dedupe by class and date ± 3 sessions |
| Show | one line (`N 86 · New CEO · 2026-03-12 (5.8 mo) · +11.4 % on 4.2× vol · RS line held`); the event table; **unconfirmed** events (too new to have reacted) listed apart; **discarded counts printed**, as proof that it is a filter, not a feed |

---

## 5. What failed

| ID | Fault | Root cause | Prevented by |
|---|---|---|---|
| — | a ticker first seen while qp is down or restarting has a blank CANSLIM reading until a later scan, and a photo taken then freezes empty `cs*` columns into R1; five tools ask qp for the same tickers | the chain lives inside the chart server; each tool caches its answers for the day | the research worker writes facts; cards read them |
| — | a new ticker's C and A arrive only if a page shows its card (a background fetch, one name at a time) or the nightly walk reaches it | lazy fetching tied to the page | the worker's new-ticker run (§6.1), whatever is on screen |
| Q-N5 | the nightly job is a systemd timer installed by hand with a hard-coded user and path; without it the data goes stale silently | the one scheduler outside pm2 | the platform scheduler runs it; a missed or failed run alerts |
| F-21 (fixed) | the industry map flipped between SIC and TradingView every morning | two writers for one file | one writer: the research worker |
| — | a missing O'Neil file made the Market tab ask qp to build it inside a page request | computation in the request path | pages only read; "not built yet · last run DATE" |
| — | the first live data check reported a different environment from the running one (a bare shell without the keys) | the check did not load the service's environment | health checks run inside the worker's own environment |
| D-D3 | R2's O'Neil status read at export time | not frozen | the market state carries the M fact as it was |
| — | the backtest rebuilds CANSLIM "as of" a day separately | no dated facts | the gate reads facts by `as_of` |
| — | each piece rebuilt on first request when the job did not run, so the first person in the morning paid for it | lazy builds as a fallback | no lazy builds; the scheduler is the only trigger |

---

## 6. The new design

### 6.1 The research worker

A Python job (it reuses qp's verified code: `relstrength.py`, `oneil.py`,
`groups.py`, `edgar.py`, `f13.py`, `base.py`, `ratings.py`), always started by
the platform scheduler. It runs its steps, writes facts, records its run, and
exits. Each step is independent: one failure never stops the rest, and each
failure is reported.

| Run | When (New York, trading days) | Steps |
|---|---|---|
| **the night** | 18:30, once the day's whole-market bars are published (today's timer: 22:30 UTC) | all eleven, below |
| **new tickers** | every 5 minutes, 04:00–16:00, while any ticker carded today has no company facts and no attempt today | 6–10 for those tickers only |
| **provisional M** | every 30 minutes, 09:30–16:00 | 3, on today's index bars so far, written as `provisional`; the night's run replaces it |
| **by hand** | a button or `desk research <step>`: it queues the job, and no page waits | any |

The "new tickers" list is a query over today's cards and the facts (a card
whose ticker has no company fact and no attempt today), not a queue table, so
the worker stays the only writer. EDGAR allows ten requests a second, so a
morning's new tickers land within minutes; until then the card says
"computing · since 09:41".

| # | Step | Writes (fact family) | Clock | Budget |
|---|---|---|---|---|
| 1 | RS universe top-up | `bars_universe` (Polygon grouped daily, the newest sessions) | each close | minutes |
| 2 | RS ratings | `rs_rating` per ticker (with the universe size) | each close | — |
| 3 | market model | `oneil_m` for `market` (state, per-index counts, distribution days, rally, follow-through, rules in use) | each close; every 30 minutes in the session as `provisional` | — |
| 4 | SIC map | `sic` per ticker | new listings and changes: nightly | — |
| 5 | groups | `group_ranking` for `market`; `oneil_l` per ticker (group, level, rank of N, percentile, letter, RS in group, rotation, roll-up) | each close | — |
| 6 | earnings | `oneil_c`, `oneil_a` per ticker | weekly, and on a new 10-Q or 10-K | a time budget per night |
| 7 | supply | `oneil_s` per ticker | monthly (shares), each close (U/D, A/D) | — |
| 8 | institutions | `oneil_i` per ticker | quarterly, after the 45-day deadline | — |
| 9 | base and RS line | `oneil_n_base`, `rs_line` per ticker | each close (weekly bars) | — |
| 10 | ratings | `oneil_ratings` (RS, Grp, A/D, volume vs 50-day; then EPS, SMR, Composite) | each close | — |
| 11 | N events | `oneil_n_events` per ticker | nightly, 24-month window | a time budget |

**Which tickers.** Whole-market steps (1–5) cover every US stock, so RS,
the group and the SIC code exist for any ticker the moment it is carded.
Per-company steps (6–11) cover, each night, the union of every ticker any tool
has carded in the last 90 days, every R1 ticker and every ticker in an open
trade; a ticker carded for the first time is covered the same morning by the
new-ticker run.

### 6.2 Facts, with dates

Each fact family above is written to the fact store with:

- `as_of`: the date it describes (the quarter end, the session, the 13F quarter);
- `known_at`: when the worker learned it;
- `status`: `ok`, `none` (e.g. no filings) or `unavailable` (e.g. EDGAR timed
  out), with the reason;
- the **rules in use** for anything with a threshold, so a signal can be
  checked against its definition later.

This makes the backtest's CANSLIM gate exact: it reads the facts known before
its decision bar ([trunk §5.2](../ARCHITECTURE.md#52-the-fact-store)).

### 6.3 Who reads what

| Reader | Reads | Never |
|---|---|---|
| the card engine | `oneil_*`, `rs_rating`, `rs_line` for the card's ticker | computes any of them |
| the market engine | the latest `oneil_m` (final or provisional), `group_ranking` | computes any part of them |
| quant | any of them, as of a day | writes them |
| pages | through the card and the market state | trigger a build |

### 6.4 What gets built that was not

In order, each behind its own versioned definition:

1. **Index RS line** and **group new highs / lows** (cheap, from data already
   fetched).
2. **Sector rank** from SIC major groups, kept distinct from the group.
3. **EPS rating and SMR** from EDGAR, then **Composite** once both exist.
4. **Float estimate** (shares outstanding minus insider and 5 %-holder
   positions from Forms 4 and SC 13D/G), labelled as an estimate; **funds /
   banks / management %**.
5. **The N pipeline**, as designed in §4.

### 6.5 Everything explains itself

Each fact family ships with its definition card: what it means, how it is
calculated, **what it is not** (from the trap table in §2), source and as-of.
The card and the Market tab show it on a tap ([CARD.md](CARD.md) §5.6).

---

## 7. Contracts

### Owns (only writer)

| Fact family | Subject |
|---|---|
| `bars_universe`, `group_ranking`, `oneil_m` | `market` |
| `rs_rating`, `rs_line`, `sic`, `oneil_l`, `oneil_c`, `oneil_a`, `oneil_s`, `oneil_i`, `oneil_n_base`, `oneil_n_events`, `oneil_ratings` | ticker |

### Reads

| From | What |
|---|---|
| sources | EDGAR (company facts, tickers, 8-K items, SIC), 13F datasets, Polygon grouped daily, Yahoo index and stock bars, openFDA, USASpending |
| tools and cards | which tickers to cover |
| platform | its schedule and environment |

### Run record

Each run writes a job-run row: start, end, each step's result, counts (tickers
covered, facts written, failures with reasons). A step that has not succeeded
within its clock (for example, earnings not refreshed in 8 days) turns the
health page amber, then red, and sends an alert.

---

## 8. How the rebuild is proven

1. **Same numbers.** For a week the worker runs beside qp's nightly chain; for
   every ticker and family, its facts are compared with qp's files. Differences
   are explained or fixed before the card switches to the facts.
2. **qp down test.** With quant stopped, every card's CANSLIM reading and the
   Market tab's M and L are unchanged.
3. **The traps as tests.** Each row of §2 and each EDGAR trap of §3.4 has a
   fixture: a negative base, a missing Q4, a restatement, a tag switch, a split,
   a 13F amendment, a lowest close vs an intraday low, a day-3 bounce, a late
   follow-through.
4. **M against charts.** One month of distribution days and follow-throughs is
   checked by hand against index charts.
5. **A missed run.** Skip the worker for a night: the health page goes amber
   and an alert arrives; cards show "last run DATE".
6. **A new ticker.** A ticker carded for the first time at 10:00 shows its C,
   A, N and S readings by 10:15, with nothing on screen.
