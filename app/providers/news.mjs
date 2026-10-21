// Trade-Disk — per-stock fresh-news provider (free sources: Yahoo Finance search +
// SEC EDGAR filings). The analysis workspace shows only news that is (1) fresh — within
// a short window, 48h by default — and (2) about THIS stock, not generic "who's moving
// today" lists that merely tag a mega-cap in passing. Yahoo tags many articles with a
// big name in relatedTickers, so we keep an item only when the ticker is the primary
// subject (first related ticker) or the headline names the ticker or the company. SEC
// filings are kept only for material forms (8-K, 10-Q/K, offerings, big stakes), never
// routine insider Form 3/4/5. A paid feed (Finnhub) can be layered on in commercial
// mode via the feed switch; this module stays on free data.
//
// Plain fetch, no proxy knowledge (like providers/yahoo.mjs): direct on a normal box,
// via HTTPS_PROXY in a sandbox when NODE_USE_ENV_PROXY=1. Never throws — returns an
// empty, well-shaped result on any failure so the card renders without guards.

const YT_UA = 'Mozilla/5.0';
const SEC_UA = 'Trade-Disk research tool admin@trade-disk.app';
const SEARCH = 'https://query1.finance.yahoo.com/v1/finance/search';
const SUBMISSIONS = (cik) => `https://data.sec.gov/submissions/CIK${cik}.json`;

async function getJSON(url, ua) {
  const res = await fetch(url, { headers: { 'user-agent': ua, accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

// The distinctive word of a company name for headline matching: skip generic
// suffixes/stopwords, take the first word of length ≥4 (else the first word).
const STOP = new Set(['the', 'and', 'for', 'inc', 'incorporated', 'corp', 'corporation', 'company', 'co', 'ltd', 'limited', 'plc', 'holdings', 'holding', 'group', 'technologies', 'technology', 'systems', 'international', 'industries', 'enterprises', 'class', 'common', 'stock', 'adr']);
function nameKey(name) {
  if (!name) return null;
  const words = String(name).toLowerCase().replace(/[.,&/()]/g, ' ').split(/\s+/).filter(Boolean);
  for (const w of words) if (w.length >= 4 && !STOP.has(w)) return w;
  return words[0] || null;
}

function ageText(ts) {
  const h = (Date.now() - ts) / 3600000;
  if (h < 1) return Math.max(1, Math.round(h * 60)) + 'm ago';
  if (h < 24) return Math.round(h) + 'h ago';
  return Math.round(h / 24) + 'd ago';
}

const MATERIAL = /^(8-K|6-K|10-Q|10-K|20-F|40-F|S-1|S-3|F-1|424|SC 13D|SC 13G|DEF 14A|DEFA14A|425)/i;
function formLabel(f) {
  if (/^8-K/i.test(f)) return 'Material event · 8-K';
  if (/^10-Q/i.test(f)) return 'Quarterly report · 10-Q';
  if (/^10-K/i.test(f)) return 'Annual report · 10-K';
  if (/^6-K/i.test(f)) return 'Foreign issuer report · 6-K';
  if (/^20-F/i.test(f) || /^40-F/i.test(f)) return `Annual report · ${f}`;
  if (/^SC 13D/i.test(f)) return 'Activist stake · SC 13D';
  if (/^SC 13G/i.test(f)) return 'Passive stake · SC 13G';
  if (/^(S-1|S-3|F-1|424|425)/i.test(f)) return `Offering / registration · ${f}`;
  if (/^DEF/i.test(f)) return 'Proxy statement · DEF 14A';
  return `${f} filed`;
}

// ── public API ───────────────────────────────────────────────────────────────
// news(ticker, { name, cik, maxAgeHours, limit }) → { available, maxAgeHours, asOf, items }
// items: [{ source, title, url, ts, ageText, kind: 'news'|'filing', related? }], newest first.
export async function news(ticker, { name = null, cik = null, maxAgeHours = 48, limit = 12 } = {}) {
  const tk = String(ticker).toUpperCase();
  const cutoff = Date.now() - maxAgeHours * 3600 * 1000;
  const key = nameKey(name);
  const tickerWord = new RegExp(`(^|[^A-Z])${tk.replace(/[.^$*+?()[\]{}|\\]/g, '\\$&')}([^A-Z]|$)`);
  const items = [];

  // Yahoo Finance search news — fresh and plentiful, but we must keep only items
  // where this stock is the primary subject (not just a tagged mega-cap).
  try {
    const j = await getJSON(`${SEARCH}?q=${encodeURIComponent(tk)}&quotesCount=0&newsCount=30&enableFuzzyQuery=false`, YT_UA);
    for (const n of (j.news || [])) {
      const ts = (n.providerPublishTime || 0) * 1000;
      if (!ts || ts < cutoff) continue;
      const rel = (n.relatedTickers || []).map((s) => String(s).toUpperCase());
      const title = n.title || '';
      // Must be ABOUT this stock, not merely tagged with it: the headline has to name
      // the ticker or the company. Yahoo lists a mega-cap first in relatedTickers even
      // on other companies' earnings recaps and "big movers" roundups, so a tag — or
      // even being the first related ticker — is not enough.
      const aboutStock = tickerWord.test(title) || (key && title.toLowerCase().includes(key));
      if (!aboutStock) continue;
      items.push({ source: n.publisher || 'Yahoo Finance', title, url: n.link || null, ts, ageText: ageText(ts), kind: 'news', related: rel.slice(0, 4) });
    }
  } catch { /* free feed best-effort */ }

  // SEC EDGAR recent filings — material corporate events only, same freshness window.
  try {
    if (cik) {
      const sj = await getJSON(SUBMISSIONS(cik), SEC_UA);
      const r = sj.filings?.recent;
      if (r && Array.isArray(r.form)) {
        for (let i = 0; i < r.form.length && i < 60; i++) {
          const form = r.form[i];
          if (!MATERIAL.test(form)) continue;
          const ts = Date.parse(`${r.filingDate[i]}T12:00:00Z`);
          if (!ts || ts < cutoff) continue;
          const acc = String(r.accessionNumber[i] || '').replace(/-/g, '');
          const doc = r.primaryDocument[i] || '';
          const url = acc ? `https://www.sec.gov/Archives/edgar/data/${+cik}/${acc}/${doc}` : null;
          items.push({ source: 'SEC EDGAR', title: `${formLabel(form)} filed with the SEC`, url, ts, ageText: ageText(ts), kind: 'filing', form });
        }
      }
    }
  } catch { /* filings best-effort */ }

  items.sort((a, b) => b.ts - a.ts);
  return {
    available: items.length > 0,
    maxAgeHours,
    asOf: new Date().toISOString(),
    items: items.slice(0, limit),
  };
}
