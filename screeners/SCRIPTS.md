# Screener scripts

Every helper script that works on the screener tools: what question it
answers or what job it does. Most of them were written to answer one
specific "why is this wrong?", and the habit is worth keeping in a rebuild: **measure a doubt with a script
before changing code**.

Run them on the box from the repo root (`~/Tade-desk-server`) unless noted.
Each file's header has its full usage.

---

## Keys

| Script | Does |
|---|---|
| `scripts/set-alpaca-keys.js` | points every tool at one Alpaca account, in each place a key is looked for |

## Run the tools

| Script | Does |
|---|---|
| `deploy-tools.sh` | the deploy: pull, install, start every enabled tool (and the other programs) |
| `deploy/tool-ctl.sh` | starts, stops or restarts one tool; re-reads the archive ([TOOL-LIFECYCLE.md](TOOL-LIFECYCLE.md)) |

## Screeners: why is it empty, what is it matching

| Script | Question |
|---|---|
| `scripts/show-screeners.js` | what every tool is screening for, and when, read from each tool's own database |
| `scripts/check-screeners.js` | every screener on every live tool, measured: how many it matches now |
| `scripts/why-empty.js` | which filter is emptying this screener |
| `scripts/try-filter.js` | what change to that filter would open it up, measured |
| `scripts/field-values.js` | what TradingView is returning for one column right now |
| `scripts/archive-values.js` | what the stocks that actually matched read for a column, on the days they matched |
| `scripts/verify-tv-fields.js` | is every column the builder offers one TradingView knows |
| `scripts/probe-range-fields.js`, `probe-week-range.js` | do the week / all-time range columns exist and mean what they say |
| `scripts/probe-tv-symbol.js` | which symbol form TradingView's headline endpoint accepts |

## Data sources

| Script | Question |
|---|---|
| `scripts/probe-tv-news.js`, `probe-more-news.js`, `probe-edgar-shape.js` | which news sources can this box reach, and what do they send |
| `scripts/probe-short-interest.js` | where short interest can be had |
| `scripts/check-shortlist.js` | why the unified shortlist is empty when the tools' own are not |

## Data repair

| Script | Does |
|---|---|
| `scripts/audit-floor.js` | finds stored rows below the tradability floor |
| `scripts/purge-sub-floor.js` | removes them (rows from before the floor existed) |
| `scripts/backfill_signals.js` | adds the relational signals to old training rows |
| `scripts/rebuild_training.js` | rebuilds R4A/R4B training rows from the registers |
| `scripts/convert_legacy_to_r4.py` | converts an old merged-register CSV into R4A/R4B files |
| `scripts/split-tool-history.js` | splits one tool's history between two new tools, by screener (the T8 split) |

## Analysis

| Script | Question |
|---|---|
| `scripts/analyse-bias.js` | does the long/short call match what the stocks did |
| `scripts/analyse-news-chain.js` | does news → catalyst → bias earn its place |
| `scripts/card_lookup.py` | the complete frozen card for a ticker on a date, with its outcome |
| `scripts/verify_irdm_score.py` | a by-hand check of one card's score |
| `src/scoring/explain_score.py` | today's score of one card, in full arithmetic ([SCORING-TODAY.md](SCORING-TODAY.md)) |
