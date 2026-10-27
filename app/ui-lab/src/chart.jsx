// Trade-Disk — TradeLab price chart. Our own qp chart (QpChart): candles, indicator
// overlays and entry/exit markers, with drag-to-pan and scroll-to-zoom. It plots the
// engine's own values, so a signal you see is the signal it trades. Daily bars (Yahoo).
import React from 'react';
import QpChart from './qpchart.jsx';
import { OVERLAY_COLORS } from './lib.js';

export default function CandleChart({ bars = [], overlays = {}, trades = [], height = 420 }) {
  const priceOverlays = Object.entries(overlays).map(([k, s], i) => ({ color: OVERLAY_COLORS[i % OVERLAY_COLORS.length], series: s || [] }));
  const markers = [];
  for (const t of trades || []) {
    if (t.entry_ts) markers.push({ t: t.entry_ts, dir: 'up', color: '--blue' });
    if (t.exit_ts) markers.push({ t: t.exit_ts, dir: 'down', color: t.ret > 0 ? '--green' : '--red' });
  }
  return <QpChart bars={bars} priceOverlays={priceOverlays} markers={markers} height={height} intraday={false} />;
}
