import React from 'react';
import { StockCard, FilterPanel, FiltersToggle, presetTitle } from './components.jsx';

// Screener — the landing screen: the filter panel + the result cards.
export function Screener({ filters, setFilters, visibleSorted, visibleCount, sort, setSort, shortlist, selectedTicker, screen, collapsed, loading, onApply, onReset, onChangePreset, onLoadSaved, onToggleFilters, onToggleStar, onOpen, onNav, onToast }) {
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
          filters={filters} setFilters={setFilters} visibleCount={visibleCount} collapsed={collapsed}
          onApply={onApply} onReset={onReset} onChangePreset={onChangePreset} onLoadSaved={onLoadSaved} onToast={onToast} />
        <section className="panel results">
          <div className="results-top">
            <div>
              <h2 id="presetTitle">{presetTitle(filters.preset)}</h2>
              <p>Real-time-style demo opportunities with momentum and catalysts</p>
            </div>
            <div className="result-tools">
              <select id="sort" className="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="score">Sort: Score ↓</option>
                <option value="change">Sort: Change ↓</option>
                <option value="ticker">Sort: Ticker A–Z</option>
              </select>
            </div>
          </div>
          <div className="countline">
            <span id="resultCount">Results · {visibleSorted.length} stock{visibleSorted.length === 1 ? '' : 's'}</span>
            <span>Tap a stock to analyze →</span>
          </div>
          <div className="stocklist" id="stocks" aria-live="polite">
            {visibleSorted.length ? visibleSorted.map((s) => (
              <StockCard key={s.t} s={s} saved={shortlist.has(s.t)}
                selected={screen === 'analysis' && selectedTicker === s.t}
                onToggleStar={onToggleStar} onOpen={onOpen} />
            )) : loading ? (
              <div className="empty"><b>Loading the demo universe…</b>Reading the screener records from the API.</div>
            ) : (
              <div className="empty"><b>No demo stocks match these filters</b>Try lowering the minimum score or relative-volume filter, or reset your filters.</div>
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

// Screens that later Radar steps fill in. Honest about the incremental build; the
// page-head matches each screen's approved heading so the shell stays coherent.
const STEP = {
  market: { eyebrow: 'Broad-market context', h1: 'Market', subtitle: 'A structured view of major-index direction, market stage, final regime and sector leadership.', step: 'step C' },
  settings: { eyebrow: 'Your screening workspace', h1: 'Settings', subtitle: 'Manage your screening tools and their schedules.', step: 'step D' },
  analysis: { eyebrow: 'Analysis workspace', h1: 'Analysis', subtitle: 'Overview, Technical, CAN SLIM and Fundamentals for the selected stock.', step: 'steps E–F' },
};
export function StepPlaceholder({ screen, selectedTicker, onNav }) {
  const m = STEP[screen];
  return (
    <section id={screen} className="screen active">
      <div className="page-head">
        <div>
          <div className="eyebrow">{m.eyebrow}</div>
          <h1>{m.h1}{screen === 'analysis' && selectedTicker ? <span style={{ color: 'var(--muted)', fontWeight: 500 }}> · {selectedTicker}</span> : null}</h1>
          <p className="subtitle">{m.subtitle}</p>
        </div>
        <button className="ghost" onClick={() => onNav('screener')}>← Back to Screener</button>
      </div>
      <section className="panel results">
        <div className="empty">
          <b>Built in the next Radar step</b>
          This screen ({m.h1}) is reproduced from the approved prototype in {m.step}. The Screener and Shortlist are live now.
        </div>
      </section>
    </section>
  );
}
