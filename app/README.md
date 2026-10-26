# Trade-Disk — solo build (run it locally)

The Trading Station and its tools, running on your own machine: a Node server
(built-in HTTP + SQLite, **no external services of its own**) that serves the
static front ends and an `/api`. Demo data by default; opt into live Yahoo quotes
per data group in Admin (personal use). No orders — ever.

## Requirements
- **Node 22.5+** (uses the built-in `node:sqlite`).

## Run it (two commands)
```bash
cd app
npm run setup     # installs + builds the 3 front ends, seeds the demo database
npm start         # starts the server
```
Then open **http://localhost:8787** — the Station launcher.

- `/` — the **Station** (launcher)
- `/journal/` — the **Journal** (working: ledger, calendar, stats, import, notes)
- `/radar/` — **Radar** (Screener · Shortlist · Market · Settings · 4-tab Analysis)
- `/admin/` — **Admin** — the data-source feed switch (personal ⇄ commercial, provider per group, keys). Linked from the Station footer.

## Handy
- `npm run seed` — reset the demo database (22 trades + 8 radar stocks + market snapshot).
- `npm run refresh` — pull live quotes for the Radar watchlist from the Price group's
  active feed. Set that group to **Yahoo** in Admin first (or use the Refresh button there);
  on demo it's a no-op. Wires groups 1·2·3·4·7 (price/volume/range/indicators/name);
  5·6·8 stay demo until a paid feed is added.
- `npm run smoke` — quick API check.
- Re-run `npm run setup` any time to rebuild after code changes.

## What's where
- `server.mjs` — the front door: serves `web/` + routes `/api/...`.
- `db/` — schema + seed (SQLite at `data/journal.db`).
- `api/` — the Journal and Radar read/write services.
- `ui/` (Journal), `ui-radar/` (Radar), `ui-station/` (Station) — Vite/React apps
  that build into `web/`.

> TradeLab and TradePilot are not built yet. Hosted mode (accounts, Postgres/
> Supabase, licensed data providers) is designed in `/design`, not built here.
