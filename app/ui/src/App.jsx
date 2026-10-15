import React, { useEffect, useMemo, useState } from 'react';
import { stats, advanced, money, pct, fmt, lineChart, ring } from './lib.js';
import { Shell, Head, Btn, Panel, StatBand, FilterBar, demoBanner, TradesTable, AccountsPanel, Html } from './components.jsx';

const DEFAULT_FILTERS = { period: 'all', account: 'all', setup: 'all', symbol: '' };

function filtered(trades, f) {
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

function Overview({ data, filters, setFilters, onNav }) {
  const list = useMemo(() => filtered(data.trades, filters), [data.trades, filters]);
  const s = stats(list), a = advanced(list), open = list.filter(t => t.status === 'Open');

  const heroEq = (
    <section className="hero-eq">
      <div className="cap">
        <div><small>Net realized P&amp;L · selected period</small>
          <div className={'big ' + (s.sum >= 0 ? 'positive' : 'negative')}>{money(s.sum)}</div></div>
        <div className="delta"><div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>Win rate</div>
          <div className="num" style={{ fontSize: 19, fontWeight: 600 }}>{pct(s.winRate)}</div></div>
      </div>
      <Html html={lineChart(list, false)} />
    </section>
  );

  const ringsHtml = ring(s.winRate, 'Win rate', s.wins.length + ' won · ' + s.loss.length + ' lost', 'var(--brand)') +
    ring(s.c.length ? s.longN / s.c.length * 100 : 0, 'Long share', s.longN + ' long · ' + s.shortN + ' short', 'var(--violet)');

  const six = [
    { k: 'Net P&L', v: money(s.sum), f: 'Closed · after fees', cls: s.sum >= 0 ? 'positive' : 'negative' },
    { k: 'Win rate', v: pct(s.winRate), f: s.c.length + ' closed' },
    { k: 'Profit factor', v: s.pf === null ? '—' : fmt(s.pf, 2), f: 'Wins ÷ losses' },
    { k: 'Expectancy', v: money(s.expect), f: 'Per closed trade', cls: s.expect >= 0 ? 'positive' : 'negative' },
    { k: 'Payoff', v: s.payoff === null ? '—' : fmt(s.payoff, 2), f: 'Avg win ÷ avg loss' },
    { k: 'Max drawdown', v: money(a.mdd), f: 'Equity high-water', cls: a.mdd > 0 ? 'negative' : '' },
  ];
  const strip = [
    ['SQN', a.sqn === null ? '—' : fmt(a.sqn, 2), 'System quality'],
    ['Kelly', a.kelly === null ? '—' : fmt(a.kelly, 0) + '%', 'Suggested fraction'],
    ['Recovery', a.recovery === null ? '—' : fmt(a.recovery, 2), 'Net ÷ drawdown'],
    ['Consistency', a.consistency === null ? '—' : fmt(a.consistency, 0) + '%', 'Green days'],
    ['Streaks', '+' + a.maxW + ' / −' + a.maxL, 'Best win / loss run'],
  ];

  return (
    <>
      <Head title="See the full picture." desc="A clear view of your decisions, results and risk — every number computed in one place."
        actions={<Btn cls="ghost" onClick={() => onNav('trades')}>View all trades</Btn>} />
      <FilterBar filters={filters} accounts={data.accounts} setups={data.setups} onChange={setFilters} />
      {demoBanner}
      <div className="grid sectiongrid">
        {heroEq}
        <Panel title="Outcomes" desc="Win rate and long share"><div className="panelbody"><Html className="rings" html={ringsHtml} /></div></Panel>
      </div>
      <div style={{ margin: '16px 0' }}><StatBand items={six} /></div>
      <Panel title="Performance strip" desc="Quality, risk and streak measures over this sample">
        <div className="panelbody"><div className="strip">
          {strip.map(([l, v, sub]) => <div className="stripchip" key={l}><small>{l}</small><b>{v}</b><span className="sf">{sub}</span></div>)}
        </div></div>
      </Panel>
      <div className="grid sectiongrid" style={{ marginTop: 16 }}>
        <Panel title="Recent trades" desc="Latest activity · select a row to inspect"
          right={<button className="inline-link" onClick={() => onNav('trades')}>View all</button>}>
          <TradesTable list={list} limit={6} onRow={() => onNav('trades')} />
        </Panel>
        <Panel title="Where to look" desc="Insights tied to this filtered sample">
          <div className="panelbody">
            {s.loss.length > 0 && <div className="insight"><b>Review your largest losses</b><p>{s.loss.length} losing trades in this sample. Open any trade to review its plan, fees and notes — this is a demo sample, not a performance diagnosis.</p></div>}
            <div className="insight"><b>Check setup sample sizes</b><p>Compare setup results next to their trade counts before drawing conclusions. Small samples are not evidence of an edge.</p></div>
            <div className="insight"><b>Add a stop to every trade</b><p>R-multiple, capture and the verdict need a recorded initial risk. Trades without a stop show “—”, never a guessed R.</p></div>
          </div>
        </Panel>
      </div>
      <div className="grid sectiongrid">
        <AccountsPanel accounts={data.accounts} onNav={onNav} />
        <Panel title="Open positions" desc="Excluded from realized P&L">
          {open.length ? <div className="panelbody">{open.map(t => (
            <div className="minirow" key={t.id} style={{ cursor: 'pointer' }} onClick={() => onNav('trades')}>
              <div className="miniicon">{t.symbol.slice(0, 1)}</div>
              <div className="minimain"><b>{t.symbol} · {t.side}</b><small>{t.setup} · {t.account}</small></div>
              <div className="minivalue neutral">Open</div>
            </div>
          ))}</div> : <div className="empty">No open positions in this sample.</div>}
        </Panel>
      </div>
    </>
  );
}

function Stub({ page }) {
  return (
    <>
      <Head title={({ calendar: 'Your month, trade by trade.', time: 'When do you trade well?', risk: 'Respect the risk first.', stats: 'The numbers, grouped.', setups: 'Know the setup, not just the ticker.', trades: 'Every trade has a story.', import: 'Three ways in. One engine.', notes: 'Notes & reviews.', settings: 'Settings.', more: 'More.' }[page]) || 'Journal'}
        desc="This screen is being ported to the new front end next — the backend data it needs is already live." />
      <div className="empty"><b>Coming up next</b>Overview is done in the new React build; {page} follows, screen by screen, same design.</div>
    </>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState('overview');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('td-theme') || 'light'; } catch { return 'light'; } });

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    fetch('/api/journal/bundle', { headers: { accept: 'application/json' } })
      .then(r => r.json())
      .then(b => setData({ trades: b.trades || [], accounts: b.accounts || [], setups: b.setups || [], dayNotes: b.dayNotes || {} }))
      .catch(() => setData({ trades: [], accounts: [], setups: [], dayNotes: {} }));
  }, []);

  if (!data) return <div className="app"><main className="main"><div className="content"><div className="empty">Loading…</div></div></main></div>;

  const onNav = p => { setPage(p); window.scrollTo({ top: 0 }); };
  const onTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return (
    <Shell page={page} onNav={onNav} onTheme={onTheme} onNewTrade={() => onNav('import')}>
      {page === 'overview'
        ? <Overview data={data} filters={filters} setFilters={setFilters} onNav={onNav} />
        : <Stub page={page} />}
    </Shell>
  );
}
