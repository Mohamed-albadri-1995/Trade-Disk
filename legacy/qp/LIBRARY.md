# The qp library: verified market math

The indicator library every part of qp uses, how a primitive is defined,
how it is verified against TradingView before anything may trust it, and how
to add one. Written from `quant-platform/qp/` (the code is in
[library/](library/README.md)), `approvals/approvals.json`,
`tools/compare_server.py` and `tools/gen_catalog.py`.

Every primitive, its inputs, outputs and parameters: [CATALOG.md](CATALOG.md).

---

## The one rule

**No market math exists anywhere except `qp/primitives/`.** Every function
there is registered with `@primitive` into one registry. The verification
tool, the chart, the strategy engine, the backtest and the alerts all reach
the same function through the same registry, so **what was verified against
TradingView is what the chart draws and the backtest trades**.

```
  compare tool (verify + approve)      chart, strategies, backtests, alerts
              │                                    │
              └──────────── both call ─────────────┘
                              ▼
                qp.REGISTRY['ma.sma'].fn(...)      one implementation
                              ▲
                approvals/approvals.json           the gate: what is verified
```

---

## What is in it: 71 primitives, all approved

| Group | Count | Primitives |
|---|---|---|
| `ma` | 7 | sma, ema, wma, rma, vwma, hma, pine_5day (Pine's 5-day MA on 1-minute data) |
| `vwap` | 16 | session, nday_block, nday_rolling, weekly, monthly, anchored, today_hh/ll, week_hh/ll, swing_hh/ll, last_hour_hh/ll, gap, stdev_bands |
| `volatility` | 6 | true_range, atr, atr_daily, stdev, bb, bb_ema |
| `osc` | 1 | rsi |
| `extremes` | 2 | highest, lowest |
| `levels` | 29 | day_open, prev_day_open/high/low/close, today_high/low, today_vol_max, pm_high/low, postmarket_high/low, postpre_high/low, weekly_open/high/low, prev_week_open, monthly_open/high/low, prev_month_open, monday_high/low, yearly_open, prev_year_open, window_high/low, dynamic_sr |
| `structure` | 2 | pivot_high, pivot_low |
| `pivots` | 1 | floor (P, R1–R3, S1–S3) |
| `candle` | 4 | body, upper_wick, lower_wick, bar_range |
| `trend` | 1 | slope |
| `volume` | 2 | avg_volume, rel_volume (RVOL) |

Derived quantities (body as % of range, move in ATR, distance to R1) are not
primitives: they are composed in a strategy with an `expr` operand
([STRATEGIES.md](STRATEGIES.md)).

---

## How a primitive is defined (`qp/registry.py`)

```python
from qp.registry import primitive, Param

@primitive(
    name='sma',                    # short name, unique across the WHOLE library
    group='ma',                    # key becomes 'ma.sma'
    description='Simple moving average of `source` over `length` bars.',
    params=(Param('length', 'int', default=9, min=1),),
    inputs=('source',),            # or ('bars',)
    # outputs=('upper', 'middle', 'lower') when it returns several lines
    # compute_tf='1m' when it is defined on a fixed timeframe
)
def sma(source, length): ...
```

| Part | Meaning |
|---|---|
| `inputs=('source',)` | takes one array: close, open, high, low, hl2, hlc3, ohlc4, volume, body_high, body_low |
| `inputs=('bars',)` | takes a `qp.Bars`: a validated OHLCV frame (time-zone aware, increasing, no duplicates) |
| `outputs` | `('value',)` returns one array aligned to the bars; several names return a dict of arrays |
| `Param` | `name`, `kind` (`int`, `float`, `str`, `bool`), `default`, `min`, `max`, `description` |
| `compute_tf` | the primitive needs bars of this timeframe whatever the chart shows (e.g. `pine_5day` on 1-minute bars); the caller maps the result back |

**NaN marks warm-up bars and bars where the value is undefined** (outside the
session, before an anchor, a level not yet known). The decorator refuses a
duplicate key **and** a duplicate short name, because strategies refer to
primitives by short name and a collision would silently swap one for another.

Using it:

```python
import qp
qp.REGISTRY['ma.sma'].fn(close, length=9)
qp.REGISTRY['vwap.session'].fn(qp.Bars.from_frame(df))
for key, meta in qp.approved_primitives().items(): ...   # only the verified slice
```

---

## Verification against TradingView

A primitive is **trusted only once a person has compared it with TradingView
and approved it**.

1. Run the compare tool on the box, on its own port, through an SSH tunnel:
   ```sh
   cd ~/Tade-desk-server/quant-platform
   python3 tools/compare_server.py --port 8767        # binds 127.0.0.1
   ssh -L 8767:127.0.0.1:8767 ec2-user@<box>          # from your machine
   ```
2. Pick a primitive (🚧 draft, ✅ approved), set symbol, timeframe, days,
   source and parameters, **Compute**.
3. Compare the qp chart with the TradingView widget beside it (the matching
   TradingView study attaches where one exists): the shape, and the values on
   two or three bars.
4. Match: **Approve as verified**. This writes `approvals/approvals.json`:
   who, when, the git commit of the code approved, notes. Mismatch: do not
   approve; record the primitive, the settings and what differs.
5. Commit `approvals.json`. Re-approving after a fix overwrites the record so
   it points at the fixed code.

The compare tool can load bars from every feed qp knows (yahoo, yahoo_ext,
alpaca, polygon, hybrid, hybrid_yahoo); verify VWAPs on Polygon on a
completed day (an Alpaca IEX seam distorts volume, [DATA-FEEDS.md](DATA-FEEDS.md)).

Its routes: `GET /api/health`, `GET /api/primitives`, `GET /api/data`,
`POST /api/approve`.

## Adding a primitive

1. Write it in a group file under `qp/primitives/` (a new file is discovered
   automatically).
2. Restart the compare tool: it appears as 🚧.
3. Verify, approve, then `python3 tools/gen_catalog.py` to regenerate
   [CATALOG.md](CATALOG.md) (never edited by hand), and commit.

---

## Deliberate differences from the source Pine scripts

Everything else matches bar for bar.

1. **VWAPs default to regular hours** (`rth_only=True`), as a standard
   TradingView equities chart does; `rth_only=False` accumulates extended
   hours.
2. **Two N-session VWAPs:** `vwap.nday_block` is Pine's block-reset study (use
   `anchor_offset` to line its phase up with TradingView); `vwap.nday_rolling`
   is a trailing VWAP always anchored N−1 sessions back.
3. **`last_hour_*` stops at 16:00 ET**: the raw Pine leaks into after-hours
   on extended charts.
4. **`pivots.floor` defaults to regular-hours sessions**, as TradingView's
   daily stock bars do; `'eth'` gives the literal full-day behaviour.
5. **Before a VWAP's first anchor qp shows nothing**, where Pine shows a line
   that depends on how many bars happen to be loaded.
6. **Weekly, monthly and yearly levels are regular-hours only**;
   `weekly_open` is Monday 09:30, not the 04:00 pre-market print.
7. **Daily charts:** each daily bar is treated as the regular-hours aggregate,
   so levels, pivots and session VWAPs work on 1-day frames.

---

## Why this is the part to keep

The library is the one piece of qp built the way the whole desk should be:
one implementation, one registry, a human verification step with a recorded
approval, a generated catalogue that cannot drift, and stated deviations.
Its code is copied in [library/](library/README.md) so a rebuild can start
from verified math.
