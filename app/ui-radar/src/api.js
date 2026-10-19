// Trade-Disk — Radar API client. One origin: the Node server serves this app and
// its /api routes. Solo mode today; the same shape is what hosted mode exposes.

async function j(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${opts?.method || 'GET'} ${path} → ${res.status}`);
  return res.json();
}

export const api = {
  // The screener universe + the saved shortlist in one read.
  bundle: () => j('/api/radar/bundle'),
  stocks: () => j('/api/radar/stocks'),
  shortlist: () => j('/api/radar/shortlist'),
  // Toggle a ticker in the shortlist; returns { ticker, saved }.
  toggleShortlist: (ticker) =>
    j(`/api/radar/shortlist/${encodeURIComponent(ticker)}`, { method: 'POST' }),
  // The materialized market_snapshot the Market dashboard renders.
  market: () => j('/api/radar/market'),
};
