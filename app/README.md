# Trade-Disk — solo build (run it locally)

The Trading Station and its tools, running on your own machine: a Node server
(built-in HTTP + SQLite, **zero external services**) that serves three static
front ends and an `/api`. Demo data only — no real quotes, no orders.

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
