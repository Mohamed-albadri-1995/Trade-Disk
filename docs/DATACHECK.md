# The data check

**Settings → Data sources → Check every data source.** One button that asks
every source the screener tools and qp depend on for real data, and judges
whether what came back is **usable**, not just whether it answered.

Written from `src/routes/datacheck.js` (the tool's half) and
`quant-platform/chart/datacheck.py` (qp's half).

Related: where each source is used (`docs/DATA-PIPELINE.md`), the keys
(`docs/SETTINGS.md`).

---

## Why it exists

A source that answers with nothing, or with numbers that are wrong, does not
raise an error: the cards just come out thinner, and nobody notices for weeks.
So the check asks for data that **cannot** legitimately be empty and judges
the content. It is slow on purpose (up to two minutes) and runs only when
pressed, never on a timer.

## How to run it

- The button on the Settings tab, or
- `GET /api/datacheck?symbol=SPY` on any tool (the symbol is used for qp's bar
  checks; default SPY).

The tool runs its own checks and asks qp (`QP_URL`, default
`http://127.0.0.1:8765`, `GET /api/datacheck`) for the rest, all at once.

## Verdicts

| Severity | Meaning |
|---|---|
| **ok** | usable, nothing to say |
| **degraded** | usable, but something is wrong enough to say: a gap, a warning, a stale file, a source missing from a set |
| **down** | not usable |

The answer:

```json
{ "ok": true,            // false when anything is down
  "tool": "T1", "symbol": "SPY", "ms": 41200,
  "total": 18, "passed": 15, "degraded": 2, "down": 1,
  "qpReachable": true,
  "checks": [ { "name", "ok", "severity", "detail", "fix"?, "ms"?, … } ],
  "summary": "every source returned usable data"  // or the names of what failed
}
```

Where a check knows the remedy, it carries a `fix` line.

---

## The tool's checks

| Check | Asks | down | degraded | ok |
|---|---|---|---|---|
| **tradingview scanner** | a scan for `close > 0`, 50 rows (a filter nothing can fail) | zero rows; the first row has no usable price (the columns changed); the fetch failed | — | `N rows, first is X at $P` |
| **news sources** | every news source for AAPL | no stories from any source | stories came, but one or more sources failed; when a key is missing or rejected, `fix` names it | `N stories for AAPL` |
| **Alpaca key** | the account behind the stored key (12 s) | key rejected (401/403); could not ask | — | account number, status, `paper` or `LIVE` |
| **industry map** | the tool's own map (`docs/MARKET-TAB.md`) | empty | under 200 symbols or under 20 industries | `N symbols across M industries` |
| **qp (chart platform)** | qp's whole check (120 s limit) | qp not answering: then every qp check below is missing, and it says so | — | qp's own rows are added |

## qp's checks

### Bar feeds

Every feed qp can load (`data_manager.LOADERS`: `alpaca`, `polygon`, `hybrid`,
`hybrid_yahoo`, `yahoo`), 40 daily bars of the symbol each. One row per feed,
named `feed:SYMBOL`.

| down when | degraded when |
|---|---|
| the fetch failed (with a diagnosis and, for a missing key, the fix) | more than 5 % of sessions have no volume |
| no data returned, or no close column | — |
| fewer than 15 rows | — |
| any close is NaN, or at or below zero | — |
| every volume is zero (every volume test would be dead) | — |
| the last bar is more than 5 sessions old | — |
| bars out of order, or duplicated | — |
| a one-day move over 25 % (a split not applied, or the wrong symbol) | — |

### The indexes

`^GSPC` and `^IXIC` from Yahoo, judged the same way. If either fails, the row
says O'Neil's market model cannot be built without it.

### Cross-source agreement

The only check that catches a feed that is **confidently wrong**. Every pair of
working feeds among `yahoo`, `polygon`, `alpaca` and `hybrid_yahoo` is compared
close for close.

| Result | Severity |
|---|---|
| worst difference ≤ 0.5 % | ok |
| worst difference > 0.5 % | down |
| fewer than 3 shared sessions, or one side empty | degraded |
| fewer than 2 working feeds to compare | degraded, with the fix "configure a second feed" |

### RS universe

Polygon grouped-daily, the whole-market frame the RS rating, group ranks and
rank-in-group need.

| Result | Severity |
|---|---|
| no sessions cached | down (fix: the backfill command; needs `POLYGON_API_KEY`) |
| fewer than 1,000 symbols | down |
| fewer than 253 sessions (a year) | degraded |
| otherwise | ok |

### Files qp builds

| File | Required fields | Too old after |
|---|---|---|
| O'Neil market model | `status`, `indexes` | 36 hours |
| group ranks | `groups` | 36 hours |
| industry map | `symbols` | 14 days |

Missing, unreadable, or missing a required field: **down**. Present but too
old: **degraded** ("nothing has rebuilt it").

### SEC EDGAR

The source of the C and A tables. **down** when the ticker map has fewer than
5,000 entries, when AAPL's facts give no quarters, or on a 403 (EDGAR wants a
descriptive User-Agent: set `EDGAR_UA`). ok shows how many tickers are mapped and
how many quarters AAPL parsed to.

---

## Known gaps

- The news `fix` line and the Alpaca `fix` line say "Settings > API Keys",
  which has no inputs; keys go in `data/keys.json` (D-T4).
