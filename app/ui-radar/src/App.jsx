import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from './api.js';
import { getTheme, toggleTheme } from './theme.js';
import { filterStocks, sortStocks, presetValues, DEFAULT_FILTERS } from './lib.js';
import { Appbar, BottomNav, Footer, Toast } from './components.jsx';
import { Screener, Shortlist, StepPlaceholder } from './screens.jsx';

const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 700;

export default function App() {
  const [theme, setThemeState] = useState(getTheme());
  const [screen, setScreen] = useState('screener');
  const [stocks, setStocks] = useState([]);
  const [shortlist, setShortlist] = useState(() => new Set());
  const [visible, setVisible] = useState([]);
  const [filters, setFilters] = useState(() => structuredClone(DEFAULT_FILTERS));
  const [sort, setSort] = useState('score');
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);

  // Load the screener universe + the saved shortlist. The view renders all stocks
  // until the trader applies a filter, exactly like the prototype.
  useEffect(() => {
    api.bundle().then(({ stocks, shortlist }) => {
      setStocks(stocks);
      setVisible(stocks);
      setShortlist(new Set(shortlist));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const toast = (msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2300);
  };

  const onToggleTheme = () => setThemeState(toggleTheme());

  const nav = (id) => { setScreen(id); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  // Star → the persisted shortlist. Optimistic, then reconcile to the server's truth.
  const onToggleStar = (t) => {
    setShortlist((prev) => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });
    api.toggleShortlist(t)
      .then(({ saved }) => setShortlist((prev) => { const n = new Set(prev); saved ? n.add(t) : n.delete(t); return n; }))
      .catch(() => toast('Could not reach the server — shortlist not saved.'));
  };

  // filterStocks(): narrow once from the full universe; on mobile, fold the panel.
  const onApply = () => {
    setVisible(filterStocks(stocks, filters));
    if (isMobile()) setCollapsed(true);
  };

  // resetFilters(): defaults back, every stock visible again.
  const onReset = () => {
    setFilters(structuredClone(DEFAULT_FILTERS));
    setVisible(stocks);
  };

  // changePreset(): set this preset's score/rvol, then apply.
  const onChangePreset = (preset) => {
    const next = { ...filters, preset, ...(preset === 'Custom' ? {} : presetValues(preset)) };
    setFilters(next);
    setVisible(filterStocks(stocks, next));
  };

  const onLoadSaved = (preset) => onChangePreset(preset);

  const onToggleFilters = () => setCollapsed((c) => !c);

  // openStock(): remember the stock and open its analysis workspace.
  const onOpen = (t) => { setSelectedTicker(t); nav('analysis'); };

  // focusSearch(): nudge toward the list (kept as a view affordance).
  const onSearch = () => {
    document.getElementById('stocks')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Choose a stock card below to open its analysis.');
  };

  const visibleSorted = useMemo(() => sortStocks(visible, sort), [visible, sort]);
  const savedCards = useMemo(() => stocks.filter((s) => shortlist.has(s.t)), [stocks, shortlist]);

  return (
    <>
      <Appbar theme={theme} onToggleTheme={onToggleTheme} onSearch={onSearch} onToast={toast} />
      <main>
        {screen === 'screener' && (
          <Screener
            filters={filters} setFilters={setFilters} visibleSorted={visibleSorted} visibleCount={visible.length}
            sort={sort} setSort={setSort} shortlist={shortlist} selectedTicker={selectedTicker} screen={screen}
            collapsed={collapsed} loading={!loaded}
            onApply={onApply} onReset={onReset} onChangePreset={onChangePreset} onLoadSaved={onLoadSaved}
            onToggleFilters={onToggleFilters} onToggleStar={onToggleStar} onOpen={onOpen} onNav={nav} onToast={toast} />
        )}
        {screen === 'shortlist' && (
          <Shortlist saved={savedCards} shortlist={shortlist} onToggleStar={onToggleStar} onOpen={onOpen} onNav={nav} />
        )}
        {(screen === 'market' || screen === 'settings' || screen === 'analysis') && (
          <StepPlaceholder screen={screen} selectedTicker={selectedTicker} onNav={nav} />
        )}
        <Footer />
      </main>
      <BottomNav screen={screen} onNav={nav} />
      <Toast msg={toastMsg} />
    </>
  );
}
