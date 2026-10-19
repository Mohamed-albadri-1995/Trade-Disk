// Trade-Disk — Radar's market snapshot, reproduced verbatim from the approved radar
// prototype's Market dashboard (frontend-design/radar.html). This is the solo-mode
// seed of the materialized `market_snapshot` read model the Market screen reads and
// never recomputes (MARKET.md §3.5). Fictional illustrative demo data, never live
// quotes; the heatmap and group-leadership rows were extracted from the prototype's
// own tables. Minus signs are U+2212, exactly as the prototype renders them.

export const MARKET_SNAPSHOT = {
  "asOf": "14 Oct 2026",
  "scan": {
    "title": "SWING TRADES AFTER HUGE VOLUME",
    "window": "08:00–16:00 ET",
    "lastScan": "07:30 AM",
    "examples": 3
  },
  "indexes": [
    {
      "sym": "SPY",
      "name": "SPDR S&P 500 ETF",
      "price": "$778.01",
      "changes": [
        {
          "v": "−0.01%",
          "c": "negative",
          "label": "Day"
        },
        {
          "v": "−0.07%",
          "c": "negative",
          "label": "Week"
        }
      ]
    },
    {
      "sym": "QQQ",
      "name": "Nasdaq-100 ETF",
      "price": "$743.57",
      "changes": [
        {
          "v": "−0.33%",
          "c": "negative",
          "label": "Day"
        },
        {
          "v": "−1.02%",
          "c": "negative",
          "label": "Week"
        }
      ]
    },
    {
      "sym": "DIA",
      "name": "Dow Jones ETF",
      "price": "$516.21",
      "changes": [
        {
          "v": "−0.33%",
          "c": "negative",
          "label": "Day"
        },
        {
          "v": "—",
          "c": "",
          "label": "Week · N/A"
        }
      ]
    },
    {
      "sym": "IWM",
      "name": "Russell 2000 ETF",
      "price": "$276.70",
      "changes": [
        {
          "v": "−0.43%",
          "c": "negative",
          "label": "Day"
        },
        {
          "v": "−0.80%",
          "c": "negative",
          "label": "Week"
        }
      ]
    },
    {
      "sym": "VIX",
      "name": "Cboe Volatility Index",
      "price": "15.36",
      "changes": [
        {
          "v": "+0.52%",
          "c": "negative",
          "label": "Day"
        },
        {
          "v": "+3.43%",
          "c": "negative",
          "label": "Week"
        }
      ]
    }
  ],
  "model": {
    "short": {
      "kicker": "SHORT TERM",
      "title": "Market Bias",
      "value": "BEARISH",
      "valueClass": "negative",
      "note": "Score −3 · six documented signal contributions",
      "signals": [
        [
          "SPY Day",
          "0",
          ""
        ],
        [
          "QQQ Day",
          "−1",
          ""
        ],
        [
          "IWM Day",
          "−1",
          ""
        ],
        [
          "VIX",
          "0",
          ""
        ],
        [
          "SPY Week",
          "0",
          ""
        ],
        [
          "QQQ Week",
          "−1",
          ""
        ]
      ]
    },
    "mid": {
      "kicker": "MID TERM",
      "title": "Market Stage",
      "value": "UPTREND",
      "valueClass": "positive",
      "note": "Illustrative published output · 6 of 6 trend checks bullish",
      "signals": [
        [
          "Close vs 5-day MA",
          "Above",
          "positive"
        ],
        [
          "Close vs 20-day MA",
          "Above",
          "positive"
        ],
        [
          "5-day vs 20-day MA",
          "Above",
          "positive"
        ],
        [
          "20-day vs 50-day MA",
          "Above",
          "positive"
        ],
        [
          "Hourly trend checks",
          "2 of 2 positive",
          ""
        ]
      ]
    },
    "long": {
      "kicker": "LONG TERM",
      "title": "Long-Term Bias",
      "value": "BULLISH",
      "valueClass": "positive",
      "note": "Illustrative published output",
      "signals": [
        [
          "SPY close vs 200-day MA",
          "Above",
          "positive"
        ],
        [
          "50-day MA vs 200-day MA",
          "Above",
          "positive"
        ],
        [
          "Reference instrument",
          "SPY",
          ""
        ]
      ]
    }
  },
  "regime": {
    "output": "EXTENDED_UP",
    "outputClass": "positive",
    "terms": [
      [
        "Long-term",
        "BULLISH"
      ],
      [
        "Mid-term",
        "UPTREND"
      ],
      [
        "Bollinger position",
        "UPPER"
      ]
    ],
    "bias": "LONG",
    "biasClass": "positive",
    "confidence": "Confidence: high · illustrative classification, not a trade instruction"
  },
  "heatmap": [
    {"cells":[{"t":"Energy"},{"t":"XLE"},{"t":"+1.80%","c":"positive"},{"t":"+3.26%","c":"positive"},{"t":"+1.81%","c":"positive"},{"t":"+3.33%","c":"positive"},{"t":"BULLISH"},{"t":"+100"},{"t":"20"},{"t":"🔥 HOT"}]},
    {"cells":[{"t":"Utilities"},{"t":"XLU"},{"t":"+0.58%","c":"positive"},{"t":"+1.11%","c":"positive"},{"t":"+0.59%","c":"positive"},{"t":"+1.18%","c":"positive"},{"t":"BULLISH"},{"t":"+91"},{"t":"25"},{"t":"🔥 HOT"}]},
    {"cells":[{"t":"Communication Services"},{"t":"XLC"},{"t":"+0.74%","c":"positive"},{"t":"+1.72%","c":"positive"},{"t":"+0.76%","c":"positive"},{"t":"+1.79%","c":"positive"},{"t":"BULLISH"},{"t":"+67"},{"t":"8"},{"t":"🔥 HOT"}]},
    {"cells":[{"t":"Materials"},{"t":"XLB"},{"t":"+0.57%","c":"positive"},{"t":"+0.59%","c":"positive"},{"t":"+0.58%","c":"positive"},{"t":"+0.66%","c":"positive"},{"t":"BULLISH"},{"t":"+66"},{"t":"19"},{"t":"🔥 HOT"}]},
    {"cells":[{"t":"Real Estate"},{"t":"XLRE"},{"t":"−0.21%","c":"negative"},{"t":"+0.53%","c":"positive"},{"t":"−0.20%","c":"negative"},{"t":"+0.60%","c":"positive"},{"t":"BULLISH"},{"t":"+51"},{"t":"39"},{"t":"🔥 HOT"}]},
    {"cells":[{"t":"Financials"},{"t":"XLF"},{"t":"−0.42%","c":"negative"},{"t":"+0.16%","c":"positive"},{"t":"−0.41%","c":"negative"},{"t":"+0.24%","c":"positive"},{"t":"BULLISH"},{"t":"+49"},{"t":"32"},{"t":"🔥 HOT"}]},
    {"cells":[{"t":"Retail"},{"t":"XRT"},{"t":"+0.21%","c":"positive"},{"t":"+0.29%","c":"positive"},{"t":"+0.23%","c":"positive"},{"t":"+0.36%","c":"positive"},{"t":"BULLISH"},{"t":"+49"},{"t":"17"},{"t":"🔥 HOT"}]},
    {"cells":[{"t":"Technology"},{"t":"XLK"},{"t":"−0.04%","c":"negative"},{"t":"−1.26%","c":"negative"},{"t":"−0.03%","c":"negative"},{"t":"−1.19%","c":"negative"},{"t":"BULLISH"},{"t":"+48"},{"t":"16"},{"t":"—"}]},
    {"cells":[{"t":"Consumer Discretionary"},{"t":"XLY"},{"t":"+0.08%","c":"positive"},{"t":"−0.43%","c":"negative"},{"t":"+0.09%","c":"positive"},{"t":"−0.36%","c":"negative"},{"t":"BULLISH"},{"t":"+32"},{"t":"18"},{"t":"🔥 HOT"}]},
    {"cells":[{"t":"Consumer Staples"},{"t":"XLP"},{"t":"−0.26%","c":"negative"},{"t":"+0.91%","c":"positive"},{"t":"−0.25%","c":"negative"},{"t":"+0.98%","c":"positive"},{"t":"BULLISH"},{"t":"+31"},{"t":"19"},{"t":"🔥 HOT"}]},
    {"cells":[{"t":"Semiconductors"},{"t":"SMH"},{"t":"−0.49%","c":"negative"},{"t":"−2.52%","c":"negative"},{"t":"−0.47%","c":"negative"},{"t":"−2.45%","c":"negative"},{"t":"BULLISH"},{"t":"+30"},{"t":"17"},{"t":"—"}]},
    {"cells":[{"t":"Industrials"},{"t":"XLI"},{"t":"−0.28%","c":"negative"},{"t":"−0.34%","c":"negative"},{"t":"−0.27%","c":"negative"},{"t":"−0.27%","c":"negative"},{"t":"BULLISH"},{"t":"+24"},{"t":"27"},{"t":"🔥 HOT"}]},
    {"cells":[{"t":"Transportation"},{"t":"XTN"},{"t":"−0.42%","c":"negative"},{"t":"−1.26%","c":"negative"},{"t":"−0.41%","c":"negative"},{"t":"−1.19%","c":"negative"},{"t":"BULLISH"},{"t":"+23"},{"t":"37"},{"t":"—"}]},
    {"cells":[{"t":"Health Care"},{"t":"XLV"},{"t":"−1.35%","c":"negative"},{"t":"−0.67%","c":"negative"},{"t":"−1.34%","c":"negative"},{"t":"−0.60%","c":"negative"},{"t":"NEUTRAL"},{"t":"+11"},{"t":"11"},{"t":"🔥 HOT"}]},
    {"cells":[{"t":"Biotechnology"},{"t":"IBB"},{"t":"−2.08%","c":"negative"},{"t":"−3.13%","c":"negative"},{"t":"−2.06%","c":"negative"},{"t":"−3.06%","c":"negative"},{"t":"NEUTRAL"},{"t":"+8"},{"t":"14"},{"t":"🔥 HOT"}]}
  ],
  "groups": [
    {"cells":[{"t":"1 / 175"},{"t":"Deep Sea Foreign Transportation of Freight"},{"t":"99 · A+"},{"t":"26"},{"t":"93.5"},{"t":"88%"},{"t":"—"},{"t":"ECO 98 · FRO 97 · TEN 97 · CMBT 96"}]},
    {"cells":[{"t":"2 / 175"},{"t":"Services — Medical Laboratories"},{"t":"99 · A+"},{"t":"16"},{"t":"93.0"},{"t":"75%"},{"t":"—"},{"t":"CDNA 99 · GRAL 98 · BDSX 98 · NTRA 97"}]},
    {"cells":[{"t":"3 / 175"},{"t":"Petroleum Refining"},{"t":"98 · A+"},{"t":"17"},{"t":"91.0"},{"t":"88%"},{"t":"—"},{"t":"MPC 98 · PBF 98 · CLMT 98 · VLO 97"}]},
    {"cells":[{"t":"4 / 175"},{"t":"Instruments for Measuring & Testing"},{"t":"98 · A+"},{"t":"9"},{"t":"91.0"},{"t":"67%"},{"t":"—"},{"t":"AEHR 97 · COHU 97 · ALNT 95 · TER 94"}]},
    {"cells":[{"t":"5 / 175"},{"t":"Services — Help Supply Services"},{"t":"97 · A+"},{"t":"9"},{"t":"91.0"},{"t":"78%"},{"t":"—"},{"t":"AMN 96 · RCMT 96 · TBI 95 · MAN 93"}]},
    {"cells":[{"t":"6 / 175"},{"t":"Wholesale — Electronic Parts & Equipment"},{"t":"96 · A+"},{"t":"6"},{"t":"89.0"},{"t":"67%"},{"t":"—"},{"t":"RELL 94 · ARW 93 · AVT 93 · WCC 86"}]},
    {"cells":[{"t":"7 / 175"},{"t":"Electronic Computers & Related"},{"t":"96 · A+"},{"t":"18"},{"t":"88.0"},{"t":"61%"},{"t":"—"},{"t":"DELL 99 · SNDK 99 · QMCO 99 · HPE 98"}]},
    {"cells":[{"t":"8 / 175"},{"t":"Wholesale — Computers & Peripheral Equipment"},{"t":"95 · A+"},{"t":"6"},{"t":"87.5"},{"t":"67%"},{"t":"—"},{"t":"CNXN 92 · SNX 92 · SCSC 90 · CLMB 85"}]},
    {"cells":[{"t":"9 / 175"},{"t":"Computer Communications Equipment"},{"t":"95 · A+"},{"t":"10"},{"t":"85.0"},{"t":"60%"},{"t":"—"},{"t":"SILC 98 · DGII 94 · FFIV 91 · ANET 90"}]},
    {"cells":[{"t":"10 / 175"},{"t":"Laboratory Analytical Instruments"},{"t":"94 · A+"},{"t":"12"},{"t":"85.0"},{"t":"75%"},{"t":"—"},{"t":"TXG 99 · ILMN 97 · MASS 95 · RVTY 94"}]},
    {"cells":[{"t":"11 / 175"},{"t":"Plastics Products, NEC"},{"t":"94 · A+"},{"t":"7"},{"t":"85.0"},{"t":"57%"},{"t":"—"},{"t":"KRT 97 · ENTG 90 · MYE 90 · NWL 85"}]},
    {"cells":[{"t":"12 / 175"},{"t":"Industrial Organic Chemicals"},{"t":"93 · A"},{"t":"9"},{"t":"84.0"},{"t":"56%"},{"t":"—"},{"t":"SXT 88 · FF 87 · MEOH 86 · NEU 85"}]},
    {"cells":[{"t":"13 / 175"},{"t":"Motion Pictures — small industries rolled up"},{"t":"93 · A"},{"t":"6"},{"t":"84.0"},{"t":"50%"},{"t":"—"},{"t":"MCS 94 · STRZ 94 · CNK 90 · LION 78"}]},
    {"cells":[{"t":"14 / 175"},{"t":"Drilling Oil & Gas Wells"},{"t":"92 · A"},{"t":"9"},{"t":"83.0"},{"t":"89%"},{"t":"—"},{"t":"HPK 94 · PTEN 92 · VAL 87 · HP 87"}]},
    {"cells":[{"t":"15 / 175"},{"t":"Semiconductors & Related Devices"},{"t":"91 · A"},{"t":"72"},{"t":"82.0"},{"t":"51%"},{"t":"—"},{"t":"MXL 99 · AXTI 99 · MU 98 · AMD 98"}]},
    {"cells":[{"t":"16 / 175"},{"t":"Services — Health Services"},{"t":"91 · A"},{"t":"7"},{"t":"82.0"},{"t":"57%"},{"t":"—"},{"t":"LFST 96 · PNTG 87 · OMDA 83 · INNV 82"}]},
    {"cells":[{"t":"17 / 175"},{"t":"Wholesale — Machinery & Supplies"},{"t":"90 · A"},{"t":"8"},{"t":"82.0"},{"t":"50%"},{"t":"—"},{"t":"GIC 89 · DXPE 88 · MSM 88 · DSGR 86"}]},
    {"cells":[{"t":"18 / 175"},{"t":"Computer Peripheral Equipment, NEC"},{"t":"90 · A"},{"t":"8"},{"t":"81.0"},{"t":"50%"},{"t":"—"},{"t":"FTNT 97 · CRSR 97 · PANW 96 · MITK 86"}]},
    {"cells":[{"t":"19 / 175"},{"t":"Printed Circuit Boards"},{"t":"89 · A"},{"t":"9"},{"t":"81.0"},{"t":"67%"},{"t":"—"},{"t":"FLEX 92 · BHE 92 · SANM 88 · PLXS 88"}]},
    {"cells":[{"t":"20 / 175"},{"t":"Special Industry Machinery, NEC"},{"t":"89 · A"},{"t":"11"},{"t":"80.0"},{"t":"55%"},{"t":"—"},{"t":"CRCT 91 · AZTA 90 · LRCX 89 · ASML 87"}]},
    {"cells":[{"t":"…"},{"t":"Ranks 21–165 omitted in this design view (145 groups); production table should support search, sorting and pagination.","colspan":7}],"omitted":true},
    {"cells":[{"t":"166 / 175"},{"t":"Construction — Special Trade Contractors"},{"t":"5 · E"},{"t":"7"},{"t":"15.0"},{"t":"0%"},{"t":"—"},{"t":"BBCP 77 · LGN 35 · AGX 25 · MTRX 15"}]},
    {"cells":[{"t":"167 / 175"},{"t":"Household Furniture & Related"},{"t":"5 · E"},{"t":"6"},{"t":"14.5"},{"t":"33%"},{"t":"—"},{"t":"FLXS 96 · CODI 90 · ETD 17 · LZB 12"}]},
    {"cells":[{"t":"168 / 175"},{"t":"Building Retail — small groups rolled up"},{"t":"4 · E"},{"t":"7"},{"t":"14.0"},{"t":"0%"},{"t":"—"},{"t":"FAST 77 · SHW 33 · TSCO 15 · HD 14"}]},
    {"cells":[{"t":"169 / 175"},{"t":"Communications Services, NEC"},{"t":"3 · E"},{"t":"9"},{"t":"13.0"},{"t":"44%"},{"t":"—"},{"t":"IRDM 95 · VSAT 90 · GSAT 87 · TSAT 83"}]},
    {"cells":[{"t":"170 / 175"},{"t":"Search, Detection & Navigation Systems"},{"t":"3 · E"},{"t":"7"},{"t":"12.0"},{"t":"0%"},{"t":"—"},{"t":"GRMN 72 · TDY 51 · NOC 13 · DRS 12"}]},
    {"cells":[{"t":"171 / 175"},{"t":"Stone, Clay & Glass — rolled up"},{"t":"2 · E"},{"t":"10"},{"t":"11.5"},{"t":"0%"},{"t":"—"},{"t":"APOG 67 · JHX 62 · LOMA 27 · OC 17"}]},
    {"cells":[{"t":"172 / 175"},{"t":"Water, Sewer, Pipeline & Power Line Construction"},{"t":"2 · E"},{"t":"6"},{"t":"11.0"},{"t":"17%"},{"t":"—"},{"t":"PLPC 91 · MYRG 67 · ESOA 15 · MTZ 7"}]},
    {"cells":[{"t":"173 / 175"},{"t":"Aircraft & Related"},{"t":"1 · E"},{"t":"6"},{"t":"10.0"},{"t":"0%"},{"t":"—"},{"t":"AIR 25 · BA 17 · TXT 15 · AIRO 5"}]},
    {"cells":[{"t":"174 / 175"},{"t":"Food & Kindred Products"},{"t":"1 · E"},{"t":"9"},{"t":"6.0"},{"t":"0%"},{"t":"—"},{"t":"MDLZ 63 · NOMD 47 · CAG 20 · CPB 12"}]},
    {"cells":[{"t":"175 / 175"},{"t":"Mortgage Bankers & Loan Correspondents"},{"t":"1 · E"},{"t":"8"},{"t":"4.0"},{"t":"0%"},{"t":"—"},{"t":"NFJ 64 · FIGR 8 · RKT 5 · ONIT 5"}]}
  ],
  "breadth": {
    "advancing": "58%",
    "declining": "35%",
    "unchanged": "7%",
    "distribution": "3 · last 25 sessions",
    "volatility": "VIX 18.20 · Demo"
  },
  "themes": [
    {
      "dot": "hot",
      "name": "AI & Accelerated Computing",
      "note": "Theme status · demo",
      "status": "Strong",
      "statusClass": "positive"
    },
    {
      "dot": "hot",
      "name": "Semiconductors",
      "note": "Theme status · demo",
      "status": "Strong",
      "statusClass": "positive"
    },
    {
      "dot": "warm",
      "name": "Cloud Infrastructure",
      "note": "Theme status · demo",
      "status": "Mixed",
      "statusClass": ""
    },
    {
      "dot": "cool",
      "name": "Consumer Discretionary",
      "note": "Theme status · demo",
      "status": "Weak",
      "statusClass": "negative"
    }
  ]
};

export function seedMarket(db) {
  db.exec('DELETE FROM radar_market;');
  db.prepare('INSERT INTO radar_market (id, snapshot, as_of) VALUES (1, ?, ?)')
    .run(JSON.stringify(MARKET_SNAPSHOT), MARKET_SNAPSHOT.asOf);
  return 1;
}
