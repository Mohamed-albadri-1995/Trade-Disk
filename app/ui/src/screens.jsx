import React from 'react';
import { fmt, money, pct, fmtDate, dateISO, ASSETS, stats, advanced, filtered, hbars, histogram } from './lib.js';
import { Head, Btn, Panel, StatBand, FilterBar, demoBanner, TradesTable, AccountsPanel, Html } from './components.jsx';

const Filters = ({ ctx }) => <FilterBar filters={ctx.filters} accounts={ctx.data.accounts} setups={ctx.data.setups} onChange={ctx.setFilters} />;

/* ------------------------------------------------------------------ TRADES */
export function Trades({ ctx }) {
  let list = filtered(ctx.data.trades, ctx.filters);
  if (ctx.tradeQuery) {
    const q = ctx.tradeQuery.toLowerCase();
    list = list.filter(t => [t.symbol, t.id, t.setup, t.side, t.status, t.account, ...(t.tags || [])].join(' ').toLowerCase().includes(q));
  }
  if (ctx.tradeTab === 'Open positions') list = list.filter(t => t.status === 'Open');
  if (ctx.tradeTab === 'Needs review') list = list.filter(t => t.adherence === 'Poor' || t.adherence === 'Unknown');
  const s = stats(list);
  return (
    <>
      <Head title="Every trade has a story." desc="Search, filter and inspect each trade from entry plan to realized result. The accounts and connectors panel sits above the ledger."
        actions={<Btn cls="primary" onClick={() => ctx.onNav('import')}>＋ Add / import</Btn>} />
      <Filters ctx={ctx} />
      <AccountsPanel accounts={ctx.data.accounts} onNav={ctx.onNav} />
      <div style={{ margin: '16px 0' }}>
        <StatBand items={[
          { k: 'Matched', v: list.length, f: 'After filters' },
          { k: 'Net P&L', v: money(s.sum), f: 'Closed only', cls: s.sum >= 0 ? 'positive' : 'negative' },
          { k: 'Win rate', v: pct(s.winRate), f: 'Closed denominator' },
          { k: 'Open', v: list.filter(t => t.status === 'Open').length, f: 'Unrealized separate' },
          { k: 'Needs review', v: list.filter(t => t.adherence === 'Poor' || t.adherence === 'Unknown').length, f: 'Markers illustrative' },
        ]} />
      </div>
      <section className="panel widepanel">
        <div className="panelhead">
          <div><div className="paneltitle">Trade ledger</div><div className="paneldesc">Choose a trade to open its record, risk, notes and chart link.</div></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="searchbox" placeholder="Search symbol, setup, account, ID…" value={ctx.tradeQuery} onChange={e => ctx.setTradeQuery(e.target.value)} />
            <button className="btn ghost small">Export CSV</button>
          </div>
        </div>
        <div className="tabs">
          {['All trades', 'Open positions', 'Needs review'].map(t => (
            <button key={t} className={ctx.tradeTab === t ? 'active' : ''} onClick={() => ctx.setTradeTab(t)}>{t}</button>
          ))}
        </div>
        <TradesTable list={list} limit={200} sortKey={ctx.sort.key} sortDir={ctx.sort.dir}
          onSort={k => ctx.setSort(s => ({ key: k, dir: s.key === k ? -s.dir : -1 }))} onRow={() => { }} />
        <div className="tablefoot"><span>{list.length} records · synthetic demo data</span><span>Net P&L excludes open positions · % move signed by direction</span></div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------- STATS */
export function Stats({ ctx }) {
  const list = filtered(ctx.data.trades, ctx.filters), s = stats(list);
  const syms = [...new Set(list.map(t => t.symbol))].map(sym => ({ sym, ...stats(list.filter(t => t.symbol === sym)) })).sort((a, b) => b.sum - a.sum);
  const assetRows = Object.keys(ASSETS).map(k => ({ k, ...stats(list.filter(t => t.assetType === k)) })).filter(r => r.c.length);
  const groups = [
    ['Performance', [['Net P&L', money(s.sum)], ['Profit factor', s.pf === null ? '—' : fmt(s.pf, 2)], ['Expectancy', money(s.expect)], ['Average R', s.avgR === null ? '—' : fmt(s.avgR, 2) + 'R']]],
    ['Trade', [['Closed trades', s.c.length], ['Winners', s.wins.length], ['Losers', s.loss.length], ['Breakeven', s.be]]],
    ['Cost', [['Fees paid', money(s.fees)], ['Avg win', money(s.avgWin)], ['Avg loss', money(-s.avgLoss)], ['Payoff', s.payoff === null ? '—' : fmt(s.payoff, 2)]]],
    ['Volume', [['Total units', fmt(s.c.reduce((a, t) => a + t.qty, 0), 0)], ['Avg units/trade', fmt(s.c.length ? s.c.reduce((a, t) => a + t.qty, 0) / s.c.length : 0, 1)], ['Symbols', syms.length], ['Accounts', new Set(list.map(t => t.account)).size]]],
  ];
  return (
    <>
      <Head title="The numbers, grouped." desc="Performance, trade, cost and volume groups, a by-asset-class breakdown, and the symbols with the largest net P&L." />
      <Filters ctx={ctx} />
      <div className="grid twocol">
        {groups.map(([title, rows]) => (
          <Panel key={title} title={title} desc="Closed trades · selected filters">
            <div className="panelbody"><div className="kv">
              {rows.map(([k, v]) => <div key={k}><small>{k}</small><b className="n">{v}</b></div>)}
            </div></div>
          </Panel>
        ))}
      </div>
      <Panel title="By asset class" desc="Per-class multipliers applied">
        <div className="tablewrap"><table className="table">
          <thead><tr><th>Asset class</th><th>Closed</th><th>Net P&L</th><th>Win rate</th><th>Profit factor</th></tr></thead>
          <tbody>{assetRows.length ? assetRows.map(r => (
            <tr key={r.k}><td><b>{ASSETS[r.k]}</b></td><td className="n">{r.c.length}</td>
              <td className={'n ' + (r.sum >= 0 ? 'positive' : 'negative')}>{money(r.sum)}</td>
              <td className="n">{pct(r.winRate)}</td><td className="n">{r.pf === null ? '—' : fmt(r.pf, 2)}</td></tr>
          )) : <tr><td colSpan="5"><div className="empty">No closed trades.</div></td></tr>}</tbody>
        </table></div>
      </Panel>
      <section className="panel widepanel" style={{ marginTop: 16 }}>
        <div className="panelhead"><div><div className="paneltitle">Symbols by net P&L</div><div className="paneldesc">Largest contributors first · closed trades</div></div></div>
        <div className="tablewrap"><table className="table">
          <thead><tr><th>Symbol</th><th>Trades</th><th>Net P&L</th><th>Win rate</th><th>Profit factor</th><th>Avg R</th></tr></thead>
          <tbody>{syms.length ? syms.map(x => (
            <tr key={x.sym}><td><b>{x.sym}</b></td><td className="n">{x.c.length}</td>
              <td className={'n ' + (x.sum >= 0 ? 'positive' : 'negative')}>{money(x.sum)}</td>
              <td className="n">{pct(x.winRate)}</td><td className="n">{x.pf === null ? '—' : fmt(x.pf, 2)}</td>
              <td className="n">{x.avgR === null ? '—' : fmt(x.avgR, 2) + 'R'}</td></tr>
          )) : <tr><td colSpan="6"><div className="empty">No trades.</div></td></tr>}</tbody>
        </table></div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ SETUPS */
export function Setups({ ctx }) {
  const list = filtered(ctx.data.trades, ctx.filters);
  return (
    <>
      <Head title="Know the setup, not just the ticker." desc="Per-setup statistics over closed trades with an R, and the conditions recorded at entry."
        actions={<Btn cls="ghost" onClick={() => ctx.onNav('trades')}>Review trades</Btn>} />
      <Filters ctx={ctx} />
      <div className="notice"><b>Condition data is not fabricated.</b> This demo has no verified entry-time snapshots, so alignment shows as unknown, never assumed. Setups with fewer than three closed trades are flagged as small samples.</div>
      <div className="grid twocol">
        {ctx.data.setups.map((name, i) => {
          const sl = list.filter(t => t.setup === name), st = stats(sl), small = st.c.length < 3;
          return (
            <section className="panel" key={name}>
              <div className="panelhead"><div><div className="paneltitle">{name}</div><div className="paneldesc">{sl.length} trades · {st.c.length} closed</div></div><span className="chip">Setup {String.fromCharCode(65 + i)}</span></div>
              <div className="panelbody">
                <div className="statband sb2" style={{ marginBottom: 14 }}><div className="sbrow">
                  <div className="stat"><div className="stat-k">Net P&L</div><div className={'stat-v ' + (st.sum >= 0 ? 'positive' : 'negative')} style={{ fontSize: 20 }}>{money(st.sum)}</div></div>
                  <div className="stat"><div className="stat-k">Win rate</div><div className="stat-v" style={{ fontSize: 20 }}>{pct(st.winRate)}</div></div>
                </div></div>
                <div className="kv">
                  <div><small>Profit factor</small><b className="n">{st.pf === null ? '—' : fmt(st.pf, 2)}</b></div>
                  <div><small>Average R</small><b className="n">{st.avgR === null ? '—' : fmt(st.avgR, 2) + 'R'}</b></div>
                  <div><small>Expectancy</small><b className="n">{money(st.expect)}</b></div>
                  <div><small>Entry conditions</small><b>Unknown</b></div>
                </div>
                {small && <div className="tag warn" style={{ marginTop: 12 }}>Small sample — not reliable evidence</div>}
                <button className="btn ghost small" style={{ marginTop: 12 }} onClick={() => { ctx.setFilters({ ...ctx.filters, setup: name }); ctx.onNav('trades'); }}>View matching trades</button>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- CALENDAR */
export function Calendar({ ctx }) {
  const list = filtered(ctx.data.trades, ctx.filters);
  const m = ctx.calMonth.getMonth(), year = ctx.calMonth.getFullYear();
  const first = new Date(year, m, 1).getDay(), days = new Date(year, m + 1, 0).getDate(), prev = new Date(year, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    let day, dt, other = false;
    if (i < first) { day = prev - first + i + 1; dt = new Date(year, m - 1, day); other = true; }
    else if (i >= first + days) { day = i - first - days + 1; dt = new Date(year, m + 1, day); other = true; }
    else { day = i - first + 1; dt = new Date(year, m, day); }
    const key = dateISO(dt), ts = list.filter(t => t.date === key && t.status === 'Closed'), sum = ts.reduce((a, t) => a + t.net, 0), op = list.some(t => t.date === key && t.status === 'Open');
    cells.push(
      <button className={'day ' + (other ? 'mutedday ' : '') + (ctx.selectedDay === key ? 'selected' : '')} key={i} onClick={() => ctx.setSelectedDay(key)}>
        <span className="daynum">{day}</span>
        {ts.length > 0 && <><span className={'daypnl ' + (sum >= 0 ? 'positive' : 'negative')}>{(sum < 0 ? '−' : '') + '$' + fmt(Math.abs(sum), 0)}</span><span className="daycount">{ts.length} trade{ts.length === 1 ? '' : 's'}</span></>}
        {op && <span className="daycount">● Open</span>}
      </button>
    );
  }
  const chosen = list.filter(t => t.date === ctx.selectedDay), dnet = chosen.reduce((a, t) => a + (t.status === 'Closed' ? t.net : 0), 0);
  return (
    <>
      <Head title="Your month, trade by trade." desc="Daily realized net P&L and counts, weekends kept. Times are shown in New York."
        actions={<Btn cls="ghost" onClick={() => ctx.setCalMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</Btn>} />
      <Filters ctx={ctx} />
      <div className="grid sectiongrid">
        <Panel title={ctx.calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} desc="Daily realized net P&L · open positions marked separately"
          right={<div style={{ display: 'flex', gap: 6 }}>
            <button className="iconbtn" aria-label="Previous month" onClick={() => ctx.setCalMonth(new Date(year, m - 1, 1))}>‹</button>
            <button className="iconbtn" aria-label="Next month" onClick={() => ctx.setCalMonth(new Date(year, m + 1, 1))}>›</button>
          </div>}>
          <div className="calendar">
            <div className="calhead">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(x => <div key={x}>{x}</div>)}</div>
            <div className="calgrid">{cells}</div>
          </div>
        </Panel>
        <Panel title="Day review" desc={fmtDate(ctx.selectedDay)}>
          <div className="panelbody">
            <div className="statband sb2" style={{ marginBottom: 14 }}><div className="sbrow">
              <div className="stat"><div className="stat-k">Net P&L</div><div className={'stat-v ' + (dnet >= 0 ? 'positive' : 'negative')}>{money(dnet)}</div></div>
              <div className="stat"><div className="stat-k">Closed</div><div className="stat-v">{chosen.filter(t => t.status === 'Closed').length}</div></div>
            </div></div>
            {chosen.length ? chosen.map(t => (
              <div className="minirow" key={t.id} style={{ cursor: 'pointer' }} onClick={() => ctx.onNav('trades')}>
                <div className="miniicon">{t.symbol.slice(0, 1)}</div>
                <div className="minimain"><b>{t.symbol} · {t.side}</b><small>{t.setup} · {t.status}</small></div>
                <div className={'minivalue ' + (t.status === 'Open' ? 'neutral' : t.net >= 0 ? 'positive' : 'negative')}>{t.status === 'Open' ? 'Open' : money(t.net)}</div>
              </div>
            )) : <div className="empty"><b>No trades on this date</b>Use a day note to record your plan or review.</div>}
            <div style={{ marginTop: 16 }}><div className="field"><label>Daily plan / review note</label>
              <textarea placeholder="What was the plan? What did you learn?" defaultValue={ctx.data.dayNotes[ctx.selectedDay] || ''} /></div>
              <button className="btn primary small" style={{ marginTop: 10 }}>Save day note</button></div>
          </div>
        </Panel>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------- TIME */
export function Time({ ctx }) {
  const list = filtered(ctx.data.trades, ctx.filters), closed = list.filter(t => t.status === 'Closed');
  const wk = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => ({ label: d, value: 0 }));
  closed.forEach(t => { wk[new Date(t.date + 'T12:00:00').getDay()].value += t.net; });
  const priceBuckets = [['<$50', 0, 50], ['$50–150', 50, 150], ['$150–400', 150, 400], ['≥$400', 400, 1e9]].map(([label, lo, hi]) => ({ label, value: closed.filter(t => t.entry >= lo && t.entry < hi).reduce((a, t) => a + t.net, 0) }));
  const sizeBuckets = [['1–10', 1, 10], ['10–50', 10, 50], ['50–150', 50, 150], ['150+', 150, 1e9]].map(([label, lo, hi]) => ({ label, value: closed.filter(t => t.qty >= lo && t.qty < hi).reduce((a, t) => a + t.net, 0) }));
  const winners = closed.filter(t => t.net > 0), losers = closed.filter(t => t.net < 0);
  const med = arr => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  return (
    <>
      <Head title="When do you trade well?" desc="Net P&L by weekday, entry price and position size; plus hold time." />
      <Filters ctx={ctx} />
      <div className="notice info"><b>Entry hour &amp; session need timestamps.</b> This sample stores dates, not intraday entry times, so hour-of-day and session analysis are shown as unavailable rather than invented. Weekday, price and size use the data on hand.</div>
      <div className="grid twocol">
        <Panel title="Net P&L by weekday" desc="Closed trades"><div className="panelbody"><Html html={hbars(wk.map(w => ({ label: w.label, value: w.value, fmt: v => money(v) })))} /></div></Panel>
        <Panel title="Entry hour & session" desc="Timezone-aware grouping"><div className="panelbody"><div className="empty"><b>Unavailable in demo</b>Needs exact entry timestamps and the chosen display timezone, including DST and overnight sessions.</div></div></Panel>
      </div>
      <div className="grid twocol">
        <Panel title="Net P&L by entry price" desc="Closed trades"><div className="panelbody"><Html html={hbars(priceBuckets.map(b => ({ ...b, fmt: v => money(v) })))} /></div></Panel>
        <Panel title="Net P&L by position size" desc="Closed trades"><div className="panelbody"><Html html={hbars(sizeBuckets.map(b => ({ ...b, fmt: v => money(v) })))} /></div></Panel>
      </div>
      <div className="grid twocol">
        <Panel title="Hold time" desc="Minutes · closed positions"><div className="panelbody">
          <div className="kv">
            <div><small>Median — winners</small><b className="n">{fmt(med(winners.map(t => t.duration)), 0)} min</b></div>
            <div><small>Median — losers</small><b className="n">{fmt(med(losers.map(t => t.duration)), 0)} min</b></div>
            <div><small>Shortest</small><b className="n">{fmt(Math.min(...closed.map(t => t.duration).concat(0)), 0)} min</b></div>
            <div><small>Longest</small><b className="n">{fmt(Math.max(0, ...closed.map(t => t.duration)), 0)} min</b></div>
          </div><p className="stat-f" style={{ marginTop: 8 }}>Durations are illustrative in this demo.</p>
        </div></Panel>
        <Panel title="Winners vs losers" desc="Closed trades"><div className="panelbody">
          <div style={{ height: 9, borderRadius: 99, overflow: 'hidden', background: 'var(--panel-2)', display: 'flex', margin: '4px 0 8px' }}>
            <span style={{ background: 'var(--pos)', width: (closed.length ? winners.length / closed.length * 100 : 0) + '%' }}></span>
            <span style={{ background: 'var(--neg)', flex: 1 }}></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 'var(--fs-sm)' }}><span>{winners.length} winners</span><span>{losers.length} losers</span></div>
        </div></Panel>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------- RISK */
export function Risk({ ctx }) {
  const list = filtered(ctx.data.trades, ctx.filters), s = stats(list), a = advanced(list);
  const rbuckets = [['≤−2R', -99, -2], ['−2…−1', -2, -1], ['−1…0', -1, 0], ['0…1', 0, 1], ['1…2', 1, 2], ['≥2R', 2, 99]].map(([label, lo, hi]) => ({ label, count: s.rs.filter(r => r > lo && r <= hi).length, neg: hi <= 0 }));
  const pls = s.c.map(t => t.net);
  const plbuckets = (() => { if (!pls.length) return []; const mn = Math.min(...pls), mx = Math.max(...pls), step = (mx - mn) / 6 || 1; return Array.from({ length: 6 }, (_, i) => { const lo = mn + i * step, hi = lo + step; return { label: '$' + fmt(lo, 0), count: pls.filter(v => v >= lo && (i === 5 ? v <= hi : v < hi)).length, neg: hi <= 0 }; }); })();
  const riskTrades = list.filter(t => t.initialRisk > 0);
  return (
    <>
      <Head title="Respect the risk first." desc="The risk snapshot, the R-multiple distribution and the P&L distribution." />
      <Filters ctx={ctx} />
      <StatBand items={[
        { k: 'Initial risk at work', v: money(riskTrades.reduce((a, t) => a + t.initialRisk, 0)), f: riskTrades.length + ' of ' + list.length + ' carry a stop' },
        { k: 'Average R', v: s.avgR === null ? '—' : fmt(s.avgR, 2) + 'R', f: 'Blank with no stop', cls: (s.avgR || 0) >= 0 ? 'positive' : 'negative' },
        { k: 'MAE / MFE', v: 'Unknown', f: 'Needs time-valid bars' },
      ]} />
      <div className="grid twocol" style={{ marginTop: 16 }}>
        <Panel title="R-multiple distribution" desc="Closed trades with valid initial risk"><div className="panelbody">
          {s.rs.length ? <Html html={histogram(rbuckets)} /> : <div className="empty">No trades with a recorded stop in this sample.</div>}
        </div></Panel>
        <Panel title="P&L distribution" desc="Closed trades"><div className="panelbody">
          {plbuckets.length ? <Html html={histogram(plbuckets)} /> : <div className="empty">No closed trades.</div>}
        </div></Panel>
      </div>
      <Panel title="Risk strip" desc="Drawdown and sizing measures"><div className="panelbody">
        <div className="strip">
          <div className="stripchip"><small>Max drawdown</small><b className="negative">{money(a.mdd)}</b><span className="sf">Equity order</span></div>
          <div className="stripchip"><small>Recovery</small><b>{a.recovery === null ? '—' : fmt(a.recovery, 2)}</b><span className="sf">Net ÷ DD</span></div>
          <div className="stripchip"><small>SQN</small><b>{a.sqn === null ? '—' : fmt(a.sqn, 2)}</b><span className="sf">System quality</span></div>
          <div className="stripchip"><small>Kelly</small><b>{a.kelly === null ? '—' : fmt(a.kelly, 0) + '%'}</b><span className="sf">Suggested</span></div>
          <div className="stripchip"><small>Worst loss run</small><b className="negative">−{a.maxL}</b><span className="sf">Trades</span></div>
        </div>
        <p className="stat-f" style={{ marginTop: 12 }}>R multiples are only meaningful when initial risk is valid and positive.</p>
      </div></Panel>
    </>
  );
}
