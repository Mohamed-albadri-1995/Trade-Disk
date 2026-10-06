# The data model

**Trunk section:** [§5 The data architecture](../ARCHITECTURE.md#5-the-data-architecture).

Every table of the new desk in one place: its owner (the only writer), its
key, its columns, and the legacy store it replaces. The domain leaves describe
what each table means; this leaf is the schema and the map from the old data.

**Built on:** the three legacy data models,
[screeners](../legacy/screeners/DATA-MODEL.md), [qp](../legacy/qp/DATA-MODEL.md) and
[journal](../legacy/journal/DATA-MODEL.md), and the contracts section of every
design leaf.

---

## Contents

1. [Conventions](#1-conventions)
2. [The tables, by domain](#2-the-tables-by-domain)
3. [The fact families](#3-the-fact-families)
4. [From the legacy stores](#4-from-the-legacy-stores)
5. [Retention and size](#5-retention-and-size)

---

## 1. Conventions

| Rule | Meaning |
|---|---|
| one writer | every table names its owner; no other component writes it |
| instants | `timestamptz`, stored in UTC |
| trading days | `date`, the New York date |
| clock times | `HH:MM` New York, only for configuration (capture minutes, windows) |
| JSON | `jsonb` for documents that are read whole (a card, a strategy, rules) |
| honest null | a missing value is `NULL` in a column, or a `status` with a `reason` on a fact; never 0 |
| versions | definitions that change (screeners, strategies, settings, models, the photo) carry a version; results record the version that produced them |
| migrations | numbered, run once, recorded; never a start-up repair |
| symbols | canonical ticker (no exchange prefix); `tv_symbol` kept beside it where TradingView needs it |

---

## 2. The tables, by domain

### Platform ([PLATFORM.md](PLATFORM.md))

| Table | Key | Columns |
|---|---|---|
| `trading_calendar` | day | `is_open`, `open_at`, `close_at` (half days), `note` |
| `users` | id | name, password hash (scrypt), created |
| `sessions` | id | user, created, expires, last seen, user agent |
| `jobs` | job | domain, schedule, calendar, enabled, expected_within, max_duration |
| `job_runs` | job, started_at | ended_at, result (`ok`, `failed`, `missed`, `hung`), counts (jsonb), error, stack |
| `settings` | key, scope | value, type, range, default, description, version |
| `setting_versions` | key, scope, version | value, changed_at, changed_by |
| `alerts_sent` | id | signal, sent_at, message, recovered_at |
| `backups` | night | manifest (jsonb), verified, row counts, size |

### Sources ([SOURCES.md](SOURCES.md))

| Table | Key | Columns |
|---|---|---|
| `source_calls` | adapter, day | calls, failures, last_error, last_error_at, p50 / p95 duration |
| `health_checks` | check, at | severity (`ok`, `degraded`, `down`), detail, fix |

Bars live in the Parquet cache (per feed, ticker, timeframe), outside the
database, with its limits.

### Tools and screeners ([TOOLS-AND-SCREENERS.md](TOOLS-AND-SCREENERS.md))

| Table | Key | Columns |
|---|---|---|
| `tools` | id | name, description, accent, status (running, paused, archived, deleted), paused_at, paused_reason, capture_r1, entry_a, entry_b, capture_why, role (method, control, benchmark), created_at |
| `screeners` | tool, key | name, status, mirror_of, purpose (cards, list), direction (long, short, either) |
| `screener_versions` | tool, key, version | rules (jsonb), sort, limit, run_window, check_window, floor, post_tests (jsonb), created_at, note |
| `scan_reports` | tool, at | screeners asked, rows, drops by reason (jsonb), candidates, new cards, ms, errors |

### Card ([CARD.md](CARD.md))

| Table | Key | Columns |
|---|---|---|
| `facts` | subject, family, known_at | value (jsonb), status (`ok`, `none`, `unavailable`), reason, source, as_of |
| `cards` | ticker, day | the latest projection (jsonb) of every family, `market_state_id`, updated_at |
| `tool_cards` | tool, ticker, day | screener_matches (jsonb: key, version, first match), first_seen, live, last_matched_at, star, manual_bias, score (jsonb: question, value, model version, sample, interval, breakdown) |

`facts` is the fact store of the trunk ([§5.2](../ARCHITECTURE.md#52-the-fact-store)),
shared by the card, market and research domains; each family has one writer
(§3).

### Market ([MARKET.md](MARKET.md))

| Table | Key | Columns |
|---|---|---|
| `market_states` | id | at, day, indexes, sectors, short_term, mid_term, long_term, regime, oneil_m, oneil_l_ref, status, definition version (each jsonb where structured) |
| `hot_sector_days` | sector, day | best_score, days_at_40, days_under_20, hot, hot_since |

### Registers ([REGISTERS.md](REGISTERS.md))

| Table / view | Key | Columns |
|---|---|---|
| `r1_photos` | tool, day, ticker | captured_at, card (jsonb), tool_card (jsonb), market_state_id, capture_version |
| `r2_slots` (view) | tool, day, slot | from `market_states` |
| `bars_day` | ticker, day | 1-minute and daily bars used for outcomes (or a pointer to the Parquet file) |
| `r3_outcomes` | tool, day, ticker, entry | entry_price, hh, ll, atr14, up_r, down_r, or_high, or_low, result, reason, captured_at |
| `r4` (view) | tool, day, ticker, entry | `r1_photos ⋈ r3_outcomes` |
| `r4_uploads` | tool, day, ticker, entry, source | the row (jsonb), uploaded_at |
| `shortlist` | tool, day, ticker | added_at, method, price, change, sector, score, exported_at |

### Learning ([LEARNING.md](LEARNING.md))

| Table | Key | Columns |
|---|---|---|
| `models` | tool, question, version | features, coefficients, scaler, training window, sample, walk-forward metrics, published, reason, trained_at |
| `scorecards` | tool, screener key, screener version, entry, computed_on | cards, days, good %, interval, big %, median R, average R, adverse R, days hit, verdict, thresholds version |

### Quant ([QUANT.md](QUANT.md))

| Table | Key | Columns |
|---|---|---|
| `strategies` | id | name, current version, stage, tools |
| `strategy_versions` | id, version | document (jsonb), created_at |
| `backtests` | id | name, spec (jsonb), strategy versions, status, progress, summary, error, created_at, updated_at |
| `backtest_trades` | id | backtest, day, symbol, side, entry_at, exit_at, entry, exit, ret, reason, ctx (jsonb: the register columns of its card) |
| `alerts` | strategy, symbol, bar_at | strategy version, sent_at, pushed |
| `primitive_approvals` | primitive, commit | approved_by, approved_at, notes (mirrors `approvals.json`) |

### Journal ([JOURNAL.md](JOURNAL.md))

| Table | Key | Columns |
|---|---|---|
| `accounts` | id | name, broker, paper, every_minutes, look_back_days, enabled, last_run (jsonb) |
| `fills` | account, external_id | at, symbol, side, qty, price, fees, order_id, source |
| `trades` | id | account, symbol, direction, entry_at, exit_at, entry, exit, shares, stop, target, gross, fees, net, status, setup, notes, tags, touched_by_trader |
| `trade_fills` | trade, fill | portion |
| `setups` | id | name, description, enabled |
| `trade_snapshots` | trade | facts as of the entry (jsonb), market_state_id, r1 reference, mae, mfe |
| `day_notes` | day | note, updated_at |

---

## 3. The fact families

Every family is a row type in `facts`. Its writer, its subject and its clock:

| Family | Subject | Writer | Clock |
|---|---|---|---|
| `quote` | ticker | card engine | 5 minutes |
| `derived` | ticker | card engine | with the quote |
| `short_interest` | ticker | card engine | daily |
| `borrow` | ticker | card engine | daily |
| `reg_sho` | ticker | card engine | settlement day |
| `news` | ticker | card engine | each scan, live cards |
| `catalyst`, `bias` | ticker | card engine | with news / quote |
| `themes` | ticker | card engine | daily |
| `move_tests` | ticker | card engine (discovery) | at discovery |
| `market_context` | ticker | card engine (from the market state) | each scan |
| `bars_universe`, `group_ranking`, `oneil_m` | `market` | research worker | each close |
| `rs_rating`, `rs_line`, `sic`, `oneil_l`, `oneil_c`, `oneil_a`, `oneil_s`, `oneil_i`, `oneil_n_base`, `oneil_n_events`, `oneil_ratings` | ticker | research worker | per [ONEIL.md](ONEIL.md) §6.1 |

---

## 4. From the legacy stores

Every legacy store, and where its data goes. All of it is imported once,
running and archived tools alike, and the import is checked by row counts
([MIGRATION.md](MIGRATION.md)).

### A screener tool's database (`data/tradedesk.db`, `data/t<n>.db`)

| Legacy table | New home |
|---|---|
| `screeners` | `screeners` + version 1 of `screener_versions` (later edits unknown: recorded as such) |
| `settings` (live keys) | `settings` (scope: the tool); `tool.name`, `tool.paused` → `tools` |
| `settings` (31 dead keys) | not carried |
| `scheduler_jobs` | `jobs` (custom schedules kept) |
| `r0_checkpoint` | not carried (a live list; today's comes from tool cards) |
| `r1_frozen` | `r1_photos` (the card JSON split into card and tool card; no screener versions or market state id for old days: recorded as such) |
| `r2_market_snapshots` | `market_states` (old days, with the O'Neil status left blank where it was read at export: D-D3) |
| `r3a`, `r3b` | `r3_outcomes` (entry A, B) |
| `r4a_train`, `r4b_train` (source `capture`) | not carried: `r4` is a view |
| `r4a_train`, `r4b_train` (source `upload`) | `r4_uploads` |
| `shortlist` | `shortlist` (one row per item) |
| `analysis_model` | not carried (dead) |

### Shared files in `data/`

| Legacy file | New home |
|---|---|
| `tools.config.json` + `tools.local.json` | `tools` |
| `tool-stages.json` | `tools` |
| `industry-map.json` | `facts` (`sic`), research worker |
| `oneil-market.json`, `oneil-groups.json`, `oneil-13f.json`, `oneil/` | `facts` (`oneil_*`), rebuilt by the research worker; the latest files imported as of their dates |
| `shortlist-all.json` | not carried (a query over `shortlist`) |
| `keys.json`, `r2.json`, `auth.json`, `journal-accounts.json` | the secret store (`auth.json` → `users`) |

### qp

| Legacy store | New home |
|---|---|
| `~/.qp/platform.db` `strategies` | `strategies` + `strategy_versions` (version 1) |
| `backtests`, `backtest_trades` | `backtests`, `backtest_trades` (frozen strategy copies kept in `spec`) |
| `~/.qp/strategies/*.json` | nightly export (backup) |
| `chart/seeds/*.json` | versioned migrations |
| `approvals/approvals.json` | stays in git; mirrored to `primitive_approvals` |
| `.default-feed` | `settings` |
| `screener_sources.json` | not carried (registers are read from the database) |
| oplog | logs |
| `~/.qp-cache/` (bars) | the Parquet cache |
| `~/.qp-cache/grouped/`, `sic/`, `f13/`, `canslim/` | rebuilt by the research worker into `facts` |

### The journal (`data/journal/journal.db`)

| Legacy table | New home |
|---|---|
| `journal_trades` (Alpaca) | `trades`, re-derived from their fills by the new pairing engine and compared ([JOURNAL.md](JOURNAL.md) §6) |
| `journal_trades` (file imports, manual) | `trades` (with a note where the legacy pairing is known to be wrong: D-J1, D-J2) |
| `trading_setups` | `setups` |
| `journal_daily_notes` | `day_notes` |
| `journal_fee_profiles` | `accounts` (fee rule) |
| `journal_technical_snapshots`, `journal_context_snapshots`, `journal_conditions`, `journal_setup_templates`, `trade_cards`, `trade_card_checks`, `check_library`, `setup_check_assignments` | not carried (recomputed from the fact store where wanted) |
| the old app's tables (`r0`–`r4` copies, `trading_*`, `volume_baseline`, …) | not carried |

### Models

`src/scoring/outputs*` are not imported: the new models are trained from R4.

---

## 5. Retention and size

| Data | Kept | Note |
|---|---|---|
| `facts` | `quote` facts: 30 days at 5-minute grain, then the last per day; everything else: forever | the quote is most of the volume |
| `cards`, `tool_cards` | forever | small |
| `market_states` | 30 days at scan grain, then the R2 slots and the close per day | — |
| `r1_photos`, `r3_outcomes`, `shortlist` | forever | the research record |
| `job_runs`, `health_checks`, `source_calls` | 90 days | — |
| `backtests` | until deleted | — |
| `trades`, `fills` | forever | — |
| bars cache | by size and free disk | rebuildable |

The legacy backup was about 17 MB compressed a night for everything; the new
database starts at roughly the same size and grows mainly with R1 photos (a few
MB a month per tool) and quote facts (bounded by the retention above).
