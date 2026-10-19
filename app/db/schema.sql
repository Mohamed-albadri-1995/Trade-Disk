-- Trade-Disk — Journal schema.
-- Matched field-for-field to the approved Journal view (frontend-design/index.html):
-- the trade record the screens read, the accounts/connectors, the setups, and the
-- per-day notes. Solo mode: SQLite on the box; portable to Postgres/Supabase for
-- hosted mode (DATA-MODEL.md). One writer; realized fields are frozen on write.

CREATE TABLE IF NOT EXISTS account (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  door    TEXT,                 -- "Broker connector" | "File upload + manual"
  kind    TEXT,                 -- Alpaca | IBKR Flex | File | ...
  status  TEXT,                 -- connected | not-connected | file
  last    TEXT,                 -- last-sync / status line shown in the panel
  note    TEXT,
  sort    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS setup (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS trade (
  id            TEXT PRIMARY KEY,            -- "TD-1032"
  symbol        TEXT NOT NULL,
  side          TEXT NOT NULL CHECK (side IN ('Long','Short')),
  setup         TEXT,                        -- setup name (matches setup.name)
  asset_type    TEXT NOT NULL CHECK (asset_type IN ('stock','option','future','forex','crypto')),
  qty           REAL NOT NULL,
  entry         REAL NOT NULL,
  exit          REAL,                        -- NULL while Open
  risk          REAL,                        -- per-unit initial risk distance
  date          TEXT NOT NULL,               -- YYYY-MM-DD
  status        TEXT NOT NULL CHECK (status IN ('Open','Closed')),
  adherence     TEXT CHECK (adherence IN ('Good','Average','Poor','Unknown')),
  fees          REAL NOT NULL DEFAULT 0,
  net           REAL,                         -- realized, net of fees (NULL while Open)
  gross         REAL,
  mult          REAL NOT NULL DEFAULT 1,      -- contract multiplier for the asset class
  move_pct      REAL,                         -- signed by direction (NULL while Open)
  r             REAL,                         -- realized R multiple (NULL without a stop / while Open)
  account       TEXT,                         -- account name
  source        TEXT,
  duration      INTEGER,                      -- minutes held
  tags          TEXT,                         -- JSON array
  thesis        TEXT,
  notes         TEXT,
  stop          REAL,
  target        REAL,
  planned_rr    REAL,
  initial_risk  REAL,
  emotions      TEXT,
  batch         TEXT,                         -- import batch id
  created_at    TEXT,
  updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS day_note (
  day        TEXT PRIMARY KEY,               -- YYYY-MM-DD
  note       TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_note (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trade_date   ON trade(date);
CREATE INDEX IF NOT EXISTS idx_trade_setup  ON trade(setup);
CREATE INDEX IF NOT EXISTS idx_trade_status ON trade(status);
CREATE INDEX IF NOT EXISTS idx_trade_symbol ON trade(symbol);

-- ============================================================================
-- Radar — the screener / discovery tool. Matched to the approved radar prototype
-- (frontend-design/radar.html). In the design these are read-model snapshots the
-- desk publishes (DATA-MODEL.md, CARD.md); in solo demo they are seeded directly.
-- Portable to Postgres/Supabase for hosted mode, every row scoped to an account.
-- ============================================================================

-- the screener result cards (one row per stock in the demo universe)
CREATE TABLE IF NOT EXISTS radar_stock (
  t          TEXT PRIMARY KEY,         -- ticker
  n          TEXT NOT NULL,            -- company name
  p          REAL NOT NULL,            -- price
  c          REAL,                     -- change %
  abs        REAL,                     -- change (absolute)
  s          INTEGER,                  -- score 0–100
  r          REAL,                     -- relative volume (×)
  adr        REAL,                     -- average daily range %
  pm         REAL,                     -- pre-market / ADR (ratio)
  pm_high    REAL,
  pm_low     REAL,
  pm_range   REAL,
  pm_pct     REAL,
  cap        TEXT,                     -- market cap (display, e.g. "3.15T")
  cap_band   TEXT,                     -- large | mid | small | micro
  sec        TEXT,                     -- sector
  mark       TEXT,                     -- avatar letter
  color      TEXT,                     -- avatar accent
  tags       TEXT,                     -- JSON array
  ema        INTEGER DEFAULT 0,        -- above key EMAs (bool)
  stacked    INTEGER DEFAULT 0,        -- MA stack aligned (bool)
  news       INTEGER DEFAULT 0,        -- has a news catalyst (bool)
  cs         INTEGER DEFAULT 0,        -- passes a CAN SLIM gate (bool)
  change_line TEXT,                    -- JSON array of sparkline points
  sort       INTEGER DEFAULT 0
);

-- the trader's shortlist (favourites); per-account in hosted mode
CREATE TABLE IF NOT EXISTS radar_shortlist (
  ticker    TEXT PRIMARY KEY REFERENCES radar_stock(t),
  added_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- the Market dashboard's materialized market_snapshot (MARKET.md §3.5): one global
-- read, published atomically, that the Market screen renders and never recomputes.
-- Solo mode keeps the whole snapshot as one JSON document; hosted mode publishes it
-- per the licensed provider, shared across accounts (the market is global).
CREATE TABLE IF NOT EXISTS radar_market (
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  snapshot  TEXT NOT NULL,   -- the market_snapshot read model (JSON)
  as_of     TEXT
);

CREATE INDEX IF NOT EXISTS idx_radar_stock_sort ON radar_stock(sort);

-- ============================ Dual-mode data sourcing ======================
-- The feed switch (DATA-CATALOG.md, DATA-SOURCES.md §3.7). The platform runs in
-- 'personal' (free sources) or 'commercial' (licensed) mode; each of the eight
-- data groups picks its provider(s). 'demo' is the provider that serves the seeded
-- demo data — the active default today, so nothing depends on a real feed yet.
CREATE TABLE IF NOT EXISTS app_setting (
  key    TEXT PRIMARY KEY,
  value  TEXT
);

-- One row per data group: the merge/prime+backup mode, the ordered active provider
-- ids, and (solo only) any API keys. Keys live in plaintext here because solo mode
-- is a single local box; hosted mode keeps them in the platform secret store.
CREATE TABLE IF NOT EXISTS source_group (
  id      TEXT PRIMARY KEY,                 -- 'price','volume','range',...
  mode    TEXT NOT NULL DEFAULT 'prime',    -- 'prime' (prime+backup) | 'merge'
  active  TEXT NOT NULL DEFAULT '["demo"]', -- JSON: ordered provider ids
  keys    TEXT NOT NULL DEFAULT '{}'        -- JSON: { providerId: apiKey }
);

-- A trader's custom screeners and the built-in screeners' scan schedules. These
-- used to live in the browser (localStorage); they belong on the server, so they
-- survive across browsers/devices and, in hosted mode, scope to an account (add an
-- account key per row — the config/schedule shape does not change). Solo mode is a
-- single owner, so there is one set of rows.
CREATE TABLE IF NOT EXISTS radar_screener (
  id          TEXT PRIMARY KEY,              -- custom id ('scr-…') or a built-in screener key ('trend-leaders')
  kind        TEXT NOT NULL,                 -- 'custom' | 'builtin'
  name        TEXT,
  description TEXT,
  conditions  TEXT NOT NULL DEFAULT '[]',    -- JSON: the custom rule rows (custom only)
  windows     TEXT NOT NULL DEFAULT '[]',    -- JSON: the scan-schedule windows
  timezone    TEXT NOT NULL DEFAULT 'device',
  sort        INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
