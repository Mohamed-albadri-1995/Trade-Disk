import React from 'react';
import { StockCard, FilterPanel, FiltersToggle, presetTitle } from './components.jsx';

// Screener — the landing screen: the filter panel + the result cards.
export function Screener({ filters, setFilters, visibleSorted, visibleCount, screeners, scanInfo, sort, setSort, shortlist, selectedTicker, screen, collapsed, loading, onApply, onReset, onChangePreset, onLoadSaved, onRunScan, onToggleFilters, onToggleStar, onOpen, onNav, onToast }) {
  const current = (screeners || []).find((s) => s.key === filters.preset);
  const matched = scanInfo && Number.isFinite(scanInfo.totalCount) ? scanInfo.totalCount : null;
  return (
    <section id="screener" className="screen active">
      <div className="page-head">
        <div>
          <div className="eyebrow">Market discovery</div>
          <h1>Screener</h1>
          <p className="subtitle">Scan, compare and shortlist stocks with strong momentum.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button className="ghost" onClick={() => onNav('shortlist')}>☆ Shortlist</button>
          <button className="ghost" onClick={() => onNav('market')}>◉ Market</button>
          <span className="tag">✦ Approved screener layout</span>
        </div>
      </div>
      <FiltersToggle checks={filters.checks} collapsed={collapsed} onToggle={onToggleFilters} />
      <div className="layout">
        <FilterPanel
          filters={filters} setFilters={setFilters} visibleCount={visibleCount} collapsed={collapsed} screeners={screeners}
          onApply={onApply} onReset={onReset} onChangePreset={onChangePreset} onLoadSaved={onLoadSaved} onToast={onToast} />
        <section className="panel results">
          <div className="results-top">
            <div>
              <h2 id="presetTitle">{current ? current.name : 'Screener'}</h2>
              <p>{scanInfo?.error ? scanInfo.error : (current?.note || 'Live market screener')}</p>
            </div>
            <div className="result-tools">
              <button className="secondary-btn" onClick={onRunScan} disabled={loading}
                title="Run this screener against the live feed right now">
                {loading ? 'Scanning…' : '↻ Run scan'}
              </button>
              <select id="sort" className="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="score">Sort: Score ↓</option>
                <option value="change">Sort: Change ↓</option>
                <option value="ticker">Sort: Ticker A–Z</option>
              </select>
            </div>
          </div>
          <div className="countline">
            <span id="resultCount">Results · {visibleSorted.length} stock{visibleSorted.length === 1 ? '' : 's'}{matched != null && matched > visibleSorted.length ? ` · ${matched} matched` : ''}</span>
            <span>Tap a stock to analyze →</span>
          </div>
          <div className="stocklist" id="stocks" aria-live="polite">
            {visibleSorted.length ? visibleSorted.map((s) => (
              <StockCard key={s.t} s={s} saved={shortlist.has(s.t)}
                selected={screen === 'analysis' && selectedTicker === s.t}
                onToggleStar={onToggleStar} onOpen={onOpen} />
            )) : loading ? (
              <div className="empty"><b>Scanning the market…</b>Running {current ? current.name : 'the screener'} against the live feed.</div>
            ) : (
              <div className="empty"><b>No matches right now</b>{scanInfo?.error ? scanInfo.error : 'This screener found nothing at the moment — try another screener, or check back when the market is active.'}</div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

// Shortlist — the starred stocks. Wired to the persisted shortlist, not the
// prototype's in-memory set, but the view is identical.
export function Shortlist({ saved, shortlist, onToggleStar, onOpen, onNav }) {
  return (
    <section id="shortlist" className="screen active">
      <div className="page-head">
        <div>
          <div className="eyebrow">Your saved candidates</div>
          <h1>Shortlist</h1>
          <p className="subtitle">Keep an eye on stocks you want to review. Tap any stock to open its analysis.</p>
        </div>
        <span className="tag">Saved locally in this prototype</span>
      </div>
      <section className="panel results">
        <div className="results-top">
          <div>
            <h2>Shortlisted stocks</h2>
            <p>Use the star on any stock to add or remove it.</p>
          </div>
          <button className="ghost" onClick={() => onNav('screener')}>← Back to Screener</button>
        </div>
        <div id="shortlistStocks" className="stocklist">
          {saved.length ? saved.map((s) => (
            <StockCard key={s.t} s={s} saved variant="shortlist" onToggleStar={onToggleStar} onOpen={onOpen} />
          )) : (
            <div className="shortlist-empty"><strong>Your shortlist is empty</strong>Use the ☆ beside any ticker in the Screener to save it here.</div>
          )}
        </div>
      </section>
    </section>
  );
}

