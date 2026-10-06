# The qp page

Everything on qp's one page (`:8765/`): the chart, the tools rail and the
sections it opens. Written from `quant-platform/chart/static/index.html` and
the routes it calls in `chart/server.py`.

Related: strategies ([STRATEGIES.md](STRATEGIES.md)), backtests
([BACKTEST.md](BACKTEST.md)), alerts and print sheets
([ALERTS-AND-PRINTS.md](ALERTS-AND-PRINTS.md)), feeds
([DATA-FEEDS.md](DATA-FEEDS.md)).

---

## Layout

```
┌ desk app bar: Trade Desk · Screeners · qp · Journal ───────────────────┐
│ Symbol [SPY]  TF [5m]  ▶ Live   ☰ Panel  ⚙ More                         │
├──┬──────────────────────────────────────────────────────┬──────────────┤
│R │                                                      │ side panel:  │
│a │                chart                                 │ the section  │
│i │      candles · indicators · signals · stop/target    │ the rail     │
│l │                                                      │ opened       │
│  │ volume pane · oscillator panes                       │              │
└──┴──────────────────────────────────────────────────────┴──────────────┘
```

On a phone the side panel and the More sheet slide over the chart; the rail
can sit **left of the chart** or **under the time axis** (More → Tools).

---

## The header

| Control | Does |
|---|---|
| Symbol | any ticker |
| TF | 1m, 2m, 5m, 15m, 30m, 1h, 1d |
| ▶ Live | re-computes on an interval over `/ws/live` and moves only the newest bar and indicator tips. Disabled while **As-of** is set (a past day is not live). Moves only on feeds that are live (not free Polygon) |
| ☰ Panel | shows or hides the side panel |
| ⚙ More | the chart settings sheet (below) |

## The tools rail

| Button | Opens |
|---|---|
| **Chart** | the settings sheet: type, scale, days, session, feed, as-of |
| **Indicators** | add an indicator, list and edit the ones on the chart |
| **⚡ Strategy** | the strategy drawer |
| **Backtest** | the backtest section |
| **Register** | what the scanners found, by tool and day |
| **🔔 Alerts** | the live signal watcher |
| **🖨 Print** | print a register day as charts |

---

## Chart settings (⚙ More / Chart)

| Setting | Options |
|---|---|
| Type | Candles, Bars, Line, Area, Heikin Ashi |
| Scale | Linear, Log, % |
| Labels | **Clean**: price only; **Every indicator tagged**: each line labelled on the scale |
| Tools | rail left of the chart, or under the time axis |
| Days | 1–730 days of bars (warm-up for the indicators is added automatically) |
| Session | All-day (extended hours) or Regular |
| Feed | yahoo, yahoo_ext, alpaca, polygon, hybrid, hybrid_yahoo ([DATA-FEEDS.md](DATA-FEEDS.md)); **make default** sets the feed every chart and backtest starts with |
| As-of | **replay cutoff**: every bar after this date is hidden, so a setup is judged as it stood then. Blank = everything through today |
| ⤢ Fit all bars | fit the whole range |
| Bar cache | how much disk it uses; **Delete all**, or **Delete > 2 days** |

## The chart

- Candles with the chosen indicators; price overlays sit on the candles,
  oscillators (RSI, RVOL, ATR, slope …) drop into their own pane, volume as a
  histogram underneath.
- Levels and support/resistance drawn as steps; session background bands;
  New York time axis.
- Crosshair legend with OHLC and every indicator's value at that bar.
- After **Evaluate**: entry ▲ and exit ▼ markers, coloured by exit reason
  (stop, target, trail, rule, end of day), and the stop and target as the
  simulation used them.

---

## Indicators

**Add an indicator**: pick a primitive from the verified library
([CATALOG.md](CATALOG.md)), its length and source (close, open, high, low,
hl2, hlc3, ohlc4, volume), **+ Add to chart**. **On the chart** lists what is
drawn; **Selected** shows one indicator's parameters to edit. Every primitive
is offered, marked ✅ approved or 🚧 draft (all 71 are approved today).

---

## The strategy drawer (⚡ Strategy)

A resizable drawer over the chart.

| Part | |
|---|---|
| name, side (Long/Short), **Stage** (Development/Ready), **Tools** (`T1 T2`) | the strategy's identity ([STRATEGIES.md](STRATEGIES.md)) |
| saved list, Save, New, Delete | strategies are stored in qp's database |
| **Entry** and **Exit** groups | rows of *operand · operator · operand*, each with its `[n]` offset, *held for / within N*, and a 🔍 test; **+ condition**, **+ group ( )** for nested groups; group mode ALL / ANY / AT LEAST k / IN SEQUENCE |
| stop and target | %, ATR×, points, or **@ line** (anchored to an indicator); **＋ target** adds scale-out legs |
| **▶ Evaluate**, **Clear signals** | run it over the chart window; clear the markers |

The stage's help text still describes Ready as "trusted to place real orders
from"; the desk no longer places orders (Q-N3).

---

## The Register section

What the screener tools froze, browsable by day:

- **Source and register:** one tool's R1 or Shortlist, or **all tools merged**
  (`'*:R1'`); the list of tools comes from `/api/screener/sources`, which says
  which are up.
- **Date**, then a card per stock: score, regime, sector, gap %, RVOL.
- Tap a card: the chart loads that ticker on that day's session. A warning
  line names any tool that did not answer.

## The Backtest section

The settings of a run in six groups (Strategy, What to test, Money, Ranking,
Funded-account rule, Prop-firm costs and caps), each field with a label and a
"?" explanation; **Only short what the broker will lend**; **Run the
backtest**; **recent backtests** (a running one can be stopped); the trade
list with its filter, **CSV (filtered)** and **Full report ↗**; **Reset
these settings to the defaults**. Every field is described in
[BACKTEST.md](BACKTEST.md). The settings are remembered in the browser.

## The Alerts section

**Start watching** / stop, what it is watching (strategies × symbols), and
**Signals today**. Each signal raises a sound and a browser notification.
See [ALERTS-AND-PRINTS.md](ALERTS-AND-PRINTS.md).

## Print

**🖨 Print R1**: every ticker of a register day as a chart, with your
timeframe and indicators, over full extended hours plus the previous day.
Also the swing sheet and a pasted list of `symbol, date` pairs. See
[ALERTS-AND-PRINTS.md](ALERTS-AND-PRINTS.md).
