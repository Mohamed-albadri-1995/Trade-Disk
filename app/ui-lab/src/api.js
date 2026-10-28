// Trade-Disk — TradeLab API client. One origin: the Node server serves this app
// and its /api routes. Every request carries the signed-in user's token, so the
// server serves and writes only this account's strategies and backtests.
import { authHeader } from './auth.js';

async function j(path, opts = {}) {
  const auth = await authHeader();
  const res = await fetch(path, { ...opts, headers: { ...(opts.headers || {}), ...auth } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `${opts?.method || 'GET'} ${path} → ${res.status}`);
  return body;
}
const post = (path, data) => j(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });

export const api = {
  meta: () => j('/api/lab/meta'),
  // chart + preview (free Yahoo daily)
  chart: (symbol, range, overlays) => post('/api/lab/chart', { symbol, range, overlays }),
  preview: (symbol, strategy, opts) => post('/api/lab/preview', { symbol, strategy, opts }),
  // strategies (per account, versioned on save)
  strategies: () => j('/api/lab/strategies'),
  strategy: (id) => j(`/api/lab/strategies/${encodeURIComponent(id)}`),
  saveStrategy: (doc, id) => post('/api/lab/strategies', { doc, id }),
  deleteStrategy: (id) => j(`/api/lab/strategies/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  // backtests
  backtest: (spec) => post('/api/lab/backtest', spec),
  backtests: () => j('/api/lab/backtests'),
  getBacktest: (id) => j(`/api/lab/backtests/${encodeURIComponent(id)}`),
  deleteBacktest: (id) => j(`/api/lab/backtests/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  // screener replay (historical backtest over the migrated daily record)
  replayScreens: () => j('/api/lab/replay-screens'),
  runReplay: (spec) => post('/api/lab/replay', spec),
  replays: () => j('/api/lab/replays'),
  // intraday backtest — a saved strategy on real Polygon minute bars over a screen's picks
  intradayKey: () => j('/api/intraday/key'),
  saveIntradayKey: (key) => post('/api/intraday/key', { key }),
  intradayScreens: () => j('/api/intraday/screens'),
  runIntraday: (spec) => post('/api/intraday/run', spec),
  intradayRuns: () => j('/api/intraday/runs'),
  // the real qp library (Python qp-compute service, via our token-guarded proxy)
  primitives: () => j('/api/lab/primitives'),
  compute: (bars, overlays) => post('/api/lab/compute', { bars, overlays }),
  // register browser (a screener's picks by day) + bars for the qp chart
  registerScreens: () => j('/api/radar/register-screens'),
  registerDays: (screen) => j(`/api/radar/register-days?screen=${encodeURIComponent(screen)}`),
  registerDay: (screen, day) => j(`/api/radar/register-day?screen=${encodeURIComponent(screen)}&day=${encodeURIComponent(day)}`),
  bars: (ticker) => j(`/api/radar/bars/${encodeURIComponent(ticker)}`),
  intradayBars: (ticker, day, interval) => j(`/api/radar/intraday-bars?ticker=${encodeURIComponent(ticker)}&day=${encodeURIComponent(day)}&interval=${encodeURIComponent(interval || '1')}`),
};
