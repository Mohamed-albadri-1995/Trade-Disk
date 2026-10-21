// Trade-Disk — the Lab's starter strategies. Classic, well-understood daily setups
// written in the engine's own grammar, so a trader can load one, see it on the
// chart, backtest it, then edit or save their own. They are examples, not advice —
// the whole point of the Lab is to test them honestly before trusting any of them.

export const TEMPLATES = [
  {
    id: 'tpl-sma-trend', name: 'SMA 20/50 Trend', side: 'long',
    about: 'Buy when the 20-day average crosses above the 50-day; exit on the cross back down. An ATR stop and a 2R/4R scale-out.',
    doc: {
      name: 'SMA 20/50 Trend', side: 'long', stage: 'development', fill: 'desk',
      entry: { logic: 'AND', rules: [{ left: { kind: 'primitive', name: 'sma', params: { length: 20 } }, op: 'cross_above', right: { kind: 'primitive', name: 'sma', params: { length: 50 } } }] },
      exit: { logic: 'OR', rules: [{ left: { kind: 'primitive', name: 'sma', params: { length: 20 } }, op: 'cross_below', right: { kind: 'primitive', name: 'sma', params: { length: 50 } } }] },
      risk: { sl: { type: 'atr', value: 2.5 }, targets: [{ fraction: 0.5, r_multiple: 2 }, { fraction: 0.5, r_multiple: 4 }] },
    },
  },
  {
    id: 'tpl-rsi2', name: 'RSI(2) Pullback', side: 'long',
    about: "Larry Connors' mean-reversion: in an uptrend (above the 200-day), buy a 2-period RSI under 10; exit when RSI pops over 70 or price reclaims the 5-day average.",
    doc: {
      name: 'RSI(2) Pullback', side: 'long', stage: 'development', fill: 'desk',
      entry: { logic: 'AND', rules: [
        { left: { kind: 'price', source: 'close' }, op: 'gt', right: { kind: 'primitive', name: 'sma', params: { length: 200 } } },
        { left: { kind: 'primitive', name: 'rsi', params: { length: 2 } }, op: 'lt', right: { kind: 'const', value: 10 } },
      ] },
      exit: { logic: 'OR', rules: [
        { left: { kind: 'primitive', name: 'rsi', params: { length: 2 } }, op: 'gt', right: { kind: 'const', value: 70 } },
        { left: { kind: 'price', source: 'close' }, op: 'gt', right: { kind: 'primitive', name: 'sma', params: { length: 5 } } },
      ] },
      risk: { sl: { type: 'pct', value: 6 }, max_entries_per_day: 1 },
    },
  },
  {
    id: 'tpl-donchian', name: '20-day Breakout', side: 'long',
    about: 'A Donchian breakout: buy when price closes above the prior 20-day high; exit when it closes below the prior 10-day low. ATR stop.',
    doc: {
      name: '20-day Breakout', side: 'long', stage: 'development', fill: 'desk',
      entry: { logic: 'AND', rules: [{ left: { kind: 'price', source: 'close' }, op: 'cross_above', right: { kind: 'primitive', name: 'window_high', params: { length: 20 }, offset: 1 } }] },
      exit: { logic: 'OR', rules: [{ left: { kind: 'price', source: 'close' }, op: 'cross_below', right: { kind: 'primitive', name: 'window_low', params: { length: 10 }, offset: 1 } }] },
      risk: { sl: { type: 'atr', value: 3 } },
    },
  },
  {
    id: 'tpl-bb-mr', name: 'Bollinger Mean-Reversion', side: 'long',
    about: 'Buy a close back below the lower Bollinger band (oversold) and exit at the middle band. A fixed percentage stop.',
    doc: {
      name: 'Bollinger Mean-Reversion', side: 'long', stage: 'development', fill: 'desk',
      entry: { logic: 'AND', rules: [{ left: { kind: 'price', source: 'close' }, op: 'cross_below', right: { kind: 'primitive', name: 'bb', sub: 'lower', params: { length: 20, mult: 2 } } }] },
      exit: { logic: 'OR', rules: [{ left: { kind: 'price', source: 'close' }, op: 'ge', right: { kind: 'primitive', name: 'bb', sub: 'middle', params: { length: 20, mult: 2 } } }] },
      risk: { sl: { type: 'pct', value: 6 }, min_hold_bars: 1 },
    },
  },
];
