-- Trade-Disk logical schema draft (PostgreSQL-style).
-- DESIGN ONLY: review and adapt before applying to any database.
-- No provider, refresh cadence, or scoring formula is selected here.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE stock (
  stock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL,
  instrument_type TEXT NOT NULL DEFAULT 'equity',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stock_symbol (
  stock_symbol_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  symbol TEXT NOT NULL,
  exchange_code TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to TIMESTAMPTZ,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  source_id TEXT,
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE INDEX ix_stock_symbol_lookup ON stock_symbol(exchange_code, symbol) WHERE valid_to IS NULL;
CREATE INDEX ix_stock_symbol_stock ON stock_symbol(stock_id, is_primary);

CREATE TABLE source_registry (
  source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  terms_reference TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE ingestion_event (
  ingestion_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES source_registry(source_id),
  event_type TEXT NOT NULL,
  entity_key TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processing_status TEXT NOT NULL DEFAULT 'received',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_detail TEXT,
  raw_payload JSONB,
  processed_at TIMESTAMPTZ
);
CREATE INDEX ix_ingestion_status_time ON ingestion_event(processing_status, received_at);

CREATE TABLE raw_stock_observation (
  raw_observation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_event_id UUID REFERENCES ingestion_event(ingestion_event_id),
  stock_id UUID REFERENCES stock(stock_id),
  source_id UUID REFERENCES source_registry(source_id),
  source_symbol TEXT,
  observed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL,
  normalization_status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX ix_raw_stock_observation_stock_time ON raw_stock_observation(stock_id, observed_at DESC);

CREATE TABLE sector (
  sector_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_key TEXT NOT NULL UNIQUE,
  sector_name TEXT NOT NULL,
  taxonomy_version TEXT NOT NULL DEFAULT 'internal-v1'
);
CREATE TABLE sector_etf (
  sector_etf_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES sector(sector_id),
  etf_stock_id UUID REFERENCES stock(stock_id),
  etf_symbol TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to TIMESTAMPTZ
);
CREATE TABLE stock_sector_membership (
  stock_sector_membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  sector_id UUID NOT NULL REFERENCES sector(sector_id),
  taxonomy_version TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  source_id UUID REFERENCES source_registry(source_id),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE INDEX ix_stock_sector_current ON stock_sector_membership(stock_id, valid_to);

CREATE TABLE industry_group (
  industry_group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_key TEXT NOT NULL,
  group_name TEXT NOT NULL,
  taxonomy_version TEXT NOT NULL,
  UNIQUE(group_key, taxonomy_version)
);
CREATE TABLE stock_industry_group_membership (
  stock_industry_group_membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  industry_group_id UUID NOT NULL REFERENCES industry_group(industry_group_id),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  source_id UUID REFERENCES source_registry(source_id),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE INDEX ix_stock_group_current ON stock_industry_group_membership(stock_id, valid_to);

CREATE TABLE theme (
  theme_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_key TEXT NOT NULL UNIQUE,
  theme_name TEXT NOT NULL,
  description TEXT
);
CREATE TABLE stock_theme_membership (
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  theme_id UUID NOT NULL REFERENCES theme(theme_id),
  confidence NUMERIC,
  source_id UUID REFERENCES source_registry(source_id),
  as_of TIMESTAMPTZ,
  PRIMARY KEY(stock_id, theme_id)
);

CREATE TABLE stock_quote_observation (
  quote_observation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  source_id UUID REFERENCES source_registry(source_id),
  market_time TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  price NUMERIC,
  previous_close NUMERIC,
  open_price NUMERIC,
  day_high NUMERIC,
  day_low NUMERIC,
  after_hours_price NUMERIC,
  currency_code CHAR(3),
  session_code TEXT,
  source_status TEXT NOT NULL DEFAULT 'unknown',
  raw_observation_id UUID REFERENCES raw_stock_observation(raw_observation_id)
);
CREATE INDEX ix_quote_stock_time ON stock_quote_observation(stock_id, market_time DESC);

CREATE TABLE stock_ohlcv_bar (
  bar_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  timeframe TEXT NOT NULL,
  bar_start TIMESTAMPTZ NOT NULL,
  bar_end TIMESTAMPTZ NOT NULL,
  session_basis TEXT NOT NULL DEFAULT 'regular',
  adjustment_basis TEXT NOT NULL DEFAULT 'unadjusted',
  open_price NUMERIC NOT NULL,
  high_price NUMERIC NOT NULL,
  low_price NUMERIC NOT NULL,
  close_price NUMERIC NOT NULL,
  volume NUMERIC,
  source_id UUID REFERENCES source_registry(source_id),
  source_status TEXT NOT NULL DEFAULT 'unknown',
  UNIQUE(stock_id, timeframe, bar_start, session_basis, adjustment_basis),
  CHECK (bar_end > bar_start),
  CHECK (high_price >= low_price)
);
CREATE INDEX ix_ohlcv_chart ON stock_ohlcv_bar(stock_id, timeframe, bar_start DESC);

CREATE TABLE stock_share_facts (
  share_fact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  as_of DATE NOT NULL,
  shares_outstanding NUMERIC,
  float_shares NUMERIC,
  short_interest_shares NUMERIC,
  short_float_pct NUMERIC,
  days_to_cover NUMERIC,
  institutional_ownership_pct NUMERIC,
  source_id UUID REFERENCES source_registry(source_id),
  source_status TEXT NOT NULL DEFAULT 'unknown',
  UNIQUE(stock_id, as_of, source_id)
);

CREATE TABLE stock_fundamental_period (
  fundamental_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  metric_key TEXT NOT NULL,
  period_type TEXT NOT NULL,
  period_start DATE,
  period_end DATE NOT NULL,
  reported_at DATE,
  value_numeric NUMERIC,
  value_text TEXT,
  unit TEXT,
  currency_code CHAR(3),
  is_estimate BOOLEAN NOT NULL DEFAULT FALSE,
  source_id UUID REFERENCES source_registry(source_id),
  source_status TEXT NOT NULL DEFAULT 'unknown',
  UNIQUE(stock_id, metric_key, period_type, period_end, source_id)
);
CREATE INDEX ix_fundamental_stock_metric_period ON stock_fundamental_period(stock_id, metric_key, period_end DESC);

CREATE TABLE stock_valuation_observation (
  valuation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  metric_key TEXT NOT NULL,
  value_numeric NUMERIC,
  basis TEXT,
  period_end DATE,
  as_of TIMESTAMPTZ NOT NULL,
  currency_code CHAR(3),
  source_id UUID REFERENCES source_registry(source_id),
  source_status TEXT NOT NULL DEFAULT 'unknown'
);
CREATE INDEX ix_valuation_stock_metric_time ON stock_valuation_observation(stock_id, metric_key, as_of DESC);

CREATE TABLE news_article (
  news_article_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_url TEXT,
  publisher TEXT,
  headline TEXT NOT NULL,
  summary TEXT,
  published_at TIMESTAMPTZ,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  category TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  source_id UUID REFERENCES source_registry(source_id),
  UNIQUE(canonical_url)
);
CREATE TABLE stock_news_link (
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  news_article_id UUID NOT NULL REFERENCES news_article(news_article_id),
  relevance NUMERIC,
  why_it_matters TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(stock_id, news_article_id)
);
CREATE INDEX ix_stock_news_recent ON stock_news_link(stock_id, news_article_id);
CREATE TABLE company_event (
  company_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  event_start TIMESTAMPTZ,
  event_end TIMESTAMPTZ,
  timezone TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  source_id UUID REFERENCES source_registry(source_id),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
);
CREATE TABLE macro_event (
  macro_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  event_start TIMESTAMPTZ,
  timezone TEXT,
  region TEXT,
  importance TEXT,
  source_id UUID REFERENCES source_registry(source_id),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
);

CREATE TABLE market_snapshot (
  market_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  as_of TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  source_status TEXT NOT NULL DEFAULT 'unknown',
  schema_version INTEGER NOT NULL DEFAULT 1,
  model_version TEXT,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT
);
CREATE UNIQUE INDEX ux_market_snapshot_current ON market_snapshot(is_current) WHERE is_current;
CREATE TABLE market_index_observation (
  market_index_observation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_snapshot_id UUID NOT NULL REFERENCES market_snapshot(market_snapshot_id),
  symbol TEXT NOT NULL,
  instrument_type TEXT NOT NULL,
  display_name TEXT,
  last_value NUMERIC,
  daily_change_pct NUMERIC,
  weekly_change_pct NUMERIC,
  daily_period_label TEXT NOT NULL DEFAULT 'Day',
  weekly_period_label TEXT NOT NULL DEFAULT 'Week',
  source_status TEXT NOT NULL DEFAULT 'unknown',
  UNIQUE(market_snapshot_id, symbol)
);
CREATE TABLE market_model_snapshot (
  market_model_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_snapshot_id UUID NOT NULL REFERENCES market_snapshot(market_snapshot_id),
  horizon TEXT NOT NULL CHECK (horizon IN ('short','mid','long')),
  label TEXT NOT NULL,
  score NUMERIC,
  confidence TEXT,
  rationale TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_version TEXT,
  UNIQUE(market_snapshot_id, horizon)
);
CREATE TABLE market_model_signal (
  market_model_signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_model_snapshot_id UUID NOT NULL REFERENCES market_model_snapshot(market_model_snapshot_id),
  signal_key TEXT NOT NULL,
  label TEXT NOT NULL,
  value_numeric NUMERIC,
  value_text TEXT,
  contribution NUMERIC,
  status TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE market_regime_snapshot (
  market_regime_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_snapshot_id UUID NOT NULL UNIQUE REFERENCES market_snapshot(market_snapshot_id),
  regime_key TEXT NOT NULL,
  label TEXT NOT NULL,
  directional_bias TEXT,
  confidence TEXT,
  rationale TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_version TEXT
);
CREATE TABLE market_sector_snapshot (
  market_sector_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_snapshot_id UUID NOT NULL REFERENCES market_snapshot(market_snapshot_id),
  sector_id UUID NOT NULL REFERENCES sector(sector_id),
  etf_symbol TEXT NOT NULL,
  daily_change_pct NUMERIC,
  weekly_change_pct NUMERIC,
  relative_strength_day NUMERIC,
  relative_strength_week NUMERIC,
  bias TEXT,
  score NUMERIC,
  adx NUMERIC,
  status TEXT,
  source_status TEXT NOT NULL DEFAULT 'unknown',
  UNIQUE(market_snapshot_id, sector_id)
);
CREATE TABLE market_industry_group_snapshot (
  market_industry_group_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_snapshot_id UUID NOT NULL REFERENCES market_snapshot(market_snapshot_id),
  industry_group_id UUID NOT NULL REFERENCES industry_group(industry_group_id),
  rank INTEGER,
  percentile NUMERIC,
  grade TEXT,
  member_count INTEGER,
  median_relative_strength NUMERIC,
  members_over_rs80_pct NUMERIC,
  three_month_value NUMERIC,
  leaders JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE(market_snapshot_id, industry_group_id)
);
CREATE TABLE market_breadth_snapshot (
  market_snapshot_id UUID PRIMARY KEY REFERENCES market_snapshot(market_snapshot_id),
  advancing_count INTEGER,
  declining_count INTEGER,
  unchanged_count INTEGER,
  distribution_day_count INTEGER,
  distribution_window_days INTEGER,
  vix_value NUMERIC,
  themes JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE stock_indicator_snapshot (
  indicator_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  indicator_key TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_field TEXT,
  timeframe TEXT NOT NULL,
  session_basis TEXT NOT NULL DEFAULT 'regular',
  adjustment_basis TEXT NOT NULL DEFAULT 'unadjusted',
  value_numeric NUMERIC,
  value_secondary NUMERIC,
  status TEXT,
  as_of TIMESTAMPTZ NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  calculation_version TEXT,
  source_status TEXT NOT NULL DEFAULT 'unknown'
);
CREATE INDEX ix_indicator_lookup ON stock_indicator_snapshot(stock_id, indicator_key, timeframe, as_of DESC);
CREATE TABLE stock_technical_level_snapshot (
  technical_level_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  level_type TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  price NUMERIC NOT NULL,
  label TEXT,
  status TEXT,
  confidence NUMERIC,
  invalidation_price NUMERIC,
  as_of TIMESTAMPTZ NOT NULL,
  calculation_version TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE stock_pattern_snapshot (
  pattern_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  pattern_key TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  status TEXT NOT NULL,
  pivot_price NUMERIC,
  breakout_volume_status TEXT,
  invalidation_price NUMERIC,
  confidence NUMERIC,
  as_of TIMESTAMPTZ NOT NULL,
  calculation_version TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE stock_multi_timeframe_snapshot (
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  as_of TIMESTAMPTZ NOT NULL,
  timeframe TEXT NOT NULL,
  trend_label TEXT,
  structure_label TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculation_version TEXT,
  PRIMARY KEY(stock_id, as_of, timeframe)
);

CREATE TABLE stock_canslim_snapshot (
  canslim_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  as_of TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  model_version TEXT NOT NULL,
  overall_status TEXT,
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  missing_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_review_note TEXT
);
CREATE TABLE stock_canslim_factor_evidence (
  canslim_factor_evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canslim_snapshot_id UUID NOT NULL REFERENCES stock_canslim_snapshot(canslim_snapshot_id),
  factor_key CHAR(1) NOT NULL,
  status TEXT,
  grade TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(canslim_snapshot_id, factor_key)
);

CREATE TABLE stock_market_context_snapshot (
  stock_market_context_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  market_snapshot_id UUID NOT NULL REFERENCES market_snapshot(market_snapshot_id),
  stock_sector_membership_id UUID REFERENCES stock_sector_membership(stock_sector_membership_id),
  market_sector_snapshot_id UUID REFERENCES market_sector_snapshot(market_sector_snapshot_id),
  stock_industry_group_membership_id UUID REFERENCES stock_industry_group_membership(stock_industry_group_membership_id),
  stock_group_rank INTEGER,
  stock_relative_strength NUMERIC,
  stock_sector_key TEXT,
  stock_sector_bias TEXT,
  stock_sector_score NUMERIC,
  as_of TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  source_status TEXT NOT NULL DEFAULT 'unknown',
  CHECK (market_sector_snapshot_id IS NULL OR market_snapshot_id IS NOT NULL)
);
CREATE INDEX ix_stock_market_context_current ON stock_market_context_snapshot(stock_id, as_of DESC);

-- Denormalized frontend card. A row is a published version, not the canonical source of facts.
CREATE TABLE stock_card_snapshot (
  stock_card_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  market_snapshot_id UUID REFERENCES market_snapshot(market_snapshot_id),
  stock_market_context_snapshot_id UUID REFERENCES stock_market_context_snapshot(stock_market_context_snapshot_id),
  canslim_snapshot_id UUID REFERENCES stock_canslim_snapshot(canslim_snapshot_id),
  quote_observation_id UUID REFERENCES stock_quote_observation(quote_observation_id),
  as_of TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  schema_version INTEGER NOT NULL DEFAULT 1,
  source_status TEXT NOT NULL DEFAULT 'unknown',
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  card_payload JSONB NOT NULL,
  upstream_versions JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX ux_stock_card_current ON stock_card_snapshot(stock_id) WHERE is_current;
CREATE INDEX ix_stock_card_stock_asof ON stock_card_snapshot(stock_id, as_of DESC);

CREATE TABLE stock_technical_read_snapshot (
  technical_read_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  timeframe TEXT NOT NULL,
  parameter_set JSONB NOT NULL DEFAULT '{}'::jsonb,
  as_of TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  schema_version INTEGER NOT NULL DEFAULT 1,
  source_status TEXT NOT NULL DEFAULT 'unknown',
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL,
  upstream_versions JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX ix_technical_read ON stock_technical_read_snapshot(stock_id, timeframe, as_of DESC);
CREATE TABLE stock_fundamental_read_snapshot (
  fundamental_read_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  as_of TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  schema_version INTEGER NOT NULL DEFAULT 1,
  source_status TEXT NOT NULL DEFAULT 'unknown',
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL,
  upstream_versions JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX ux_fundamental_read_current ON stock_fundamental_read_snapshot(stock_id) WHERE is_current;

CREATE TABLE filter_definition (
  filter_definition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filter_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  value_type TEXT NOT NULL,
  supported_operators JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_timeframes JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  supports_length BOOLEAN NOT NULL DEFAULT FALSE,
  supports_field_comparison BOOLEAN NOT NULL DEFAULT TRUE,
  supports_percent_distance BOOLEAN NOT NULL DEFAULT FALSE,
  config_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE screener_definition (
  screener_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT,
  screener_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  definition_version INTEGER NOT NULL DEFAULT 1,
  sort_spec JSONB NOT NULL DEFAULT '{"field":"score","direction":"desc"}'::jsonb,
  result_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_screener_owner_name ON screener_definition(owner_id, name);
CREATE TABLE screener_filter_group (
  filter_group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screener_id UUID NOT NULL REFERENCES screener_definition(screener_id) ON DELETE CASCADE,
  parent_group_id UUID REFERENCES screener_filter_group(filter_group_id) ON DELETE CASCADE,
  join_operator TEXT NOT NULL CHECK (join_operator IN ('AND','OR')),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE screener_condition (
  screener_condition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filter_group_id UUID NOT NULL REFERENCES screener_filter_group(filter_group_id) ON DELETE CASCADE,
  filter_definition_id UUID NOT NULL REFERENCES filter_definition(filter_definition_id),
  left_operand JSONB NOT NULL,
  operator_key TEXT NOT NULL,
  right_operand JSONB,
  percent_distance NUMERIC,
  indicator_parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE screener_column (
  screener_id UUID NOT NULL REFERENCES screener_definition(screener_id) ON DELETE CASCADE,
  column_key TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  width_px INTEGER,
  PRIMARY KEY(screener_id, column_key)
);
CREATE TABLE screener_schedule_window (
  schedule_window_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screener_id UUID NOT NULL REFERENCES screener_definition(screener_id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  timezone TEXT NOT NULL,
  start_local TIME NOT NULL,
  end_local TIME NOT NULL,
  interval_minutes INTEGER NOT NULL CHECK (interval_minutes >= 1 AND interval_minutes <= 60),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  exchange_calendar_key TEXT,
  CHECK (end_local > start_local)
);
CREATE TABLE screener_run (
  screener_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screener_id UUID NOT NULL REFERENCES screener_definition(screener_id),
  definition_version INTEGER NOT NULL,
  status TEXT NOT NULL,
  triggered_by TEXT NOT NULL DEFAULT 'scheduler',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  market_snapshot_id UUID REFERENCES market_snapshot(market_snapshot_id),
  result_count INTEGER,
  error_detail TEXT,
  run_metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX ix_screener_run_recent ON screener_run(screener_id, started_at DESC);
CREATE TABLE screener_run_result (
  screener_run_id UUID NOT NULL REFERENCES screener_run(screener_run_id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  stock_card_snapshot_id UUID REFERENCES stock_card_snapshot(stock_card_snapshot_id),
  rank INTEGER NOT NULL,
  matched BOOLEAN NOT NULL DEFAULT TRUE,
  sort_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY(screener_run_id, stock_id)
);
CREATE INDEX ix_screener_result_rank ON screener_run_result(screener_run_id, rank);
CREATE TABLE user_stock_list_item (
  owner_id TEXT NOT NULL,
  stock_id UUID NOT NULL REFERENCES stock(stock_id),
  list_key TEXT NOT NULL DEFAULT 'shortlist',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  PRIMARY KEY(owner_id, stock_id, list_key)
);

CREATE TABLE publication_event (
  publication_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  snapshot_id UUID,
  event_status TEXT NOT NULL DEFAULT 'building',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  schema_version INTEGER NOT NULL DEFAULT 1,
  validation_report JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX ix_publication_status ON publication_event(event_status, created_at);
