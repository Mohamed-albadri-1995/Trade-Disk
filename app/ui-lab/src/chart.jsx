// Trade-Disk — TradeLab price chart. A real interactive chart (TradingView's
// lightweight-charts via TVChart): pan, zoom, crosshair. It plots the engine's own
// values — the indicator overlays the strategy references and entry/exit markers for
// the trades it took — so what you see is exactly what it traded. Daily bars (Yahoo).
import React from 'react';
import TVChart from './tvchart.jsx';
import { OVERLAY_COLORS } from './lib.js';

export default function CandleChart({ bars = [], overlays = {}, trades = [], height = 420 }) {
  // overlay arrays (aligned to bars) → line series, skipping warm-up nulls
  const lines = Object.entries(overlays).map(([key, s], i) => ({
    key,
    color: OVERLAY_COLORS[i % OVERLAY_COLORS.length],
    data: (s || []).map((v, idx) => (v != null && Number.isFinite(v) && bars[idx] ? { time: bars[idx].t, value: +v } : null)).filter(Boolean),
  }));
  // entry ▲ / exit ▼ markers for each trade
  const markers = [];
  for (const t of trades || []) {
    if (t.entry_ts) markers.push({ time: t.entry_ts, position: 'belowBar', color: '#2b9bff', shape: 'arrowUp', text: 'E' });
    if (t.exit_ts) markers.push({ time: t.exit_ts, position: 'aboveBar', color: t.ret > 0 ? '#19dfa0' : '#ff6374', shape: 'arrowDown', text: 'X' });
  }
  return <TVChart bars={bars} lines={lines} markers={markers} height={height} intraday={false} />;
}
