# The card

The design of a screener card: what is on it, in what order, how each part is
drawn, and the rules behind the drawing. Written from `buildCard()` and its
helpers in `public/index.html`.

| For | Read |
|---|---|
| where each number comes from | `docs/DATA-PIPELINE.md` |
| every field, its source, and when a blank is legitimate | `CARD-FIELDS.md` |
| which of these fields are frozen into the registers | `docs/REGISTERS.md` |

---

## Layout, top to bottom

```
┌──────────────────────────────────────────────────────────┐
│ NVDA  TV↗  $128.40  +4.12%  ● Live          72  ☆        │  header
│ Electronic Technology · Semiconductors      B4 main      │
├──────────────────────────────────────────────────────────┤
│ first seen 09:12 · 18m before open  ★ also T7            │  badges
│ [Big Move 09:12] [Pre-Mkt 08:30]  🔥 HOT  ▲▲ ALL BULL     │
│ ⚡ Earnings Beat +1                                       │
├──────────────────────────────────────────────────────────┤
│ ▲9MA ▲13MA ▲20MA ▲50MA ▲5MA ▲VWAP ▲PDC ▲OPEN ▲PMH ▲PML   │  signal tags
│ 9>13>20>50   Q4 range   PM/ADR 1-2 · 1.34×               │
├──────────────────────────────────────────────────────────┤
│ ▸ Chart                     tap to open                  │  folds, each
│ ▸ Volume & Float            RVOL 6.2× · cap $3.1T · …    │  with a one-line
│ ▸ Range                     W 92% · M 88% · Q 74% · Y 81%│  summary when
│ ▸ News · ⚡ Earnings Beat    3 stories · Nvidia beats …   │  closed
│ ▸ CANSLIM · O'Neil          C A N S L I M one-liner      │
│ ▸ Themes                                                 │
│ ▸ Market Context            STRONG_UP · long BULLISH · … │
│ ▸ Price                     $128.40 · gap +2.1% · vwap … │
│ ▸ EMAs                      9 … · 20 … · 50 …            │
│ ▸ ATR & Move                ADR 3.2% · move 1.40× ATR     │
│ ▸ Pre-Market Range          PM/ADR 1.34× · range $3.90   │
├──────────────────────────────────────────────────────────┤
│ score breakdown (opens when the score is tapped)         │
└──────────────────────────────────────────────────────────┘
```

**One level of folding.** Every section is a fold, closed by default except
where noted, and each closed fold shows its key numbers on its heading line.
There is no "Details" button wrapping folds inside folds.

---

## Header

| Element | Content | Rule |
|---|---|---|
| Ticker | the symbol | tap opens the full chart overlay |
| `TV ↗` | link to the symbol on TradingView | uses `tvSymbol` (e.g. `NASDAQ:AAPL`) |
| Price | `$` price | plain text: a price is a fact, not a claim |
| Change | `+x.xx%` today | green up, red down |
| `Live` / `Stale` | Live = matched by a screener in the last scan; Stale = matched earlier today, still re-quoted every 5 minutes | a stale card is dimmed |
| Sector · Industry | TradingView labels | — |
| Score | 0–100, or `—` when there is none | ≥70 high, ≥40 mid, below low; tap opens the score breakdown. `—` on every card today (scorer off, D-D1) |
| Table label | e.g. `B4 main` or `B4 sub:STRONG_UP` | which scoring table produced the score; tap opens the table inspector |
| ☆ / ★ | this tool's shortlist star | your own mark, yellow |

## Badges row

In this order:

1. **First seen** `HH:MM` and `Nm before open` / `at the open` / `+Nm`: the
   earliest moment any of this tool's screeners matched the stock. Pre-market,
   early (≤ 30 min after the open) and late are styled differently.
2. **★ also T2 T7**: other tools that shortlisted the same ticker today
   (violet: someone else's opinion).
3. **Screener badges**: one per screener that ever matched it today, with the
   time it first matched, coloured by screener. A screener that matched earlier
   but not in the last scan is drawn faded (`badge-past`); the tooltip gives
   its run window.
4. **🔥 HOT**: its sector is hot (`docs/MARKET-TAB.md`).
5. **▲▲ ALL BULL / ▼▼ ALL BEAR**: the price is above every one of EMA 9, 13,
   20, 50, SMA 5, VWAP, previous close, open and the PM low, the EMA stack is
   9>13>20>50, **and** the catalyst is bullish (the mirror for bearish, with
   the PM high). The PM high/low on the other side and the month quarter are
   not part of it.
6. **Catalyst**:
   - ⚡ marks tier 1 (major), ● tier 2, · tier 3, and 📈 a technical catalyst
     (the tape, not a story);
   - `+N` counts the further catalysts found;
   - a stale story (over 4 days old) is dimmed;
   - the tooltip gives the tier, the detail, how many headlines corroborate
     it, its age, the confidence and the evidence headline.

## Signal tags

One row of tags drawn from `row.signals`:

- **Ten level tags**: `9MA 13MA 20MA 50MA 5MA VWAP PDC OPEN PMH PML`.
  - ▲ green when the price is above the level, ▼ red when below.
  - The tooltip gives the distance in %.
  - A missing level means no tag.
- **Stack**: `9>13>20>50` (bull), `9<13<20<50` (bear) or `MA mixed`, with
  `n/3` in order.
- **Month quarter**: `Q1 range` … `Q4 range` (Q1 = bottom of the 1-month
  range).
- **PM/ADR band**: `<0.5`, `0.5-1`, `1-2`, `2-3`, `3+`, with the ratio.

## The folds

| # | Fold | Closed line | Open |
|---|---|---|---|
| 1 | **Chart** | tap to open | a TradingView widget (`tv.js`), daily candles, dark, no toolbar. Mounted only when the card is on screen **and** the fold is open; `⤢ full` opens the full chart. If `tv.js` did not load, it says so (D-S4) |
| 2 | **Volume & Float** | RVOL · cap · float · days to cover | RVOL, market cap, float, short %, days to cover — each coloured by magnitude (below) |
| 3 | **Range** | `W 92% · M 88% · Q 74% · Y 81%` | four bars (week = 5 sessions, month, quarter, year), each with its low, high and the price's position; all-time high as a distance (no low exists) |
| 4 | **News** | `N stories · top headline`, or `nothing in three weeks` | up to 5 newest headlines across all sources with source tag (TV, BZ = Alpaca/Benzinga, FH, GN, YH, SEC), age and link; a warning when a source is not answering; how many older stories were hidden; when it was fetched. "Load News" when not fetched yet |
| 5 | **CANSLIM · O'Neil** | the C A N S L I M one-liner | the seven letters (C, A, N, S, L, I, M), a "Not shown:" line naming each missing letter and why, relative strength (RS line, divergence), and a nested **Full tables** fold: eight quarters, the annual run, the whole base. Field by field in `CARD-FIELDS.md` |
| 6 | **Themes** | tap to open | theme tags (AI, Space, Nuclear …) from a ticker list and an industry list |
| 7 | **Market Context** | regime · long · short | regime with its icon, stance and colour; long, mid and short term; the sector with its bias and score; the **bias button** (below) |
| 8 | **Price** | price · gap · VWAP | price, previous close, VWAP, 5-day MA, open, gap % |
| 9 | **EMAs** | 9 · 20 · 50 | EMA 9, 13, 20, 50, each green above / red below the price |
| 10 | **ATR & Move** | ADR % · move × ATR | ADR $, ADR %, today's range ÷ ATR, day high/low |
| 11 | **Pre-Market Range** | PM/ADR · range | PM high, low, range, PM/ADR |

The CANSLIM data is fetched by the browser when cards are shown, through the
tool's `/api/market/oneil/*` routes, which ask qp.

### Range rules

- **Reverse splits.** TradingView's longer-window highs are not
  split-adjusted. When a window's high is more than **10×** the next shorter
  window's high, that window and every wider one are hidden. The card says
  which, and why. The all-time-high distance is suppressed the same way.
- **Identical windows.** When a shorter window has exactly the same low and
  high as the next wider one, it is labelled `= month` (the whole month
  happened this week), so it does not look like a broken column.

### The bias button

`⊙ AUTO (long ⚡)` → `▲ LONG` → `▼ SHORT` → back to AUTO, saved per card.

- **AUTO** shows what the desk would choose and why (`docs/DATA-PIPELINE.md`,
  auto bias). ⚡ means a catalyst decided it.
- **(no read)** means nothing points either way.
- A manual choice is carried into scoring.

---

## Colour language

One meaning per colour, everywhere on the card:

| Role | Used for |
|---|---|
| **Direction** (green / red) | price relative to something: above/below a level, up/down on the day. A good score is never green. |
| **Magnitude** (one hue, 4 intensities) | how big, never whether it is good: RVOL, float, cap, short %, days to cover, PM/ADR, sector heat |
| **Model** (orange) | the score, and only the score |
| **Someone else** (violet) | another tool's shortlist |
| **Mine** (yellow) | your shortlist star |
| **No claim** (grey) | missing data, below a threshold, switched off |
| **Furniture** (blue) | links, borders, bar fills; never used to say something |

Magnitude steps (present / notable / extreme):

| Field | 1 | 2 | 3 |
|---|---|---|---|
| RVOL | ≥ 1.5× | ≥ 3× | ≥ 5× |
| Float (smaller is louder) | ≤ 50M | ≤ 20M | ≤ 10M |
| Market cap (smaller is louder) | ≤ $2B | ≤ $300M | ≤ $50M |
| Short % | ≥ 5 % | ≥ 10 % | ≥ 20 % |
| Days to cover | ≥ 2 | ≥ 5 | ≥ 10 |

---

## Above the cards

| Control | Options |
|---|---|
| Search | ticker or sector text |
| Screener | all, or one screener (cards it ever matched today) |
| News | any · has news · no news · not checked yet |
| Catalyst | any · has catalyst · ⚡ major only · no catalyst |
| Aligned | any · ▲ fully bullish · ▼ fully bearish · either direction |
| Sort | score ↓ · change ↓ · RVOL ↓ · live first · newest found ↓ |

## The score breakdown

Tap the score: the base used (e.g. B4 = 09:40 long), the entry time and bias,
the market regime of this card, which table scored it (a regime-specific
`sub` table, or the `main` table and why), the bias the table read, its
sample count, its confidence, a bar per factor's bucket score, and a button
to open that table.
