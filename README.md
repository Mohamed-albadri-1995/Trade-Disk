# Trade Desk

A self-hosted trading research desk: three apps in one repository, run on one
box under pm2.

| App | Where | Port | What it does |
|---|---|---|---|
| **Screener suite** | `src/`, `public/` | 3000 (landing page + T1), 3010, 3050, 3060, 3120 | One Node process per screener tool. Scans TradingView on a schedule, enriches each card (market context, news, catalysts, short interest, the O'Neil CANSLIM letters), keeps a daily shortlist and freezes the daily registers (R1–R4) the research runs on. |
| **qp** — chart & backtest | `quant-platform/` | 8765 | FastAPI + Python. Live charts on verified indicator primitives, a strategy builder, and a backtest engine over the screeners' registers. |
| **Journal** | `journal/` | 3100 | Trade journal: imports broker/CSV files and fetches fills from Alpaca accounts on a schedule; cards, calendar, grading. |

`tools.config.json` is the registry every app reads — tool ids, names, ports,
capture times. Ports above come from it; if they ever disagree, that file is
right.

## Run it

```bash
npm install
cd quant-platform && pip3 install -r requirements.txt && cd ..
./deploy-tools.sh            # on the box: pulls, starts every app under pm2, checks health
```

Then set the one password every app asks for: `./scripts/set-password.sh`
(see *Login* in `deploy/README.md`).

`deploy/README.md` is the operations runbook: what runs, who supervises it,
how to restart one thing, and what never to do.

## Tests

```bash
npx jest                                              # Node: screeners, journal, deploy
cd quant-platform/chart && python3 tests/run_all.py   # qp
```

## Documentation

| File | What it is |
|---|---|
| `docs/USER-GUIDE.md` (+ `.pdf`) | Using the desk: every page, signing in, what runs on its own through the day |
| `docs/ARCHITECTURE.md` | How the three apps work and fit together — read before changing anything |
| `docs/BACKUPS.md` (+ `.pdf`) | The nightly Cloudflare R2 backup: bucket layout, manifest, retention, restoring |
| `docs/KNOWN-ISSUES.md` | Open findings, with severity and where they live |
| `deploy/README.md` | Operations runbook |
| `METHODOLOGY.md` (+ `.pdf`) | What each screener hunts for and why its filters are what they are |
| `docs/DATA-PIPELINE.md` (+ `.pdf`) | How a screener tool finds a stock: every source, every processing stage, how it lands on the card and in the registers |
| `docs/REGISTERS.md` (+ `.pdf`) | Every register (R0–R4, Shortlist): when it is written and every column |
| `docs/CARD.md` (+ `.pdf`) | The card's layout, section by section, and its display rules |
| `CARD-FIELDS.md` | Every field on a card, where it comes from, when a blank is legitimate |
| `docs/IDEAS.md` (+ `.pdf`) | The intent behind the score, the screener builder and the screener scorecard — the target for their rebuild |
| `docs/SETTINGS.md` (+ `.pdf`) | Every setting of a screener tool: default, accepted values, what reads it, the dead keys |
| `docs/MONITOR.md` (+ `.pdf`) | The Monitor tab and every scheduled job |
| `docs/DATACHECK.md` (+ `.pdf`) | The data-source check: every check and what makes it ok, degraded or down |
| `docs/TOOL-LIFECYCLE.md` (+ `.pdf`) | Adding, starting, pausing, stopping, deleting tools: the registry, `tool-ctl.sh`, the archive |
| `docs/API.md` (+ `.pdf`) | Every route a screener tool answers |
| `docs/MARKET-TAB.md` (+ `.pdf`) | The Market tab: indexes, O'Neil model, desk regime, sector heatmap, industry groups |
| `docs/CANSLIM.md` | The CANSLIM implementation |
| `docs/REVERSIBLE-CHOICES.md` | Choices made on the trader's word, and how to undo each |
| `quant-platform/README.md` | The qp primitive library and compare tool |
| `quant-platform/chart/README.md` | The chart platform |
| `quant-platform/chart/SCALPS.md`, `SCALPS_SPEC.md` | The five scalp strategies and how they are built |
| `pine/README.md` | Pine Script versions of the ready strategies |

The PDFs are built from their markdown: `node scripts/make-pdfs.js` (rebuild
after editing any of them).
