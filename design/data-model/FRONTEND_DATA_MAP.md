# Trade-Disk — Frontend-to-Database Data Map

**Status:** Architecture/design contract for backend and database implementation. No database, ingestion provider, refresh cadence, or score formula is selected by this document.

## 1. Goal and non-negotiable model

When an upstream process first discovers a stock and inserts a raw/universe record, downstream processing should enrich and persist the information required by the UI. Frontend reads should fetch already-prepared records and should not calculate technical indicators, score models, market regime, sector bias, relative strength, or join dozens of raw tables at request time.

Use two paths:

1. **Write/enrichment path:** raw discovery → normalize identity → enrich source facts → calculate approved derived metrics → build read snapshots → publish a new snapshot/version.
2. **Read path:** frontend request → read-optimized API/view/table → return a coherent stock or market snapshot immediately.

Refresh frequency and triggers remain deliberately undecided. The schema must support event-driven refresh, scheduled refresh, and explicit refresh without changing the frontend contract.

## 2. Key domain distinction: market-wide vs stock-specific

These are different records and must never be merged into one ambiguous `sector_bias` field.

- **Market dashboard sector bias** is the broad-market module's classification for each sector ETF (e.g., XLE or XLK), at a specific snapshot/as-of time. It powers the Market tab heatmap.
- **Stock-specific sector context** is the sector associated with the selected stock, the applicable sector ETF, and the market-sector snapshot that applies to that stock. A stock overview should show *that stock's mapped sector* and the corresponding sector bias/score, not a generic or arbitrary sector. It is a stock-context projection/relationship, not a new independent sector calculation.
- **Industry group** is another dimension. A stock's industry-group rank/relative-strength evidence is not the same as its sector's ETF bias or the broad market's industry-group leadership table.
- **Stock technical trend** is based on that stock's own price/volume and timeframe. It is not the same as market regime, sector bias, or group leadership.

Required relationships:

`stock → sector membership → sector ETF → market-sector snapshot`

`stock → industry-group membership → stock/group relative-strength facts`

`market snapshot → index observations + short/mid/long model outputs + final regime + sector heatmap + market industry-group rankings`

Every relationship must be time-aware or point to an explicitly published snapshot ID, so a response cannot combine today's stock quote with yesterday's sector classification without exposing the as-of mismatch.

## 3. Frontend surfaces → data contracts → read models

| Frontend surface / interaction | Required read model or endpoint contract | Data origin / relationship | Important rule |
|---|---|---|---|
| Screener landing / result cards | `screener_result_snapshot` joined to `stock_card_snapshot` for the selected `screener_id` and `result_set_id` | Saved screener definition + evaluated conditions + stock snapshot | Selecting T1/T2 is a database query context, not just a visual label. It selects that screener's definition, filters, sort, columns, schedule metadata and latest result set. |
| Screener selector T1/T2/custom | `screener_definition` + `screener_filter_group` + `screener_condition` + `screener_column` + `screener_schedule_window` + latest `screener_run` | Several normalized tables | The tiny selector controls multiple database records. It must resolve to stable IDs, not infer behavior from the display name. |
| Screener filter editor | Filter catalogue/metadata + saved filter groups/conditions | `filter_definition`, `screener_filter_group`, `screener_condition` | Supports field-vs-value, field-vs-field, percentage distance, timeframe/length/source where applicable, AND/OR and nested groups. Store typed operands, not only a human-readable string. |
| Screener schedule settings | `screener_schedule_window` and `screener_schedule` | User configuration | One screener can have multiple windows, each with timezone, start/end, interval, enabled state and later exchange-calendar policy. Configuring a schedule does not itself mean a scan ran. |
| Screener sort, columns, pagination | `screener_definition` preferences + `screener_run_result` ordered by saved sort | Definition and result set | Persist sort keys/direction and visible columns. Result pages should be stable within a run ID. |
| Shortlist | `user_stock_list_item` (or account-scoped equivalent) joined to `stock_card_snapshot` | User/account + stock identity | Favorites are user-specific; don't put them in a global stock table. |
| Stock header | `stock_card_snapshot` / `stock_quote_snapshot` | One stock and one coherent snapshot version | Quote, change, score/status if approved, sector, and as-of/data-quality fields. No browser calculations. |
| Overview chart preview | `stock_card_snapshot.chart_preview` or chart-series endpoint | Selected stock, approved timeframe and snapshot | Lightweight preview payload; full OHLC candles belong to chart/technical read contract. |
| Overview volume/float | `stock_card_snapshot` fields backed by stock liquidity/share facts | Stock-specific | Missing values remain null/N/A, not zero. Snapshot can denormalize float, relative volume, market cap, short interest and days-to-cover. |
| Overview range snapshot | `stock_card_snapshot.range_summary` | Stock's range metrics | Same low/high/current basis as Technical. Overview is a summary of the same facts. |
| Overview recent news | `stock_news_preview` or `stock_card_snapshot.news_preview[]` | News articles related to selected ticker | Preview only; full articles/events stay in Fundamental · Market · News. Include source and publication time. |
| Overview CAN SLIM summary | `stock_canslim_snapshot` | Stock + published CAN SLIM analysis version | UI reads published output; no browser-side scoring or factor inference. Full evidence stays in locked CAN SLIM view. |
| Overview themes | `stock_theme_membership` + optional theme catalog | Stock-specific theme tags | Tags are descriptive unless a separate, approved score model exists. |
| Overview Market Context | `stock_market_context_snapshot` | Selected stock's mapped sector/group + linked broad-market snapshot | This is where the stock-specific sector bias appears. It must be derived for the selected stock's sector and linked to a market snapshot ID. It is not a duplicate of the full Market dashboard. |
| Overview price/EMA/ATR/pre-market summaries | `stock_card_snapshot` fields copied from same technical snapshot | Stock-specific technical calculations | Compact values only; technical detail is the owner. Ensure source snapshot IDs and as-of times align. |
| Technical chart/timeframes | `stock_ohlcv_bar` or prebuilt chart series + `stock_technical_snapshot` | Stock + timeframe + bar aggregation | Read selected timeframe without recomputing indicators in frontend. Store adjustment/session basis. |
| Technical indicators | `stock_indicator_snapshot` / `stock_technical_snapshot` | Stock + timeframe + indicator parameters | Key must include indicator, parameters, source field, timeframe, session/adjustment basis and as-of. RSI(14) 1D is not RSI(14) 15m. |
| Technical support/resistance/setup | `stock_technical_level_snapshot` and `stock_pattern_snapshot` | Stock + timeframe + calculation/version | Keep confidence/status, invalidation, source/engine version and as-of. Unconfirmed must be explicit. |
| CAN SLIM detail | `stock_canslim_snapshot` + factor evidence tables | Stock + analysis version | This module owns factor grades/evidence. Fundamental raw values may be referenced by IDs, not re-scored in UI. |
| Fundamentals/valuation | `stock_fundamental_period` + `stock_valuation_snapshot` | Stock + fiscal period/reporting date | Every metric needs period, currency/unit, source, reported/estimated flag and as-of date. |
| Company news/events | `news_article`, `stock_news_link`, `company_event`, `macro_event` | Article/event linked to one or more stocks | Store publisher, canonical URL, publication time/timezone, category, verification status and ticker relevance. |
| Market index dashboard | `market_snapshot` + `market_index_observation` | Broad market snapshot and SPY/QQQ/DIA/IWM/VIX observations | Market tab owns the broad index dashboard. Daily and weekly periods must be explicit. VIX is an index, not an ETF share price. |
| Market short/mid/long model and final regime | `market_model_snapshot` + `market_model_signal` + `market_regime_snapshot` | Published market-model version | Server supplies all labels, scores, evidence and confidence. Frontend displays, never calculates. |
| Market sector heatmap | `market_sector_snapshot` | Market snapshot + sector ETF | Broad sector bias/score/ADX/status are indexed by sector ETF and snapshot. Do not use as an unscoped global field on a stock. |
| Market industry-group ranking | `market_industry_group_snapshot` | Market snapshot + internal group taxonomy | Separate from the selected stock's own industry-group rank. Taxonomy version and as-of are required. |
| Settings custom screeners | Same normalized screener tables as above | Account/user + screener definition | Create/edit/delete operates on the definition and its child records. Built-in presets should be distinguishable from user-owned screens. |

## 4. The stock arrival/materialization lifecycle

1. **Raw discovery insert:** upstream process writes a stable `stock_id`/ticker identity and a raw observation/ingestion event. This does not imply the record is frontend-ready.
2. **Normalize:** resolve ticker/exchange/security identity, corporate-action/adjustment basis, currency, sector and industry-group memberships. Keep symbol changes and source IDs traceable.
3. **Enrich:** persist quote, OHLCV, share/float facts, fundamentals, news/events, and source metadata when available.
4. **Calculate/publish:** downstream modules generate technical indicators, approved score/CAN SLIM outputs, stock-specific sector context, and relevant relationships. Store algorithm/model versions and source snapshot IDs.
5. **Materialize read models:** write `stock_card_snapshot`, `stock_market_context_snapshot`, technical/fundamental/CAN SLIM snapshots, and applicable screener result rows. These are prepared for direct reads.
6. **Publish atomically:** build a new `snapshot_id`/`published_at` and mark it current only when the required snapshot bundle is coherent. Avoid exposing half-updated combinations.
7. **Refresh dependencies:** when a stock quote, sector classification, market snapshot, technical calculation, or relevant screener definition changes, mark dependent read models stale and rebuild only the affected ones. Refresh policy/cadence is intentionally TBD.
8. **Read:** UI fetches by stable IDs (`stock_id`, `screener_id`, `market_snapshot_id`, `snapshot_id`) and gets precomputed data. Use indexed current pointers and paginated result IDs.

A raw stock row can therefore trigger multiple enrichment writes and can appear in many screeners. Do not duplicate the canonical stock identity for each screener; store screener membership/results as relations.

## 5. Snapshot coherence and freshness contract

Every published read model should expose at least:

- `snapshot_id`
- `stock_id` and/or `market_snapshot_id` where relevant
- `as_of` (time the represented market/source data applies to)
- `published_at` (when this read model became available)
- `source_status` (`live`, `delayed`, `end_of_day`, `demo`, `unavailable`, etc.)
- `is_stale` or an explicit freshness state
- `schema_version`
- source/calculation/model version IDs where applicable

Do not assume one universal timestamp means all facts have the same freshness. Fundamentals are period-based; news uses publication time; market/quotes use market timestamps; schedules use local timezone. Preserve per-domain timestamps when different.

If a value is unavailable, use null plus a reason/status where needed. Never turn missing into zero, a false boolean, or an invented value.

## 6. API/read response shape principles (not a provider/API implementation)

- `GET stock card by stock_id/ticker` should return one prepared card payload and references to the underlying technical/fundamental/CAN SLIM/news snapshot versions.
- `GET screener by screener_id` should return definition/preferences/schedule and latest run metadata; result pages should be requested by `run_id` and cursor/page.
- `GET stock analysis by stock_id` should return the selected stock header plus tab-specific snapshot IDs or a bundled response. It must not re-run the full enrichment pipeline on a read.
- `GET market dashboard` should return one coherent `market_snapshot_id` with index observations, model outputs, sector heatmap, industry-group table, breadth, volatility and themes.
- `GET stock market context by stock_id` should join the stock's sector/group mapping to the correct broad-market snapshot, not return an unqualified `sector_bias` singleton.

Response payloads may denormalize values for fewer round trips; canonical source tables remain normalized. Read model changes must be versioned so the UI can migrate safely.

## 7. Identity and key rules

- Use internal immutable `stock_id` as the foreign key. Ticker is a mutable, exchange-scoped symbol, not a safe global primary key.
- A security identity should include listing/exchange and instrument type. Avoid assuming all ticker strings are globally unique or permanent.
- Screener selection resolves `screener_id`, not just label `T1`.
- Filter operands are typed (number, percent, enum, date/time, field reference, duration, boolean) and validated against a filter catalogue.
- Every technical indicator identity includes its full parameters and timeframe.
- Every sector/industry classification includes a taxonomy/mapping version or effective date.
- Market model and CAN SLIM outputs include model version. Do not encode undocumented score formulas into schema constraints.

## 8. Not decided in this mapping

- Data vendor/provider and acquisition pipeline.
- Database engine/deployment topology.
- Exact refresh frequency, trigger priority, retries and staleness SLA.
- Production score engine/formula and its weights.
- Exact list of supported filter catalogue entries in the first release.
- Exchange calendar/holiday policy and schedule execution service.
- Retention/partitioning policy and legal/licensing limits.

These can be decided independently without changing the ownership boundaries and read-model principles above.
