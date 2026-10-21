// Trade-Disk — SEC EDGAR fundamentals provider (free, no API key, public domain).
// Pulls real company financials (EPS, revenue, net income, margins, ROE, growth)
// straight from the SEC's XBRL "company facts" feed — the same numbers filed in
// each 10-K/10-Q. EPS and revenue are the fundamentals Radar's company card shows
// next to the free price feed; unlike Yahoo/TradingView this source is
// redistributable, so it stays on in commercial mode (see DATA-CATALOG.md).
//
// SEC asks for a descriptive User-Agent on every request and rate-limits politely,
// so the ticker→CIK directory is fetched once and cached in a module-level var.
// Plain fetch, no proxy knowledge: on a normal machine it hits SEC directly; in a
// proxied sandbox Node 22.21+ reads HTTPS_PROXY when NODE_USE_ENV_PROXY=1.
//
// fundamentals(ticker) never throws — on any failure it returns {available:false,…}
// with the full shape intact (null/empty fields) so callers can render a card
// without guarding every access.

const UA = 'Trade-Disk research tool admin@trade-disk.app';
const TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';
const FACTS_URL = (cik) => `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;

const DAY = 86400000;

// ── low-level fetch ─────────────────────────────────────────────────────────
async function getJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`SEC HTTP ${res.status} ${url}`);
  return res.json();
}

// ── ticker → CIK (fetched once, cached) ─────────────────────────────────────
let _tickerMap = null; // Map<UPPER-ticker, {cik, name}>
async function resolveCik(ticker) {
  if (!_tickerMap) {
    const j = await getJSON(TICKERS_URL);
    _tickerMap = new Map();
    for (const v of Object.values(j || {})) {
      if (v && v.ticker) {
        _tickerMap.set(String(v.ticker).toUpperCase(), {
          cik: String(v.cik_str).padStart(10, '0'),
          name: v.title || null,
        });
      }
    }
  }
  return _tickerMap.get(String(ticker).toUpperCase()) || null;
}

// ── small helpers ───────────────────────────────────────────────────────────
function parseDate(s) { return s ? Date.parse(`${s}T00:00:00Z`) : NaN; }
function daysBetween(a, b) { return (parseDate(b) - parseDate(a)) / DAY; }
function round(n, dp = 2) {
  if (n == null || !Number.isFinite(n)) return null;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
function yearOf(end) { return new Date(parseDate(end)).getUTCFullYear(); }
function qlabel(end) {
  const d = new Date(parseDate(end));
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
}

// Pick the best us-gaap concept among `names` under unit `unit`, or null.
// Companies migrate XBRL tags over the years — e.g. NVIDIA's revenue runs under
// the ASC-605 tag `RevenueFromContractWithCustomerExcludingAssessedTax` only
// through FY2020, then continues under `Revenues`. So the first tag that merely
// *has* data can be years stale (summing 2019's quarters into "TTM"). We instead
// choose the concept whose most recent observation is newest; ties in recency
// fall back to the given preference order (Diluted before Basic, the cleaner
// revenue tag first) so normal single-tag companies are unaffected.
function pickConcept(gaap, names, unit) {
  let best = null, bestEnd = '', bestRank = Infinity;
  names.forEach((name, rank) => {
    const arr = gaap?.[name]?.units?.[unit];
    if (!Array.isArray(arr) || !arr.length) return;
    let latest = '';
    for (const d of arr) if (d.end && d.end > latest) latest = d.end;
    if (latest > bestEnd || (latest === bestEnd && rank < bestRank)) {
      best = arr; bestEnd = latest; bestRank = rank;
    }
  });
  return best;
}

// Revenue needs the comprehensive top line, which differs by sector: operating
// companies headline `Revenues` or the ASC-606 contract tag, while banks/fintechs
// headline `RevenuesNetOfInterestExpense` (net interest income + fee income) and
// also carry a much smaller contract-revenue sub-line. Just taking the first tag
// present understates a bank's revenue several-fold (SoFi: $0.6B contract vs $3.6B
// total net revenue). So among the revenue tags that are still current (reach a
// recent fiscal year), pick the one whose latest annual figure is largest — the
// real top line. Recency first excludes abandoned tags (NVIDIA's old ASC-605 tag
// stops in 2020 but continues under `Revenues`).
const REVENUE_CONCEPTS = [
  'Revenues',
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
  'RevenuesNetOfInterestExpense',
  'SalesRevenueNet',
];
function pickRevenueConcept(gaap) {
  const cands = [];
  for (const name of REVENUE_CONCEPTS) {
    const arr = gaap?.[name]?.units?.USD;
    if (!Array.isArray(arr) || !arr.length) continue;
    const ann = annualSeries(arr);
    if (!ann.length) continue;
    cands.push({ arr, latestFY: ann[ann.length - 1].fy, latestVal: ann[ann.length - 1].value });
  }
  if (!cands.length) return pickConcept(gaap, REVENUE_CONCEPTS, 'USD'); // no annuals → recency fallback
  const maxFY = Math.max(...cands.map((c) => c.latestFY));
  const current = cands.filter((c) => c.latestFY >= maxFY - 1); // drop abandoned tags
  current.sort((a, b) => b.latestVal - a.latestVal);            // largest top line wins
  return current[0].arr;
}

// Most recent datapoint by period-end (ties → latest filed). Works for instant
// (equity) and duration (weighted-avg shares) concepts alike.
function latestByEnd(arr) {
  let best = null;
  for (const d of arr) {
    if (!d.end) continue;
    if (!best || d.end > best.end || (d.end === best.end && (d.filed || '') > (best.filed || ''))) best = d;
  }
  return best;
}

// ── annual series: full-year 10-K durations, one per fiscal year ────────────
// Dedupe by end-date year; within a year prefer a 10-K carrying a CY#### frame,
// then the latest filing (so restatements win). Sorted oldest→newest.
function annualSeries(arr) {
  const byYear = new Map();
  for (const d of arr) {
    if (!d.start || !d.end) continue;
    const dur = daysBetween(d.start, d.end);
    if (dur < 350 || dur > 380) continue;            // full year only
    if (!/^10-K/.test(d.form || '')) continue;        // annual report only
    const fy = yearOf(d.end);
    const score = (/^CY\d{4}$/.test(d.frame || '') ? 1 : 0);
    const prev = byYear.get(fy);
    const prevScore = prev ? (/^CY\d{4}$/.test(prev.frame || '') ? 1 : 0) : -1;
    if (!prev || score > prevScore || (score === prevScore && (d.filed || '') > (prev.filed || ''))) {
      byYear.set(fy, d);
    }
  }
  return [...byYear.entries()]
    .map(([fy, d]) => ({ fy, value: d.val, start: d.start, end: d.end }))
    .sort((a, b) => a.fy - b.fy);
}

// ── quarterly series: direct 3-month observations + derived Q4 ──────────────
// Direct quarters are ~3-month periods (dedupe by end, latest filed). For any
// fiscal year that has an annual total and exactly its first three quarters but
// no discrete Q4 (the 10-K only files the full year), derive Q4 = annual − Σ(3).
// Sorted oldest→newest. Each entry: { start, end, value }.
function quarterlySeries(arr, annual) {
  const byEnd = new Map();
  for (const d of arr) {
    if (!d.start || !d.end) continue;
    const dur = daysBetween(d.start, d.end);
    if (dur < 80 || dur > 100) continue;             // a single quarter
    const prev = byEnd.get(d.end);
    if (!prev || (d.filed || '') > (prev.filed || '')) byEnd.set(d.end, d);
  }
  for (const yr of annual) {
    const yStart = parseDate(yr.start), yEnd = parseDate(yr.end);
    const inside = [...byEnd.values()].filter((q) => {
      const qe = parseDate(q.end);
      return qe > yStart && qe <= yEnd + 10 * DAY && parseDate(q.start) >= yStart - 20 * DAY;
    });
    const hasQ4 = inside.some((q) => Math.abs(parseDate(q.end) - yEnd) < 20 * DAY);
    const q123 = inside.filter((q) => Math.abs(parseDate(q.end) - yEnd) >= 20 * DAY);
    if (!hasQ4 && q123.length === 3) {
      const sum3 = q123.reduce((s, q) => s + q.val, 0);
      const lastStart = q123.map((q) => q.end).sort().pop(); // day after Q3 ends ≈ Q4 start
      byEnd.set(yr.end, { start: lastStart, end: yr.end, val: yr.value - sum3, form: 'DERIVED', filed: '' });
    }
  }
  return [...byEnd.values()]
    .sort((a, b) => parseDate(a.end) - parseDate(b.end))
    .map((d) => ({ start: d.start, end: d.end, value: d.val }));
}

// Trailing-twelve-months = sum of the last 4 quarters, but only if they exist and
// are consecutive (combined span ≈ one year), so a gap can't produce a bogus TTM.
function ttmSum(qs, dp) {
  if (qs.length < 4) return null;
  const last4 = qs.slice(-4);
  const span = daysBetween(last4[0].start, last4[3].end);
  if (!(span > 330 && span < 400)) return null;
  return round(last4.reduce((s, q) => s + q.value, 0), dp);
}

// The quarter ending ~1 year before `q` (closest within ±50 days), or null.
function findYearAgo(qs, q) {
  const target = parseDate(q.end) - 365 * DAY;
  let best = null, bestDiff = Infinity;
  for (const o of qs) {
    if (o === q) continue;
    const diff = Math.abs(parseDate(o.end) - target);
    if (diff < bestDiff) { bestDiff = diff; best = o; }
  }
  return best && bestDiff <= 50 * DAY ? best.value : null;
}

function quarterlyWithYoY(qs) {
  return qs.map((q) => {
    const ya = findYearAgo(qs, q);
    const yoyPct = (ya != null && ya !== 0 && q.value != null)
      ? round((q.value - ya) / Math.abs(ya) * 100, 1) : null;
    return { label: qlabel(q.end), value: q.value, yearAgo: ya, yoyPct };
  });
}

function emptyResult(cik, name) {
  return {
    available: false,
    cik: cik || null,
    name: name || null,
    source: 'SEC EDGAR',
    asOf: new Date().toISOString().slice(0, 10),
    eps: { ttm: null, annual: [], quarterly: [] },
    revenue: { ttm: null, annual: [], quarterly: [], yoyGrowthPct: null, qoqYoyPct: null },
    netIncome: { annual: [], ttm: null },
    sharesDiluted: null,
    margins: { net: null },
    roe: null,
    epsAnnualCagr3yPct: null,
  };
}

// ── public API ──────────────────────────────────────────────────────────────
export async function fundamentals(ticker) {
  let cik = null, name = null;
  try {
    const hit = await resolveCik(ticker);
    if (!hit) return emptyResult(null, null);
    cik = hit.cik; name = hit.name;

    const facts = await getJSON(FACTS_URL(cik));
    name = facts?.entityName || name;
    const gaap = facts?.facts?.['us-gaap'] || {};

    const epsArr = pickConcept(gaap, ['EarningsPerShareDiluted', 'EarningsPerShareBasic'], 'USD/shares');
    const revArr = pickRevenueConcept(gaap);
    const niArr = pickConcept(gaap, ['NetIncomeLoss'], 'USD');
    const eqArr = pickConcept(gaap, ['StockholdersEquity'], 'USD');
    const shArr = pickConcept(gaap, ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic'], 'shares');

    const epsAnnual = epsArr ? annualSeries(epsArr) : [];
    const epsQ = epsArr ? quarterlySeries(epsArr, epsAnnual) : [];
    const revAnnual = revArr ? annualSeries(revArr) : [];
    const revQ = revArr ? quarterlySeries(revArr, revAnnual) : [];
    const niAnnual = niArr ? annualSeries(niArr) : [];
    const niQ = niArr ? quarterlySeries(niArr, niAnnual) : [];

    const eqLatest = eqArr ? latestByEnd(eqArr) : null;
    const shLatest = shArr ? latestByEnd(shArr) : null;

    // asOf = newest period-end across everything we read
    let asOf = '';
    for (const s of [epsAnnual, epsQ, revAnnual, revQ, niAnnual, niQ]) {
      for (const d of s) if (d.end > asOf) asOf = d.end;
    }
    if (eqLatest && eqLatest.end > asOf) asOf = eqLatest.end;
    if (shLatest && shLatest.end > asOf) asOf = shLatest.end;
    if (!asOf) asOf = new Date().toISOString().slice(0, 10);

    const epsTtm = ttmSum(epsQ, 2);
    const revTtm = ttmSum(revQ, 0);
    const niTtm = ttmSum(niQ, 0);

    const epsQFull = quarterlyWithYoY(epsQ);
    const revQFull = quarterlyWithYoY(revQ);
    const epsQOut = epsQFull.slice(-8).map((q) => ({
      label: q.label,
      value: round(q.value, 2),
      yearAgo: q.yearAgo != null ? round(q.yearAgo, 2) : null,
      yoyPct: q.yoyPct,
    }));
    const revQOut = revQFull.slice(-8).map((q) => ({
      label: q.label,
      value: round(q.value, 0),
      yoyPct: q.yoyPct,
    }));

    const epsAnnualOut = epsAnnual.slice(-5).map((d) => ({ fy: d.fy, value: round(d.value, 2) }));
    const revAnnualOut = revAnnual.slice(-5).map((d) => ({ fy: d.fy, value: d.value }));
    const niAnnualOut = niAnnual.slice(-5).map((d) => ({ fy: d.fy, value: d.value }));

    // revenue annual YoY (latest FY vs prior FY)
    let revYoY = null;
    if (revAnnual.length >= 2) {
      const a = revAnnual[revAnnual.length - 1].value, b = revAnnual[revAnnual.length - 2].value;
      if (b) revYoY = round((a - b) / Math.abs(b) * 100, 1);
    }
    const revQoQYoY = revQOut.length ? revQOut[revQOut.length - 1].yoyPct : null;

    // EPS 3-year CAGR (needs 4 annual points, both ends positive)
    let epsCagr = null;
    if (epsAnnual.length >= 4) {
      const last = epsAnnual[epsAnnual.length - 1].value;
      const prior3 = epsAnnual[epsAnnual.length - 4].value;
      if (last > 0 && prior3 > 0) epsCagr = round((Math.pow(last / prior3, 1 / 3) - 1) * 100, 1);
    }

    // net margin: TTM NI / TTM revenue, else latest FY
    let netMargin = null;
    if (niTtm != null && revTtm) {
      netMargin = round(niTtm / revTtm * 100, 1);
    } else if (niAnnual.length && revAnnual.length) {
      const rv = revAnnual[revAnnual.length - 1].value;
      if (rv) netMargin = round(niAnnual[niAnnual.length - 1].value / rv * 100, 1);
    }

    // ROE: NI (TTM, else latest FY) / latest stockholders' equity
    let roe = null;
    const niForRoe = niTtm != null ? niTtm : (niAnnual.length ? niAnnual[niAnnual.length - 1].value : null);
    if (niForRoe != null && eqLatest && eqLatest.val) roe = round(niForRoe / eqLatest.val * 100, 1);

    // Integrity guard: if net income is ≥90% of revenue, the revenue tag we picked
    // is almost certainly a narrow sub-line (a real operating company cannot keep
    // nearly all its revenue as profit), so the top line — and everything derived
    // from it — is untrustworthy. Suppress revenue and margin rather than publish a
    // >100% net margin; EPS and net income stand on their own and stay.
    const revenueSuspect = niTtm != null && revTtm != null && revTtm > 0 && niTtm > 0.9 * revTtm;
    const revOut = revenueSuspect
      ? { ttm: null, annual: [], quarterly: [], yoyGrowthPct: null, qoqYoyPct: null }
      : { ttm: revTtm, annual: revAnnualOut, quarterly: revQOut, yoyGrowthPct: revYoY, qoqYoyPct: revQoQYoY };
    const netMarginOut = revenueSuspect ? null : netMargin;

    const available = epsTtm != null || revOut.ttm != null || epsAnnualOut.length > 0 || revOut.annual.length > 0;

    return {
      available,
      cik,
      name,
      source: 'SEC EDGAR',
      asOf,
      eps: { ttm: epsTtm, annual: epsAnnualOut, quarterly: epsQOut },
      revenue: revOut,
      netIncome: { annual: niAnnualOut, ttm: niTtm },
      sharesDiluted: shLatest ? shLatest.val : null,
      margins: { net: netMarginOut },
      roe,
      epsAnnualCagr3yPct: epsCagr,
    };
  } catch {
    return emptyResult(cik, name);
  }
}
