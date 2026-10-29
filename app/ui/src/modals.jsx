import React, { useState } from 'react';
import { fmt, money, signed, fmtDate, ASSETS } from './lib.js';

const px = (v, lt = 2) => '$' + fmt(v, v < 10 ? 4 : lt);

/* ---------------------------------------------------- trade detail (view + edit) */
export function TradeDetailModal({ trade: t, setups, onClose, onSave }) {
  const [tab, setTab] = useState('Overview');
  const [f, setF] = useState({ setup: t.setup, adherence: t.adherence || 'Unknown', emotions: t.emotions || 'Focused', stop: t.stop ?? '', target: t.target ?? '', fees: t.fees ?? 0, notes: t.notes || '' });
  const open = t.status === 'Open';
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));

  return (
    <div className="modalback" onClick={e => { if (e.target.classList.contains('modalback')) onClose(); }}>
      <div className="modal">
        <div className="modalhead"><div><div className="mk">Trade record · {t.id}</div><h3>{t.symbol} · {t.side}</h3></div>
          <button className="iconbtn" aria-label="Close" onClick={onClose}>×</button></div>
        <div className="detailhero">
          <div><div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{fmtDate(t.date)} · {t.duration} min{open ? ' · Open position' : ''} · {ASSETS[t.assetType]}</div>
            <h2>{t.symbol} <span className="chip">{t.setup}</span></h2>
            <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{t.account} · {t.source}</div></div>
          <div style={{ textAlign: 'right' }}>
            <div className={'bigpnl ' + (open ? 'neutral' : t.net >= 0 ? 'positive' : 'negative')}>{open ? 'Open' : money(t.net)}</div>
            <div className="stat-f">{open ? 'Quote unavailable' : 'Net after ' + money(t.fees) + ' fees · ' + (t.movePct === null ? '' : signed(t.movePct, v => fmt(v, 2) + '% move'))}</div></div>
        </div>
        <div className="detailstats">
          <div className="detailstat"><small>Gross P&L</small><b className={t.gross >= 0 ? 'positive' : 'negative'}>{open ? '—' : money(t.gross)}</b></div>
          <div className="detailstat"><small>Realized R</small><b>{t.r === null ? 'Needs stop' : fmt(t.r, 2) + 'R'}</b></div>
          <div className="detailstat"><small>Initial risk</small><b>{t.initialRisk ? money(t.initialRisk) : '—'}</b></div>
          <div className="detailstat"><small>Quantity</small><b>{fmt(t.qty, t.qty < 10 ? 3 : 0)}{t.mult > 1 ? ' × ' + t.mult : ''}</b></div>
          <div className="detailstat"><small>Entry avg</small><b>{px(t.entry)}</b></div>
          <div className="detailstat"><small>Exit avg</small><b>{open ? '—' : px(t.exit)}</b></div>
        </div>
        <div className="tabs">{['Overview', 'Edit', 'Entry snapshot', 'Executions', 'History'].map(x =>
          <button key={x} className={tab === x ? 'active' : ''} onClick={() => setTab(x)}>{x}</button>)}</div>
        <div className="modalbody">
          {tab === 'Overview' && (<>
            <div className="kv">
              <div><small>Opened (UTC)</small><b className="n">{t.createdAt}</b></div>
              <div><small>Last updated (UTC)</small><b className="n">{t.updatedAt}</b></div>
              <div><small>Side</small><b>{t.side}</b></div>
              <div><small>Status</small><b>{t.status}</b></div>
              <div><small>Stop loss</small><b className="n">{t.stop ? px(t.stop) : '—'}</b></div>
              <div><small>Target</small><b className="n">{t.target ? px(t.target) : '—'}</b></div>
              <div><small>Planned reward:risk</small><b className="n">{t.plannedRR ? t.plannedRR.toFixed(1) + ':1' : '—'}</b></div>
              <div><small>Fees</small><b className="n">{money(t.fees)}</b></div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}><a className="btn ghost small" href={`/lab/?symbol=${encodeURIComponent(t.symbol)}`} target="_blank" rel="noreferrer">📈 Open {t.symbol} in TradeLab</a><span className="roflag">qp chart</span></div>
            <div className="notice" style={{ marginTop: 14 }}><b>Provenance:</b> source — {t.source || 'manual'}. The 📈 chart opens TradeLab's qp chart for this symbol. An entry-time snapshot and MAE/MFE need verified intraday bars and aren't captured yet — they show as unknown, never inferred.</div>
          </>)}
          {tab === 'Edit' && (<>
            <p className="stat-f">Setup, stop, target, fees and notes are editable on the page.</p>
            <div className="formgrid" style={{ marginTop: 10 }}>
              <div className="field"><label>Setup</label><select value={f.setup} onChange={e => set('setup', e.target.value)}>{setups.map(s => <option key={s}>{s}</option>)}</select></div>
              <div className="field"><label>Rule adherence</label><select value={f.adherence} onChange={e => set('adherence', e.target.value)}>{['Good', 'Average', 'Poor', 'Unknown'].map(x => <option key={x}>{x}</option>)}</select></div>
              <div className="field"><label>Stop</label><input type="number" step=".0001" value={f.stop} onChange={e => set('stop', e.target.value)} /></div>
              <div className="field"><label>Target</label><input type="number" step=".0001" value={f.target} onChange={e => set('target', e.target.value)} /></div>
              <div className="field"><label>Fees</label><input type="number" step=".01" value={f.fees} onChange={e => set('fees', e.target.value)} /></div>
              <div className="field"><label>Emotional state</label><select value={f.emotions} onChange={e => set('emotions', e.target.value)}>{['Focused', 'Confident', 'Anxious', 'FOMO', 'Frustrated', 'Tired', 'Unknown'].map(x => <option key={x}>{x}</option>)}</select></div>
            </div>
            <div className="field full" style={{ marginTop: 12 }}><label>Notes</label><textarea value={f.notes} onChange={e => set('notes', e.target.value)} /></div>
            <button className="btn primary" style={{ marginTop: 12 }} onClick={() => onSave(t.id, f)}>Save changes</button>
          </>)}
          {tab === 'Entry snapshot' && <div className="empty"><b>No entry-time snapshot yet</b>Capturing the price structure and market state as known at the entry minute needs verified intraday bars, which aren't wired in yet. When they are, MAE and MFE are measured between entry and exit — never inferred.</div>}
          {tab === 'Executions' && <div className="empty"><b>No execution ledger yet</b>Individual fills and events aren't captured yet; each trade is stored as a single round trip. A future import engine will carry executions and pair them flat-to-flat, FIFO.</div>}
          {tab === 'History' && (<><div className="kv">
            <div><small>Created</small><b className="n">{t.createdAt}</b></div>
            <div><small>Updated</small><b className="n">{t.updatedAt}</b></div>
            <div><small>Source</small><b>{t.source}</b></div>
            <div><small>Import batch</small><b className="n">{t.batch || '—'}</b></div>
          </div><p className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: 10 }}>A production audit history needs persisted, immutable change events. This preview stores the trade's created/updated stamps.</p></>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ new trade */
export function NewTradeModal({ setups, onClose, onAdd }) {
  const [f, setF] = useState({ symbol: '', side: 'Long', assetType: 'stock', qty: '', entry: '', exit: '', stop: '', target: '', fees: '', date: new Date().toISOString().slice(0, 10), setup: setups[0] || '', adherence: 'Good', notes: '' });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const submit = e => { e.preventDefault(); if (!f.symbol || !f.qty || !f.entry) return; onAdd(f); };
  return (
    <div className="modalback" onClick={e => { if (e.target.classList.contains('modalback')) onClose(); }}>
      <div className="modal">
        <div className="modalhead"><div><div className="mk">Journal · capture</div><h3>Add a trade</h3></div>
          <button className="iconbtn" aria-label="Close" onClick={onClose}>×</button></div>
        <div className="modalbody">
          <form id="newTradeForm" onSubmit={submit}>
            <div className="formgrid">
              <div className="field"><label>Symbol</label><input value={f.symbol} onChange={e => set('symbol', e.target.value)} placeholder="e.g. NVDA" /></div>
              <div className="field"><label>Side</label><select value={f.side} onChange={e => set('side', e.target.value)}><option>Long</option><option>Short</option></select></div>
              <div className="field"><label>Asset class</label><select value={f.assetType} onChange={e => set('assetType', e.target.value)}>{Object.entries(ASSETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="field"><label>Setup</label><select value={f.setup} onChange={e => set('setup', e.target.value)}>{setups.map(s => <option key={s}>{s}</option>)}</select></div>
              <div className="field"><label>Quantity</label><input type="number" step="any" value={f.qty} onChange={e => set('qty', e.target.value)} /></div>
              <div className="field"><label>Date</label><input type="date" value={f.date} onChange={e => set('date', e.target.value)} /></div>
              <div className="field"><label>Entry price</label><input type="number" step="any" value={f.entry} onChange={e => set('entry', e.target.value)} /></div>
              <div className="field"><label>Exit price <span className="muted">(blank = open)</span></label><input type="number" step="any" value={f.exit} onChange={e => set('exit', e.target.value)} /></div>
              <div className="field"><label>Stop</label><input type="number" step="any" value={f.stop} onChange={e => set('stop', e.target.value)} /></div>
              <div className="field"><label>Target</label><input type="number" step="any" value={f.target} onChange={e => set('target', e.target.value)} /></div>
              <div className="field"><label>Fees</label><input type="number" step="any" value={f.fees} onChange={e => set('fees', e.target.value)} placeholder="auto if blank" /></div>
              <div className="field"><label>Rule adherence</label><select value={f.adherence} onChange={e => set('adherence', e.target.value)}>{['Good', 'Average', 'Poor', 'Unknown'].map(x => <option key={x}>{x}</option>)}</select></div>
            </div>
            <div className="field full" style={{ marginTop: 12 }}><label>Notes</label><textarea value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="What was the plan? What did you see?" /></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button type="submit" className="btn primary">Add trade</button><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><span className="roflag" style={{ marginLeft: 'auto' }}>Saved to your workspace</span></div>
          </form>
        </div>
      </div>
    </div>
  );
}
