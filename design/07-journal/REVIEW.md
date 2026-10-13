# Journal review: screens, analysis and product requirements

**Above:** [JOURNAL.md](JOURNAL.md). This is the customer-facing product specification for the Trading Journal on web and Android.

**Purpose.** Preserve the existing journal's substantive capabilities and analytical intent while redesigning the experience. This document is the product source of truth for the journal UI. It is based on [legacy/journal/PAGE.md](../../legacy/journal/PAGE.md), [ANALYSIS.md](../../legacy/journal/ANALYSIS.md), [DATA-MODEL.md](../../legacy/journal/DATA-MODEL.md) and [KNOWN-ISSUES.md](../../legacy/journal/KNOWN-ISSUES.md). The legacy documents are evidence of the existing implementation, not a promise that every old behavior is correct.

## 1. Product principles

1. A trader should be able to record a trade quickly, then add depth when wanted.
2. Every important statistic must be traceable to the trades, dates, fees and filters behind it.
3. A missing value must be shown as unavailable, never silently treated as zero or a failed condition.
4. Entry-time context must use only information that was available at entry. No look-ahead data.
5. Closed-trade performance and open-position exposure must be clearly separated.
6. Web and Android share the same calculations and data model, with responsive layouts rather than two different products.
7. The journal reviews and teaches; it does not place orders or provide a promise of profitability.
8. Import and trade-capture methods are intentionally left open for redesign in IMPORT.md. Do not reproduce the legacy import UI or its assumptions.

## 2. Global shell and navigation

Use the shared Trade-Disk application shell and account access. On desktop, provide a persistent left navigation and a compact top bar. On mobile, use a compact top bar and bottom navigation for the most frequent destinations, with secondary pages under More.

Global controls:
- Date range: today, this week, month, quarter, year, all time, and custom range.
- Account: all accounts or one account.
- Setup: all setups, a selected setup, or untagged trades.
- Symbol search and filters where relevant.
- Clear-filter action, refresh/sync status, last updated time, and visible data-quality warnings.
- Currency and timezone presentation based on account/user settings; retain exchange-local timestamps and daylight-saving correctness internally.
- Light and dark themes, accessible contrast, keyboard support on web, and readable chart labels on mobile.

Navigation destinations:
1. Overview
2. Calendar
3. Trades
4. Analytics
5. Setups
6. Notes / Trading plan
7. Accounts & trade capture
8. Settings

The global date/account/setup scope should persist across analysis pages where meaningful. Each page must state when a metric has a narrower sample or excludes open trades.

## 3. Overview dashboard

Goal: answer “How am I trading over this period?” within seconds.

### Primary metric cards
- Net realized P&L after fees.
- Closed trades, with open trades shown separately.
- Win rate.
- Profit factor.
- Expectancy per trade in currency and R.
- Maximum drawdown in currency and percent.

Each card includes a definition tooltip and comparison to the previous equivalent period when enough data exists. Do not imply that a green color alone means a strategy is sound.

### Main visualizations
- Equity curve of cumulative realized net P&L, with a visible high-water mark and drawdown shading.
- Optional switch between currency, percentage return and R-multiple where the data supports it.
- P&L by day/week/month.
- Win/loss distribution and long-vs-short contribution.
- Performance by setup, with minimum-sample warnings.

### Insight panel
Surface a small number of evidence-based observations, for example:
- best and worst time bucket by net P&L, with sample size;
- setup with strongest expectancy and setup with weakest expectancy, only when sample thresholds are met;
- whether average winners are larger than average losers;
- fees as a share of gross profit;
- current drawdown from peak and recovery status.

Every insight links to the filtered trades behind it. Avoid unsupported AI claims and avoid causal language when data only shows correlation.

## 4. Calendar

- Monthly calendar with Monday–Friday trading days and optional weekend rows for overnight/crypto-capable accounts.
- Each day shows realized net P&L and number of closed trades; open positions are indicated separately.
- Weekly and monthly totals reconcile exactly with the Trades and Analytics pages.
- Select a day to see its trades, notes, gross/net P&L, fees, win rate and trade count.
- Day notes support pre-market plan, market conditions, focus, execution quality, mistakes and end-of-day review.
- Navigate months and jump to the most recent trading day.
- Do not drop weekend trades from the underlying month total; display non-trading-day trades in a separate row or include them consistently.

## 5. Trades list and trade detail

### Trades list
- Search symbol; filter by account, setup, side, open/closed status, date, source, result and tags.
- Sort by newest/oldest, best/worst net P&L, R, duration and symbol.
- Show trade count and summary statistics for the current filter.
- Group by day optionally; table view on desktop and readable cards on mobile.
- Clearly distinguish open positions, partial exits, closed round trips and imported records needing review.
- Bulk tagging and bulk correction may be added without changing historical calculations silently.

### Trade detail
The detail page is the canonical record for one trade:
- Symbol, side, account, setup/strategy, tags and notes.
- Entry and exit timestamps with timezone, quantity, average entry/exit, duration, gross P&L, fees and net P&L.
- Entry price, exit price, stop-loss, target, initial risk, planned reward/risk, realized R and exit reason.
- Fills and partial fills, with weighted average prices and allocation to the round trip.
- Position sizing and risk fields when known; never fabricate a stop or initial risk from the result.
- Trade thesis, planned entry/exit, emotions/focus and rule adherence as optional user-entered fields.
- Technical snapshot at entry, chart, annotations, MAE, MFE, capture/exit efficiency and setup-condition review.
- Links to the corresponding TradeLab chart where available.
- Edit history or at least an updated timestamp for important corrections.

Open trades show unrealized P&L separately from realized P&L, with the quote timestamp and source visible.

## 6. Analytics pages

All pages must use one shared calculation layer and one filter contract. Server and client must not independently calculate competing versions of the same metric.

### 6.1 Performance
- Gross P&L, fees, net P&L.
- Number of closed trades, winners, losers and breakeven trades.
- Win rate; average winner; average loser; payoff ratio.
- Profit factor; expectancy in currency and R.
- Best/worst trade and average P&L per trading day.
- Equity curve, high-water mark, absolute and percentage drawdown, recovery factor.
- P&L standard deviation and distribution.
- Period comparisons with equivalent periods and explicit sample counts.

### 6.2 Risk and R-multiples
- Initial risk per trade and R-multiple, based on a valid stop and actual size.
- Expectancy R and R distribution histogram.
- Maximum drawdown and duration, largest loss, losing streak and risk concentration.
- Risk snapshot: average win/loss, payoff, profit factor, expectancy, fees and exposure where supported.
- Position-size and initial-risk distribution.
- Planned reward/risk versus realized R.
- MAE (maximum adverse excursion) and MFE (maximum favorable excursion), both clearly defined relative to entry.
- Capture ratio / exit efficiency: realized favorable move compared with available MFE, only when the calculation is valid.
- Missing stop, missing fee, incomplete fill or unreliable snapshot warnings.

R must not be calculated if the original stop/risk is unknown or invalid. If stop changes are supported, preserve initial risk separately from later stop movement. R distributions and R-based statistics must display their eligible sample count.

### 6.3 Time analysis
- Performance by entry hour in the exchange's local time, weekday, month and session segment.
- Hold duration: average/median, winners vs losers, and duration distribution.
- Performance by entry price and position-size buckets, with editable/transparent bucket definitions.
- Include overnight trades and timezone/daylight-saving transitions correctly.
- Always show sample sizes; avoid recommending a time bucket based on one or two trades.

### 6.4 Symbol analysis
- Per-symbol trades, net/gross P&L, fees, win rate, expectancy, profit factor, average R and average P&L/trade.
- Best/worst symbols by selected metric, with minimum sample thresholds.
- Separate long/short performance by symbol.
- Search and drill through to underlying trades.

### 6.5 Setup and strategy analysis
- User-managed setups: create, edit, archive, describe and tag.
- Per setup: trade count, net P&L, win rate, profit factor, expectancy in currency and R, average win/loss, drawdown and equity curve.
- Compare setups side by side and compare long vs short variants.
- Conditions checklist: evaluate only conditions with valid entry-time data; display aligned, not aligned, and unknown separately.
- A condition report includes condition definition, sample count, outcome distribution and association with trade results.
- Do not label a setup or condition “profitable” or “predictive” without adequate samples and out-of-sample validation.

### 6.6 Costs and execution
- Commission and regulatory/exchange fees separately where available; total cost and cost per trade/day.
- Gross versus net P&L and fees as a proportion of gross profits.
- Slippage versus a user-defined reference price when that reference exists.
- Entry/exit execution quality and planned-versus-actual values when recorded.
- Breakeven and partial-exit handling must be consistent across all reports.

### 6.7 Long vs short
- Trade count, win rate, net P&L, expectancy, profit factor and average R for each side.
- Show side contribution to total results and risk.
- Apply direction-aware technical-condition rules.

### 6.8 Behavioral and process review
- Winning/losing streaks and daily performance patterns.
- Optional tags for discipline, FOMO, revenge trading, early exit, late entry, overtrading and rule violations; these are user labels, not automatic diagnoses.
- Planned trade vs actual trade, checklist completion and post-trade reflection.
- Review trends over time without shaming language or unsupported psychological conclusions.

## 7. Definitions and calculation rules

The canonical definitions are:
- Closed trade: position/round trip is closed and net P&L is known.
- Winner: net P&L > 0; loser: net P&L < 0; breakeven: net P&L = 0. Breakeven trades count as closed but are neither winners nor losers.
- Net P&L = gross realized P&L minus applicable fees.
- Win rate = winners / eligible closed trades. Show the denominator.
- Profit factor = gross profits from winning trades / absolute gross losses from losing trades. If there are no losses, show “No losing trades” or infinity with a clear explanation, not a misleading finite value.
- Expectancy per trade = total net P&L / eligible closed trades; expectancy R = mean valid R values.
- Payoff ratio = average winning trade / absolute average losing trade.
- R-multiple = realized net P&L divided by initial monetary risk. The stop-distance × quantity formula is only valid where the risk model and units are known.
- Maximum drawdown is measured from the prior equity high-water mark on the ordered equity curve. State the ordering and whether the metric is realized-only.
- Recovery factor = net profit / maximum drawdown; unavailable when drawdown is zero or undefined.
- SQN: use a documented standard formula and display sample count; do not mix formula variants silently.
- Kelly fraction is optional, marked theoretical and unstable for small samples. Never present it as a recommended position size.
- Sharpe and Sortino may be offered as advanced metrics only when a consistent periodic return series, benchmark/risk-free assumptions and annualization method are defined. Do not calculate them from trade P&L as though it were a regular return series.
- Consistency metrics must document the aggregation period and annualization. Label them descriptive, not predictive.
- MAE/MFE must use valid time-aligned bars from entry through exit, not bars after the trade.
- All metrics state whether fees, open trades, partial exits and breakeven trades are included.

## 8. Additional respected methods worth supporting

These extend the existing journal rather than replace its core:
1. **R-multiple framework** for comparing trades across symbols and position sizes.
2. **Expectancy framework** combining win probability and average win/loss.
3. **Equity curve and drawdown analysis**, including drawdown duration.
4. **MAE/MFE and exit-efficiency analysis** for stop placement and exit review.
5. **Setup/condition analysis** with direction-aware conditions and honest unknown states.
6. **Monte Carlo trade-sequence analysis** as an advanced, opt-in feature after the underlying trade and R data is reliable. Show assumptions and simulated ranges; never imply a forecast.
7. **Benchmark comparison** as an optional later enhancement when an appropriate benchmark and synchronized return series exist.
8. **Exportable reports** for trades, calendar, setup statistics and selected analytics.

These are analysis tools, not investment advice. No method guarantees future results.

## 9. Settings and supporting screens

- Accounts: add, test connection, enable/disable, rename and remove; secrets never displayed after save.
- Trade capture: the redesigned capture/import workflow is specified separately in IMPORT.md.
- Setups: full create/edit/archive workflow and setup descriptions.
- Fee profiles: optional per-account fee schedules; estimated fees must be labelled estimated.
- Notes: daily notes and trade-specific notes.
- Technical settings: timezone, market/session definitions, indicator defaults, snapshot calculation status.
- Data quality: failed syncs, unmatched fills, incomplete records, missing fees/stops and stale snapshots.
- Export: CSV and a readable report for selected trades/periods.
- Privacy: explain what broker credentials are stored and how they are protected.

## 10. Responsive layout

### Desktop
- Persistent left navigation.
- Top-level period/account/setup filters.
- Dense tables for trades and setups; charts and metric cards in a clear hierarchy.
- Trade detail can use a main chart/record column and a contextual analysis sidebar.

### Android
- Overview cards in a scrollable two-column or one-column layout based on screen width.
- Calendar optimized for touch.
- Trade capture uses progressive disclosure and sensible defaults; required fields are kept minimal.
- Trade detail uses sections/accordions, with key P&L/risk figures above the fold.
- Charts support tap-to-inspect without hover.
- No desktop-width tables forced into the viewport; use cards or horizontally scrollable data tables only when necessary.

## 11. Delivery priorities

### Launch essentials
- Overview, Calendar, Trades list and Trade detail.
- Fast manual trade capture and a redesigned trade-acquisition flow.
- Stops, targets, fees, setups, notes and tags as first-class editable fields.
- Correct timestamps, fill pairing, open/closed state, long/short, partial exits and duplicate-safe records.
- Performance, Risk, Time, Symbol and Setup analytics.
- Entry-time snapshot without look-ahead; MAE/MFE when valid.
- Accounts and clear sync/data-quality states.
- Responsive web and Android behavior; export.

### Next
- Advanced setup-condition analysis and customizable reports.
- Behavioral/process review.
- TradeLab chart linking and annotations.
- More sophisticated fee/slippage analysis.

### Later
- Monte Carlo sequence analysis.
- Benchmark-relative reports where the data supports them.
- Optional shareable read-only reports.

## 12. Acceptance criteria

- The same filter produces the same metrics on Overview, Analytics, Calendar and exports.
- Every displayed metric has a documented formula, eligible sample count and missing-data behavior.
- Time handling is correct across New York daylight-saving changes and overnight trades.
- Repeated trade capture cannot create duplicates when the same source record is submitted twice.
- Partial fills and partial exits pair correctly; reversals split into separate round trips.
- Fees are included when known and labelled estimated when estimated.
- R-based metrics remain unavailable without valid initial risk.
- Technical snapshots only use information available at entry; no future bars or future market context leak into the analysis.
- A failed import/sync shows what was accepted, what was rejected and why.
- Desktop and Android support the same core capabilities, with responsive presentation.
