# Trade-Disk — Logical Database Schema Draft

This is a logical, relational schema blueprint for implementation planning, not a migration to run unchanged. PostgreSQL is used only as the illustrative SQL dialect in `schema.sql`; the architecture is not committed to a vendor.

## A. Canonical/normalized entities

### Identity and classification
- `stock`: immutable internal ID, canonical name, instrument type, active state.
- `stock_symbol`: ticker, exchange/MIC, valid-from/to, primary flag; unique by exchange + symbol + validity policy.
- `sector`, `sector_etf`, `stock_sector_membership`: effective-dated mapping from a stock to its sector and representative ETF.
- `industry_group`, `stock_industry_group_membership`: separate effective-dated stock-to-industry-group mapping and taxonomy version.
- `theme`, `stock_theme_membership`: descriptive stock/theme relationship.

### Raw/source observations and fundamentals
- `source_registry`, `ingestion_event`, `raw_stock_observation`: provenance, raw payload pointer/JSON, received time, processing state and error.
- `stock_quote_observation`, `stock_ohlcv_bar`: market facts, source timestamp, timeframe/session/adjustment basis.
- `stock_share_facts`: shares outstanding, float, short interest, days-to-cover, effective/as-of date.
- `stock_fundamental_period`: metric values by fiscal period, reported date, currency/unit and reported/estimated status.
- `stock_valuation_observation`: valuation ratios with basis/period and as-of.
- `news_article`, `stock_news_link`, `company_event`, `macro_event`: news and event provenance/linkage.

### Analysis outputs
- `stock_indicator_snapshot`: indicator ID + full parameters/source/timeframe/session basis + value/status/as-of + calculation version.
- `stock_technical_level_snapshot`, `stock_pattern_snapshot`, `stock_multi_timeframe_snapshot`.
- `stock_canslim_snapshot`, `stock_canslim_factor_evidence`: published CAN SLIM output and per-factor evidence/version.
- `market_snapshot`, `market_index_observation`, `market_model_snapshot`, `market_model_signal`, `market_regime_snapshot`.
- `market_sector_snapshot`: market-wide sector ETF bias/score/ADX/status/performance for a specific market snapshot.
- `market_industry_group_snapshot`: market-wide group ranking for a specific market snapshot.
- `stock_market_context_snapshot`: selected stock's own sector/group context, foreign-keyed to the stock, its sector membership and the applicable market snapshot/sector row. Never treat this as the market-wide sector table itself.

### User screener configuration and result sets
- `screener_definition`: stable ID, owner/account, name, description, built-in/custom flag, enabled flag, default sort and result preferences.
- `filter_definition`: filter catalogue metadata (type, supported operators, units, supported timeframe/source/length controls and validation schema).
- `screener_filter_group`: nested AND/OR groups.
- `screener_condition`: typed left operand, operator, typed right operand/value, distance percent and indicator parameter JSON as appropriate.
- `screener_column`: visible result columns and order.
- `screener_schedule_window`: one row per independent window with timezone, start/end, interval and enabled state.
- `screener_run`: each actual execution attempt, config version, started/finished time, status, data snapshot/as-of and counts.
- `screener_run_result`: result rows linked to one run and one stock, rank/sort values, compact result payload and stock snapshot ID.
- `user_stock_list_item`: per-user shortlist/favorite relationship.

## B. Read-optimized snapshots/materialized projections

These tables/views are intentionally denormalized for fast frontend reads and are rebuilt from canonical facts. They are not authoritative source data.

- `stock_card_snapshot`: compact header + Overview card fields + selected technical summary + CAN SLIM summary + recent news preview + `stock_market_context_snapshot_id`.
- `stock_technical_read_snapshot`: technical page's indicators, ranges, chart series reference and levels for one stock/timeframe/parameter-set.
- `stock_fundamental_read_snapshot`: latest reported fundamentals, valuation, business context, company events and news references.
- `market_dashboard_snapshot`: one `market_snapshot_id` bundle of indices, model outputs, regime, sectors, groups, breadth, volatility and themes.
- `screener_run_result`: pre-evaluated results so opening T1 doesn't require scanning all raw tables on the frontend read path.

Each read model needs a stable snapshot ID, schema version, as-of timestamp, published timestamp, source/freshness state and the relevant upstream snapshot IDs. Publish a new version and atomically switch the current pointer after the bundle is complete.

## C. Relationships that matter most

1. A stock has one current effective sector membership (unless a deliberate multi-sector classification is adopted) and may have a separate industry-group membership.
2. A market snapshot has many index observations, sector rows and market industry-group rows.
3. `stock_market_context_snapshot` links one stock to the sector row from a named market snapshot; stock-specific context is therefore reproducible and time-aware.
4. A screener definition has many filter groups, conditions, columns and schedule windows; it has many runs; each run has many stock results.
5. Each screener result references the stock card snapshot used to evaluate it, making the displayed values explainable and consistent.
6. A stock can appear in multiple screener results without duplicated stock master rows.
7. Fundamental facts are period-based; quote/technical facts are time-series or as-of-based; don't force them into one universal timestamp.
