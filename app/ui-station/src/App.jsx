import React from 'react';

// The Station — the launcher home at /. Reproduced from the approved prototype's
// station home (frontend-design/index.html). The tool cards link to the real built
// apps: the Journal at /journal/ and Radar at /radar/. TradeLab and TradePilot are
// not built yet. The Journal snapshot figures mirror the seeded demo workspace.

const HERO_PATH_FILL = 'M0 126 C32 118 44 124 70 102 S112 110 138 85 S188 99 212 76 S254 88 282 59 S324 80 352 53 S398 70 418 39 S458 52 482 31 S520 44 544 15 L560 10 L560 150 L0 150Z';
const HERO_PATH_LINE = 'M0 126 C32 118 44 124 70 102 S112 110 138 85 S188 99 212 76 S254 88 282 59 S324 80 352 53 S398 70 418 39 S458 52 482 31 S520 44 544 15 L560 10';

export default function App({ session, onSignOut } = {}) {
  return (
    <div className="station">
      <header className="st-header">
        <a className="st-brand" href="/" aria-label="Trade-Disk home"><span className="brandmark">◆</span><span><span className="bn">Trade-Disk</span><small>THE TRADING STATION</small></span></a>
        <nav className="st-links" aria-label="Main navigation"><a href="#tools">Products</a><a href="#workflow">Workflow</a><a href="#journal">The Journal</a></nav>
        {session ? (
          <>
            <span className="st-login" style={{ cursor: 'default' }} title={session.user.email}>{session.user.email}</span>
            <button className="st-cta" style={{ border: 0, cursor: 'pointer' }} onClick={onSignOut}>Sign out</button>
          </>
        ) : (
          <>
            <a className="st-login" href="/journal/">Sign in</a>
            <a className="st-cta" href="/journal/">Get started <span className="ar">→</span></a>
          </>
        )}
      </header>

      <section className="st-hero">
        <div>
          <div className="st-eyebrow">ANALYZE · PLAN · EXECUTE · IMPROVE</div>
          <h1>Your trading.<br /><span className="b2">One station.</span></h1>
          <p className="lede">Four tools to find opportunities, analyze, test, trade and improve — on web and Android. Start with the Journal; the rest of the toolkit is on the way.</p>
          <div className="st-actions"><a className="st-cta" href="/journal/">Open the Journal <span className="ar">→</span></a><a className="st-ghost" href="#tools">Explore the tools</a></div>
          <div className="st-proof"><span>Web and Android</span><span>Use tools independently</span><span>Built for active traders</span></div>
        </div>
        <div className="st-visual" aria-label="Illustration of the Trade-Disk Journal">
          <div className="st-screen">
            <div className="sv-top"><span className="d"></span> TRADE-DISK <span className="sv-tabs">Journal · Radar · TradeLab · TradePilot</span><span className="sv-live">● DEMO</span></div>
            <div className="sv-body">
              <aside className="sv-side"><b>◧ Overview</b><span>▦ Calendar</span><span>∑ Stats</span><span>≡ Trades</span><span>↑ Import</span></aside>
              <div>
                <div className="sv-metrics"><div><small>Net P&amp;L</small><b>+$3,082</b></div><div><small>Win rate</small><b>80%</b></div><div><small>Profit factor</small><b>3.1</b></div></div>
                <div className="sv-chart"><svg viewBox="0 0 560 150" preserveAspectRatio="none" role="img" aria-label="Illustrative rising equity curve"><defs><linearGradient id="ha" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#5b8cff" stopOpacity=".3" /><stop offset="1" stopColor="#5b8cff" stopOpacity="0" /></linearGradient></defs><path d={HERO_PATH_FILL} fill="url(#ha)" /><path d={HERO_PATH_LINE} fill="none" stroke="#5b8cff" strokeWidth="2.5" vectorEffect="non-scaling-stroke" /></svg></div>
              </div>
            </div>
          </div>
          <div className="st-float"><div className="muted">Latest closed</div><div className="pnl">NVDA +$190</div></div>
        </div>
      </section>

      <section className="st-tools" id="tools">
        <div className="st-sec"><h2>Four tools. One complete trading station.</h2><p>Use each on its own, or get the complete Trade-Disk. The Journal is ready today — the rest are in development.</p></div>
        <div className="st-feature" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => { window.location.href = '/journal/'; }}>
          <div>
            <div className="ti">▤</div>
            <span className="badge">Available now</span>
            <h3>Trading Journal</h3>
            <p>Track every real trade, pair your fills into round trips, and find the patterns that make and lose money — grounded in evidence, never guesses.</p>
            <a className="st-cta" href="/journal/">Open the Journal <span className="ar">→</span></a>
          </div>
          <div className="mini" aria-hidden="true">
            <div className="row"><span className="muted">Net P&amp;L</span><span className="v positive">$3,082.50</span></div>
            <div className="row"><span className="muted">Win rate</span><span className="v">80.0%</span></div>
            <div className="row"><span className="muted">Profit factor</span><span className="v">3.06</span></div>
            <div className="row"><span className="muted">Max drawdown</span><span className="v negative">$524.00</span></div>
          </div>
        </div>
        <div className="st-trio">
          <a className="st-tool radar" href="/radar/" style={{ display: 'block' }}><div className="ti">⌕</div><h3>Radar</h3><p>Find high-probability opportunities with powerful screening tools and watchlists.</p><span className="soon" style={{ color: 'var(--warn)', borderColor: 'color-mix(in srgb,var(--warn) 42%,var(--line))' }}>Preview →</span></a>
          <div className="st-tool lab"><div className="ti">▥</div><h3>TradeLab</h3><p>Professional charting, indicators, strategy development and backtesting.</p><span className="soon">Coming soon</span></div>
          <div className="st-tool pilot"><div className="ti">✦</div><h3>TradePilot</h3><p>Algorithmic trading, strategy automation and execution controls.</p><span className="soon">Coming soon</span></div>
        </div>
      </section>

      <section className="st-flow" id="workflow">
        <div className="st-sec"><h2>A complete workflow.</h2><p>From finding a setup to reviewing the result — Trade-Disk supports every step.</p></div>
        <div className="flowrow">
          <div className="flowstep"><div className="fi">1</div><span className="fl">RADAR</span><b>Find</b><small>Discover opportunities with screeners and watchlists.</small></div>
          <div className="flowstep"><div className="fi">2</div><span className="fl">TRADELAB</span><b>Analyze</b><small>Chart, test and develop your strategies.</small></div>
          <div className="flowstep"><div className="fi">3</div><span className="fl">YOUR BROKER</span><b>Trade</b><small>Execute at your broker, then record it in the Journal.</small></div>
          <div className="flowstep"><div className="fi">4</div><span className="fl">JOURNAL</span><b>Improve</b><small>Review performance and refine your edge.</small></div>
        </div>
      </section>

      <section className="st-tools" id="journal">
        <div className="st-feature" role="button" tabIndex={0} style={{ cursor: 'pointer', background: 'linear-gradient(135deg,var(--panel),var(--brand-soft))' }} onClick={() => { window.location.href = '/journal/'; }}>
          <div><span className="badge">Start here</span><h3>Ready when you are.</h3><p>The Journal works today, on web and Android. Connect a read-only broker feed, upload a CSV, or log a trade by hand.</p><a className="st-cta" href="/journal/">Launch the Journal <span className="ar">→</span></a></div>
          <div className="mini" aria-hidden="true"><div className="row"><span className="muted">Broker connectors</span><span className="v">Read-only</span></div><div className="row"><span className="muted">File upload</span><span className="v">Column mapping</span></div><div className="row"><span className="muted">Manual entry</span><span className="v">5 asset classes</span></div></div>
        </div>
      </section>

      <footer className="st-foot"><span>© Trade-Disk · The Trading Station · <a href="/admin/" style={{ color: 'inherit' }}>Admin · Data sources</a></span><span>Journal preview uses synthetic demo trades — never real performance. The Trade-Disk tools place no orders.</span></footer>
    </div>
  );
}
