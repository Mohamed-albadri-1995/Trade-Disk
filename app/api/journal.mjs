// Trade-Disk — the Journal's data API (reads + writes), on Supabase.
// Every call runs through a per-user Supabase client (`sb`), so row-level security
// scopes reads to the signed-in account automatically; writes stamp owner_id
// (`uid`). The view's own stats()/advanced() compute the metrics, so there is one
// metric definition. Table `journal_account` holds the trader's broker/file
// accounts (named apart from the auth account).

import { deriveTrade, SETUPS, SEED_ROWS } from '../db/seed-data.mjs';

const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const todayISO = () => new Date().toISOString().slice(0, 10);
const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

function mapTrade(r) {
  return {
    id: r.id, symbol: r.symbol, side: r.side, setup: r.setup, assetType: r.asset_type,
    qty: r.qty, entry: r.entry, exit: r.exit, risk: r.risk, date: r.date, status: r.status,
    adherence: r.adherence, fees: r.fees, net: r.net, gross: r.gross, mult: r.mult,
    movePct: r.move_pct, r: r.r, account: r.account, source: r.source, duration: r.duration,
    tags: Array.isArray(r.tags) ? r.tags : [], thesis: r.thesis, notes: r.notes, stop: r.stop, target: r.target,
    plannedRR: r.planned_rr, initialRisk: r.initial_risk, emotions: r.emotions, batch: r.batch,
    createdAt: r.created_at, updatedAt: r.updated_at, entrySnapshot: null,
  };
}

// app-shape trade → DB row (snake_case + owner_id). jsonb columns take JS values.
const toRow = (t, uid) => ({
  owner_id: uid, id: t.id, symbol: t.symbol, side: t.side, setup: t.setup, asset_type: t.assetType,
  qty: t.qty, entry: t.entry, exit: t.exit, risk: t.risk, date: t.date, status: t.status,
  adherence: t.adherence || 'Unknown', fees: t.fees || 0, net: t.net, gross: t.gross, mult: t.mult,
  move_pct: t.movePct, r: t.r, account: t.account, source: t.source, duration: t.duration,
  tags: t.tags || [], thesis: t.thesis, notes: t.notes, stop: t.stop, target: t.target,
  planned_rr: t.plannedRR, initial_risk: t.initialRisk, emotions: t.emotions, batch: t.batch,
  created_at: t.createdAt, updated_at: t.updatedAt,
});

/* ---------- reads ---------- */
export async function trades(sb) {
  return chk(await sb.from('trade').select('*').order('date', { ascending: false }).order('id', { ascending: false })).map(mapTrade);
}
export async function accounts(sb) {
  return chk(await sb.from('journal_account').select('id,name,door,kind,status,last,note').order('sort'));
}
export async function setups(sb) {
  return chk(await sb.from('setup').select('name').order('name')).map((r) => r.name);
}
export async function dayNotes(sb) {
  const o = {};
  for (const r of chk(await sb.from('day_note').select('day,note'))) o[r.day] = r.note;
  return o;
}
export async function reviews(sb) {
  return chk(await sb.from('review_note').select('id,title,body,created_at').order('created_at', { ascending: false }))
    .map((r) => ({ id: r.id, title: r.title, body: r.body, createdAt: r.created_at }));
}
export async function bundle(sb) {
  const [t, a, s, d, r] = await Promise.all([trades(sb), accounts(sb), setups(sb), dayNotes(sb), reviews(sb)]);
  return { trades: t, accounts: a, setups: s, dayNotes: d, reviews: r };
}

/* ---------- writes ---------- */
async function nextId(sb) {
  const data = chk(await sb.from('trade').select('id').like('id', 'TD-%').order('id', { ascending: false }).limit(1));
  const n = data[0] ? parseInt(data[0].id.slice(3), 10) : 1000;
  return 'TD-' + String(n + 1).padStart(4, '0');
}

export async function addTrade(sb, uid, input) {
  const now = new Date().toISOString();
  const t = deriveTrade({
    symbol: String(input.symbol || '').toUpperCase(), side: input.side === 'Short' ? 'Short' : 'Long',
    setup: input.setup || null, assetType: input.assetType || 'stock',
    qty: Number(input.qty) || 0, entry: Number(input.entry) || 0,
    exit: input.exit === '' || input.exit == null ? null : Number(input.exit),
    risk: input.risk != null && input.risk !== '' ? Number(input.risk) : null,
    stop: input.stop != null && input.stop !== '' ? Number(input.stop) : null,
    target: input.target != null && input.target !== '' ? Number(input.target) : null,
    fees: input.fees != null && input.fees !== '' ? Number(input.fees) : null,
    date: input.date || now.slice(0, 10), status: input.exit == null || input.exit === '' ? 'Open' : 'Closed',
    adherence: input.adherence || 'Unknown',
  });
  const full = {
    ...t, id: await nextId(sb), plannedRR: input.plannedRR != null ? Number(input.plannedRR) : 2,
    account: input.account || 'Manual / CSV', source: input.source || 'Manual entry',
    duration: input.duration != null ? Number(input.duration) : null, tags: input.tags || [],
    thesis: input.thesis || '', notes: input.notes || '', emotions: input.emotions || 'Unknown',
    batch: input.batch || null, createdAt: now, updatedAt: now,
  };
  return mapTrade(chk(await sb.from('trade').insert(toRow(full, uid)).select().single()));
}

export async function updateTrade(sb, id, patch) {
  const cur = chk(await sb.from('trade').select('*').eq('id', id).limit(1))[0];
  if (!cur) return null;
  const t = mapTrade(cur);
  if (patch.setup !== undefined) t.setup = patch.setup;
  if (patch.adherence !== undefined) t.adherence = patch.adherence;
  if (patch.emotions !== undefined) t.emotions = patch.emotions;
  if (patch.notes !== undefined) t.notes = patch.notes;
  if (patch.stop !== undefined) t.stop = patch.stop === '' || patch.stop == null ? null : Number(patch.stop);
  if (patch.target !== undefined) t.target = patch.target === '' || patch.target == null ? null : Number(patch.target);
  if (patch.fees !== undefined && patch.fees !== '' && patch.fees != null) t.fees = Number(patch.fees);
  const dir = t.side === 'Long' ? 1 : -1, mult = t.mult || 1;
  if (t.status === 'Closed') { t.gross = round((t.exit - t.entry) * t.qty * mult * dir); t.net = round(t.gross - t.fees); }
  t.initialRisk = t.stop != null ? round(Math.abs(t.entry - t.stop) * t.qty * mult) : null;
  t.r = t.initialRisk && t.status === 'Closed' ? round(t.net / t.initialRisk, 4) : null;
  t.updatedAt = new Date().toISOString();
  const upd = {
    setup: t.setup, adherence: t.adherence, emotions: t.emotions, notes: t.notes, stop: t.stop, target: t.target,
    fees: t.fees, net: t.net, gross: t.gross, initial_risk: t.initialRisk, r: t.r, updated_at: t.updatedAt,
  };
  return mapTrade(chk(await sb.from('trade').update(upd).eq('id', id).select().single()));
}

export async function saveDayNote(sb, uid, day, note) {
  if (note && note.trim()) {
    chk(await sb.from('day_note').upsert({ owner_id: uid, day, note, updated_at: new Date().toISOString() }, { onConflict: 'owner_id,day' }));
  } else {
    chk(await sb.from('day_note').delete().eq('day', day));
  }
  return { day, note: note || '' };
}

export async function addReview(sb, uid, input) {
  const id = 'rev-' + Date.now().toString(36);
  const r = chk(await sb.from('review_note').insert({ owner_id: uid, id, title: input.title || 'Review', body: input.body || '' }).select().single());
  return { id: r.id, title: r.title, body: r.body, createdAt: r.created_at };
}
export async function deleteReview(sb, id) { chk(await sb.from('review_note').delete().eq('id', id)); return { ok: true }; }

export async function importTrades(sb, uid, rows) {
  const batch = 'imp-' + Date.now().toString(36);
  let added = 0;
  for (const input of rows || []) { await addTrade(sb, uid, { ...input, source: input.source || 'File import', batch }); added++; }
  return { ok: true, added, batch };
}

// Seed (or re-seed) the signed-in account's demo workspace: clears their journal
// rows, then inserts the sample accounts, setups, trades and a day note.
export async function seedDemo(sb, uid) {
  for (const tbl of ['trade', 'journal_account', 'setup', 'day_note', 'review_note']) {
    chk(await sb.from(tbl).delete().eq('owner_id', uid));
  }
  const accts = [
    ['acc-alpaca', 'Alpaca — Paper', 'Broker connector', 'Alpaca', 'connected', 'T+1 · synced ' + todayISO(), 'Activities + orders API'],
    ['acc-ibkr', 'Interactive Brokers', 'Broker connector', 'IBKR Flex', 'not-connected', 'Reporting only — cannot trade or move funds', 'Flex Web Service'],
    ['acc-manual', 'Manual / CSV', 'File upload + manual', 'File', 'file', 'Column-mapping wizard', 'CSV · XLSX · broker exports'],
  ].map((a, i) => ({ owner_id: uid, id: a[0], name: a[1], door: a[2], kind: a[3], status: a[4], last: a[5], note: a[6], sort: i }));
  chk(await sb.from('journal_account').insert(accts));
  chk(await sb.from('setup').insert(SETUPS.map((name, i) => ({ owner_id: uid, id: String(i + 1), name }))));

  const rows = SEED_ROWS.map((x, i) => {
    const [symbol, side, setup, assetType, qty, entry, exit, risk, date, status, adherence] = x;
    const acct = (assetType === 'forex' || assetType === 'future') ? 'Interactive Brokers' : (i % 4 === 0) ? 'Manual / CSV' : 'Alpaca — Paper';
    const t = deriveTrade({ symbol, side, setup, assetType, qty, entry, exit, risk, date, status, adherence });
    return toRow({
      ...t, id: 'TD-' + String(1032 - i).padStart(4, '0'),
      account: acct, source: acct === 'Manual / CSV' ? 'File import (demo)' : 'Broker connector (demo)',
      duration: Math.round(12 + ((i * 17) % 250)), tags: i % 3 === 0 ? ['planned'] : i % 3 === 1 ? ['late entry'] : ['clean execution'],
      thesis: 'Illustrative thesis: waited for price to confirm the planned setup and respected the risk level.',
      notes: 'Demo note. Replace with your own trade observations.', plannedRR: 2, emotions: 'Focused', batch: 'seed',
      createdAt: date + 'T14:30:00Z', updatedAt: date + 'T20:00:00Z',
    }, uid);
  });
  chk(await sb.from('trade').insert(rows));
  chk(await sb.from('day_note').insert({ owner_id: uid, day: '2026-10-02', note: 'Chop; sized down and respected stops. Demo note.' }));
  return rows.length;
}

export async function reset(sb, uid) { return { ok: true, trades: await seedDemo(sb, uid) }; }

// Clear the account to a real, empty starting point: no trades, notes or reviews —
// just the setup categories and a single manual account, so the journal holds only
// what the trader adds or imports. (Loading the sample trades is a separate, explicit
// action.) This is how the Journal becomes the trader's own data, not a demo.
export async function clearWorkspace(sb, uid) {
  for (const tbl of ['trade', 'day_note', 'review_note', 'journal_account', 'setup']) {
    chk(await sb.from(tbl).delete().eq('owner_id', uid));
  }
  chk(await sb.from('journal_account').insert([{
    owner_id: uid, id: 'acc-manual', name: 'Manual / CSV', door: 'File upload + manual',
    kind: 'File', status: 'file', last: 'Add trades by hand or import a CSV', note: 'CSV · broker exports', sort: 0,
  }]));
  chk(await sb.from('setup').insert(SETUPS.map((name, i) => ({ owner_id: uid, id: String(i + 1), name }))));
  return { ok: true, cleared: true };
}

// Explicitly load the clearly-labelled sample trades (same as reset) — opt-in only.
export async function loadSamples(sb, uid) { return { ok: true, trades: await seedDemo(sb, uid) }; }
