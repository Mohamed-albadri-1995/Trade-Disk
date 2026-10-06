# User guide

How to use the desk, page by page, and what it does on its own through the
day. For *why* the screeners are built the way they are, read `METHODOLOGY.md`;
for running the box, `deploy/README.md`.

Addresses below use the box's IP: `http://<box>:<port>/…` (today
`51.20.92.202`).

---

## Signing in

Every program asks for **one password**. Sign in once on any of them and all
of them open for 30 days — the login cookie is shared across ports.

| | |
|---|---|
| Sign out | add `/logout` to any address, e.g. `http://<box>:3000/logout` |
| Set or change the password | on the box: `./scripts/set-password.sh` (signs every browser out) |
| Forgot it | run the same command — it sets a new one |
| No password set yet | every program shows the sign-in page with the command to run |

Five wrong passwords block that address for 15 minutes.

---

## The pages

```
:3000/                    Landing page — the three programs
:3000/screeners           Screener Suite — every screener tool, with its state
:3000/screeners/manage    Manage tools — add, edit, start, stop, delete tools
:3000/screeners/compare   Compare — every screener against the benchmark
:<tool port>/scanner      A tool's own app (T1 :3000, T2 :3010, T6 :3050,
                          T7 :3060, T11 :3120)
:8765/                    qp — charts, strategies, backtests, alerts
:3100/                    Journal
```

The bar at the top of every page (**Chart · Screeners · Journal**) moves
between the programs; ☀ switches high-contrast mode for reading outdoors.

### Landing page — `:3000/`

The three programs and whether each is up. Start here.

### Screener Suite — `:3000/screeners`

Every screener tool as a card: what it hunts for, its screeners, whether it is
running, how many days it has collected, and which commit it runs. Tap a card
to open that tool. Archived tools appear under a fold — stopped, with their
registers still readable.

At the bottom, **Manage tools →** opens the tool controls.

### Manage tools — `:3000/screeners/manage`

One place to run the tools themselves:

| Button | Does |
|---|---|
| **+ New tool** | a new tool (up to 6 added), with its name, description, colour and times |
| **Open ↗** | the tool's own app |
| **Pause / Resume** | stops/starts its scanning; the process stays up |
| **Scan now** | one scan immediately |
| **Start / Stop** | the process itself |
| **Edit** | name, description, colour, **capture** and **entry** times |
| **Delete** | stops and hides the tool; its history is kept and can be restored from *Deleted tools* |

The memory line says whether another tool fits on the box (each needs about
180 MB). During the market session, changed times apply after the close
(16:50 ET), so a day is never measured with two clocks.

Only T1 carries these controls; the page says so if opened elsewhere.
What each button does underneath: `docs/TOOL-LIFECYCLE.md`.

### Compare — `:3000/screeners/compare`

Every screener's scorecard in one table, ranked against **Stocks in Play**
(T9, the plain benchmark). A screener has to beat it by 5 points to count.
Entry A or B is selectable. See *Reading the scorecard* in `METHODOLOGY.md`.

### A tool's app — `:<port>/scanner`

| Tab | What it is |
|---|---|
| **Screener** | today's cards. Each card: price and change, the screener that found it, pre-market and relative-volume bands, distances to its levels, catalyst and news, short interest and borrow, sector heat, the O'Neil CANSLIM letters and its industry group, and (when a scorer runs) the score. ★ shortlists it. Layout: `docs/CARD.md`; every field: `CARD-FIELDS.md`; where each value comes from: `docs/DATA-PIPELINE.md` |
| **Market** | folds: live indexes, the O'Neil market model (M — whether to be buying at all), desk analysis, the sector heatmap, industry groups (L). Every rule and threshold: `docs/MARKET-TAB.md` |
| **Shortlist** | this tool's shortlist by date; **Copy to TradingView** gives a watchlist |
| **Warehouse** | the registers by date — R0 live, R1 the frozen photo, R2 market snapshots, R3A/R3B end-of-day, R4A/R4B merged training rows, Shortlist — with CSV/JSON export and a manual R3 capture. Every column: `docs/REGISTERS.md` |
| **Analysis** | the screener scorecard, model training and its status, R4 export and upload of external training data |
| **Screeners** | the screener builder: each screener's filters, run window, mirror, on/off |
| **Settings** | this tool's identity, data sources, hot-sector and sector-bias thresholds, the tradability floor (this tool's own), the shortlist auto-rule, API keys, the scorer, backups. Every key: `docs/SETTINGS.md`; the data-source check: `docs/DATACHECK.md` |
| **Monitor** | every scheduled job, its schedule and last run (each can be paused or retimed), and the last scan's stages. Every job: `docs/MONITOR.md` |

### qp — `:8765/`

A live chart with indicators (**+ Add to chart**), and a side panel
(**☰ Panel**) with:

- **Register navigator** — pick a tool's register and day, step through its
  tickers on the chart; a screener that is down is named.
- **⚡ Strategy** — build, save and evaluate a strategy on the chart.
- **Backtest** — run a strategy over a register's days; CSV and a full report.
- **Print R1 sheet** — one chart per register ticker for a day or range.
- **🔔 Alerts** — watches today's R1 and Shortlist against every saved setup
  and notifies on an entry signal.

`quant-platform/chart/README.md` covers the builder and its rules in depth.

### Journal — `:3100/`

| Tab | What it is |
|---|---|
| **Overview** | equity curve, win rate, expectancy, profit factor, payoff ratio, max drawdown, streaks, consistency |
| **Calendar** | P&L day by day |
| **Time** | results by day of week, entry price and position size, and the R-multiple distribution |
| **Risk** | a risk snapshot: drawdown, worst streak, payoff, fees, the R-multiple distribution |
| **Stats** | the full catalogue: per-trade and per-day averages, hold times, fees, best and worst |
| **Setups** | per setup: trades, average R, expectancy, equity |
| **Trades** | every trade: notes, tags, fees, setup |
| **Import** | files from TradingView, Trade The Pool, DXtrade; and **Alpaca accounts** — add one (key, secret, paper/live, how often) and its fills are fetched on that schedule and paired into trades |

---

## What happens on its own (New York time, weekdays)

| Time | What |
|---|---|
| 04:00–16:00, every 5 min | every card on screen re-quotes |
| 04:00–09:00, every 30 min | discovery scans (pre-market screeners) |
| 09:00–10:00, every 5 min | discovery scans |
| 09:26–10:01 | R2 market snapshots |
| per tool (09:36 … 10:16) | **R1 capture** — the day's photo, the only thing the model learns from (times on Manage tools) |
| 10:00–16:00, every 15 min | discovery scans |
| shortlist rule time | the shortlist auto-rule |
| 16:05 | R3 end-of-day capture (how far each card ran) |
| 16:20 | model auto-train |
| 16:50 | changed tool times take effect |
| 18:30 (22:30 UTC) | qp's nightly job: prices, market model, SIC industry map, group ranks |
| 19:20 (23:20 UTC) | **backup to Cloudflare R2** — see `docs/BACKUPS.md` |
| every minute | the journal checks which Alpaca accounts are due a fetch |

Each tool only scans inside its screeners' run windows; `METHODOLOGY.md` lists
them.

---

## When something looks wrong

| You see | Look at |
|---|---|
| A tool reads offline | Manage tools — is it running? then `pm2 logs tool-T<n> --lines 50 --nostream` on the box |
| A blank field on a card | `CARD-FIELDS.md` — most blanks have a stated reason |
| qp has no days for a register | the navigator names a screener that is down |
| The sign-in page keeps coming back | the password was changed — sign in again |
| Last night's backup | `pm2 logs r2-backup --lines 20 --nostream` — it ends `0 failure(s)` |
| Anything after a deploy | the deploy's own summary: tools, qp, feeds, restarts, login |

Open findings and decisions are in `docs/KNOWN-ISSUES.md`.
