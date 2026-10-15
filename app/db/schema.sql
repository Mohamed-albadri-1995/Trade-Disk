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
