import React from 'react';
import { fmt, money, pct, fmtDate, ASSETS } from './lib.js';

// inject a self-contained SVG/HTML string (charts, rings) using the exact classes
export const Html = ({ tag = 'div', html, ...p }) =>
  React.createElement(tag, { ...p, dangerouslySetInnerHTML: { __html: html } });

const NAV_MAIN = [['overview', '◧', 'Overview'], ['calendar', '▦', 'Calendar'], ['time', '◴', 'Time'],
  ['risk', '△', 'Risk'], ['stats', '∑', 'Stats'], ['setups', '◇', 'Setups'], ['trades', '≡', 'Trades'], ['import', '↑', 'Import']];
const NAV_WORK = [['notes', '✎', 'Notes & reviews'], ['settings', '⚙', 'Settings']];
const MOBILE = [['overview', '◧', 'Overview'], ['calendar', '▦', 'Calendar'], ['trades', '≡', 'Trades'], ['import', '↑', 'Import'], ['more', '•••', 'More']];
export const CRUMB = { home: 'Trade-Disk home', overview: 'Journal overview', calendar: 'Calendar', time: 'Time', risk: 'Risk', stats: 'Stats', setups: 'Setups', trades: 'Trade ledger', import: 'Import', notes: 'Notes & reviews', settings: 'Settings', more: 'More' };

export function Shell({ page, onNav, onTheme, onNewTrade, children }) {
  const NavBtn = ([id, ico, label]) => (
    <button key={id} className={page === id ? 'active' : ''} onClick={() => onNav(id)}>
      <span className="ico">{ico}</span>{label}
    </button>
  );
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><div className="brandmark">◆</div><div><span className="bn">Trade-Disk</span><span className="bt">THE TRADING STATION</span></div></div>
        <button className="tohome" onClick={() => { window.location.href = '/'; }}>← Trade-Disk home</button>
        <div className="navlabel">Journal</div>
        <nav className="nav">{NAV_MAIN.map(NavBtn)}</nav>
        <div className="navlabel">Workspace</div>
        <nav className="nav">{NAV_WORK.map(NavBtn)}</nav>
        <div className="sidebottom">
          <div className="demo-note"><b>Demo workspace</b>Illustrative trades only. No broker is connected and no real performance is shown.</div>
          <div className="profile"><div className="avatar">TD</div><div><b>Trader workspace</b><small>Local demo · not synced</small></div></div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="crumb"><a className="crumb-home" href="/" title="Back to the Trading Station">◆ Station</a> <span className="muted">/</span> <b>{CRUMB[page] || 'Journal'}</b></div>
          <div className="topactions">
            <span className="livedot">Demo data</span>
            <button className="iconbtn" onClick={onTheme} title="Toggle light and dark theme" aria-label="Toggle theme">☀</button>
            <button className="btn primary" onClick={onNewTrade}>＋ New trade</button>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
      <nav className="mobilebottom">
        {MOBILE.map(([id, ico, label]) => (
          <button key={id} className={page === id ? 'active' : ''} onClick={() => onNav(id)}><span>{ico}</span>{label}</button>
        ))}
      </nav>
    </div>
  );
}

export const Head = ({ title, desc, actions }) => (
  <div className="pagehead">
    <div><h1>{title}</h1><p className="sub">{desc}</p></div>
    <div className="headactions">{actions}</div>
  </div>
);

export const Btn = ({ children, cls = '', onClick }) => <button className={'btn ' + cls} onClick={onClick}>{children}</button>;

export const Panel = ({ title, desc, right, children }) => (
  <section className="panel">
    <div className="panelhead"><div><div className="paneltitle">{title}</div>{desc != null && <div className="paneldesc">{desc}</div>}</div>{right}</div>
    {children}
  </section>
);

export const StatBand = ({ items }) => (
  <div className={'statband sb' + items.length}><div className="sbrow">
    {items.map((it, i) => (
      <div className="stat" key={i}>
        <div className="stat-k">{it.k}</div>
        <div className={'stat-v ' + (it.cls || '')}>{it.v}</div>
        <div className="stat-f">{it.f || ''}</div>
      </div>
    ))}
  </div></div>
);

const PERIODS = [['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['90d', 'Last 90 days'], ['ytd', 'Year to date'], ['all', 'All time']];
export function FilterBar({ filters, accounts, setups, onChange }) {
  const set = (k, v) => onChange({ ...filters, [k]: v });
  return (
    <div className="filters">
      <div className="filtergroup"><label>Period</label>
        <select value={filters.period} onChange={e => set('period', e.target.value)}>
          {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select></div>
      <div className="filtergroup"><label>Account</label>
        <select value={filters.account} onChange={e => set('account', e.target.value)}>
          <option value="all">All accounts</option>
          {accounts.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
        </select></div>
      <div className="filtergroup"><label>Setup</label>
        <select value={filters.setup} onChange={e => set('setup', e.target.value)}>
          <option value="all">All setups</option>
          {setups.map(s => <option key={s} value={s}>{s}</option>)}
        </select></div>
      <div className="filtergroup"><label>Symbol</label>
        <input placeholder="Any symbol" value={filters.symbol} onChange={e => set('symbol', e.target.value)} /></div>
      <div className="spacer"></div>
      <button className="btn ghost small" onClick={() => onChange({ period: 'all', account: 'all', setup: 'all', symbol: '' })}>Reset</button>
      <span className="status">Demo · not synced</span>
    </div>
  );
}

export const demoBanner = (
  <div className="notice"><b>Demo workspace.</b> Every figure on this screen is synthetic sample data for interface preview. No broker is connected; nothing here is a claim about real performance.</div>
);

const COLS = [['date', 'Date'], ['symbol', 'Symbol'], ['side', 'Side'], ['setup', 'Setup'], ['qty', 'Qty'], ['entry', 'Entry'], ['exit', 'Exit'], ['net', 'Net P&L'], ['movePct', '% move'], ['r', 'R'], ['status', 'Status']];
export function TradesTable({ list, limit = 200, clickable = true, sortKey = 'date', sortDir = -1, onSort, onRow }) {
  const items = [...list].sort((a, b) => {
    if (['net', 'r', 'qty', 'movePct'].includes(sortKey)) return sortDir * ((a[sortKey] || 0) - (b[sortKey] || 0));
    return sortDir * String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''));
  }).slice(0, limit);
  if (!items.length) return <div className="empty"><b>No trades match these filters</b>Try resetting the filters, or add a trade from the Import tab.</div>;
  return (
    <div className="tablewrap"><table className="table">
      <thead><tr>{COLS.map(([k, v]) => (
        <th key={k}><button onClick={() => onSort && onSort(k)}>{v}{sortKey === k ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}</button></th>
      ))}</tr></thead>
      <tbody>{items.map(t => (
        <tr key={t.id} className={clickable ? 'clickable' : ''} onClick={() => onRow && onRow(t)}>
          <td className="n">{fmtDate(t.date)}</td>
          <td><span className="sym">{t.symbol}</span><span className="subcell">{ASSETS[t.assetType]} · {t.id}</span></td>
          <td><span className={'tag ' + (t.side === 'Long' ? 'long' : 'short')}>{t.side}</span></td>
          <td>{t.setup}</td>
          <td className="n">{fmt(t.qty, t.qty < 10 ? 3 : 0)}</td>
          <td className="n">${fmt(t.entry, t.entry < 10 ? 4 : 2)}</td>
          <td className="n">{t.exit === null ? '—' : '$' + fmt(t.exit, t.exit < 10 ? 4 : 2)}</td>
          <td className={'n ' + (t.status === 'Open' ? 'neutral' : t.net >= 0 ? 'positive' : 'negative')}>{t.status === 'Open' ? 'Open' : money(t.net)}</td>
          <td className={'n ' + (t.movePct === null ? 'neutral' : t.movePct >= 0 ? 'positive' : 'negative')}>{t.movePct === null ? '—' : (t.movePct > 0 ? '+' : '−') + fmt(Math.abs(t.movePct), 2) + '%'}</td>
          <td className="n">{t.r === null ? '—' : fmt(t.r, 2) + 'R'}</td>
          <td><span className={'tag ' + (t.status === 'Open' ? 'warn' : 'good')}>{t.status}</span></td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

export function AccountsPanel({ accounts, onNav }) {
  return (
    <Panel title="Accounts & connectors" desc="Read-only broker connectors and file sources — each account keeps its trades apart">
      <div className="panelbody">
        {accounts.map(a => {
          const cls = a.status === 'connected' ? 'good' : a.status === 'file' ? 'info' : 'warn';
          const label = a.status === 'connected' ? 'Connected · read-only' : a.status === 'file' ? 'File / manual' : 'Not connected';
          return (
            <div className="conncard" key={a.id || a.name}>
              <div className="miniicon">{a.kind === 'File' ? '↑' : '◎'}</div>
              <div className="cmeta"><b>{a.name}</b><small>{a.door} · {a.note}</small></div>
              <div style={{ textAlign: 'right' }}><span className={'tag ' + cls}>{label}</span><div className="stat-f" style={{ marginTop: 4 }}>{a.last}</div></div>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button className="btn ghost small" onClick={() => onNav && onNav('import')}>Manage in Import</button>
          <button className="btn ghost small">Sync now</button>
          <span className="roflag">Read-only — no credential that can trade</span>
        </div>
      </div>
    </Panel>
  );
}
