// Trade-Disk — TradingView scanner provider (free, personal-use only). Posts a
// screener definition ({left,operation,right} rules) to TradingView's public
// scanner and returns the matching stocks across the whole US market. This is
// the real-scanner engine for personal mode; the feed switch keeps it out of
// commercial use (TradingView's ToS is personal-only — see DATA-CATALOG.md).
//
// Plain fetch; in a proxied sandbox Node 22.21+ reads HTTPS_PROXY when
// NODE_USE_ENV_PROXY=1. The request shape mirrors what TradingView's own screener
// sends, so a rule built in their UI reproduces here field for field.

const URL = 'https://scanner.tradingview.com/america/scan?label-product=screener-stock';

const HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Origin': 'https://www.tradingview.com',
  'Referer': 'https://www.tradingview.com/',
  'Accept': 'application/json',
};

// The universe gate: common stocks / preferred / depositary receipts / closed
// funds (no ETFs, mutuals or pre-IPO). Ported from the reference scanner so the
// result set is the same tradable universe, not every instrument TradingView lists.
const BASE_FILTER = {
  operator: 'and',
  operands: [
    { operation: { operator: 'or', operands: [
      { operation: { operator: 'and', operands: [
        { expression: { left: 'type', operation: 'equal', right: 'stock' } },
        { expression: { left: 'typespecs', operation: 'has', right: ['common'] } } ] } },
      { operation: { operator: 'and', operands: [
        { expression: { left: 'type', operation: 'equal', right: 'stock' } },
        { expression: { left: 'typespecs', operation: 'has', right: ['preferred'] } } ] } },
      { operation: { operator: 'and', operands: [
        { expression: { left: 'type', operation: 'equal', right: 'dr' } } ] } },
      { operation: { operator: 'and', operands: [
        { expression: { left: 'type', operation: 'equal', right: 'fund' } },
        { expression: { left: 'typespecs', operation: 'has_none_of', right: ['etf', 'mutual', 'closedend'] } } ] } },
    ] } },
    { expression: { left: 'typespecs', operation: 'has_none_of', right: ['pre-ipo'] } },
  ],
};

// Run one screener definition. Returns { totalCount, rows } where each row is an
// object keyed by the requested column names, plus `ticker` (bare symbol). Throws
// on a bad response or a column mismatch (a dropped field shifts every column, so
// we refuse rather than map misaligned data — the reference scanner's rule).
export async function scan({ filters, columns, sort, range = [0, 50] }) {
  const body = {
    columns, filter: filters, filter2: BASE_FILTER,
    markets: ['america'], options: { lang: 'en' }, range, sort, symbols: {},
    ignore_unknown_fields: true,
  };
  const res = await fetch(URL, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`TradingView HTTP ${res.status}`);
  const j = await res.json();
  const raw = j.data || [];
  if (raw[0] && raw[0].d.length !== columns.length) {
    throw new Error(`TradingView returned ${raw[0].d.length} values for ${columns.length} columns — refusing misaligned rows`);
  }
  const rows = raw.map((r) => {
    const o = { ticker: String(r.s || '').split(':').pop(), _sym: r.s };
    columns.forEach((c, i) => { o[c] = r.d[i]; });
    return o;
  });
  return { totalCount: Number.isFinite(j.totalCount) ? j.totalCount : rows.length, rows };
}

// Current column data for SPECIFIC symbols, regardless of any screener filter — used
// to refresh the stocks a scan carried over from earlier in the day (they left the
// live result set but stay on the day's register with their data kept current).
// `symbols` are full TradingView symbols (EXCHANGE:TICKER); a wrong prefix is simply
// dropped by TradingView, so we pass the exact `_sym` stored at discovery.
export async function quote(symbols, columns) {
  const list = (symbols || []).filter(Boolean);
  if (!list.length) return { rows: [] };
  const body = {
    columns, markets: ['america'], symbols: { tickers: list },
    options: { lang: 'en' }, range: [0, list.length], ignore_unknown_fields: true,
  };
  const res = await fetch(URL, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`TradingView quote HTTP ${res.status}`);
  const j = await res.json();
  const raw = j.data || [];
  if (raw[0] && raw[0].d.length !== columns.length) {
    throw new Error(`TradingView quote returned ${raw[0].d.length} values for ${columns.length} columns`);
  }
  const rows = raw.map((r) => {
    const o = { ticker: String(r.s || '').split(':').pop(), _sym: r.s };
    columns.forEach((c, i) => { o[c] = r.d[i]; });
    return o;
  });
  return { rows };
}
