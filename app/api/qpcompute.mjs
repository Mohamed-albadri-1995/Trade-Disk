// Trade-Disk — client for the qp-compute service (the real Python qp library).
// The chart and backtest send OHLCV bars + indicator specs here and get back the
// EXACT series your qp/primitives produce — the same code the live algo imports, so a
// backtest can never disagree with what trades. The shared token lives only on the
// server (env), never in the browser; the Lab calls our /api/lab/{primitives,compute}
// proxy, which forwards here.

const BASE = (process.env.QP_COMPUTE_URL || '').replace(/\/$/, '');
const TOKEN = process.env.QP_COMPUTE_TOKEN || '';

export const configured = () => !!BASE;

async function call(path, opts = {}) {
  if (!BASE) throw new Error('qp-compute is not configured (set QP_COMPUTE_URL)');
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { ...(opts.headers || {}), 'X-QP-Token': TOKEN },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.detail || body?.error || `qp-compute ${path} → ${res.status}`);
  return body;
}

// The full primitive catalog (what the indicator picker offers).
export const primitives = () => call('/primitives');

// Compute indicator series on provided bars.
// bars: [{t,o,h,l,c,v}] ; overlays: [{id?, key, source?, params?}]
export const compute = (bars, overlays) =>
  call('/compute', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bars: bars || [], overlays: overlays || [] }) });
