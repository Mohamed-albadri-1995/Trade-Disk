// Trade-Disk — the Database viewer API. Read-only and owner-scoped: it lists the
// account's own tables, pages their rows, and exports them (CSV / JSON). Every read
// runs through the signed-in user's RLS client `sb`, so a user only ever sees their
// own rows; and only the tables in ALLOW can be touched — no arbitrary table access.

// The account's data tables: a friendly label, a group, and the column to order by
// (newest first unless noted). Anything not listed here cannot be read.
const ALLOW = {
  trade:                 { label: 'Trades',              group: 'Journal',            order: ['created_at', false] },
  journal_account:       { label: 'Accounts',            group: 'Journal',            order: null },
  setup:                 { label: 'Setups',              group: 'Journal',            order: null },
  day_note:              { label: 'Day notes',           group: 'Journal',            order: ['day', false] },
  review_note:           { label: 'Reviews',             group: 'Journal',            order: ['created_at', false] },
  radar_register:        { label: 'Daily register',      group: 'Radar · live',       order: ['updated_at', false] },
  radar_shortlist:       { label: 'Shortlist',           group: 'Radar · live',       order: ['added_at', false] },
  radar_screener:        { label: 'Custom screeners',    group: 'Radar · live',       order: ['updated_at', false] },
  radar_screen_catalog:  { label: 'Screen catalog',      group: 'Radar · history',    order: ['screen', true] },
  radar_history:         { label: 'Screen history',      group: 'Radar · history',    order: ['day', false] },
  radar_history_outcome: { label: 'Recorded outcomes',   group: 'Radar · history',    order: ['day', false] },
  radar_snapshot:        { label: 'Snapshots · cards',   group: 'Radar · collection', order: ['taken_at', false] },
  radar_snapshot_facts:  { label: 'Snapshots · facts',   group: 'Radar · collection', order: ['taken_at', false] },
  radar_snapshot_market: { label: 'Snapshots · market',  group: 'Radar · collection', order: ['taken_at', false] },
  radar_snapshot_label:  { label: 'EOD labels',          group: 'Radar · collection', order: ['day', false] },
  lab_strategy:          { label: 'Strategies',          group: 'Lab',                order: ['updated_at', false] },
  lab_strategy_version:  { label: 'Strategy versions',   group: 'Lab',                order: ['created_at', false] },
  lab_backtest:          { label: 'Backtests',           group: 'Lab',                order: ['created_at', false] },
};

const MAX_EXPORT = 200000;                      // safety cap on a single export
const clampPage = (n, d) => Math.max(1, Math.round(+n || d));
const clampSize = (n, d) => Math.max(1, Math.min(200, Math.round(+n || d)));
const applyOrder = (q, meta) => (meta.order ? q.order(meta.order[0], { ascending: !!meta.order[1] }) : q);

// The list of tables with live row counts, for the chooser.
export async function tables(sb) {
  const entries = Object.entries(ALLOW);
  const counts = await Promise.all(entries.map(async ([t]) => {
    try { return (await sb.from(t).select('*', { count: 'exact', head: true })).count || 0; } catch { return 0; }
  }));
  return { tables: entries.map(([t, meta], i) => ({ table: t, label: meta.label, group: meta.group, count: counts[i] })) };
}

// One page of a table's rows, ordered newest-first, with its column list and total.
export async function rows(sb, table, { page = 1, size = 50 } = {}) {
  const meta = ALLOW[table];
  if (!meta) throw new Error('unknown table');
  page = clampPage(page, 1); size = clampSize(size, 50);
  const from = (page - 1) * size, to = from + size - 1;
  const { data, error, count } = await applyOrder(sb.from(table).select('*', { count: 'exact' }).range(from, to), meta);
  if (error) throw new Error(error.message);
  const cols = new Set();
  for (const r of (data || [])) for (const k of Object.keys(r)) cols.add(k);
  return { table, label: meta.label, columns: [...cols], rows: data || [], page, size, total: count || 0 };
}

async function fetchAll(sb, table, meta) {
  const all = [];
  for (let from = 0; from < MAX_EXPORT; from += 1000) {
    const { data, error } = await applyOrder(sb.from(table).select('*').range(from, from + 999), meta);
    if (error) throw new Error(error.message);
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

const csvCell = (v) => {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// The whole table as a downloadable CSV or JSON payload (the UI turns it into a file).
export async function exportTable(sb, table, format = 'csv') {
  const meta = ALLOW[table];
  if (!meta) throw new Error('unknown table');
  const data = await fetchAll(sb, table, meta);
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'json') return { filename: `${table}_${stamp}.json`, mime: 'application/json', rows: data.length, content: JSON.stringify(data, null, 2) };
  const cols = [...new Set(data.flatMap((r) => Object.keys(r)))];
  const lines = [cols.join(',')];
  for (const r of data) lines.push(cols.map((c) => csvCell(r[c])).join(','));
  return { filename: `${table}_${stamp}.csv`, mime: 'text/csv', rows: data.length, content: lines.join('\n') };
}
