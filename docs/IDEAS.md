# The ideas behind scoring, screeners and judging

Three parts of the screener tools are to be rebuilt: **the score**, **the
screener builder** and **the scorecard that judges screeners**. This document
records what each one is *for* and the rules it must keep. It does not
describe today's code, which is not the model to copy.

The ideas come from the trader's own requirements, recorded in the code's
design notes and in `METHODOLOGY.md`. Where a rule was learned the hard way,
the reason is given. Items marked **(proposed)** are new suggestions from the
2026-10 review, not yet decided.

Related: how a card is built (`docs/DATA-PIPELINE.md`), what is frozen each day
(`docs/REGISTERS.md`), what each screener hunts for (`METHODOLOGY.md`).

---

## Part 1 — The score

### What it is for

At the moment a stock appears on a tool, answer one question with one number:

> **Of the stocks this tool has found before that looked like this one, how
> many went on to make a good move?**

The score ranks today's cards so the eye goes to the likeliest ones first, and
so the shortlist can be filled automatically. It is a ranking aid, never a
filter: a low score never removes a card.

### What it learns from

Only from the tool's own history:

- **the photo (R1):** what every card looked like at the capture minute;
- **what happened after (R3):** how far it ran, in ATR, from the entry
  minutes.

One photo row plus its outcome is one example. Nothing else is training data.
A stock found after the photo is shown and can be traded, but it teaches
nothing, because nothing was frozen about it in time.

### What counts as a good move

The same line everywhere: **at least 1.3 ATR in the trade's direction** from
the entry, before the close. The scorecard, the model and the shortlist must
never grade on different curves.

### One score per question asked

A move depends on when you enter and which way you face, so each is scored
separately:

| | Long (ran up) | Short (ran down) | Either way |
|---|---|---|---|
| Entry A (e.g. 09:37) | A-long | A-short | A-any |
| Entry B (e.g. 09:40) | B-long | B-short | B-any |

The card shows the score for the direction its bias points to (manual first,
then the automatic bias), at the tool's chosen entry.

### The market matters

The same card behaves differently in a strong uptrend and in a correction. The
score should prefer what happened in **the same market regime**. When there
are not enough examples from that regime, it falls back to all regimes and
says so.

### Rules it must keep

1. **Each tool learns only from itself.** Tools are separate experiments;
   one tool's results must never shape another's score.
2. **No look-ahead.** Every input is what was known at the photo minute;
   outcomes come only from after the entry; ATR is from days before.
3. **Honest about thin data.** Every score carries how many past examples it
   rests on and a confidence that grows with that number. A score from 12
   examples must not look as sure as one from 300. (Proposed) below a
   minimum, show no score rather than a guess.
4. **Explainable.** Tapping a score shows why: which features pushed it up or
   down, and (proposed) how the most similar past cards did.
5. **Unit-free features first.** Relations (above/below a level, distance in
   %, position in a range, the MA stack, PM/ADR) compare a $2 stock with a
   $200 one; raw prices do not.
6. **Fixed at discovery.** The score a card got when found does not drift as
   the price moves; re-scoring happens only when something the trader chose
   changes (the bias).
7. **Retrained every day** after the outcomes are in, from all history.

### Open questions for the rebuild

- How few examples are too few to show a score at all.
- Whether regime-specific scoring has enough data per regime, or should use
  broader groups (up / sideways / down).
- How to treat cards that appeared after the photo.

---

## Part 2 — The screener builder

### What it is for

Let the trader define, from the phone, **what a tool hunts for**, test it
against today's market, and switch it on, without touching code.

### What a screener is

| Part | Meaning |
|---|---|
| **Name** | what the trader calls it; shown as the badge on every card it finds |
| **Rules** | conditions on TradingView's scanner fields: a field against a number (`close ≥ 1`), against another field (`close ≥ VWAP`), a range (`gap outside −3 %…+3 %`), a cross (`close crosses above VWAP`), on a timeframe (`EMA50` daily vs 5-minute) |
| **Order and size** | which field ranks the matches and how many to take (e.g. top 25 by relative volume) |
| **Run window** | the minutes it may **add** new cards (e.g. 09:00–10:00). Outside it, its cards stay on screen and keep updating; it just finds nothing new |
| **Check window** | when it is worth opening the tool to look, which can differ from when it scans (a pre-market screener scans from 04:00 but has nothing to show until there is volume) |
| **Mirror** | the same setup facing the other way, made automatically (below) |
| **Purpose** | a trade candidate list (cards) or a membership list (label only, never a card) |
| **On / off** | off keeps the definition and its history; nothing is deleted |

### Rules it must keep

1. **The tradability floor applies to every screener** (price, volume, ATR),
   added at scan time, not written into each screener. One setting changes
   all. Exceptions are explicit and named (the neglected-name screener, a
   membership list).
2. **Mirrors are made correctly, not by flipping operators:**
   - direction flips sign (`change > 5` → `change < −5`);
   - a high becomes its low (`close ≥ 1-month high` → `close ≤ 1-month low`);
   - an oscillator reflects (`RSI > 70` → `RSI < 30`);
   - quality guards stay as they are (`price > $1`).

   Flipping operators alone gives a screener that matches almost everything.
3. **What the scanner cannot express is said, not faked.** News, a rolling
   two-hour move, a trend that excludes today: these are tests applied after
   the scan, shown as part of the screener, never a pretend column that
   silently returns nothing.
4. **A screener is tested before it is trusted.** "Test" runs it now and shows
   how many stocks match in total, how many it would take, and a sample, so a
   rule that matches nothing (or everything) is obvious.
5. **Windows and capture times must agree (proposed).** A tool's photo must come after
   at least one of its screeners can have found something. The builder
   refuses a combination where it cannot (the T6 case, D-S9).
6. **Definitions are versioned (proposed).** Each frozen day records which version of
   each screener produced it, so changing a rule never mixes two different
   experiments under one name.

---

## Part 3 — Judging screeners

### What it is for

Answer the trader's question bluntly: **keep this screener, or delete it?**

### What is measured

Not trades. There is no stop, target or exit. The only thing a screener can
be held responsible for is **whether the stocks it finds move**. Whether a
move is tradable is a question about setups, which comes after the screeners
that work are known.

For every card frozen in the photo, from the entry minute to the close:

- **upR:** how far it ran in the trade's favour, in ATR;
- **downR:** how far it ran against first, in ATR;
- a **good move** is upR ≥ 1.3, and a **big move** is ≥ 2.

### The numbers per screener

| Number | Why it matters |
|---|---|
| Cards and days | the sample; too small (e.g. under 20 cards or 5 days) is "not enough data", never a verdict |
| Share of good moves | the headline rate |
| Median and average R | typical size of the move |
| Average adverse R | how much pain came first |
| Share of big moves | the tail |
| **Days hit**: share of days with at least one good move | **the deciding number.** A screener whose wins all came on two wild days cannot be planned around |

### The verdict

**Keep** needs both a good rate **and** a spread of days. **Watch** has one of
them. **Drop** has neither. The thresholds are set once and shown with the
verdict, so a verdict can always be checked.

### Two comparisons

1. **Against the benchmark.** Every screener is compared with *Stocks in Play*
   (liquid stocks over $5, ranked by unusual volume, no pattern). A screener
   must beat it by a clear margin (e.g. 5 points), because a few points on a
   month's sample is noise. If cleverness cannot beat doing nothing clever, it
   is not earning its complexity.
2. **Against its own mirror.** A screener and its opposite run in the same
   window over the same universe, so what separates them is direction alone:
   - **directional:** one side clearly wins, so the direction is real;
   - **both sides work:** it finds movers, and the direction is decoration;
   - **neither beats the benchmark:** it is noise whichever way it faces.

### Rules it must keep

1. Each screener is graded against **its own tool's** baseline. Comparing
   across tools compares universes (small caps against large caps), not
   screeners.
2. The good-move line is the same 1.3 ATR the score uses.
3. Entry A and entry B are both available, never mixed.
4. Every verdict shows its sample, so a thin one is never mistaken for a
   strong one.

### The order of work this serves

1. **Collect:** run the tools for about a month.
2. **Cut:** read the scorecard and delete the screeners that do not find
   movers.
3. **Then setups:** only for the survivors, work out entries, stops and
   targets.
