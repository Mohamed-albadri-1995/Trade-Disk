// Trade-Disk — TradeLab small helpers.
export const cls = (...xs) => xs.filter(Boolean).join(' ');

export const fmt = (x, d = 2) => (x == null || !Number.isFinite(+x) ? '—' : (+x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const fmtInt = (x) => (x == null || !Number.isFinite(+x) ? '—' : Math.round(+x).toLocaleString('en-US'));
export const signed = (x, d = 2) => (x == null || !Number.isFinite(+x) ? '—' : (x > 0 ? '+' : '') + fmt(x, d));
export const pct = (x, d = 1) => (x == null || !Number.isFinite(+x) ? '—' : signed(x, d) + '%');
export const money = (x, d = 0) => (x == null || !Number.isFinite(+x) ? '—' : (x < 0 ? '-$' : '$') + fmt(Math.abs(x), d));

export const dateOf = (ts) => (ts ? new Date(ts * 1000).toISOString().slice(0, 10) : '—');
export const shortDate = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

// A stable colour for an indicator overlay line, by index.
export const OVERLAY_COLORS = ['#19c6ed', '#ffd33d', '#b9a1ff', '#ffad43', '#19dfa0', '#ff6374', '#087cff'];
export const valCls = (v) => (v == null || v === 0 ? '' : v > 0 ? 'pos' : 'neg');
