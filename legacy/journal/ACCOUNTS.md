# Alpaca accounts: the scheduled fetch

The second way trades enter the journal. Add an Alpaca account on the page
and the journal reads its fills on a schedule, pairs them into round trips
and writes them in. This is the journal's best-built part: the pairing is the
model a rebuild should use for every source.

Written from `journal/src/addons/accounts.js`, `journal/src/addons/fillsToTrades.js`
and the accounts panel in `journal/public/addons.js`. Covered by
`tests/journal.alpacaAccounts.test.js` (18 tests) and `tests/journal.import.test.js`
(19 tests, the pairing).

---

## The panel (Trades tab, above the trade list)

**Add an Alpaca account:** name, API key id, secret (a password field),
paper or live, *every N min*, *last N days*, **add account**. After saving,
the message says the first fetch comes within a minute.

Each account is one row:

| Shown | Meaning |
|---|---|
| name | as typed |
| `paper` or `LIVE` (amber) · key id · every N min · last N days · `PAUSED` | the settings; the key id is shortened to its first 4 and last 2 characters |
| status line | `not fetched yet`, or `last fetch <time> ET · F fills → T trades (A new, U updated)`, or `last fetch <time> ET FAILED: <reason>` in red |
| **fetch now** | fetches at once, then reloads the trades |
| **test key** | asks Alpaca for the account: `key works · account <number> · <status>` or the reason it failed |
| **pause** / **resume** | turns the schedule off or on |
| **remove** | asks for a second tap (`remove? its trades stay`); the account goes, its trades stay |

The panel re-reads the list every minute and whenever the page comes back
into view, so a scheduled fetch shows without a reload. Every account's name
is also added to the page's account filter, so an account that has not traded
yet can still be chosen.

---

## The settings and their checks

| Field | Rule | Default |
|---|---|---|
| name | 1 to 40 characters; unique, ignoring case | — |
| key id, secret | both or neither; no quotes or spaces; key ≥ 10 and secret ≥ 20 characters. On an edit, leaving both out keeps the old pair | — |
| paper | paper uses `https://paper-api.alpaca.markets`, live `https://api.alpaca.markets` | paper |
| every | 5 to 1440 minutes, rounded | 30 |
| look back (`days`) | 1 to 90 days, rounded | 5 |
| enabled | on or off | on |

An account gets a random 12-hex-character id.

---

## Where the keys live

`<JOURNAL_DATA_DIR>/journal-accounts.json`, normally `data/journal/`.

- Written to a temporary file, then renamed over the old one, mode **0600**.
- Gitignored by name. The nightly backup does **not** take it: the backup
  copies only `journal.db` from that folder.
- No answer from the server ever carries a secret. The page receives
  `id, name, paper, enabled, everyMinutes, days`, the shortened key id,
  `hasKeys` and `lastRun`.
- The only Alpaca calls made with these keys are **`GET /v2/account`** (test
  key) and **`GET /v2/account/activities/FILL`** (the fetch). The keys are used
  read-only.

The same file is also the **last fallback** for the market-data key the
technical compute uses ([ANALYSIS.md](ANALYSIS.md#where-the-bars-come-from)).

---

## The schedule

- A timer ticks **every 60 seconds**.
- Each tick takes every account that is enabled, has keys, and whose last run
  (success **or** failure) is at least *every* minutes old, and fetches them
  **one at a time**.
- A failed fetch is recorded with its reason and waits for its next turn. It
  does not retry every minute.
- Only one fetch per account can run at once; a second one answers
  `a fetch for this account is already running`.

## One fetch

1. `since` = now − *days*.
2. Ask Alpaca for every fill after `since`, oldest first, 100 per page, up to
   **50 pages (5,000 fills)**. Each fill keeps `id, symbol, side, qty, price,
   transaction_time`.
3. Pair the fills into trades (next section).
4. Write the trades (the section after).
5. Save `lastRun = { at, ok, fills, trades, added, updated, error }` on the
   account.

---

## Fills into trades

`tradesFrom(fills, accountId, accountName)`: fills are grouped by symbol and
sorted by time (pages do not guarantee order). Then, per symbol, a **running
position** is tracked:

| Position | Becomes |
|---|---|
| 0 → not 0 | a trade opens; its direction is this fill's (`buy…` is long, anything else short) |
| moves further the same way | more entry; the entry price is the **volume-weighted average** of every entry fill |
| moves back toward 0 | exit; the exit price is the volume-weighted average of every exit fill |
| reaches 0 | the trade is finished |
| crosses 0 in one fill | the fill is **split**: the part up to 0 closes the first trade, the rest opens a new trade the other way |
| not 0 at the end of the window | the trade is kept as **open**, with no exit |

A trade counts as closed only when its exit shares reach its entry shares; a
partly closed trade is sent as open with no exit price. Times are taken in
**New York**: the trade's `date` is the entry's New York date, and entry and
exit times are `HH:MM:SS` New York clock.

**The id** is `alpaca:<accountId>:<first fill's Alpaca id>`. The account is
part of the id, so two accounts trading the same stock at the same second can
never overwrite each other.

## Writing them

For each trade:

| Case | Action |
|---|---|
| a field is missing (id, date, ticker, direction, shares, entry price) | skipped |
| a trade with this id exists and is **closed** | skipped: **a closed trade is never rewritten**, because by then it may carry a setup or a note |
| a trade with this id exists and is open | updated: shares, entry, exit, P&L, % move, duration, status, account |
| new | inserted |

Stored values: `commission = 0`, `net_pnl = gross_pnl`, `pct_move` signed by
direction, `source = alpaca`, `account` = the account's **name**,
`entry_time` `00:00:00` when missing, `duration_ms` from the two clock times
on the entry date. Every trade that is closed after the write is offered to
the grading copy ([ANALYSIS.md](ANALYSIS.md#the-grading-bridge)).

---

## Limits found while checking (recorded in [KNOWN-ISSUES.md](KNOWN-ISSUES.md))

| | What happens |
|---|---|
| **A position older than the window** (D-J11) | Fills before `since` are not fetched. A long bought 7 days ago and sold today, with *days* = 5, arrives as one sell: it opens a **short** that stays open. The real trade, if an earlier fetch stored it as open, keeps its old id and is never closed. **Tested.** Any trade held longer than *days* hits this |
| **Swing trades** (D-J12) | A trade has one date (the entry's) and two clock times. Bought Monday 10:00 and sold Wednesday 11:30 is stored as exit 11:30 with a duration of **1.5 hours**. **Tested** |
| **No fees** (D-J15) | Commission is always 0. Alpaca stock trades have no commission, but regulatory and pass-through fees are not read |
| **Renaming an account** | Trades carry the account's name. Open trades take the new name on the next fetch; closed trades keep the old one, so one account's history shows under two names |
| **5,000 fills** | A fetch reads at most 50 pages; an account with more fills in its window loses the newest |

## What a rebuild should keep

The pairing itself: running position, weighted prices, reversals split, open
trades kept, a stable id that includes the account. It should be the only
pairing code, used for files too. Add to it: fetch from **before** the oldest
open position (or carry the position across fetches), give a trade an exit
date, and read fees.
