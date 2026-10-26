// Trade-Disk — view helpers, ported verbatim from the approved prototype so the
// numbers and shapes are identical. Pure functions: formatting, the metric
// engine (stats/advanced), and the self-contained SVG chart generators.

/* ---------- formatting ---------- */
export const fmt = (n, dec = 2) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(Number(n) || 0);
export const money = n => (n < 0 ? '−' : '') + '$' + fmt(Math.abs(n));
export const pct = (n, d = 1) => fmt(n, d) + '%';
export const signed = (n, s) => (n > 0 ? '+' : n < 0 ? '−' : '') + s(Math.abs(n));
export const fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const dateISO = d => d.toISOString().slice(0, 10);
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const ASSETS = { stock: 'Stock / ETF', option: 'Option', future: 'Future', forex: 'Forex', crypto: 'Crypto' };
export const DEFAULT_FILTERS = { period: 'all', account: 'all', setup: 'all', symbol: '' };

export function filtered(trades, f) {
  const now = new Date();
  return trades.filter(t => {
    if (f.account !== 'all' && t.account !== f.account) return false;
    if (f.setup !== 'all' && t.setup !== f.setup) return false;
    if (f.symbol && !t.symbol.toLowerCase().includes(f.symbol.toLowerCase())) return false;
    if (f.period !== 'all') {
      const d = new Date(t.date + 'T12:00:00');
      const days = f.period === '7d' ? 7 : f.period === '30d' ? 30 : f.period === '90d' ? 90 :
        f.period === 'ytd' ? Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / 864e5) + 1 : 1e9;
      if ((now - d) / 864e5 >= days) return false;
    }
    return true;
  });
}

/* ---------- the metric engine (identical to the prototype's stats/advanced) ---------- */
export function stats(list) {
  const c = list.filter(t => t.status === 'Closed'), wins = c.filter(t => t.net > 0), loss = c.filter(t => t.net < 0),
    sum = c.reduce((a, t) => a + t.net, 0), winSum = wins.reduce((a, t) => a + t.net, 0),
    lossSum = Math.abs(loss.reduce((a, t) => a + t.net, 0)),
    rs = c.filter(t => Number.isFinite(t.r)).map(t => t.r),
    avgWin = wins.length ? winSum / wins.length : 0, avgLoss = loss.length ? lossSum / loss.length : 0;
  return {
    c, wins, loss, sum, winRate: c.length ? wins.length / c.length * 100 : 0, pf: lossSum ? winSum / lossSum : null,
    expect: c.length ? sum / c.length : 0, avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    fees: c.reduce((a, t) => a + t.fees, 0), avgWin, avgLoss, payoff: avgLoss ? avgWin / avgLoss : null, rs,
    longN: c.filter(t => t.side === 'Long').length, shortN: c.filter(t => t.side === 'Short').length,
    be: c.filter(t => t.net === 0).length,
  };
}
export function drawdown(list) {
  let c = [...list].filter(t => t.status === 'Closed').sort((a, b) => a.date.localeCompare(b.date)), eq = 0, peak = 0, mdd = 0;
  c.forEach(t => { eq += t.net; peak = Math.max(peak, eq); mdd = Math.max(mdd, peak - eq); });
  return mdd;
}
export function advanced(list) {
  const s = stats(list), mdd = drawdown(list);
  let sqn = null;
  if (s.rs.length > 1) {
    const m = s.rs.reduce((a, b) => a + b, 0) / s.rs.length, v = s.rs.reduce((a, b) => a + (b - m) ** 2, 0) / (s.rs.length - 1), sd = Math.sqrt(v);
    sqn = sd ? m / sd * Math.sqrt(s.rs.length) : null;
  }
  const w = s.winRate / 100;
  const kelly = (s.payoff && s.payoff > 0) ? (w - (1 - w) / s.payoff) * 100 : null;
  const recovery = mdd > 0 ? s.sum / mdd : null;
  const byDay = {}; s.c.forEach(t => { byDay[t.date] = (byDay[t.date] || 0) + t.net; });
  const days = Object.values(byDay), greenDays = days.filter(v => v > 0).length, consistency = days.length ? greenDays / days.length * 100 : null;
  let curW = 0, curL = 0, maxW = 0, maxL = 0, cur = 0;
  [...s.c].sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
    if (t.net > 0) { curW++; curL = 0; maxW = Math.max(maxW, curW); cur = curW; }
    else if (t.net < 0) { curL++; curW = 0; maxL = Math.max(maxL, curL); cur = -curL; }
  });
  return { sqn, kelly, recovery, consistency, mdd, streakCur: cur, maxW, maxL };
}

/* ---------- SVG / chart generators (return self-contained markup strings) ---------- */
export function lineChart(list, animate) {
  let c = list.filter(t => t.status === 'Closed').sort((a, b) => a.date.localeCompare(b.date)), vals = [], s = 0;
  c.forEach(t => { s += t.net; vals.push(s); });
  if (!vals.length) vals = [0];
  let min = Math.min(0, ...vals), max = Math.max(1, ...vals), range = max - min || 1, w = 680, h = 210, pad = 18;
  let pts = vals.map((v, i) => [pad + i * (w - 2 * pad) / Math.max(1, vals.length - 1), h - pad - (v - min) / range * (h - 2 * pad)]);
  let path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  let area = path + ' L' + pts[pts.length - 1][0] + ',' + (h - pad) + ' L' + pts[0][0] + ',' + (h - pad) + ' Z';
  return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="Illustrative cumulative net profit and loss curve" style="height:230px"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="var(--brand)" stop-opacity=".22"/><stop offset="100%" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>' +
    [0, .5, 1].map(p => '<line x1="' + pad + '" y1="' + (pad + p * (h - 2 * pad)) + '" x2="' + (w - pad) + '" y2="' + (pad + p * (h - 2 * pad)) + '" stroke="var(--line-soft)" stroke-dasharray="2 6"/>').join('') +
    '<path d="' + area + '" fill="url(#fill)"/><path d="' + path + '" pathLength="1" class="' + (animate ? 'eq-draw' : '') + '" fill="none" stroke="var(--brand)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
export function ring(pctv, label, sub, color) {
  const r = 33, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pctv)) / 100);
  return '<div class="ring"><svg width="86" height="86" viewBox="0 0 86 86" role="img" aria-label="' + esc(label) + ' ' + fmt(pctv, 0) + '%"><circle cx="43" cy="43" r="' + r + '" fill="none" stroke="var(--panel-2)" stroke-width="8"/><circle cx="43" cy="43" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 43 43)"/><text x="43" y="48" text-anchor="middle" class="rc">' + fmt(pctv, 0) + '%</text></svg><b>' + esc(label) + '</b><small>' + esc(sub) + '</small></div>';
}
export function histogram(buckets) {
  const max = Math.max(1, ...buckets.map(b => b.count));
  return '<div class="histo">' + buckets.map(b => '<div class="bar' + (b.neg ? ' neg' : '') + '" style="height:' + (b.count / max * 100) + '%" title="' + esc(b.label) + ': ' + b.count + '"></div>').join('') + '</div><div class="histoax">' + buckets.map(b => '<span>' + esc(b.label) + '</span>').join('') + '</div>';
}
export function hbars(rows) {
  const max = Math.max(1, ...rows.map(r => Math.abs(r.value)));
  return '<div class="hbars">' + rows.map(r => '<div class="hbar"><span>' + esc(r.label) + '</span><div class="track"><span class="' + (r.value < 0 ? 'neg' : '') + '" style="width:' + (Math.abs(r.value) / max * 100) + '%"></span></div><b class="' + (r.value < 0 ? 'negative' : 'positive') + '">' + (r.fmt ? r.fmt(r.value) : r.value) + '</b></div>').join('') + '</div>';
}
