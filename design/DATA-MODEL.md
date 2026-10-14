# The data model

**Above:** [ARCHITECTURE.md](../ARCHITECTURE.md) §5 (how the blocks share data)
and the **deployment modes** section.

**Talks to:** every block that stores or reads a fact — the
[desk](03-desk/DESK.md) and its [card](03-desk/tool/CARD.md),
[registers](03-desk/tool/REGISTERS.md), [screeners](03-desk/tool/SCREENERS.md)
and [market reader](03-desk/MARKET.md); [qp](05-qp/QP.md); the
[journal](07-journal/JOURNAL.md); the
[research worker](06-research-worker/RESEARCH-WORKER.md); the
[data sources](08-data-sources/DATA-SOURCES.md); the
[shared record](09-shared-record/SHARED-RECORD.md); and, in hosted mode,
[accounts](13-accounts/ACCOUNTS.md) and the [admin dashboard](14-admin/ADMIN.md).

---

## 1. What it is

**The one relational model that every stored fact and every read the front end
makes resolves to.** It was frozen from the approved front end: the field
catalog and data map were traced to tables, and the result is the schema in
[`data-model/schema.sql`](data-model/schema.sql) (49 tables), with its prose in
[`data-model/SCHEMA_DRAFT.md`](data-model/SCHEMA_DRAFT.md), the field→table map in
[`data-model/FRONTEND_DATA_MAP.md`](data-model/FRONTEND_DATA_MAP.md), the field
catalog in [`data-model/FRONTEND_FIELD_CATALOG.md`](data-model/FRONTEND_FIELD_CATALOG.md),
and the write/read lifecycle in
[`data-model/DATA_LIFECYCLE.md`](data-model/DATA_LIFECYCLE.md). PostgreSQL is the
chosen dialect, which the [shared record](09-shared-record/SHARED-RECORD.md) already uses.

**What it owns:** the shape of every table, the keys and the relationships, the
line between a canonical fact and a materialized read, and the rules that keep a
read coherent.

**What it never does:** compute a value (the enrichers do), decide where the
record physically lives (the deployment mode does, §5), or hold a secret
(keys live apart — [BOX.md](01-box/BOX.md) §4.3, [ADMIN.md](14-admin/ADMIN.md)).

---

## 2. Two layers: canonical facts and read models

Every table is one of two kinds. This split is the heart of the model, and the
reason a card never shows a new price beside a stale score.

| Layer | What it is | Rule |
|---|---|---|
| **Canonical** | the authoritative record of one fact family, written by its one producer | normalized; time-aware; never overwritten by a second source ([DATA-SOURCES.md](08-data-sources/DATA-SOURCES.md)) |
| **Read model** (materialized snapshot) | a denormalized bundle built *from* canonical facts for one frontend surface | the UI reads only these; rebuilt on change; **published atomically** (§4) |

The front end reads a read model and nothing else — it never joins canonical
tables or computes a metric ([FRONTEND_DATA_MAP.md](data-model/FRONTEND_DATA_MAP.md) §1).

---

## 3. The tables, by domain and producer

Every table already has a producer in the existing design — which is why the
front end is supported. The producer named is the **solo-mode** writer; in
hosted mode the same role runs as a service (§5).

### 3.1 Identity & classification — *canonical*
`stock`, `stock_symbol`, `sector`, `sector_etf`, `stock_sector_membership`,
`industry_group`, `stock_industry_group_membership`, `theme`,
`stock_theme_membership`.
**Producer:** ingestion + normalization. **Key rule:** the immutable internal
`stock_id` is the foreign key everywhere; the ticker is a mutable,
exchange-scoped symbol, not a global key.

### 3.2 Raw source observations & fundamentals — *canonical*
`source_registry`, `ingestion_event`, `raw_stock_observation`,
`stock_quote_observation`, `stock_ohlcv_bar`, `stock_share_facts`,
`stock_fundamental_period`, `stock_valuation_observation`, `news_article`,
`stock_news_link`, `company_event`, `macro_event`, `publication_event`.
**Producer:** the source [adapters](08-data-sources/DATA-SOURCES.md) (quotes,
bars, short interest, borrow, news) and the research worker (EDGAR fundamentals).
**Key rule:** each fact carries source, `as_of`/`known_at` and status; a missing
value is null + reason, never 0.

### 3.3 Analysis outputs — *canonical (derived / interpretation)*
`stock_indicator_snapshot`, `stock_technical_level_snapshot`,
`stock_pattern_snapshot`, `stock_multi_timeframe_snapshot`,
`stock_canslim_snapshot`, `stock_canslim_factor_evidence`.
**Producer:** the technical enricher (the [qp library](05-qp/LIBRARY.md), the only
market math) for indicators/levels/patterns; the
[research worker](06-research-worker/ONEIL.md) for CAN SLIM.
**Key rule:** an indicator's identity includes its full parameters, source field
and timeframe (RSI(14) 1D ≠ RSI(14) 15m); outputs carry a calculation/model
version.

### 3.4 Market, broad — *canonical*
`market_snapshot`, `market_index_observation`, `market_model_snapshot`,
`market_model_signal`, `market_regime_snapshot`, `market_sector_snapshot`,
`market_industry_group_snapshot`, `market_breadth_snapshot`.
**Producer:** the [market reader](03-desk/MARKET.md) (indexes, regime, sectors)
and the research worker (O'Neil M and L, read not computed).
**Key rule:** one read per snapshot, shared by every stock; a stock never copies
the global regime into its own sector field (§3.5).

### 3.5 Stock ↔ market link — *canonical*
`stock_market_context_snapshot`: the selected stock's *own* sector/group context,
foreign-keyed to the stock, its sector membership and the applicable
`market_snapshot`/sector row.
**Producer:** the card pipeline (a projection, not a new calculation).
**Key rule:** this is the only place a stock's sector bias appears; it is
reproducible because it names the exact market snapshot it came from.

### 3.6 Screeners, runs & results — *canonical*
`screener_definition`, `filter_definition`, `screener_filter_group`,
`screener_condition`, `screener_column`, `screener_schedule_window`,
`screener_run`, `screener_run_result`.
**Producer:** the [screeners](03-desk/tool/SCREENERS.md) builder + the scheduler.
**Key rule:** `T1`/`T2` resolve to a stable `screener_id` and a versioned
definition; a saved schedule is not a run; each result references the
`stock_card_snapshot` it was evaluated against.

### 3.7 User — *canonical, account-scoped*
`user_stock_list_item` (shortlist/favourites); `screener_definition.owner`.
**Producer:** the user. **Key rule:** per-user, never global (§5 accounts).

### 3.8 Read models — *materialized*
`stock_card_snapshot` (Overview card + header + compact technical/CAN SLIM/news +
`stock_market_context_snapshot_id`), `stock_technical_read_snapshot`,
`stock_fundamental_read_snapshot`, and the `market_snapshot` bundle served by id.
**Producer:** the materializer. **Key rule:** each carries `snapshot_id`,
`as_of`, `published_at`, `source_status`, `is_stale`, `schema_version` and the
upstream snapshot IDs it was built from.

---

## 4. The rules that keep a read coherent

From [DATA_LIFECYCLE.md](data-model/DATA_LIFECYCLE.md), and consistent with the
registers' photo rule ([REGISTERS.md](03-desk/tool/REGISTERS.md)):

1. **Raw insert ≠ frontend-ready.** A stock existing does not mean every field is
   ready; readiness is tracked per snapshot/domain; the UI shows a coherent card
   with explicit missing states.
2. **Atomic publication.** A read model is never updated field-by-field while the
   UI reads it. Build a new `snapshot_id`, validate references, then switch the
   current pointer in one transaction.
3. **Dependency invalidation.** When a quote, share fact, fundamental period,
   news item, sector mapping or market snapshot changes, dependent read models
   are marked stale and only the affected ones are rebuilt. Cadence is
   deferred — the [admin dashboard](14-admin/ADMIN.md) surfaces it.
4. **Per-domain time.** A quote's time and a fundamental's period are different
   `as_of`s and both are kept; never one universal timestamp.
5. **One producer per table.** No table has two writers (the one-writer rule,
   [ARCHITECTURE §7](../ARCHITECTURE.md#7-rules-that-apply-everywhere)).

---

## 5. The two deployment modes

The model is one shape; where it physically lives differs by mode
([ARCHITECTURE deployment modes](../ARCHITECTURE.md)).

| | **Solo mode** (personal box) | **Hosted mode** (commercial) |
|---|---|---|
| Authoritative record | each tool's file on the box; the [shared record](09-shared-record/SHARED-RECORD.md) is a copy | **this schema in a hosted Postgres is the record**; no box files |
| Accounts | one implicit user; no roles | real accounts; admin/user roles ([ACCOUNTS.md](13-accounts/ACCOUNTS.md)) |
| Tenancy | n/a | `owner`/account columns isolate each tenant's screeners, shortlists and journal; enforced by auth/row policies |
| Data sources | free/unofficial | licensed, swappable, chosen in the [admin dashboard](14-admin/ADMIN.md) |

The canonical/read-model split, the keys, the relationships and the coherence
rules (§2–§4) are **identical in both modes**. Accounts columns exist in both;
solo mode fills them with one implicit account. This is why "design accounts now,
build later" costs nothing structural.

---

## 6. Contracts

| It owns | Where |
|---|---|
| the table shapes, keys, relationships | [`data-model/schema.sql`](data-model/schema.sql) |
| the canonical ↔ read-model split and the coherence rules | this document, §2–§4 |

| It reads from | For |
|---|---|
| the field catalog & data map | which frontend field each table serves ([data-model/](data-model/)) |

The front end reads read models by stable ID (`stock_id`, `screener_id`,
`market_snapshot_id`, `snapshot_id`); canonical tables are written by their
producers only.

---

## 7. When it fails

| Event | What happens |
|---|---|
| a domain is not ready for a stock | its read-model fields are null + status; the rest of the card builds |
| two as-of times differ | both are preserved and exposed; no false single timestamp |
| a read model is mid-rebuild | the old `snapshot_id` keeps serving until the new one is published |
| a ticker changes | `stock_id` is unchanged; `stock_symbol` records the change with validity dates |

---

## 8. Built on

- the approved front-end freeze and field catalog (the uploaded design package),
  traced into tables;
- the existing fact/producer model ([DATA-SOURCES.md](08-data-sources/DATA-SOURCES.md),
  [SHARED-RECORD.md](09-shared-record/SHARED-RECORD.md),
  [REGISTERS.md](03-desk/tool/REGISTERS.md), [CARD.md](03-desk/tool/CARD.md));
- the reconciliation in [FRONTEND-SUPPORT-AUDIT.md](FRONTEND-SUPPORT-AUDIT.md).

---

## 9. Status

| Part | Status |
|---|---|
| the relational schema, canonical ↔ read-model split, coherence rules | **adopted** (this document; `data-model/schema.sql`) |
| mapping every table to its producer | **done** (§3) |
| building the tables and the materializer | **to build** (infrastructure step) |
| accounts/tenancy columns enforced | **designed; enforced in hosted mode** ([ACCOUNTS.md](13-accounts/ACCOUNTS.md)) |
| refresh cadence, retention/partitioning, licensing limits | **deferred** (surfaced in the [admin dashboard](14-admin/ADMIN.md)) |
