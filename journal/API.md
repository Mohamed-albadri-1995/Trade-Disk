# The journal's API

Every route the journal's server answers, what it takes, what it returns, and
whether anything calls it. **29 routes**: 19 in `journal/src/routes/journal.js`
(mounted at `/api/journal`), 5 in `journal/src/addons/accounts.js`, 5 in
`journal/server.js`. Static files come from `journal/public/`.

Every route sits behind the desk's login (`src/auth`, the same `td_auth`
cookie as every program). Bodies are JSON, up to 10 MB.

"Caller" says what uses the route today: **page** (`journal.html`),
**add-on** (`addons.js`), or **none**.

---

## Trades

| Method | Path | Takes | Returns | Caller |
|---|---|---|---|---|
| GET | `/api/journal/trades` | optional query: `from`, `to` (dates), `account`, `setup_id`, `direction`, `status`, `ticker` | every matching trade, newest date and entry time first | page (no filters) |
| GET | `/api/journal/trades/:id` | | the trade with `context`, `technical` and `conditions`; 404 if missing | none |
| POST | `/api/journal/trades` | `date, ticker, direction, shares, entry_price, entry_time` (required); `exit_price, exit_time, sl, tp, commission, setup_id, notes, account, context` | `{ ok, id }`; 400 when a required field is missing | none |
| PATCH | `/api/journal/trades/:id` | any of `exit_price, exit_time, sl, tp, setup_id, notes, status` | `{ ok }`; 404 if missing | page (`setup_id` only) |
| DELETE | `/api/journal/trades/:id` | | `{ ok }`; also deletes its snapshots, conditions and grading card | page |

The rules for each are in [IMPORT.md](IMPORT.md#2-by-hand-post-apijournaltrades).

## Import

| Method | Path | Takes | Returns | Caller |
|---|---|---|---|---|
| POST | `/api/journal/import` | `{ csv, account? }` | `{ ok, imported, total, trades, bridged: { mirrored, skipped, failed } }`; 400 with `{ ok: false, error }` when the file is refused or the parser throws | page |

The formats and the pairing: [IMPORT.md](IMPORT.md#1-file-import).

## Technicals and conditions

| Method | Path | Takes | Returns | Caller |
|---|---|---|---|---|
| POST | `/api/journal/trades/:id/compute` | | `{ ok, technicalSnapshot, outcomes }`, after fetching bars and evaluating the setup's template; 500 with the reason on failure | none |
| POST | `/api/journal/compute-all` | | `{ ok, queued }` at once; the work runs in the background, 300 ms apart, errors swallowed | none |
| POST | `/api/journal/reevaluate-conditions` | | `{ ok, evaluated }`: closed, tagged trades with a snapshot, no bar fetch | page (**Re-eval Conditions**) |
| POST | `/api/journal/trades/:id/context` | the context fields: `regime, regimeLabel, secBias, broadResolved, shortTerm, midTerm, longTerm, secScore, sector, industry, scanner_score, scanner_confidence` | `{ ok }` (replaces the trade's context snapshot) | none |
| GET | `/api/journal/templates` | | every setup template, conditions parsed | none |
| PUT | `/api/journal/templates/:setupId` | `{ conditions, min_grade_trades?, min_condition_trades? }` | `{ ok }` (creates or replaces) | none |

What each computes: [ANALYSIS.md](ANALYSIS.md).

## Analysis

| Method | Path | Takes | Returns | Caller |
|---|---|---|---|---|
| GET | `/api/journal/analysis/metrics` | `from, to, account, setup_id` | the server's metrics ([ANALYSIS.md](ANALYSIS.md#the-servers-own-metrics)) | none |
| GET | `/api/journal/analysis/calendar` | `from, to` (the account is ignored) | `[{ date, pnl, n }]` per date | none |
| POST | `/api/journal/analysis/backfill-to-grading` | | `{ ok, considered, mirrored, skipped, failed }`; safe to repeat | none |

The code points readers of the grading data to `/api/trading/grading/summary`
and `/api/trading/grading/setup/:id`. **Those routes do not exist** in the
journal.

## Notes and fees

| Method | Path | Takes | Returns | Caller |
|---|---|---|---|---|
| GET | `/api/journal/notes/:date` | | `{ date, note, updated_at }`, or an empty note | none |
| PUT | `/api/journal/notes/:date` | `{ note }` | `{ ok }` | none |
| GET | `/api/journal/fees` | | every fee profile, rules parsed | none |
| PUT | `/api/journal/fees/:account` | `{ rules, mode? }` (`replace` by default) | `{ ok }`. The rules are stored, never applied | none |

## Alpaca accounts

| Method | Path | Takes | Returns | Caller |
|---|---|---|---|---|
| GET | `/api/journal/accounts` | | `{ ok, accounts }`: no secrets, key id shortened, with `lastRun` | add-on |
| POST | `/api/journal/accounts` | new: `name, keyId, secret, paper, everyMinutes, days, enabled`. Edit: `id` plus any of those (keys both or neither) | `{ ok, account }` or `{ ok: false, error }` (always status 200) | add-on (add, pause/resume) |
| DELETE | `/api/journal/accounts/:id` | | `{ ok }`; the account's trades stay | add-on |
| POST | `/api/journal/accounts/:id/test` | | `{ ok, number, status, paper }` or `{ ok: false, error }` | add-on |
| POST | `/api/journal/accounts/:id/fetch` | | the run: `{ ok, at, fills, trades, added, updated, error }` | add-on |

The rules: [ACCOUNTS.md](ACCOUNTS.md).

## Shared and the page

| Method | Path | Returns | Caller |
|---|---|---|---|
| GET | `/api/trading/setups` | every row of `trading_setups`, `config` parsed; `[]` on any error | page |
| GET | `/api/tools` | `{ ok, tools, apps }` from `tools.config.json`; never fails (an error gives empty lists) | the app bar |
| GET | `/deskbar.css` | the app bar's rules cut from `public/desk.css`, `no-cache` | the page |
| GET | `/desk.js` | `public/desk.js` from the repo, `no-cache` | the page |
| GET | `/` | `journal.html` | the browser |
| GET | `/addons.js`, other files | static files from `journal/public/` (`/` itself is the route above) | the page |

---

## In summary

Of the 29 routes, the page, its add-on and the app bar use 15. One trade with
its snapshots, hand entry, technicals, context, templates, notes, fees, the
server's metrics and calendar, and the grading backfill (14 routes) have no
caller. A rebuild should start from what
the page needs, and give each route either a screen or a job that calls it.
