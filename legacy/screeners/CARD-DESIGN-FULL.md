# Complete Screener Stock Card — Design Specification

**Source of truth:** `legacy/screeners/CARD.md`, `CARD-FIELDS.md`, `DATA-PIPELINE.md`, `REGISTERS.md`, `API.md`, and the current `buildCard()` behavior documented there. This specification formalizes the full card, not a replacement screener or a new scoring model.

## 1. What a card represents

One card represents one ticker in one screener tool's current-day registry. It combines:
- The latest shared market facts available for that ticker.
- The screeners that have matched it in this tool today and when they first matched.
- This tool's own shortlist decision.
- Cross-tool shortlist membership as a label only.
- Server-computed technical relationships, market context, catalyst/news and optional CANSLIM data.
- The model score and its explanation when the scorer returns them.

**Data ownership:** all displayed fields are read from the tool's R0 record or its documented enrichment routes. Scanners populate R0; enrichment fills missing facts; scoring reads R0 and writes the score and score details back; the card renders those values. The browser must not independently recalculate market indicators, market regime, catalysts, score, or historical outcomes.

**Historical integrity:** today's card uses R0. A past-date card uses the frozen R1 JSON for that tool/date. It must never silently fill historical gaps from today's values. A card is a view, not a new data source.

## 2. Layout hierarchy

Use one responsive card with a compact, scannable top and eleven first-level disclosure sections. Keep exactly one fold level: no nested "Details" button around the folds. Closed folds must show useful one-line summaries.

### A. Header

Left:
- Ticker in bold, largest text in the card; click opens the full chart overlay.
- TradingView external-link icon, built from the record's `tvSymbol` (never guess an exchange).
- Price in plain text and today's percentage change. Green/red means direction only.
- Sector and industry on the second line.

Right:
- Live/Stale state.
- Score 0–100 or em dash if absent.
- Score table label (e.g. B4 main or B4 sub:STRONG_UP).
- This tool's own shortlist star.
- Score and table labels are separate click targets opening their relevant explanation.

Live means the ticker matched a screener in the last scan. Stale means it matched earlier today but not the latest scan; stale cards are visually dimmed but remain available because the tool keeps the entire day's R0 set.

### B. Discovery and context badges

Order:
1. First-seen time and time relative to 09:30 ET: pre-market, at open, minutes after open. Style pre-market/early/late distinctly.
2. Cross-tool shortlist label such as "★ also T2 T7", violet. It never changes this tool's own shortlist state.
3. One badge for every screener that matched this ticker today, with first-match time. Faded badge = matched earlier but not on the latest scan. Tooltip shows its run window.
4. HOT when the sector model marks its sector hot.
5. ALL BULL / ALL BEAR only when the documented full alignment predicate is true. Bull: price above EMA9/13/20/50, SMA5, VWAP, previous close, open and PM low; EMA stack 9>13>20>50; bullish catalyst. Bear is the documented mirror using PM high.
6. Catalyst label and additional-catalyst count. Tier 1 uses lightning, tier 2 dot, tier 3 subdued dot, technical catalyst a chart/arrow marker. Old stories (>4 days) are dimmed. Tooltip shows tier, detail, corroborating headline count, age, confidence and evidence headline.

### C. Technical signal tags

One compact wrapping row. Show only tags with valid source values:
- Relative-to-level: EMA9, EMA13, EMA20, EMA50, SMA5, VWAP, previous close (PDC), open, PM high, PM low. Up triangle/green means price above; down triangle/red means below. Tooltip gives percentage distance.
- EMA stack: 9>13>20>50, 9<13<20<50, or MA mixed; include ordered count where supplied.
- Month range quartile: Q1 through Q4.
- PM/ADR band: <0.5, 0.5–1, 1–2, 2–3, 3+, plus ratio.

Do not render a tag for a missing level.

## 3. Eleven disclosure sections

Every section is collapsed by default and has a compact summary except the chart row, whose summary is "tap to open". Keep the section order below.

### 1. Chart
- Closed summary: "Tap to open".
- On opening, mount the TradingView daily chart only when the card is in view and the fold is open.
- Dark daily chart with no toolbar; provide a full-chart action.
- If the widget script fails, show a clear chart-unavailable message rather than an empty blank area.
- Do not load every chart for every off-screen card.

### 2. Volume & Float
Summary: RVOL, market cap, float and days to cover.
Open fields: relative volume; market capitalization; float shares; short-interest percentage; days to cover.
Use magnitude intensity, not direction coloring:
- RVOL: notable ≥1.5×, stronger ≥3×, extreme ≥5×.
- Float (smaller is louder): ≤50M, ≤20M, ≤10M.
- Market cap (smaller is louder): ≤$2B, ≤$300M, ≤$50M.
- Short interest: ≥5%, ≥10%, ≥20%.
- Days to cover: ≥2, ≥5, ≥10.
These colors say magnitude, never that a stock is good or bad.

### 3. Range
Closed summary: W/M/Q/Y position percentages.
Open: weekly (5 sessions), monthly, quarterly and yearly low/high with a position bar and current price marker. Show all-time-high distance separately because no all-time low is paired with it.
- If a longer window high is more than 10× the next shorter window's high, hide that window and every wider window, including ATH distance; explain the suspected split-adjustment issue.
- If adjacent windows have identical low and high, label the duplicate (e.g. "= month") instead of showing a broken-looking bar.
- Q/Y may be unavailable when the symbol lacks enough history; explain why.

### 4. News
Closed summary: story count and top headline, or "Nothing in three weeks".
Open: up to five newest headlines across available sources; source tag (TV, BZ, FH, GN, YH, SEC), age and external link. Show failed/unavailable sources, count of older hidden stories and last fetch time. If not fetched yet, show Load News. Catalyst and news are related but not interchangeable.

### 5. CANSLIM · O'Neil
Closed summary: one-line C/A/N/S/L/I/M summary.
Open: the seven letter summaries, relative-strength line state and divergence. A "Not shown" line lists every missing letter and why. A single nested "Full tables" fold contains:
- C: eight quarterly rows with period, EPS, year-ago EPS, % change, sales, year-ago sales, sales change, margin, acceleration and beat count.
- A: annual EPS, growth, ROE, three-year growth, stability, ROE-floor comparison, plus the independently sourced annual sum from four quarters.
- N: weekly base weeks, lip/week, low/week, depth, waves down, accumulation, handle, pivot distance and checks.
- S: shares outstanding and basis/date, share-count change and comparison dates, float, float percentage, short interest/basis/as-of, days to cover, up/down volume and accumulation/distribution.
- L: group, roll-up explanation, rank/percentile, RS in group and rotation when available.
- I: funds, change and direction; explain missing 13F/CUSIP match.
- M: market status and distribution-day check details.
Use qp-backed `/api/market/oneil/*` routes as documented. Never calculate CANSLIM in the card. Missing letters must include the reason; a loss-base percentage or insufficient history is not a bug.

### 6. Themes
Closed summary: "Tap to open".
Open: theme tags from the ticker and industry lists. Themes are labels/context, not filters added by the card.

### 7. Market Context
Closed summary: regime, long-term and short-term stance.
Open: regime icon/name/label and color, long/mid/short trend, sector name/bias/score and HOT status. Include the bias control:
- AUTO (long/short and catalyst marker where relevant)
- LONG
- SHORT
- return to AUTO
Manual choice is saved per card and passed into scoring. "No read" is valid when there is no directional evidence. Bias is not a trade order.

### 8. Price
Closed summary: price, gap and VWAP.
Open: price, previous close, VWAP, SMA5, open and gap percentage. Preserve the source's precision and timestamp; don't recompute these from rounded display values.

### 9. EMAs
Closed summary: EMA9, EMA20 and EMA50.
Open: EMA9, EMA13, EMA20 and EMA50. Each value is colored by whether price is above/below that level. Missing EMA is explicitly unavailable; do not render a fabricated value.

### 10. ATR & Move
Closed summary: ADR% and today's range divided by ATR.
Open: ADR dollars, ADR percentage, high/low, today's range and range ÷ ATR. Use the field's documented definition, and do not call range/ATR a forecast or a guaranteed remaining move.

### 11. Pre-Market Range
Closed summary: PM/ADR and PM range.
Open: pre-market high, low, range and PM-range/ADR ratio. Explain not available when no valid pre-market data exists.

## 4. Score breakdown

Score tap opens a dedicated popover/modal:
- Score and model/table label.
- Base and entry time (e.g. B4 = 09:40 long), bias used and card's market regime.
- Which table scored it: regime-specific sub-table or main table, with the reason.
- Bias actually read by the table.
- Sample count and confidence.
- Factor-by-factor bucket and contribution bars.
- Link/action to open the exact table inspector.

Score color is orange and reserved for model score. Do not use green/red to imply score quality. If no score exists, show "—", not 0; disable fake score detail and show the actual reason/status when known. Do not copy the legacy scorer's known defects or up-only scorecard grading into a new model.

## 5. Color and typography contract

| Color role | Use |
|---|---|
| Green / red | Direction only: up/down, above/below |
| One hue, four intensities | Magnitude only: RVOL, float, cap, short %, DTC, PM/ADR, sector heat |
| Orange | Model score only |
| Violet | Shortlist membership from other tools |
| Yellow | This user's shortlist star |
| Grey | Missing, unavailable, stale/muted or no claim |
| Blue | UI furniture, links, borders, bars; never a claim |

Use tabular numerals for prices, percent and counts. The ticker and current price lead visually. Badges wrap naturally without clipping; fold summaries ellipsize only the headline, never the ticker, price or key numeric value. On mobile, actions remain reachable without hover and sections do not create page-wide horizontal overflow.

## 6. Card list controls

Above the list:
- Search ticker or sector text.
- Screener filter: all or a screener that matched this ticker at any point today.
- News: any / has news / no news / not checked yet.
- Catalyst: any / has catalyst / major only / no catalyst.
- Alignment: any / fully bullish / fully bearish / either direction.
- Sort: score descending, change descending, RVOL descending, live first, newest first-seen first.

Filters only filter the current tool's cards; they do not change scanner definitions or candidate membership.

## 7. Data contract and source rules

- Live card: the tool's R0 row, including documented `liveNow`, `lastUpdated`, `news`, full `catalyst`, `autoBias`, `seenAt`, `shortlistedBy`, `_scoreDetails` where present.
- Frozen card: complete JSON from that tool/date's R1 `r1_frozen.data`. Keep the same field meanings and display rules.
- R1 route documented in the repo: `/api/warehouse/R1/<date>`. Full-card historical lookup documented in the page spec as `/api/card/:ticker?date=`. Shortlist action: `POST /api/shortlist/toggle/:ticker`; cross-tool label: `/api/shortlist/all-tools`.
- CANSLIM/O'Neil values come through the documented `/api/market/oneil/*` routes and qp.
- Scanner key and definition are stable/versioned. Card rendering never changes a screener's definition.
- Server updates the live card/registry; the Screener tab currently reloads on tab open or Run Scan rather than auto-refreshing itself. A card must show its own last update time so the UI does not imply a fresher render than it has.

### Missing-value semantics

Missing is never zero and never automatically bearish. Show an em dash or "Unavailable" plus a reason when known. Separate:
- normal absence (no catalyst, no news in the window, no pre-market range);
- insufficient history (weekly/annual/RS calculations);
- provider has no value for this symbol (e.g. float);
- not built/not run (QP/13F/model);
- likely data bug (fields expected on every scan, such as ticker/price/change/sector/industry/RVOL or expected W/M positions).
Never fill historical gaps with present-day data.

## 8. Actions and accessibility

- Ticker opens chart; TradingView icon opens the exact external symbol.
- Star toggles this tool's own shortlist via the documented route; other-tool stars are informational only.
- Score opens score breakdown; table label opens table inspector.
- News headline opens source link.
- Each fold is keyboard-operable and has an accessible label and expanded state.
- Tooltips are not the only place required meaning appears; touch users get tap/long-press equivalents.
- Use event delegation for large lists; lazy-mount charts only on visible expanded cards.

## 9. Acceptance checklist

- [ ] Card field order matches this spec and source CARD.md.
- [ ] R0 and R1 cards use the same renderer, with explicit live/historical mode.
- [ ] Every screener badge includes its first-match time and past/current state.
- [ ] Cross-tool shortlist never modifies the local star.
- [ ] Score absence is shown as —, never zero.
- [ ] All ten level tags omit missing levels and show direction/distance.
- [ ] All eleven folds have useful closed summaries and no extra nested fold.
- [ ] Range split-adjustment and duplicate-window safeguards are implemented.
- [ ] News source failures and stale stories are visible.
- [ ] CANSLIM missing letters state why; tables come from QP.
- [ ] AUTO/LONG/SHORT bias persists and is passed to scoring.
- [ ] Colors retain their single semantic meaning.
- [ ] No invented market math, news, score or historical values.
- [ ] Mobile card works without hover or page-level horizontal overflow.
