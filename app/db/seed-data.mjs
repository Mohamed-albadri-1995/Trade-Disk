// Trade-Disk — demo data, reproduced from the approved prototype's buildSeed()
// (same 22 rows, formulas, accounts, setups). Exposed as a function so both the
// seed script and the /api/journal/reset endpoint can rebuild the demo workspace.
// Every figure is synthetic demo data, never real performance.

const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const todayISO = () => new Date().toISOString().slice(0, 10);

export const SETUPS = ['Breakout retest', 'VWAP pullback', 'Opening range breakout', 'Trend continuation'];
export const MULT = { stock: 1, option: 100, future: 50, forex: 100000, crypto: 1 };

// derive the stored trade fields from the raw inputs (one definition, used by
// the seed and by manual add/edit so every path computes the same way).
export function deriveTrade(t) {
  const mult = MULT[t.assetType] || 1, dir = t.side === 'Long' ? 1 : -1;
  const open = t.status === 'Open' || t.exit == null;
  const gross = open ? null : round((t.exit - t.entry) * t.qty * mult * dir);
  const fees = t.fees != null ? t.fees : (open ? 0 : Math.max(0.3, t.qty * (t.assetType === 'stock' ? 0.01 : 0.6)));
  const net = open ? null : round(gross - fees);
  const risk = t.risk != null ? t.risk : (t.stop != null ? Math.abs(t.entry - t.stop) : null);
  const initialRisk = risk != null ? round(risk * t.qty * mult) : null;
  return {
    ...t, mult, fees, gross, net,
    exit: open ? null : t.exit,
    status: open ? 'Open' : 'Closed',
    movePct: open ? null : round(((t.exit - t.entry) / t.entry * 100) * dir, 4),
    r: open || !initialRisk ? null : round(net / initialRisk, 4),
    risk, initialRisk,
    stop: t.stop != null ? t.stop : (risk != null ? round(dir > 0 ? t.entry - risk : t.entry + risk, 4) : null),
    target: t.target != null ? t.target : (risk != null ? round(dir > 0 ? t.entry + risk * 2 : t.entry - risk * 2, 4) : null),
  };
}

export const SEED_ROWS = [
  ['NVDA', 'Long', 'Breakout retest', 'stock', 60, 124.2, 127.4, 0.8, '2026-10-13', 'Closed', 'Good'],
  ['AAPL', 'Long', 'VWAP pullback', 'stock', 100, 246.4, 248.4, 1.2, '2026-10-12', 'Closed', 'Average'],
  ['TSLA', 'Short', 'Opening range breakout', 'stock', 50, 452.0, 447.8, 1.4, '2026-10-11', 'Closed', 'Good'],
  ['AMD', 'Long', 'Trend continuation', 'stock', 120, 169.2, 172.1, 1.6, '2026-10-10', 'Closed', 'Good'],
  ['PLTR', 'Long', 'Breakout retest', 'stock', 150, 176.3, 173.4, 1.7, '2026-10-09', 'Closed', 'Poor'],
  ['SPY 670C', 'Long', 'VWAP pullback', 'option', 4, 3.10, 4.05, 0.6, '2026-10-08', 'Closed', 'Good'],
  ['MSFT', 'Long', 'Breakout retest', 'stock', 40, 521.2, 525.6, 1.1, '2026-10-07', 'Closed', 'Good'],
  ['ES', 'Long', 'Opening range breakout', 'future', 2, 5720.0, 5731.5, 4.0, '2026-10-06', 'Closed', 'Average'],
  ['AMZN', 'Long', 'Trend continuation', 'stock', 70, 228.1, 231.5, 1.3, '2026-10-03', 'Closed', 'Good'],
  ['HOOD', 'Short', 'VWAP pullback', 'stock', 120, 128.7, 131.4, 1.8, '2026-10-02', 'Closed', 'Poor'],
  ['GOOGL', 'Long', 'Breakout retest', 'stock', 60, 244.3, 248.2, 1.2, '2026-10-01', 'Closed', 'Good'],
  ['EURUSD', 'Short', 'Opening range breakout', 'forex', 1, 1.0880, 1.0845, 0.0015, '2026-09-29', 'Closed', 'Average'],
  ['QQQ', 'Long', 'Trend continuation', 'stock', 40, 605.4, 609.8, 1.0, '2026-09-26', 'Closed', 'Good'],
  ['IWM', 'Short', 'Breakout retest', 'stock', 100, 241.3, 239.5, 1.3, '2026-09-25', 'Closed', 'Average'],
  ['BTC', 'Long', 'VWAP pullback', 'crypto', 0.25, 61200, 62850, 900, '2026-09-23', 'Closed', 'Good'],
  ['INTC', 'Long', 'Breakout retest', 'stock', 400, 37.4, 36.1, 1.9, '2026-09-20', 'Closed', 'Poor'],
  ['SPY', 'Long', 'Trend continuation', 'stock', 30, 667.2, 669.1, 0.9, '2026-09-18', 'Closed', 'Good'],
  ['MU', 'Short', 'Opening range breakout', 'stock', 80, 181.3, 178.7, 1.2, '2026-09-15', 'Closed', 'Good'],
  ['AVGO', 'Long', 'Breakout retest', 'stock', 20, 357.2, 361.3, 1.0, '2026-09-12', 'Closed', 'Good'],
  ['SOFI', 'Long', 'VWAP pullback', 'stock', 300, 27.6, 26.9, 1.6, '2026-09-10', 'Closed', 'Poor'],
  ['CRWD', 'Long', 'Trend continuation', 'stock', 20, 418.2, 425.1, 1.1, '2026-09-05', 'Open', 'Unknown'],
  ['UBER', 'Long', 'Breakout retest', 'stock', 120, 98.4, 99.6, 0.7, '2026-10-13', 'Open', 'Unknown'],
];

const COLS = ['id', 'symbol', 'side', 'setup', 'asset_type', 'qty', 'entry', 'exit', 'risk', 'date', 'status', 'adherence',
  'fees', 'net', 'gross', 'mult', 'move_pct', 'r', 'account', 'source', 'duration', 'tags', 'thesis', 'notes',
  'stop', 'target', 'planned_rr', 'initial_risk', 'emotions', 'batch', 'created_at', 'updated_at'];

// insert one derived trade; shared by seed and the add-trade endpoint
export function insertTrade(db, t) {
  const row = {
    id: t.id, symbol: t.symbol, side: t.side, setup: t.setup, asset_type: t.assetType, qty: t.qty, entry: t.entry,
    exit: t.exit, risk: t.risk, date: t.date, status: t.status, adherence: t.adherence || 'Unknown', fees: t.fees || 0,
    net: t.net, gross: t.gross, mult: t.mult, move_pct: t.movePct, r: t.r, account: t.account, source: t.source,
    duration: t.duration, tags: JSON.stringify(t.tags || []), thesis: t.thesis, notes: t.notes, stop: t.stop,
    target: t.target, planned_rr: t.plannedRR, initial_risk: t.initialRisk, emotions: t.emotions, batch: t.batch,
    created_at: t.createdAt, updated_at: t.updatedAt,
  };
  db.prepare(`INSERT INTO trade (${COLS.join(',')}) VALUES (${COLS.map(() => '?').join(',')})`).run(...COLS.map(c => row[c] ?? null));
}

export function seedDemo(db) {
  db.exec('DELETE FROM trade; DELETE FROM account; DELETE FROM setup; DELETE FROM day_note; DELETE FROM review_note;');
  const accts = [
    ['acc-alpaca', 'Alpaca — Paper', 'Broker connector', 'Alpaca', 'connected', 'T+1 · synced ' + todayISO(), 'Activities + orders API'],
    ['acc-ibkr', 'Interactive Brokers', 'Broker connector', 'IBKR Flex', 'not-connected', 'Reporting only — cannot trade or move funds', 'Flex Web Service'],
    ['acc-manual', 'Manual / CSV', 'File upload + manual', 'File', 'file', 'Column-mapping wizard', 'CSV · XLSX · broker exports'],
  ];
  accts.forEach((a, i) => db.prepare(`INSERT INTO account (id,name,door,kind,status,last,note,sort) VALUES (?,?,?,?,?,?,?,?)`).run(...a, i));
  SETUPS.forEach((name, i) => db.prepare(`INSERT INTO setup (id,name) VALUES (?,?)`).run(i + 1, name));

  SEED_ROWS.forEach((x, i) => {
    const [symbol, side, setup, assetType, qty, entry, exit, risk, date, status, adherence] = x;
    const acct = (assetType === 'forex' || assetType === 'future') ? 'Interactive Brokers' : (i % 4 === 0) ? 'Manual / CSV' : 'Alpaca — Paper';
    const t = deriveTrade({ symbol, side, setup, assetType, qty, entry, exit, risk, date, status, adherence });
    insertTrade(db, {
      ...t, id: 'TD-' + String(1032 - i).padStart(4, '0'),
      account: acct, source: acct === 'Manual / CSV' ? 'File import (demo)' : 'Broker connector (demo)',
      duration: Math.round(12 + ((i * 17) % 250)), tags: i % 3 === 0 ? ['planned'] : i % 3 === 1 ? ['late entry'] : ['clean execution'],
      thesis: 'Illustrative thesis: waited for price to confirm the planned setup and respected the risk level.',
      notes: 'Demo note. Replace with your own trade observations.', plannedRR: 2, emotions: 'Focused', batch: 'seed',
      createdAt: date + 'T14:30:00Z', updatedAt: date + 'T20:00:00Z',
    });
  });
  db.prepare(`INSERT INTO day_note (day,note) VALUES (?,?)`).run('2026-10-02', 'Chop; sized down and respected stops. Demo note.');
  return db.prepare('SELECT COUNT(*) c FROM trade').get().c;
}
