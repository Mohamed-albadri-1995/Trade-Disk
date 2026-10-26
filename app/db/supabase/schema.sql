-- Trade-Disk — Supabase (Postgres) schema, applied to the hosted database.
-- The authoritative record of what runs in the project (also applied via the
-- Supabase migration history). One stack for solo and commercial: solo uses a
-- single account; commercial opens signups. Every per-account row is stamped with
-- owner_id and locked by row-level security to (select auth.uid()); global tables
-- (market snapshot, demo universe, operator feed config) are shared, readable by
-- any authenticated user and written by the service-role API.

-- ===== Accounts =====
create table if not exists public.profile (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  role         text not null default 'owner',      -- owner | member | admin
  plan         text not null default 'personal',   -- personal | commercial
  created_at   timestamptz not null default now()
);
alter table public.profile enable row level security;
create policy profile_select_own on public.profile for select to authenticated using (id = (select auth.uid()));
create policy profile_update_own on public.profile for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profile_insert_own on public.profile for insert to authenticated with check (id = (select auth.uid()));
-- NB: the profile row is created by the app right after signup (a trigger on
-- auth.users cannot be added through the connector).

-- ===== Journal (per account) =====
create table if not exists public.journal_account (
  owner_id uuid not null references public.profile(id) on delete cascade,
  id text not null, name text not null,
  door text, kind text, status text, last text, note text,
  sort int not null default 0,
  primary key (owner_id, id)
);
create table if not exists public.setup (
  owner_id uuid not null references public.profile(id) on delete cascade,
  id text not null, name text not null, description text,
  primary key (owner_id, id), unique (owner_id, name)
);
create table if not exists public.trade (
  owner_id uuid not null references public.profile(id) on delete cascade,
  id text not null, symbol text not null,
  side text not null check (side in ('Long','Short')),
  setup text,
  asset_type text not null check (asset_type in ('stock','option','future','forex','crypto')),
  qty double precision not null, entry double precision not null, exit double precision, risk double precision,
  date text not null, status text not null check (status in ('Open','Closed')),
  adherence text check (adherence in ('Good','Average','Poor','Unknown')),
  fees double precision not null default 0, net double precision, gross double precision,
  mult double precision not null default 1, move_pct double precision, r double precision,
  account text, source text, duration int,
  tags jsonb, thesis text, notes text,
  stop double precision, target double precision, planned_rr double precision, initial_risk double precision,
  emotions text, batch text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  primary key (owner_id, id)
);
create index if not exists trade_owner_date_idx   on public.trade (owner_id, date);
create index if not exists trade_owner_status_idx on public.trade (owner_id, status);
create index if not exists trade_owner_symbol_idx on public.trade (owner_id, symbol);
create table if not exists public.day_note (
  owner_id uuid not null references public.profile(id) on delete cascade,
  day text not null, note text not null, updated_at timestamptz not null default now(),
  primary key (owner_id, day)
);
create table if not exists public.review_note (
  owner_id uuid not null references public.profile(id) on delete cascade,
  id text not null, title text not null, body text, created_at timestamptz not null default now(),
  primary key (owner_id, id)
);

-- ===== Radar (per account) =====
create table if not exists public.radar_shortlist (
  owner_id uuid not null references public.profile(id) on delete cascade,
  ticker text not null, added_at timestamptz not null default now(),
  primary key (owner_id, ticker)
);
create table if not exists public.radar_screener (
  owner_id uuid not null references public.profile(id) on delete cascade,
  id text not null, kind text not null, name text, description text,
  conditions jsonb not null default '[]', windows jsonb not null default '[]',
  timezone text not null default 'device', sort int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);
-- The daily register (the "sticky screener"): a stock seen on a screener today stays
-- on its list until end of ET day, marked live/not-live, its data refreshed each scan.
-- Also the historical daily record (one row per owner/day/screener/ticker) the Lab
-- can backtest. See core/register.mjs.
create table if not exists public.radar_register (
  owner_id uuid not null references public.profile(id) on delete cascade,
  day text not null, screener text not null, ticker text not null, sym text,
  card jsonb not null, live boolean not null default true,
  first_seen timestamptz not null default now(), last_live timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, day, screener, ticker)
);
create index if not exists radar_register_owner_day_idx on public.radar_register (owner_id, day, screener);

-- ===== Lab / qp (per account) =====
-- A strategy is a document (the whole grammar in `doc`); saving it makes a version
-- so an old backtest's meaning never changes. A backtest freezes its run spec
-- (including a copy of the strategy it ran) and stores its report and trades.
create table if not exists public.lab_strategy (
  owner_id uuid not null references public.profile(id) on delete cascade,
  id text not null, name text not null, side text not null default 'long',
  stage text not null default 'development',       -- development | ready (set by hand)
  doc jsonb not null, version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);
create table if not exists public.lab_strategy_version (
  owner_id uuid not null references public.profile(id) on delete cascade,
  strategy_id text not null, version int not null, name text, doc jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, strategy_id, version)
);
create table if not exists public.lab_backtest (
  owner_id uuid not null references public.profile(id) on delete cascade,
  id text not null, name text, status text not null default 'done',  -- running | done | error
  spec jsonb not null,                               -- frozen run spec incl. the strategy
  report jsonb, trades jsonb, error text,
  created_at timestamptz not null default now(),
  primary key (owner_id, id)
);
create index if not exists lab_backtest_owner_created_idx on public.lab_backtest (owner_id, created_at desc);
alter table public.lab_strategy enable row level security;
create policy lab_strategy_own on public.lab_strategy for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
alter table public.lab_strategy_version enable row level security;
create policy lab_strategy_version_own on public.lab_strategy_version for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
alter table public.lab_backtest enable row level security;
create policy lab_backtest_own on public.lab_backtest for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update, delete on public.lab_strategy, public.lab_strategy_version, public.lab_backtest to authenticated;

-- ===== Global (shared) =====
create table if not exists public.radar_stock (
  t text primary key, n text not null,
  p double precision not null, c double precision, abs double precision,
  s int, r double precision, adr double precision,
  pm double precision, pm_high double precision, pm_low double precision, pm_range double precision, pm_pct double precision,
  cap text, cap_band text, sec text, mark text, color text,
  tags jsonb, ema boolean default false, stacked boolean default false, news boolean default false, cs boolean default false,
  change_line jsonb, sort int default 0
);
create table if not exists public.radar_market (
  id int primary key default 1 check (id = 1), snapshot jsonb not null, as_of timestamptz
);
create table if not exists public.app_setting (key text primary key, value text);
create table if not exists public.source_group (
  id text primary key, mode text not null default 'prime',
  active jsonb not null default '["demo"]', keys jsonb not null default '{}'
);

-- ===== Row-level security =====
-- per-account: owner-only (select/insert/update/delete)
alter table public.journal_account enable row level security;
create policy journal_account_own on public.journal_account for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
alter table public.setup enable row level security;
create policy setup_own on public.setup for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
alter table public.trade enable row level security;
create policy trade_own on public.trade for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
alter table public.day_note enable row level security;
create policy day_note_own on public.day_note for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
alter table public.review_note enable row level security;
create policy review_note_own on public.review_note for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
alter table public.radar_shortlist enable row level security;
create policy radar_shortlist_own on public.radar_shortlist for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
alter table public.radar_screener enable row level security;
create policy radar_screener_own on public.radar_screener for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
alter table public.radar_register enable row level security;
create policy radar_register_own on public.radar_register for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update, delete on public.radar_register to authenticated;
-- global config / shared tables: any authenticated user may read; only an owner/admin
-- may write (the server does so on their behalf — e.g. the live market snapshot
-- refresh and the feed-switch config). Operator membership is read from profile.role.
-- (The _admin policies' using/with check both are the EXISTS clause shown below.)
-- operator := exists (select 1 from public.profile p
--               where p.id = (select auth.uid()) and p.role = any (array['owner','admin']))
alter table public.radar_stock enable row level security;
create policy radar_stock_read on public.radar_stock for select to authenticated using (true);
create policy radar_stock_admin on public.radar_stock for all to authenticated
  using (exists (select 1 from public.profile p where p.id = (select auth.uid()) and p.role = any (array['owner','admin'])))
  with check (exists (select 1 from public.profile p where p.id = (select auth.uid()) and p.role = any (array['owner','admin'])));
alter table public.radar_market enable row level security;
create policy radar_market_read on public.radar_market for select to authenticated using (true);
create policy radar_market_admin on public.radar_market for all to authenticated
  using (exists (select 1 from public.profile p where p.id = (select auth.uid()) and p.role = any (array['owner','admin'])))
  with check (exists (select 1 from public.profile p where p.id = (select auth.uid()) and p.role = any (array['owner','admin'])));

-- Industry Group Leadership (O'Neil "L") cache: the live S&P 500 group RS ranking,
-- rebuilt about once a day. Single row like radar_market; owner/admin gate the write.
create table if not exists public.radar_groups (
  id int primary key default 1 check (id = 1), snapshot jsonb not null, as_of timestamptz
);
alter table public.radar_groups enable row level security;
create policy radar_groups_read on public.radar_groups for select to authenticated using (true);
create policy radar_groups_admin on public.radar_groups for all to authenticated
  using (exists (select 1 from public.profile p where p.id = (select auth.uid()) and p.role = any (array['owner','admin'])))
  with check (exists (select 1 from public.profile p where p.id = (select auth.uid()) and p.role = any (array['owner','admin'])));
grant select, insert, update, delete on public.radar_groups to authenticated;
alter table public.app_setting enable row level security;
create policy app_setting_read on public.app_setting for select to authenticated using (true);
create policy app_setting_admin on public.app_setting for all to authenticated
  using (exists (select 1 from public.profile p where p.id = (select auth.uid()) and p.role = any (array['owner','admin'])))
  with check (exists (select 1 from public.profile p where p.id = (select auth.uid()) and p.role = any (array['owner','admin'])));
alter table public.source_group enable row level security;
create policy source_group_read on public.source_group for select to authenticated using (true);
create policy source_group_admin on public.source_group for all to authenticated
  using (exists (select 1 from public.profile p where p.id = (select auth.uid()) and p.role = any (array['owner','admin'])))
  with check (exists (select 1 from public.profile p where p.id = (select auth.uid()) and p.role = any (array['owner','admin'])));
