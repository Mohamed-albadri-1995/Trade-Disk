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
};
