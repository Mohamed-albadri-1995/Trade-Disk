# The market

**Trunk section:** [§6.4 The market](../ARCHITECTURE.md#64-the-market).

**Talks to:** Sources (§6.1: TradingView for index and sector-ETF quotes);
Research data (§6.5: O'Neil's M and L, written nightly); the Card (§6.3), which
carries the market context on every card; Registers (§6.6), whose R2 is a view
of this domain's history; Learning (§6.7), which uses regime and sector as
features.

**Built on:** [MARKET-TAB](../legacy/screeners/MARKET-TAB.md) (every block, formula and
threshold of today's tab), [CANSLIM](../legacy/qp/CANSLIM.md) §2 (the market model's
exact rules), §8 (the tab's O'Neil block), §9 (the four levels of strength),
§14 (the market reflected on each card), and the code in `src/sideD/` and
`quant-platform/chart/oneil.py`, `groups.py`.

---

## Contents

1. [What the market domain answers](#1-what-the-market-domain-answers)
2. [The legacy design in full](#2-the-legacy-design-in-full)
3. [What was planned and never built](#3-what-was-planned-and-never-built)
4. [What failed](#4-what-failed)
5. [The new design](#5-the-new-design)
6. [Contracts](#6-contracts)
7. [How the rebuild is proven](#7-how-the-rebuild-is-proven)

---

## 1. What the market domain answers

Two different questions, kept apart on purpose:

| Read | Answers | Clock | Built today by |
|---|---|---|---|
| **The desk's read** | what is the tape doing right now, and which sectors lead? | every scan | each tool, from TradingView quotes |
| **O'Neil's method** | should I be buying at all, and where is the leadership? | after each close (M also provisionally every 30 minutes in the session) | qp, from index bars and whole-market RS |

They use different words so the trader can never mistake one for the other.
Both are stamped on every card, and both are frozen into the registers.

---

## 2. The legacy design in full

### 2.1 The inputs

**TradingView scanner**, every discovery scan, for **SPY, QQQ, IWM, DIA, VIX**
and **15 sector ETFs**, with the columns `close`, `change`,
`change_from_open`, `change|1W`, `SMA5`, `SMA20`, `SMA50`, `SMA200`,
`BB.upper`, `BB.lower`, `ADX`, `VWAP`, `relative_volume_10d_calc`.

| Sector | ETF | | Sector | ETF |
|---|---|---|---|---|
| Technology | XLK | | Real Estate | XLRE |
| Financial | XLF | | Consumer Staples | XLP |
| Industrial | XLI | | Semiconductors | SMH |
| Consumer Discretionary | XLY | | Biotechnology | IBB |
| Energy | XLE | | Retail | XRT |
| Health Care | XLV | | Transportation | XTN |
| Communication Services | XLC | | Utilities | XLU |
| Materials | XLB | | | |

**Yahoo daily bars** of the **S&P 500 (^GSPC)** and the **Nasdaq Composite
(^IXIC)** for O'Neil's M. **The SIC industry map** and **whole-market RS
ratings** for L (both from the research worker: [ONEIL.md](ONEIL.md)).

**No regime rather than a wrong one** (D-S2): if SPY and QQQ are both missing
any of close, SMA5, SMA20, SMA50 or SMA200, the scan records no regime, and
cards carry no context.

### 2.2 Indexes

Five tiles in order SPY, QQQ, DIA, IWM, VIX: price, change today, change over
the week. Tapping one opens its chart.

### 2.3 Short-term bias

From the index quotes (`computeMarketBiasDetail`):

| Signal | +1 | −1 |
|---|---|---|
| SPY day | > +0.3 % | < −0.3 % |
| QQQ day | > +0.3 % | < −0.3 % |
| IWM day | > +0.3 % | < −0.3 % |
| VIX day | < −2 % (+1) | > +1 % (−1), > +3 % (−2) |
| SPY week | > +1 % | < −1 % |
| QQQ week | > +1 % | < −1 % |

Sum ≥ **+3** BULLISH, ≤ **−3** BEARISH, else NEUTRAL. The tab shows the score
and each signal.

### 2.4 Mid-term stage

From SPY (QQQ when SPY is incomplete) (`computeMarketStage`). Six checks,
counted as bull signals:

1. close > SMA5
2. close > SMA20
3. SMA5 > SMA20
4. SMA20 > SMA50
5. "1-hour close > 20-hour MA": the code uses the daily close > SMA20, which is check 2 again
6. "1-hour 5MA > 20-hour MA": the code uses SMA5 > SMA20, which is check 3 again

| Stage | Rule |
|---|---|
| UPTREND | ≥ 5 bull, or 4 with close > SMA5 |
| PULLBACK | 3–4 bull, close < SMA5, SMA5 > SMA20 |
| REBOUND | 2–3 bull, close > SMA5, SMA5 < SMA20 |
| SIDEWAYS | 2–3 bull otherwise |
| DOWNTREND | fewer |

**Bollinger position** (close between the bands): ≥ 75 % `UPPER`, ≤ 25 %
`LOWER`, else `MID`.

### 2.5 Long-term bias

| | SMA50 > SMA200 | SMA50 < SMA200 |
|---|---|---|
| **close > SMA200** | BULLISH | RECOVERING |
| **close < SMA200** | WEAKENING | BEARISH |

Also shown: the distance from the 200-day in %.

### 2.6 The final regime

Long-term × mid-term, then a Bollinger overlay:

| Long \ Mid | UPTREND | PULLBACK | REBOUND | SIDEWAYS | DOWNTREND |
|---|---|---|---|---|---|
| **BULLISH** | STRONG_UP | PULLBACK_BULL | UP | CHOP_BULL | CORRECTION |
| **RECOVERING** | WEAK_UP | RECOVERY | RECOVERY | BASING | DOWN |
| **WEAKENING** | RECOVERY | TOPPING | BEAR_RALLY | CHOP_BEAR | DOWN |
| **BEARISH** | BEAR_RALLY | DOWN | BEAR_RALLY | BASING | STRONG_DOWN |

STRONG_UP at the upper band becomes **EXTENDED_UP**; STRONG_DOWN at the lower
band becomes **CAPITULATION**.

| Regime | Stance | Guidance shown |
|---|---|---|
| Extended Up | LONG | Market extended. Momentum strong. Pullbacks are buying opportunities. |
| Strong Uptrend | LONG | Strong bullish conditions. Favor long setups with momentum. |
| Uptrend | LONG | Bullish but recovering. Favor long setups selectively. |
| Weak Uptrend | LONG | Recovering from weakness. Light long bias. |
| Pullback (bull intact) | LONG | Short-term pullback in a bull market. Watch for long re-entries. |
| Recovery | NEUTRAL | Recovering structure. Be selective. Wait for confirmation. |
| Basing | NEUTRAL | Market is basing. No clear direction. Reduce exposure. |
| Chop (bull bias) | NEUTRAL | Choppy but leaning bullish. Trade small and be selective. |
| Chop (bear bias) | NEUTRAL | Choppy with bear undertone. Reduce position size. |
| Correction (bull intact) | NEUTRAL | Correction in a bull market. Monitor for stabilization before re-entering. |
| Topping | SHORT | Signs of topping. Reduce longs. Hedge or go short on weakness. |
| Bear Rally | NEUTRAL | Counter-trend rally in bear market. Fade strength cautiously. |
| Downtrend | SHORT | Bearish conditions. Avoid longs. Short on rallies. |
| Strong Downtrend | SHORT | Strongly bearish. Reduce all risk. Short only. |
| Capitulation | SHORT | Market in capitulation. Extreme caution. Watch for reversal signals. |

**Confidence** is high when long and mid term agree in side, medium otherwise
(shown as Aligned / Diverging).

### 2.7 Sector heatmap and score

Columns: sector, ETF, day %, week %, **RS day** (ETF day − SPY day), **RS week**
(ETF week − SPY week), bias, score, ADX, status (🔥 HOT); sorted by score.

**Score** (`sectorShortTermBias`):

1. Five checks: close > SMA20 · SMA20 > SMA50 · close > VWAP · RS day > 0 ·
   week > 0.
2. `base = checks / 5 × 100`.
3. `RS influence = RS day × 5`, clamped to ±30.
4. ADX factor: **1.3** if ADX > 25, **1.1** if 20–25, **0.8** below 20.
5. `score = round((base + RS influence) × ADX factor)`, clamped to ±100.
6. Bias: > **20** BULLISH, < **−20** BEARISH (`sectorBullishThreshold`,
   `sectorBearishThreshold`), else NEUTRAL.

### 2.8 Hot sectors

Counted **per New York trading day**, not per scan (F-17):

- **hot at once** when the day's score reaches **60** (`hotImmediateThreshold`);
- **hot after 3 trading days** (`hotSustainedSessions`) whose best score
  reached **40** (`hotSustainedThreshold`);
- **stays hot** while the day's best score is at least **20**
  (`hotFloorThreshold`); after **2** days below (`coolOffDays`) it cools off.

The state lives in each tool's memory; a restart starts it again; Settings has
a reset.

### 2.9 Each card's sector

A card's TradingView sector is mapped to one of the 15 (`broadResolved`):

| TradingView sector (what the stock scanner sends) | Market sector |
|---|---|
| Electronic Technology, Technology Services | Technology |
| Finance | Financial |
| Finance/Real Estate | Real Estate |
| Producer Manufacturing, Process Industries | Industrial |
| Consumer Services, Consumer Durables | Consumer Discretionary |
| Consumer Non-Durables | Consumer Staples |
| Energy Minerals | Energy |
| Health Technology, Health Services | Health Care |
| Communications | Communication Services |
| Non-Energy Minerals | Materials |
| Retail Trade | Retail |
| Transportation, Utilities | themselves |

GICS-style names (Healthcare, Consumer Cyclical, Basic Materials, Consumer
Defensive, …) are mapped too, for the index scanner. Then each card carries
`secBias`, `secScore` and `secHot` (🔥 HOT) of its sector.

### 2.10 M: O'Neil's market model

Rebuilt from O'Neil's published descriptions ([CANSLIM](../legacy/qp/CANSLIM.md)
§2):

| Rule | Value |
|---|---|
| Distribution day | close down **≥ 0.2 %** on volume **above the prior session**, counted only in an uptrend |
| Stalling day | heavy volume (above the prior session or the 25-day average), close in the **lower half** of the range, gain **under 0.2 %**: counts as distribution |
| Live window | **25 sessions** |
| Removal | after 25 sessions, or when the index trades **5 %** above that day's close |
| Under pressure | **5** live distribution days |
| Correction | **6** live, or the uptrend's low broken |
| Rally attempt, day 1 | the session after the **lowest close** of the correction; a lower close restarts the count |
| Follow-through day | day **4 or later**, gain **≥ 1.7 %**, volume above the prior session; "late" after day 7, "very late" after day 11 (still counted) |

Volume above the 50-day average is reported beside a follow-through but does
not decide it. Each index runs its own state machine; **the published status
is the worse of the two**:

| Status | What O'Neil does (shown) |
|---|---|
| Confirmed uptrend | Buy breakouts. This is the state the method is designed for. |
| Uptrend under pressure | Stop initiating new positions; tighten stops. A name holding up through distribution is a leader candidate for the next follow-through. |
| Market in correction (including a rally attempt with no follow-through yet) | No new buying. Three out of four stocks follow the market. |

**The block shows:** the status, its date and a *because* line; live
distribution per index; the follow-through (date, day number, gain, timing);
sessions since it, with a band; the rally attempt (day N off a dated low); the
guidance; a **dated distribution-day table** (date, index, kind, move %,
volume ratio, sessions until expiry); the rules in use; the caveat that about
one follow-through in four fails; the model note.

**On each card** (CANSLIM M and Market Context): the status, live distribution
days, what this stock did on those days (`up on 4 of 5, avg +0.9 % vs index
−0.8 %`), the verdict HOLDING UP / IN LINE / GIVING WAY, sessions since the
follow-through, and the exposure note.

### 2.11 L: industry groups

Ranked across the whole market, the level O'Neil says carries about **37 %**
of a stock's move (the sector **12 %**):

| Step | How |
|---|---|
| Membership | SIC codes from EDGAR for every filer; TradingView labels only for symbols SIC has not classified (F-21) |
| Strength | each stock's RS rating, ranked against the whole market |
| Group strength | the **median** member RS |
| Thin groups | fewer than **6** ranked members: merged one rung up (4-digit industry → 3-digit industry group → 2-digit major group); dropped if still thin |
| Ranking | 1 … N by median RS; percentile and letter (A+ ≥ 94 … E) |
| Rotation | rank three months ago → now: into / out of leadership |

The table: top 20 and weakest 10, each with rank X of N, group (marked
*rolled up*), percentile and letter, members, median RS, share over RS 80, the
3-month rank change, and the four leaders with their RS. A note gives how many
symbols and industries are mapped and how many groups are ranked.

### 2.12 Who uses what

| Number | Card | R1 | R2 | Model features |
|---|---|---|---|---|
| Regime, long / mid / short | Market Context | ✓ | ✓ | ✓ |
| Sector bias, score, hot | Market Context, 🔥 HOT | ✓ | ✓ (all 15) | bias and score |
| Index prices | — | — | ✓ | — |
| O'Neil status | CANSLIM M | `csMarket` | ✓ (read at export) | — |
| Group rank | CANSLIM L | `csGroup*` | — | — |

---

## 3. What was planned and never built

From [CANSLIM](../legacy/qp/CANSLIM.md) §9 and §12.1:

| Item | What it is | In the new design |
|---|---|---|
| **Index RS line** (M11) | `Nasdaq ÷ S&P 500`, the earliest read on whether growth or defensives are being bought | built: a line on the tab |
| **Sector rank 1 of 33** (L7) | a coarse level between the 15 ETFs and the groups | built from the SIC map's major groups |
| **Group new highs / lows** (L4) | how many members made new highs or lows | built |
| **Divisor stored with every group rank** (L2) | a group scheme can change (IBD went from 197 to 145 groups); a stored rank without its divisor rewrites its own past | built: every rank is stored as `rank of N` |

---

## 4. What failed

| ID | Fault | Root cause | Prevented by |
|---|---|---|---|
| — | five tools compute the same snapshot from the same ETFs, minutes apart, and can disagree | the market read lives inside each tool | one market engine |
| F-17 (fixed) / — | hot state was once counted per scan; it is still lost on every restart | state in memory | hot state persisted per trading day |
| F-16 | sector score runs about −39 to +100, so BULLISH is far easier to reach than BEARISH | `base` runs 0–100 before the RS influence | score centred on 0 ([§5.4](#54-the-desk-read-rebuilt)) |
| D-D5 | the mid-term stage counts two facts twice | "hourly" checks proxied by daily ones | four distinct checks, or real hourly data |
| D-D3 | R2's O'Neil columns are read when exported, so an old day shows today's status | O'Neil status not frozen with the snapshot | R2 reads the market history, which holds the O'Neil status as it was |
| D-D6 | the group table marks only a two-rung roll-up | display | one rule for both rungs, as on the card |
| D-S2 (fixed) | no index data once read as a bearish market | no honest null | kept: no regime, said plainly |
| new | four TradingView stock sectors have no mapping: Commercial Services, Distribution Services, Industrial Services, Miscellaneous. Their cards get no sector bias, score or hot badge | an incomplete map | a complete, tested map; unmapped labels reported in health |
| — | when an O'Neil file is missing, the tab asks qp to build it inside a page request | computation in the request path | the tab only reads; a missing fact says "not built yet · last run DATE" |

---

## 5. The new design

### 5.1 One market engine

The market engine runs in desk-worker. At every discovery scan (and at least
every 5 minutes during 04:00–16:00), it:

1. asks the TradingView adapter for the 5 indexes and 15 sector ETFs, once;
2. computes the desk's read (§5.4);
3. reads the current O'Neil facts (M, L) from the fact store;
4. writes one **market state** row with everything above, stamped with its
   instant;
5. updates the persisted **hot-sector state** for the trading day.

Every card is stamped with the **id** of the market state it used, so the
context on a card can always be traced to one snapshot.

### 5.2 The market state

| Field group | Contents |
|---|---|
| `at` | the instant (UTC); the trading day (New York) |
| `indexes` | for SPY, QQQ, IWM, DIA, VIX: every column of §2.1 |
| `sectors` | for each of the 15 ETFs: its columns, RS day, RS week, checks, score, bias, ADX factor, hot |
| `short_term` | the six signals, the sum, the bias |
| `mid_term` | the checks, the stage, Bollinger position |
| `long_term` | the bias, distance from the 200-day |
| `regime` | slug, label, stance, guidance, confidence |
| `oneil_m` | status, why, per-index live counts, follow-through, rally attempt, the distribution days, the rules in use, provisional or final: copied from the latest M fact so the state is complete on its own |
| `oneil_l_ref` | the id of the group ranking current at that instant |
| `status` | `ok`, or `no_regime` with the reason |

History is kept: R2 and the backtest read it, and a day can be replayed.

### 5.3 The hot-sector state

One row per sector per trading day: the day's best score, consecutive days at
40 or more, consecutive days under 20, hot or not, and since when. Settings
keep the thresholds (60, 40, 3, 20, 2). A restart reads the rows back; a reset
is an explicit action that is logged.

### 5.4 The desk read, rebuilt

The formulas of §2.3–§2.8 are kept, with three corrections that need a
re-tune, each behind a versioned definition so history records which ran:

| Correction | Change | Re-tune |
|---|---|---|
| Sector score centred on 0 (F-16) | `base = (checks − 2.5) / 2.5 × 100` (−100 … +100) before the RS influence and ADX factor | the hot thresholds (60, 40, 20) and bias thresholds (±20), checked against a month of history |
| Mid-term stage (D-D5) | four distinct checks (close > SMA5, close > SMA20, SMA5 > SMA20, SMA20 > SMA50), or hourly bars when an adapter provides them | the stage rules, re-cut for four checks |
| The sector map | every TradingView sector mapped; an unknown label is reported, never silently dropped | — |

### 5.5 O'Neil on the tab

M and L are **computed by the research worker** ([ONEIL.md](ONEIL.md)) and **only read** here. The rules in §2.10 and §2.11 carry over
unchanged. Through the day the worker's market-model step also runs every 30
minutes on today's index bars (a distribution day in progress) and writes a
provisional M; the market state copies the latest M, labelled provisional
until the close. The rules exist once, in the worker.

### 5.6 The tab

Order, top to bottom:

1. **M · O'Neil market model** (first, because it decides whether to buy at
   all), with the index RS line.
2. **Indexes.**
3. **Desk analysis**: short-term, mid-term, long-term, the final regime,
   titled "Desk regime" so it can never be read as O'Neil's status.
4. **Sector heatmap**, with the sector rank above it.
5. **L · Industry groups**: top 20, weakest 10, with divisors, roll-up marks,
   new highs and lows.

Every number has its ⓘ (what it means, how it is calculated, what it is not,
source and as-of), as on the card.

### 5.7 What the card receives

`market_state_id`, `regime`, `regimeLabel`, `longTerm`, `midTerm`, `shortTerm`,
`broadResolved`, `secBias`, `secScore`, `secHot`, and from M the per-card
reflection (status, live distribution days, this stock on those days, verdict,
sessions since the follow-through). See [CARD.md](CARD.md) §2.9 and §2.11.

---

## 6. Contracts

### Owns

| Table | Key | Written |
|---|---|---|
| `market_states` | id; instant | each scan |
| `hot_sector_days` | sector, trading day | each scan |

### Reads

| From | What |
|---|---|
| sources | TradingView index and ETF quotes |
| research data | the latest `oneil_m` fact and group ranking |

### Read by

| Domain | What |
|---|---|
| card | the current market state |
| registers | R2 at the tool's slots |
| learning | regime and sector features |
| quant | the market state as of any day (backtest filters, the CANSLIM gate) |

### Routes (desk-web)

| Route | Returns |
|---|---|
| `GET /api/market/state?at=` | the market state at an instant (default: now) |
| `GET /api/market/history?day=` | every state of a trading day |
| `GET /api/market/groups?day=` | the group ranking |
| `POST /api/market/hot/reset` | reset hot state (logged) |

---

## 7. How the rebuild is proven

1. **Parity.** For a week the market engine runs beside the old tools; each
   scan, its regime, stages and sector scores are compared with the old
   tool's snapshot (before the corrections of §5.4 are switched on).
2. **Fixtures.** Recorded TradingView answers drive every formula in CI,
   including incomplete SPY and QQQ (no regime).
3. **Restart test.** Restart desk-worker: hot state and the day's history are
   intact.
4. **M against charts.** The dated distribution-day table is checked by hand
   against index charts for one month, as the legacy design requires.
5. **Sector map coverage.** A health check reports any card sector with no
   mapping.
