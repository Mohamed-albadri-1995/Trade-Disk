import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from './api.js';
import { getTheme, toggleTheme } from './theme.js';
import { filterStocks, sortStocks, presetValues, DEFAULT_FILTERS } from './lib.js';
import { Appbar, BottomNav, Footer, Toast } from './components.jsx';
import { Screener, Shortlist } from './screens.jsx';
import { Market } from './market.jsx';
import { Settings } from './settings.jsx';
import { Analysis } from './analysis.jsx';
import { DataView } from './data.jsx';
import { RegisterView } from './registers.jsx';

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
  const [shortCards, setShortCards] = useState([]);       // the shortlist as freshly quoted cards
  const appliedRef = useRef(false);                        // are the sidebar filters applied to the list?
  const liveRef = useRef({});                              // what the once-a-minute refresh needs, always current
  liveRef.current = { key: filters.preset, filters, mode: feed?.mode };

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
    // Keep the Market tab (and the cards' market context) current while the page is
    // open: re-read the snapshot every minute when the tab is visible. The server
    // rebuilds it at most every two minutes during the session, so this is cheap.
    const poll = setInterval(() => {
      if (document.hidden) return;
      api.market().then(setMarket).catch(() => {});
      // Re-read today's list for the screener on screen, so stocks found by a scheduled
      // (background) scan, and news flags, appear without pressing Run. It only reads
      // the saved list — it does not run a scan — and keeps any applied filters.
      const { key, mode } = liveRef.current;
      if (mode === 'personal' && key) {
        api.register(key).then((res) => {
          if (!res?.stocks?.length || liveRef.current.key !== key) return;
          setStocks(res.stocks);
          setVisible(appliedRef.current ? filterStocks(res.stocks, liveRef.current.filters) : res.stocks);
        }).catch(() => {});
      }
    }, 60 * 1000);
    return () => clearInterval(poll);
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
    appliedRef.current = true;
    setVisible(filterStocks(stocks, filters));
    if (isMobile()) setCollapsed(true);
  };

  // resetFilters(): defaults back, every stock visible again.
  const onReset = () => {
    appliedRef.current = false;
    setFilters(structuredClone(DEFAULT_FILTERS));
    setVisible(stocks);
  };

  // Selecting a screener runs it live against the active engine (Personal → the
  // TradingView scanner) and shows ALL its matches; the sidebar filters then refine
  // those results locally. The server-side screener has already done the real work,
  // so we don't auto-apply the numeric filters on top.
  const runScan = (key) => {
    appliedRef.current = false;
    setLoaded(false);
    api.scan(key)
      .then((res) => {
        setScanInfo(res);
        if (res && res.stocks) {
          setStocks(res.stocks); setVisible(res.stocks);
          if (res.unsupported?.length) toast(`${res.unsupported.length} condition(s) can't run live yet — ran the rest.`);
        } else { setStocks([]); setVisible([]); if (res?.error) toast(res.error); }
        setLoaded(true);
        // Running any scan force-refreshes the market snapshot server-side; pull the
        // fresh one so the Market tab and the cards' market context update too.
        api.market().then(setMarket).catch(() => {});
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

  // Live names first, then the carried-over "not live now" ones — stable within each
  // group, so the day's whole register is visible with the fresh matches on top.
  const visibleSorted = useMemo(() => {
    const sorted = sortStocks(visible, sort);
    return [...sorted].sort((a, b) => (a.live === b.live ? 0 : a.live === false ? 1 : b.live === false ? -1 : 0));
  }, [visible, sort]);
  // The Shortlist tab shows every starred stock, quoted fresh by ticker; a stock the
  // quote did not return falls back to its card from the scan on screen.
  useEffect(() => {
    if (screen !== 'shortlist') return;
    api.shortlistCards().then((r) => setShortCards(r?.stocks || [])).catch(() => {});
  }, [screen, shortlist]);
  const savedCards = useMemo(() => {
    const quoted = Object.fromEntries(shortCards.map((s) => [s.t, s]));
    const onScreen = Object.fromEntries(stocks.map((s) => [s.t, s]));
    return [...shortlist].map((t) => quoted[t] || onScreen[t]).filter(Boolean);
  }, [stocks, shortlist, shortCards]);
  const selectedStock = useMemo(() => stocks.find((s) => s.t === selectedTicker) || shortCards.find((s) => s.t === selectedTicker) || null, [stocks, shortCards, selectedTicker]);

  // The header badge tells the truth about what's on screen. In Personal mode every
  // surface is live: the Screener and the analysis opened from its cards run on
  // TradingView; the Market snapshot is computed server-side from Yahoo; the watchlist
  // holds those same live cards. So the badge reads LIVE throughout — it only falls
  // back to DEMO in Commercial mode before a licensed engine is wired.
  const badge = useMemo(() => {
    if (screen === 'analysis' || screen === 'data' || screen === 'registers') return { hide: true };   // these own their own header / need no live badge
    // the scanner says how far behind the market its data is (15 minutes without a paid TradingView feed)
    const delay = screen !== 'market' && scanInfo?.delayMin ? ` · ${scanInfo.delayMin}-MIN DELAYED` : '';
    if (feed?.live) return { live: true, label: `LIVE · ${String(feed.provider).toUpperCase()}${delay}`, title: feed.at ? `Updated ${new Date(feed.at).toLocaleString()}` : '' };
    if (screen === 'market')
      return { live: true, label: 'LIVE · YAHOO', title: market?.asOf ? `Market snapshot · ${market.asOf}` : 'Live market snapshot, computed from Yahoo daily bars' };
    const liveScan = scanInfo && !scanInfo.error && scanInfo.provider;
    if (liveScan)
      return { live: true, label: `LIVE · ${String(scanInfo.provider).toUpperCase()}${delay}`, title: delay ? `Screener results from TradingView, ${scanInfo.delayMin} minutes behind the market` : 'Live screener results from TradingView' };
    if (feed?.mode === 'personal')
      return { live: true, label: 'LIVE · TRADINGVIEW', title: 'Live screeners (TradingView) + analysis (Yahoo + SEC EDGAR)' };
    return { live: false, label: 'DEMO DATA', title: 'Seeded sample until a licensed feed is wired (Commercial mode)' };
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
        {screen === 'data' && <DataView onToast={toast} />}
        {screen === 'registers' && <RegisterView />}
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
