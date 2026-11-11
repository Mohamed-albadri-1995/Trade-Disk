// Test helpers for Radar: an in-memory stand-in for the Supabase client and a
// stand-in for fetch, so the tests run with no network and no database.

// A tiny PostgREST-like query builder over plain arrays. Supports the calls Radar
// makes: select / eq / order / limit / range / insert / upsert / delete, awaited.
export function fakeDb(tables = {}) {
  const db = { tables, log: [] };
  db.from = (name) => {
    tables[name] ||= [];
    const q = { op: 'select', filters: [], rows: null, conflict: null, lim: null };
    const api = {
      select() { return api; },
      eq(col, val) { q.filters.push([col, val]); return api; },
      order() { return api; },
      limit(n) { q.lim = n; return api; },
      range(a, b) { q.rng = [a, b]; return api; },
      insert(rows) { q.op = 'insert'; q.rows = [].concat(rows); return api; },
      upsert(rows, opts = {}) { q.op = 'upsert'; q.rows = [].concat(rows); q.conflict = opts.onConflict || null; return api; },
      delete() { q.op = 'delete'; return api; },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    const match = (r) => q.filters.every(([c, v]) => r[c] === v);
    function run() {
      db.log.push({ table: name, op: q.op, filters: q.filters.map((f) => f[0]) });
      const t = tables[name];
      if (q.op === 'insert') { t.push(...q.rows); return { data: q.rows, error: null }; }
      if (q.op === 'upsert') {
        const keys = (q.conflict || '').split(',').filter(Boolean);
        for (const row of q.rows) {
          const i = keys.length ? t.findIndex((r) => keys.every((k) => r[k] === row[k])) : -1;
          if (i >= 0) t[i] = { ...t[i], ...row }; else t.push(row);
        }
        return { data: q.rows, error: null };
      }
      if (q.op === 'delete') { tables[name] = t.filter((r) => !match(r)); return { data: null, error: null }; }
      let out = t.filter(match);
      if (q.rng) out = out.slice(q.rng[0], q.rng[1] + 1);
      if (q.lim != null) out = out.slice(0, q.lim);
      return { data: out, error: null, count: out.length };
    }
    return api;
  };
  return db;
}

// Replace global fetch with a handler (url, init) → { status?, json }. Returns a
// restore function and the list of calls made.
export function stubFetch(handler) {
  const real = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), body });
    const r = await handler(String(url), body);
    const status = r.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => r.json };
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}

// A TradingView scanner row for the given columns from a { column: value } object.
export const tvRow = (sym, columns, vals) => ({ s: sym, d: columns.map((c) => (c in vals ? vals[c] : null)) });

// n daily bars ending at `endSec`, closes from a function of the index.
export function dailyBars(n, closeAt, endSec = Date.UTC(2026, 0, 5, 14, 30) / 1000) {
  return Array.from({ length: n }, (_, i) => {
    const c = closeAt(i);
    return { t: endSec - (n - 1 - i) * 86400, o: c, h: c + 1, l: c - 1, c, v: 1000 + i };
  });
}
