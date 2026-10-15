// Trade-Disk — Journal demo data, reproduced EXACTLY from the approved prototype's
// buildSeed() (frontend-design/index.html): the same 22 rows, the same formulas,
// the same accounts and setups. So the API serves the identical record the view
// was designed against — the backend matches the exact view, not a guess.
// Every figure is synthetic demo data, never real performance.

import { openDb, run, one } from '../lib/db.mjs';

const db = openDb();
db.exec('DELETE FROM trade; DELETE FROM account; DELETE FROM setup; DELETE FROM day_note;');

// reference data — verbatim from the prototype
const setups = ['Breakout retest', 'VWAP pullback', 'Opening range breakout', 'Trend continuation'];
const MULT = { stock: 1, option: 100, future: 50, forex: 100000, crypto: 1 };
const accounts = [
  ['acc-alpaca', 'Alpaca — Paper', 'Broker connector', 'Alpaca', 'connected', 'T+1 · synced ' + iso(), 'Activities + orders API'],
  ['acc-ibkr', 'Interactive Brokers', 'Broker connector', 'IBKR Flex', 'not-connected', 'Reporting only — cannot trade or move funds', 'Flex Web Service'],
  ['acc-manual', 'Manual / CSV', 'File upload + manual', 'File', 'file', 'Column-mapping wizard', 'CSV · XLSX · broker exports'],
];

// the 22 seed rows: [symbol, side, setup, assetType, qty, entry, exit, risk, date, status, adherence]
const seedRows = [
  ['NVDA','Long','Breakout retest','stock',60,124.2,127.4,0.8,'2026-10-13','Closed','Good'],
  ['AAPL','Long','VWAP pullback','stock',100,246.4,248.4,1.2,'2026-10-12','Closed','Average'],
  ['TSLA','Short','Opening range breakout','stock',50,452.0,447.8,1.4,'2026-10-11','Closed','Good'],
  ['AMD','Long','Trend continuation','stock',120,169.2,172.1,1.6,'2026-10-10','Closed','Good'],
  ['PLTR','Long','Breakout retest','stock',150,176.3,173.4,1.7,'2026-10-09','Closed','Poor'],
  ['SPY 670C','Long','VWAP pullback','option',4,3.10,4.05,0.6,'2026-10-08','Closed','Good'],
  ['MSFT','Long','Breakout retest','stock',40,521.2,525.6,1.1,'2026-10-07','Closed','Good'],
  ['ES','Long','Opening range breakout','future',2,5720.0,5731.5,4.0,'2026-10-06','Closed','Average'],
  ['AMZN','Long','Trend continuation','stock',70,228.1,231.5,1.3,'2026-10-03','Closed','Good'],
  ['HOOD','Short','VWAP pullback','stock',120,128.7,131.4,1.8,'2026-10-02','Closed','Poor'],
  ['GOOGL','Long','Breakout retest','stock',60,244.3,248.2,1.2,'2026-10-01','Closed','Good'],
  ['EURUSD','Short','Opening range breakout','forex',1,1.0880,1.0845,0.0015,'2026-09-29','Closed','Average'],
  ['QQQ','Long','Trend continuation','stock',40,605.4,609.8,1.0,'2026-09-26','Closed','Good'],
  ['IWM','Short','Breakout retest','stock',100,241.3,239.5,1.3,'2026-09-25','Closed','Average'],
  ['BTC','Long','VWAP pullback','crypto',0.25,61200,62850,900,'2026-09-23','Closed','Good'],
  ['INTC','Long','Breakout retest','stock',400,37.4,36.1,1.9,'2026-09-20','Closed','Poor'],
  ['SPY','Long','Trend continuation','stock',30,667.2,669.1,0.9,'2026-09-18','Closed','Good'],
  ['MU','Short','Opening range breakout','stock',80,181.3,178.7,1.2,'2026-09-15','Closed','Good'],
  ['AVGO','Long','Breakout retest','stock',20,357.2,361.3,1.0,'2026-09-12','Closed','Good'],
  ['SOFI','Long','VWAP pullback','stock',300,27.6,26.9,1.6,'2026-09-10','Closed','Poor'],
  ['CRWD','Long','Trend continuation','stock',20,418.2,425.1,1.1,'2026-09-05','Open','Unknown'],
  ['UBER','Long','Breakout retest','stock',120,98.4,99.6,0.7,'2026-10-13','Open','Unknown'],
];

for (const [id, name, door, kind, status, last, note] of accounts)
  run(db, `INSERT INTO account (id,name,door,kind,status,last,note,sort) VALUES (?,?,?,?,?,?,?,?)`,
    id, name, door, kind, status, last, note, accounts.findIndex(a => a[0] === id));
setups.forEach((name, i) => run(db, `INSERT INTO setup (id,name) VALUES (?,?)`, i + 1, name));

const ins = db.prepare(`INSERT INTO trade
  (id,symbol,side,setup,asset_type,qty,entry,exit,risk,date,status,adherence,fees,net,gross,mult,
   move_pct,r,account,source,duration,tags,thesis,notes,stop,target,planned_rr,initial_risk,emotions,batch,created_at,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

seedRows.forEach((x, i) => {
  const [symbol, side, setup, assetType, qty, entry, exit, risk, date, status, adherence] = x;
  const mult = MULT[assetType] || 1, dir = side === 'Long' ? 1 : -1;
  const open = status === 'Open';
  const gross = open ? 0 : (exit - entry) * qty * mult * dir;
  const fees = open ? 0 : Math.max(0.3, qty * (assetType === 'stock' ? 0.01 : 0.6));
  const net = gross - fees;
  const initialRisk = risk * qty * mult;           // perUnit(=risk) × qty × mult
  const acct = (assetType === 'forex' || assetType === 'future') ? 'Interactive Brokers'
             : (i % 4 === 0) ? 'Manual / CSV' : 'Alpaca — Paper';
  const source = acct === 'Manual / CSV' ? 'File import (demo)' : 'Broker connector (demo)';
  const tags = i % 3 === 0 ? ['planned'] : i % 3 === 1 ? ['late entry'] : ['clean execution'];
  ins.run(
    'TD-' + String(1032 - i).padStart(4, '0'), symbol, side, setup, assetType, qty, entry,
    open ? null : exit, risk, date, status, adherence, fees,
    open ? null : round(net), open ? null : round(gross), mult,
    open ? null : round(((exit - entry) / entry * 100) * dir, 4),
    open || !initialRisk ? null : round(net / initialRisk, 4),
    acct, source, Math.round(12 + ((i * 17) % 250)), JSON.stringify(tags),
    'Illustrative thesis: waited for price to confirm the planned setup and respected the risk level.',
    'Demo note. Replace with your own trade observations.',
    round(side === 'Long' ? entry - risk : entry + risk, 4),
    round(side === 'Long' ? entry + risk * 2 : entry - risk * 2, 4),
    2, round(initialRisk), 'Focused', 'seed', date + 'T14:30:00Z', date + 'T20:00:00Z');
});

run(db, `INSERT INTO day_note (day,note) VALUES (?,?)`, '2026-10-02', 'Chop; sized down and respected stops. Demo note.');

console.log(`seeded ${one(db, 'SELECT COUNT(*) c FROM trade').c} trades, ${setups.length} setups, ${accounts.length} accounts (demo).`);

function round(x, d = 2) { return Math.round(x * 10 ** d) / 10 ** d; }
function iso() { return new Date().toISOString().slice(0, 10); }
