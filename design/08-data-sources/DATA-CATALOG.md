# Data catalog — every field, and where it comes from

**Above:** [DATA-SOURCES.md](DATA-SOURCES.md) (the adapter, the registry, the
commercial-use flags). This document is the **field-by-field map**: every data
field the platform needs, grouped by family, with its **free (solo)** source and
its **commercial (hosted)** source, and whether we **fetch** it or **compute** it.

> Scope: data sourcing only. The built solo app runs on seeded demo data today; this
> catalog is the plan for wiring **real** data — free in solo mode, licensed in
> hosted mode. Every commercial term below is **"verify at integration"**: provider
> licences change often and the binding terms live in signed agreements, not public
> pages.

---

## 1. Three rules that govern the whole table

1. **Free ≠ licensable.** Almost every *free* feed (TradingView scanner, Yahoo,
   and even most vendors' cheap "paid" tiers) is **personal-use only** — fine for
   you on your own screen (solo), forbidden in a product you sell (hosted). Going
   commercial is not "pay the sticker price"; it is **contract a commercial/
   enterprise licence**.
2. **Display vs redistribution.** *Display* = show the data to your paying users
   inside Trade-Disk (most commercial tiers allow this). *Redistribution* = let
   users pull the data back out (your own public API, bulk export, a feed) — needs
   the top enterprise/distribution tier. **Decide early which one hosted mode does;
   that choice, not price, picks every vendor's tier.**
3. **Government data is the only clean free-and-redistributable tier.** SEC EDGAR,
   FINRA (verify its portal's non-commercial string), FRED, BLS, the Fed and the
   Treasury are $0 **and** redistributable. Everything a vendor *computes on top*
   (ratios, growth, estimates, rankings) is that vendor's licensed product.

**What we compute ourselves (never bought):** all technical indicators, ranges
(ADR/ATR/52-week/period positions), relative volume, pre-market high/low/range,
valuation ratios (price × EDGAR shares/EPS), earnings growth/CAGR/stability, the
O'Neil market model (M), relative strength + industry-group rankings (L), the
regime/bias read, days-to-cover. Computing is cheaper, licence-clean (a derived
value is our work, not redistributed vendor data), and avoids per-indicator limits.

---

## 2. Source modes — merge vs prime + backup

A field is served in one of two shapes, and the [admin dashboard](../14-admin/ADMIN.md)
lets an operator set this **per field family**:

- **Prime + backup** — one active source, an ordered fallback if it is unhealthy
  (most families). E.g. short interest = FINRA → Yahoo → Nasdaq.
- **Merge** — several sources live **at once**, combined and de-duplicated (news,
  the macro calendar). E.g. news = SEC 8-K RSS + Yahoo + Google + a vendor, merged
  by headline/ticker/time.

The registry stores, per family: the **mode**, the **ordered source list** (each
enabled/disabled, prime/backup rank), and — in hosted mode — the commercial-use
flag that must be set before a source can go live ([DATA-SOURCES.md §3.7](DATA-SOURCES.md)).

---

## 3. The families

Legend — **F** = fetched, **C** = computed by us (desk / research worker / qp).
"Solo" = the free source; "Commercial" = the licensed hosted source.

### A · Real-time quote / price — *prime + backup*
| Field | F/C | Solo (free) | Commercial (hosted) |
|---|---|---|---|
| last, change, % change, open, day high/low | F | TradingView scanner | Polygon/Massive (SIP, Advanced) · Alpaca SIP · Finnhub · EODHD |
| previous close, gap %, day-range position | C | from price/open | from the licensed quote |
| VWAP | F | TradingView | rides in the day bar (`vw`) or compute |
| live/stale mark | C | desk state | desk state |

### B · Pre-market — *prime + backup* (problem area)
| Field | F/C | Solo | Commercial |
|---|---|---|---|
| PM high/low/range, PM % | C | TradingView PM cols (last only via Yahoo) | **compute from extended-hours 1-min bars** |
| PM / ADR, PM band | C | from PM range + ATR | same |
| extended-hours bars | F | Yahoo ext / Alpaca IEX (thin) | **Alpaca SIP · Polygon Advanced** (reliable PM needs a full feed) |

> Reliable pre-market needs a **consolidated (SIP) feed** → effectively paid in hosted mode.

### C · Historical bars / OHLCV — *prime + backup* (feeds already fall back)
| Field | F/C | Solo | Commercial |
|---|---|---|---|
| intraday (1m/5m/15m/1h) bars | F | Alpaca free (best) · Yahoo · Twelve Data | Polygon/Massive · Alpaca SIP · EODHD · Databento |
| daily/weekly/monthly bars | F | Stooq · Yahoo · Alpaca | Tiingo · Polygon · EODHD · Sharadar |
| adjusted vs raw, session basis, as-of | — | feed metadata | pick one adjustment policy, apply everywhere |
| live tail (newest bar) | F | Alpaca `/ws/live` | Alpaca SIP · Polygon |
| outcome bars (entry, HH/LL, OR, R-multiples) | C | from bars | from bars |

### D · Volume & liquidity — mostly *computed*
| Field | F/C | Solo | Commercial |
|---|---|---|---|
| volume (session) | F | rides every bar | rides every bar (SIP = true volume) |
| average volume (10d/3m) | F | Yahoo · Finnhub metric | EODHD · FMP · Finnhub paid — or compute |
| 20-day avg vol, relative volume, dollar volume | C | compute from bars | compute from bars |
| U/D volume ratio, A/D rating (O'Neil S) | C | research worker, from bars | same |

### E · Float, shares & short interest — *prime + backup* (problem area)
| Field | F/C | Solo | Commercial |
|---|---|---|---|
| float | F | TradingView · Yahoo | EODHD · FMP · Intrinio (definitions differ — don't mix) |
| shares outstanding (+ basis, as-of) | F | SEC EDGAR | EDGAR (free + redistributable) · vendor |
| short interest (bi-monthly) + as-of | F | **FINRA** → Yahoo → Nasdaq | FINRA via licensed vendor · Finnhub/FMP paid · **Ortex** (daily modelled) |
| days to cover | C | short int ÷ avg vol | same |
| reg-SHO flag, borrow/easy-to-borrow | F | Nasdaq+NYSE / Alpaca | Alpaca |
| share-count % change, float % (dilution) | C | from two EDGAR counts | same |

> No **real-time** short interest exists anywhere (FINRA is bi-monthly, ~8-day lag);
> Ortex sells a daily *modelled* layer. FINRA may move to weekly — design the schema for it.

### F · Range & volatility — *computed*
| Field | F/C | Solo | Commercial |
|---|---|---|---|
| ATR(14), ADR $, ADR%, move×ATR | C/F | TradingView ATR → else compute | compute from bars |
| 52-week & week/month/quarter/year high/low + position | F/C | TradingView → else compute | compute from bars |
| all-time high + distance, trailing performance 1D–1Y | C | from bars | from bars |

### G · Technical indicators — *computed from bars (C)*
| Field | F/C | Solo | Commercial |
|---|---|---|---|
| SMA5, EMA 9/13/20/50, MA stack, 10 level relations | C/F | TradingView EMAs → else compute | compute from bars |
| RSI, MACD(+signal/hist), ADX, Stochastic, Bollinger, CCI, OBV, MFI, ROC, VWMA/WMA | C | compute (Twelve Data free to spot-check) | **compute** (Twelve Data/EODHD only as fallback) |
| support/resistance/pivots, patterns, breakout/MTF state | C | compute | compute |
| O'Neil **N** base (weeks, depth, pivot, %-to-pivot, handle) | C | research worker, from weekly bars | same |

### H · Earnings — O'Neil C & A — *prime + backup*
| Field | F/C | Solo | Commercial |
|---|---|---|---|
| quarterly EPS, year-ago EPS, quarterly sales | F | **SEC EDGAR** (5 traps: 4 revenue tags, Q4 = FY−Q1−Q2−Q3, ±45-day match) | EDGAR (free) · EODHD · FMP · Sharadar ARQ |
| annual EPS (multi-year) | F | EDGAR | EDGAR · Sharadar ARY · EODHD · FMP |
| EPS/sales YoY growth, 3-yr CAGR, acceleration, stability | C | compute from EDGAR | compute (FMP/EODHD serve some growth; acceleration & stability are always ours) |
| EPS surprise vs estimate | F | **no EDGAR** — Yahoo/Finnhub (personal) | **EODHD · FMP · Finnhub paid · Intrinio (Zacks)** (needs an estimates vendor) |

### I · Financials — *prime + backup*
| Field | F/C | Solo | Commercial |
|---|---|---|---|
| revenue, net income, equity, cash, debt components | F | **SEC EDGAR** (raw) | EDGAR (free) · FMP · EODHD · Sharadar · Intrinio |
| gross/operating/net margin, ROE, ROIC, FCF, current ratio, debt/equity | C | compute from EDGAR | compute, or ready-made from Sharadar/FMP/EODHD/Finnhub |
| share dilution / buyback trend | C | from EDGAR (consistent tag) | same |

### J · Valuation — *computed (price × EDGAR), or vendor*
| Field | F/C | Solo | Commercial |
|---|---|---|---|
| market cap | F/C | TradingView · price×shares | any vendor · compute |
| P/E (TTM), P/S, P/B, EV/EBITDA, EV, dividend yield, payout | C | compute (price × EDGAR) | compute · or Sharadar/EODHD/FMP/Finnhub ready-made |
| forward P/E, PEG | F | needs forward EPS → Yahoo (personal) | **EODHD · FMP · Intrinio** (estimates vendor; Sharadar/Polygon can't) |

### K · Growth & estimates — *prime + backup*
| Field | F/C | Solo | Commercial |
|---|---|---|---|
| revenue & EPS growth (Q/Y) | C | compute from EDGAR | compute · FMP/EODHD/Finnhub serve series |
| EPS surprise %, analyst target + upside, recommendation, forward estimates | F | **no EDGAR** — Yahoo/Finnhub (personal) | **FMP · EODHD · Finnhub paid · Intrinio (Zacks)** |

### L · Indexes (SPY/QQQ/DIA/IWM/VIX) + the desk read — *prime + backup*
| Field | F/C | Solo | Commercial |
|---|---|---|---|
| SPY/QQQ/DIA/IWM quote, change, week change, SMAs, Bollinger | F | TradingView (ETFs = ordinary equities) | any equity feed — MAs/Bollinger computed |
| **VIX** (the index) | F | Yahoo `^VIX` delayed | **CBOE index licence (expensive)** — or use VIXY/VXX ETF proxy / delayed VIX |
| ^GSPC / ^IXIC daily bars (feed the M model) | F | Yahoo | licensed equity feed |
| short/mid/long bias, regime + stance + confidence, breadth | C | desk, from indexes | desk |

> **VIX real-time is the one costly outlier** — avoid CBOE index fees with an ETF proxy or delayed VIX.

### M · Sector / industry ETFs (the 15) — *prime + backup*
XLK XLF XLI XLY XLE XLV XLC XLU XLB XLRE XLP · SMH IBB XRT XTN
| Field | F/C | Solo | Commercial |
|---|---|---|---|
| per-ETF quote, daily/week %, SMAs, Bollinger, ADX, VWAP, RVOL | F | TradingView | any equity feed (all ordinary ETFs) |
| RS vs SPY (day/week), sector bias/score/hot | C | desk, from ETF + SPY | desk |

> Easiest family — all standard ETFs, no special licence; relative strength is ours to compute.

### N · O'Neil market model M — *computed by the research worker*
Status, distribution days (25-session window), stalling/follow-through days, sessions
since FTD, per-index status + worse-of-two, per-card "stock on DD days". **Computed**
from ^GSPC/^IXIC bars; read (never recomputed) by the desk and stamped on each card.

### O · Relative Strength + industry-group rankings (O'Neil L) — *computed by us (THE GAP)*
| Field | F/C | Solo | Commercial |
|---|---|---|---|
| RS rating (1–99 percentile), RS line + divergence | C | research worker, from universe bars | same |
| industry-group rank/percentile/letter, group median RS, rotation, RS-in-group | C | research worker | same |
| the universe bars that feed it | F | Stooq/Yahoo EOD (dev only) | **Polygon/Massive grouped-daily** or EODHD bulk, licensed for commercial **+ derived-data** use |
| stock→group map (SIC from EDGAR; ~197-group taxonomy) | F/C | EDGAR SIC + our taxonomy | EDGAR + GICS-based or custom ~197-group scheme |

> **Definitive: the IBD RS rating and the ~197 O'Neil industry groups are proprietary
> IBD/MarketSurge IP — no affordable API, no redistribution licence.** We **compute our
> own** from a licensed price universe. The one clause to nail with the price vendor:
> it must allow displaying/redistributing **derived** rankings.

### P · Classification — *prime + backup (cache hard)*
| Field | F/C | Solo | Commercial |
|---|---|---|---|
| ticker, company name, sector, industry, exchange, country, security type | F | TradingView · Finnhub profile | EODHD · FMP · Polygon ticker-details · Intrinio |
| index membership (SPX/NDX/Russell) | F | unofficial scrape | EODHD/FMP constituents (verify redistribution; branded lists are licensed) |
| themes (AI/Space/…) | C | ticker + industry map | same |

### Q · News & catalysts — ***merge*** (several at once)
| Field | F/C | Solo (merge set) | Commercial |
|---|---|---|---|
| headline, source, URL, timestamp | F | **SEC 8-K RSS** (redistributable) + Yahoo RSS + Google RSS (personal) | **Benzinga** (true real-time WebSocket push) + SEC 8-K RSS + Polygon/Finnhub backfill |
| ticker relevance, catalyst category | F/C | 8-K is ticker-exact; **8-K item codes** = free catalyst taxonomy | Benzinga tags · Polygon `tickers[]` |
| sentiment | C | **compute ours** (e.g. FinBERT) | compute · or Polygon/Marketaux/AV scores |

> Only **Benzinga** offers genuine real-time news push; everyone else is polled REST.
> News is the clearest **merge** family — run multiple feeds in parallel, dedupe by
> headline/ticker/time, with 8-K RSS always on (free + redistributable).

### R · Corporate & economic events — *macro = merge; earnings/dividends = prime + backup*
| Field | F/C | Solo | Commercial |
|---|---|---|---|
| macro calendar (FOMC, CPI, NFP, Treasury) | F | **FRED releases + BLS + Fed + Treasury** (merge, free, redistributable) | keep government free · optionally TradingEconomics/Finnhub for consensus values |
| next earnings date / calendar | F | Nasdaq unofficial (dev only); SEC has actuals only | **FMP · Finnhub · EODHD · Benzinga** (forward dates need a vendor) |
| dividends, splits | F | SEC filings / exchange notices (unstructured) | FMP · Finnhub · Polygon · EODHD |
| analyst action, new high/low, options-available | F/C | from bars / (none free) | vendor |
| 8-K items; drug/contract events | F | SEC 8-K · openFDA · USASpending | same (government, free) |

> The **macro calendar needs no paid vendor** — the government backbone covers it.

### S · Institutional sponsorship (O'Neil I) — *prime + backup*
| Field | F/C | Solo | Commercial |
|---|---|---|---|
| 13F holdings (manager, shares, value) | F | **SEC EDGAR 13F datasets** (free, redistributable, ~45-day lag) | own SEC pipeline · WhaleWisdom · FMP |
| funds holding, QoQ change, institutional ownership % | C | aggregate all filers + diff quarters (heavy ETL) | our pipeline · or WhaleWisdom/FMP pre-aggregated |

> SEC is free and public-domain; recommend **owning the 13F pipeline** long-term, a vendor only to bootstrap.

### T · Journal / broker — *per-account connectors (not a market-data feed)*
| Field | F/C | Source |
|---|---|---|
| executions (side, qty, price, fees, time, account, instrument) | F | broker connector / CSV / manual — Alpaca, IBKR Flex, Tastytrade, MetaTrader, Tradovate/NinjaTrader |
| trades (round trips), display entry/exit, net P&L, % move | C | desk (FIFO pairing) |
| stop, target, fees, setup, notes, tags | F | broker / strategy / user |
| entry snapshot (price structure, MAE/MFE, R-multiple, facts/market/R1 as-of) | C | from bars (C) + the shared record |
| page stats (win rate, profit factor, expectancy, SQN, Kelly, …) | C | desk, from trades |

> The Journal needs **no extra market-data vendor** beyond bars (C) + the shared record.

---

## 4. Default stacks

**Solo (free — personal use; not shippable in a sold product):**
TradingView scanner (quotes/levels/ranges/float/cap/sector/ETFs) · Alpaca free + Yahoo
+ Stooq (bars) · SEC EDGAR (earnings, financials, 13F, SIC, 8-K) · FINRA (short
interest) · FRED/BLS/Fed/Treasury (macro) · 8-K RSS + Yahoo/Google (news) · **compute**
indicators, ranges, RS/groups, market model, valuation ratios, sentiment.

**Hosted (commercial — licensed, display in the product):**
- **Prices / quotes / bars / pre-market / indexes / sector-ETFs (A,B,C,D,F,L,M):**
  **Polygon/Massive Stocks Advanced** (real-time SIP, end-user display allowed; bars
  carry VWAP) — compute D/F/G/pre-market/RS from its bars. VIX via ETF proxy, not CBOE.
- **Fundamentals / valuation / growth / estimates (H,I,J,K):** **EODHD** (commercial/
  B2B — best coverage-per-dollar) *or* **Sharadar** (point-in-time, delisted-inclusive,
  ideal for the backtest's as-of gate) + an estimates feed (EODHD/FMP/Finnhub); **keep
  SEC EDGAR underneath** as the free, always-redistributable ground truth.
- **News (Q):** **Benzinga** (real-time push) + SEC 8-K RSS, merged.
- **Events (R):** government macro (free) + FMP/Finnhub calendar for earnings/dividends.
- **Institutional (S):** our own SEC 13F pipeline (WhaleWisdom to bootstrap).
- **Short interest (E):** licensed FINRA + Ortex daily layer.
- **RS / industry groups (O):** **compute in-house** from Polygon/EODHD universe bars
  licensed for commercial + derived use. No external vendor sells this at our tier.

---

## 5. Admin-dashboard control (hosted)

The [admin dashboard](../14-admin/ADMIN.md) exposes, per field family: the **mode**
(merge / prime+backup), the **ordered source list** (enable/disable, set prime vs
backup rank, or mark several active for merge), the **key** for each source (set +
tested), and the **commercial-use flag** gate (a source without it cannot go live in
a sold deployment). News and the macro calendar default to *merge*; everything else
to *prime + backup*. Switching solo→hosted is: add the licensed key, set the flag,
re-order the family — no code change (the adapter contract, [DATA-SOURCES.md §3.1],
is unchanged).

---

## 6. Verify at integration (the terms that move)

Benzinga redistribution tier · Polygon/Massive real-time threshold + news is hourly
(not real-time) · Finnhub per-endpoint free/premium gating + commercial clause · FMP
(personal tiers forbid product display; Enterprise = display/redistribution) · EODHD
B2B display vs redistribution scope · Sharadar attribution + distribution licence ·
Tiingo "commercial" is internal-use-only · Alpaca end-user display rights · FINRA
portal "non-commercial" + possible weekly short-interest cadence · FRED per-series
third-party copyright · Nasdaq earnings calendar is unofficial · the price vendor's
**derived-data** clause for our RS rankings · CBOE VIX index fees · O'Neil Global
Advisors / PANARAY is the only true O'Neil-data licensor (institutional, assume
unavailable). SEC EDGAR: free to reuse, 10 req/s + descriptive User-Agent required.
