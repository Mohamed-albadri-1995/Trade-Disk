# The journal page

Everything on the journal's page, and every number it shows, with its
formula. The page is one file, `journal/public/journal.html` (1,080 lines),
plus `journal/public/addons.js` (558 lines), which is applied over it.

**Every number is computed in the browser**, from one call:
`GET /api/journal/trades` (every trade) and `GET /api/trading/setups` (the
setup names). The server's own metrics and calendar routes are not used by
the page ([API.md](API.md)).

---

## The top of the page

| Part | What it does |
|---|---|
| **The desk's app bar** | the same strip as every desk page, naming the programs with the journal marked (from `addons.js`, below) |
| **📒 Trade Journal** | the title |
| **Account filter** | `All`, then every account seen on a trade, plus every Alpaca account added on the page (even one with no trades yet) |
| **Setup filter** | added by `addons.js`: `All setups`, every setup used on a trade, and `No setup` when some trades have none |
| **Source filter** | `All`, then every source seen on a trade: `import`, `alpaca`, `manual` |
| **↻ Refresh** | reloads every trade |

The three filters apply to **every tab**. They narrow the trade list once
(`applyScope`), and every tab draws from that narrowed list. A remembered
setup choice that no longer exists is reset to `All setups`, so the page is
never empty for that reason.

The page remembers the open tab (`jnl_tab`) and the calendar month
(`jnl_cal_month`) in the browser.

**The app bar.** `desk.css` cannot be linked whole, because it sets the body's
font, background and gutter. So the journal's server serves `/deskbar.css`: it
cuts out only the rules between the `DESKBAR START` and `DESKBAR END` markers
in `public/desk.css`, and re-scopes the colour tokens from `:root` to
`.dk-bar`. If the markers are missing it logs a warning and the bar shows
unstyled. `/desk.js` is served straight from the repo, and `/api/tools` from
`tools.config.json`. All three are sent with `no-cache`, so a `git pull` is
enough to update them. The page's old `← Dashboard` link pointed to `/`,
which on port 3100 is the journal itself. `addons.js` removes it once the bar
is drawn, or turns it into `← Trade Desk` (port 3000) when the bar fails.

---

## Which trades count

- **Closed** = `status` is `closed` **and** net P&L is known. Every number
  below uses closed trades only, unless it says otherwise.
- **Winner**: net P&L > 0. **Loser**: net P&L < 0. A trade at exactly 0 is
  neither, but it still counts in the number of closed trades.
- **Times.** The page builds each trade's entry and exit instant from its date
  and its New York clock time **written as if it were UTC**, and reads hours
  back with UTC functions. So every hour shown is New York time, whatever the
  browser's time zone. Exit instants use the **entry date**.

---

## The numbers, exactly

| Number | Formula |
|---|---|
| Net P&L | sum of net P&L |
| Win rate | winners ÷ closed × 100 |
| Profit factor | sum of winners ÷ −(sum of losers). ∞ with winners and no losers; blank with neither |
| Expectancy ($) | net P&L ÷ closed |
| Average win / loss | sum of winners ÷ winners; sum of losers ÷ losers (a negative number) |
| Payoff | average win ÷ −average loss |
| **R of a trade** | net P&L ÷ (\|entry − stop\| × shares). Blank without a stop |
| Expectancy R | mean R of the trades that have one |
| SQN | mean R ÷ sample standard deviation of R × √(min(number of R values, 100)). Blank with fewer than 2 R values |
| Kelly % | (win rate − (1 − win rate) ÷ payoff) × 100, with win rate as a fraction |
| Max drawdown ($) | closed trades in exit order (entry order when there is no exit time); cumulative net P&L from 0; the running peak starts at 0; the largest peak − equity |
| Max drawdown (%) | that drawdown ÷ the peak it fell from × 100; blank when that peak was 0 |
| Recovery | net P&L ÷ max drawdown |
| Consistency | mean daily net P&L ÷ sample standard deviation of daily net P&L × √252 (a day is an entry date) |
| Hold time, winners / losers | mean duration of winners / of losers |
| Fees | sum of commission |
| Streaks | trades in entry order; the longest run of winners and of losers. A winner ends a losing run and a loser ends a winning run; a 0 trade ends neither |
| Long / short | count and net P&L of each side |

**R is empty for every trade today**: nothing sets a stop and the page has no
field for one (D-J9). Expectancy R, SQN and the R distribution therefore show
`—` or "needs ≥3 trades with SL set".

**Buckets** (used by the Time tab and the insights):

| Bucket | Values |
|---|---|
| Entry hour | `09:00`, `10:00`, … (New York) |
| Weekday | Mon to Fri |
| Entry price | $0–2, 2–5, 5–10, 10–20, 20–50, 50–100, 100+ |
| Size (shares) | 0–99, 100–499, 500–999, 1000–1999, 2000+ |
| Side | long, short |

Each bucket shows its number of trades, win rate, net P&L and net P&L per trade.

---

## The tabs

### Overview

1. **Closed P&L**, large, with `N closed · M open · W W / L L`.
2. Two rings: **Win %** and **Long %** (longs ÷ closed).
3. **Insights**, when there are at least 5 closed trades: every bucket above
   with at least 2 trades is ranked by the size of its net P&L. Up to four are
   shown, at most two that made money and two that lost. Each says its share
   of all profits or all losses, for example *"The 10:00 hour contributed
   $1,240.00 (38% of all profits) across 9 trades (win 67%)."*
4. Six tiles: **Net P&L** (after fees), **Win rate**, **Profit factor**
   (green ≥ 1.5, amber ≥ 1, red below), **Expectancy** (with expectancy R, or
   "set SL on trades"), **Payoff ratio**, **Max drawdown** (with % off peak).
5. **Equity curve**: cumulative net P&L (blue), its running peak (dashed),
   the gap between them shaded red as drawdown, and a zero line.
6. A strip: **SQN** (green ≥ 2, amber ≥ 1), **Kelly**, **Recovery**,
   **Consistency**, **Long** and **Short** (count · net), **Streaks**. A legend
   under it explains SQN, Kelly, Recovery and Consistency. It writes SQN as
   "× √N", but the code caps N at 100.

### Calendar

A month grid of weekdays, **Mon Tue Wed Thu Fri Week**. Each day shows its net
P&L and trade count, coloured green or red, stronger for bigger days. The
sixth column is the week's total. **‹ ›** change the month; the page opens on
the month last viewed, else the last month with a trade. Under the grid: the month's net P&L and trades.
Trades dated on a weekend are left out of the grid and of the month total.

### Time

Four bar tables, each with net P&L, trades, win rate and $ per trade:
**Entry time (New York)**, **Day of week**, **Entry price**, **Position size**.
Then **Hold time**: average winner and loser duration, with a verdict:
*"Winners held SHORTER than losers"* (amber) or *"Winners held longer than
losers"* (green).

### Risk

1. **Risk snapshot**: win rate, average win, average loss, payoff, profit
   factor, expectancy (with R when known), max drawdown, worst streak, fees.
2. **R-multiple distribution**: a histogram in bins ≤ −2R, −2..−1, −1..0,
   0..1, 1..2, 2..3, > 3R. Shown only with at least 3 trades that have R; today
   it always shows the note instead.
3. **P&L distribution ($)**: six bins of equal width from −largest to
   +largest absolute P&L. A trade whose loss is exactly the largest falls
   outside the first bin and is not drawn.

### Stats

Five folding groups (the first open):

| Group | Numbers |
|---|---|
| Performance & P&L | total net, winners' P&L, losers' P&L, expectancy, average P&L per day, best trade, worst trade, P&L standard deviation |
| Trade statistics | closed, **open**, winners, losers, win rate, profit factor, payoff, average winner, average loser, long and short (count · net), longest win and loss streaks |
| Time analysis | total time in trades, winners' and losers' total time, average and longest duration, average winner and loser hold |
| Costs & fees | total fees, per trade, per day, fees as % of winners' P&L |
| Volume | total shares, winners' and losers' shares, average shares per trade, net P&L per share |

Then **Symbol analysis**: the 12 tickers with the largest absolute net P&L,
each with trades, win rate, net and $ per trade.

### Setups

One row per setup with **at least 3 closed trades**, best total first:
trades, win rate, $ per trade, profit factor, total, average R, and a small
equity curve. A setup's name comes from `/api/trading/setups`; an id with no
name there is shown as the id. Fewer than 3 trades everywhere shows *"Need ≥3
trades per setup."*

### Trades

**Controls:** ticker search (part of the name), side (both, long, short),
status (all, closed, open), sort (newest, oldest, best P&L, worst P&L).

**The Alpaca accounts panel** sits above the list ([ACCOUNTS.md](ACCOUNTS.md)).

**Stats bar:** trades, closed, win %, net, for what the controls show.

**Per day**, in the chosen sort order: a header with the date, the day's net P&L, trades,
closed and win %. Then **one card per trade**:

| On the card | |
|---|---|
| ticker, `▲ Long` or `▼ Short`, `OPEN` when open, the setup name, the account | |
| net P&L and % move | |
| 📈 | opens qp's print sheet of that stock and day on 1-minute bars (Polygon feed), with the entry and exit drawn ([ALERTS-AND-PRINTS.md](../qp/ALERTS-AND-PRINTS.md)). **The marks land 4 or 5 hours early** (D-J10): the page sends its "New York clock written as UTC" instants, and qp's bars are real UTC instants |
| 🗑 | delete, with a second tap to confirm |
| date, entry, exit, shares, in, out, duration, net P&L, stop and target when set | |
| notes, when present | read-only |
| **Setup** dropdown | the **only edit on the page**. Choosing one sends `PATCH { setup_id }` and reloads. The list holds the **enabled** setups from `trading_setups` |

### Import

The file import ([IMPORT.md](IMPORT.md)). Its hint reads *"Trade the Pool
orders (semicolons)"*, but the semicolon format is DXtrade. After an import it
prints `✓ Imported N trades`. It also looks for `skipped` and `format`
fields, which the server never sends.

**Re-eval Conditions** re-checks the setup conditions of every closed,
tagged trade that has a technical snapshot, without fetching bars, and reports
how many it evaluated ([ANALYSIS.md](ANALYSIS.md#conditions-and-setup-templates)).
Nothing on the page shows the conditions it writes.

---

## What the page cannot do

| Wanted | Today |
|---|---|
| enter a stop or target | API only (`PATCH`) |
| add a trade by hand | API only (`POST`) |
| edit exit, notes, commission | exit and notes API only; commission nowhere |
| see a trade's technicals, MAE/MFE, conditions | computed and stored, never shown |
| day notes, fee rules, setup templates | routes exist, no screen |
| create or edit a setup or a check | no route, no screen |
| see the grading engine's expectancy or grade | no route, no screen ([ANALYSIS.md](ANALYSIS.md#the-grading-engine)) |

A rebuild should either give these a screen or not build them.
