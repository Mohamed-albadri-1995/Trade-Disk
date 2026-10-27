// Trade-Disk — a real interactive chart, built on TradingView's lightweight-charts:
// drag to pan, wheel/pinch to zoom, native crosshair, auto-fitting price axis. It
// draws candlesticks + a volume pane + any number of overlay line series (indicators),
// and optional entry/exit markers. The parent computes the series values (from the one
// engine / the indicator math) and hands them in — this component only renders them.
import React, { useRef, useEffect } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';

const cssv = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const col = (c) => (c && c.startsWith('--') ? (cssv(c) || '#888') : (c || '#888'));
const withA = (hex, aa) => (hex && hex[0] === '#' && hex.length === 7 ? hex + aa : hex);
// lightweight-charts requires each series' data strictly ascending + unique by time;
// sort and drop any duplicate/invalid timestamps so a stray bar can never throw.
const asc = (arr) => { const s = (arr || []).filter((p) => p && Number.isFinite(p.time)).sort((a, b) => a.time - b.time); const out = []; let last = -Infinity; for (const p of s) if (p.time > last) { out.push(p); last = p.time; } return out; };
const etTime = (t) => new Date(t * 1000).toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
const etDate = (t) => new Date(t * 1000).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });

export default function TVChart({ bars = [], lines = [], markers = [], height = 420, intraday = false }) {
  const elRef = useRef(null), chartRef = useRef(null), candleRef = useRef(null), volRef = useRef(null), linesRef = useRef([]), prevKey = useRef('');

  // create the chart once
  useEffect(() => {
    const el = elRef.current; if (!el) return;
    const line = col('--line') || '#1b3b52', muted = col('--muted') || '#8ca9c1';
    const fmtT = (t) => (intraday ? etTime(t) : etDate(t));
    const chart = createChart(el, {
      width: el.clientWidth || 600, height,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: muted, fontSize: 11 },
      grid: { vertLines: { color: line }, horzLines: { color: line } },
      rightPriceScale: { borderColor: line },
      timeScale: { borderColor: line, timeVisible: intraday, secondsVisible: false, rightOffset: 4, tickMarkFormatter: fmtT },
      crosshair: { mode: CrosshairMode.Normal },
      localization: { timeFormatter: fmtT },
    });
    const green = col('--green') || '#19dfa0', red = col('--red') || '#ff6374';
    candleRef.current = chart.addCandlestickSeries({ upColor: green, downColor: red, borderVisible: false, wickUpColor: green, wickDownColor: red });
    volRef.current = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => { if (chartRef.current && el.clientWidth) chartRef.current.applyOptions({ width: el.clientWidth }); });
    ro.observe(el);
    return () => { ro.disconnect(); try { chart.remove(); } catch {} chartRef.current = candleRef.current = volRef.current = null; linesRef.current = []; };
  }, []); // eslint-disable-line

  // time-axis formatting follows the daily/intraday flag
  useEffect(() => {
    const c = chartRef.current; if (!c) return;
    const fmtT = (t) => (intraday ? etTime(t) : etDate(t));
    c.applyOptions({ timeScale: { timeVisible: intraday, tickMarkFormatter: fmtT }, localization: { timeFormatter: fmtT } });
  }, [intraday]);

  useEffect(() => { const c = chartRef.current; if (c) c.applyOptions({ height }); }, [height]);

  // data: candles + volume + overlay lines + markers. Overlay lines are rebuilt each
  // time (that leaves the time scale untouched, so pan/zoom is preserved when you add
  // or remove an indicator); the view only refits when the bar set itself changes.
  useEffect(() => {
    const chart = chartRef.current, candle = candleRef.current, vol = volRef.current; if (!chart || !candle) return;
    const green = col('--green') || '#19dfa0', red = col('--red') || '#ff6374';
    candle.setData(asc(bars.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }))));
    vol.setData(asc(bars.map((b) => ({ time: b.t, value: b.v || 0, color: withA(b.c >= b.o ? green : red, '40') }))));
    for (const s of linesRef.current) { try { chart.removeSeries(s); } catch {} }
    linesRef.current = [];
    for (const ln of lines) {
      const s = chart.addLineSeries({ color: col(ln.color), lineWidth: 1, lineStyle: ln.dashed ? 2 : 0, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData(asc(ln.data));
      linesRef.current.push(s);
    }
    try { candle.setMarkers((markers || []).slice().sort((a, b) => a.time - b.time)); } catch {}
    const key = `${bars[0]?.t || 0}:${bars[bars.length - 1]?.t || 0}:${bars.length}`;
    if (key !== prevKey.current) { prevKey.current = key; chart.timeScale().fitContent(); }
  }, [bars, lines, markers]);

  return <div ref={elRef} className="tvchart" style={{ height, width: '100%' }} />;
}
