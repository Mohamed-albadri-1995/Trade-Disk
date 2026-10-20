import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from './api.js';
import { getTheme, toggleTheme } from './theme.js';
import { filterStocks, sortStocks, presetValues, DEFAULT_FILTERS } from './lib.js';
import { Appbar, BottomNav, Footer, Toast } from './components.jsx';
import { Screener, Shortlist } from './screens.jsx';
import { Market } from './market.jsx';
import { Settings } from './settings.jsx';
import { Analysis } from './analysis.jsx';

const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 700;

export default function App() {
  const [theme, setThemeState] = useState(getTheme());
  const [screen, setScreen] = useState('screener');
  const [stocks, setStocks] = useState([]);
  const [shortlist, setShortlist] = useState(() => new Set());
  const [market, setMarket] = useState(null);
  const [feed, setFeed] = useState(null);
  const [screeners, setScreeners] = useState([]);
  const [scanInfo, setScanInfo] = useState(null);
  const [visible, setVisible] = useState([]);
  const [filters, setFilters] = useState(() => structuredClone(DEFAULT_FILTERS));
  const [sort, setSort] = useState('score');
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);

  // Load the available screeners + the saved shortlist. In Personal mode we run the
  // first screener live (TradingView) so the view opens on real market results; in
  // Commercial mode (no licensed engine yet) we fall back to the seeded demo set.
  useEffect(() => {
    api.bundle().then(({ stocks, shortlist, feed, screeners }) => {
      setShortlist(new Set(shortlist));
      setFeed(feed);
      setScreeners(screeners || []);
      const firstKey = screeners?.[0]?.key;
      if (firstKey) setFilters((f) => ({ ...f, preset: firstKey }));
      if (feed?.mode === 'personal' && firstKey) {
        runScan(firstKey);
      } else {
        setStocks(stocks); setVisible(stocks); setLoaded(true);
      }
    }).catch(() => setLoaded(true));
    api.market().then(setMarket).catch(() => {});
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

  // Selecting a screener runs it live against the active engine (Personal → the
  // TradingView scanner) and shows ALL its matches; the sidebar filters then refine
  // those results locally. The server-side screener has already done the real work,
  // so we don't auto-apply the numeric filters on top.
  const runScan = (key) => {
    setLoaded(false);
    api.scan(key)
      .then((res) => {
        setScanInfo(res);
        if (res && res.stocks) { setStocks(res.stocks); setVisible(res.stocks); }
        else { setStocks([]); setVisible([]); if (res?.error) toast(res.error); }
        setLoaded(true);
      })
      .catch(() => { setLoaded(true); toast('Could not reach the screener.'); });
  };
  const onChangePreset = (key) => { setFilters((f) => ({ ...f, preset: key })); runScan(key); };
  const onLoadSaved = (key) => onChangePreset(key);

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
  const selectedStock = useMemo(() => stocks.find((s) => s.t === selectedTicker) || null, [stocks, selectedTicker]);

  // The header badge tells the truth about what's on screen. The Screener (and the
  // analysis opened from one of its cards) runs live on TradingView in Personal
  // mode, so it reads LIVE; the watchlist and market are the seeded demo set until a
  // live price feed is wired, so they read DEMO. A wired Price feed (feed.live) is
  // the global truth and wins everywhere.
  const badge = useMemo(() => {
    if (feed?.live) return { live: true, label: `LIVE · ${String(feed.provider).toUpperCase()}`, title: feed.at ? `Updated ${new Date(feed.at).toLocaleString()}` : '' };
    const liveScan = scanInfo && !scanInfo.error && scanInfo.provider;
    if ((screen === 'screener' || screen === 'analysis') && liveScan)
      return { live: true, label: `LIVE · ${String(scanInfo.provider).toUpperCase()}`, title: 'Live screener results from TradingView' };
    if (screen === 'market' && market?.live)
      return { live: true, label: 'LIVE · YAHOO', title: market.asOf ? `Market snapshot · ${market.asOf}` : 'Live market snapshot' };
    const what = screen === 'market' ? 'DEMO SNAPSHOT' : screen === 'shortlist' ? 'DEMO WATCHLIST' : 'DEMO DATA';
    return { live: false, label: what, title: 'Seeded demo data until a live feed is wired' };
  }, [screen, scanInfo, feed, market]);

  return (
    <>
      <Appbar theme={theme} onToggleTheme={onToggleTheme} onSearch={onSearch} onToast={toast} badge={badge} onNav={nav} />
      <main>
        {screen === 'screener' && (
          <Screener
            filters={filters} setFilters={setFilters} visibleSorted={visibleSorted} visibleCount={visible.length}
            screeners={screeners} scanInfo={scanInfo}
            sort={sort} setSort={setSort} shortlist={shortlist} selectedTicker={selectedTicker} screen={screen}
            collapsed={collapsed} loading={!loaded}
            onApply={onApply} onReset={onReset} onChangePreset={onChangePreset} onLoadSaved={onLoadSaved}
            onRunScan={() => runScan(filters.preset)}
            onToggleFilters={onToggleFilters} onToggleStar={onToggleStar} onOpen={onOpen} onNav={nav} onToast={toast} />
        )}
        {screen === 'shortlist' && (
          <Shortlist saved={savedCards} shortlist={shortlist} onToggleStar={onToggleStar} onOpen={onOpen} onNav={nav} />
        )}
        {screen === 'market' && <Market snapshot={market} onNav={nav} onToast={toast} />}
        {screen === 'settings' && <Settings onToast={toast} />}
        {screen === 'analysis' && (
          <Analysis stock={selectedStock} saved={!!selectedStock && shortlist.has(selectedStock.t)} onToggleStar={onToggleStar} onNav={nav} onToast={toast} />
        )}
        <Footer />
      </main>
      <BottomNav screen={screen} onNav={nav} />
      <Toast msg={toastMsg} />
    </>
  );
}
