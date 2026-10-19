import React, { useState, useEffect } from 'react';
import { api } from './api.js';

const toggleTheme = () => {
  const r = document.documentElement;
  const next = r.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  r.setAttribute('data-theme', next);
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.setAttribute('content', next === 'dark' ? '#06111e' : '#eef2f7');
  try { localStorage.setItem('td-theme', next); } catch { /* private */ }
  return next;
};

function Provider({ g, p, commercial, onToggle, onKey }) {
  const [key, setKey] = useState('');
  const disabled = !p.usableNow;
  return (
    <div className={`src-row ${p.active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" checked={p.active} disabled={disabled} aria-label={`Use ${p.name}`} onChange={() => onToggle(g, p.id)} />
      <span className="src-name">{p.name}</span>
      <span className={`tier ${p.tier}`}>{p.tier === 'commercial' ? 'licensed' : p.tier}</span>
      {commercial && !p.commercialOk ? <span className="tier" style={{ borderColor: '#673c4a', background: '#261823', color: '#ff9ca8' }}>not for commercial</span> : null}
      <span className="spacer"></span>
      {p.needsKey ? (
        p.hasKey ? <span className="keyset">✓ key set &nbsp;<button className="linkbtn" onClick={() => onKey(g.id, p.id, '')}>clear</button></span>
          : (<>
            <input className="keyin" type="password" placeholder="API key" value={key} onChange={(e) => setKey(e.target.value)} />
            <button className="linkbtn" disabled={!key} onClick={() => { onKey(g.id, p.id, key); setKey(''); }}>Save key</button>
          </>)
      ) : null}
    </div>
  );
}

export default function App() {
  const [cfg, setCfg] = useState(null);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'light');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { api.sources().then(setCfg).catch((e) => setErr(String(e.message))); }, []);

  const commercial = cfg?.mode === 'commercial';
  const run = (promise) => promise.then((c) => { setCfg(c); setErr(''); }).catch((e) => setErr(String(e.message)));

  const setMode = (mode) => run(api.setMode(mode));
  const setGroupMode = (g, mode) => run(api.setGroup(g.id, mode, g.active));
  const toggleProvider = (g, pid) => {
    const set = new Set(g.active);
    if (set.has(pid)) { if (set.size === 1) { setErr('Each group needs at least one active source.'); return; } set.delete(pid); } else set.add(pid);
    const active = g.providers.map((p) => p.id).filter((id) => set.has(id));
    run(api.setGroup(g.id, g.mode, active));
  };
  const setKey = (id, provider, key) => api.setKey(id, provider, key).then(() => api.sources().then(setCfg)).catch((e) => setErr(String(e.message)));
  const refresh = () => {
    setBusy(true); setMsg('');
    api.refresh()
      .then((r) => { setMsg(r.error || r.note || `Updated ${r.updated} stock${r.updated === 1 ? '' : 's'} from ${r.provider}.`); return api.sources().then(setCfg); })
      .catch((e) => setMsg(String(e.message)))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <header className="appbar">
        <div className="brand"><span className="logo">↗</span><span>Trade-Disk <em>· Admin</em></span></div>
        <div className="app-actions">
          <a href="/" title="Back to the Trading Station" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 13px', border: '1px solid rgba(120,160,200,.22)', borderRadius: '9px', color: '#a9c1d3', textDecoration: 'none', fontSize: '13px', fontWeight: 650, marginRight: '10px' }}>← Station</a>
          <button className="iconbtn" aria-label="Toggle theme" onClick={() => setTheme(toggleTheme())}>{theme === 'dark' ? '☾' : '☀'}</button>
          <span className="demo">● SOLO · LOCAL</span>
        </div>
      </header>
      <main className="admin-main">
        <div className="page-head">
          <div><div className="eyebrow">Platform · data sources</div><h1>Data sources</h1><p className="subtitle">Switch between personal (free) and commercial (licensed) feeds, per data group. Nothing in the app changes — only where the numbers come from.</p></div>
        </div>

        {err ? <div className="admin-err">{err}</div> : null}
        {!cfg ? <div className="empty"><b>Loading…</b>Reading the feed registry.</div> : (
          <>
            <section className="panel mode-panel">
              <div>
                <h2>Run mode</h2>
                <p className="subtitle">{commercial ? 'Commercial — only licensed, commercial-use providers may be active.' : 'Personal — free sources allowed; for your own use, not a sold product.'}</p>
              </div>
              <div className="mode-toggle">
                <button className={!commercial ? 'on' : ''} onClick={() => setMode('personal')}>Personal</button>
                <button className={commercial ? 'on' : ''} onClick={() => setMode('commercial')}>Commercial</button>
              </div>
            </section>

            <div className="notice">The <b>demo</b> provider serves the seeded sample data — the default today, so nothing needs a real feed yet. Groups <b>1·2·3·4·7</b> work on free sources; going commercial is the licensed tier of the same feed. Groups <b>5·6·8</b> need a licensed provider (paste a key).</div>

            <section className="panel refresh-panel">
              <div>
                <h2>Live data</h2>
                <p className="subtitle">Pull real quotes for the Radar watchlist from the Price group's active source. Demo stays until you switch Price to a live provider (e.g. Yahoo).</p>
              </div>
              <div className="refresh-ctl">
                {msg ? <span className="refresh-msg">{msg}</span> : null}
                <button className="refreshbtn" disabled={busy} onClick={refresh}>{busy ? 'Refreshing…' : '↻ Refresh data'}</button>
              </div>
            </section>

            {cfg.groups.map((g) => (
              <section className={`panel src-group ${g.blocked ? '' : ''}`} key={g.id}>
                <div className="src-head">
                  <span className="src-num">{g.n}</span>
                  <h3>{g.name}</h3>
                  <span className={`band ${g.band === 'free-now' ? 'free' : 'paid'}`}>{g.band === 'free-now' ? 'FREE NOW' : 'PAID FEED'}</span>
                  <div className="group-mode">
                    <span className="subtitle" style={{ fontSize: '11px' }}>combine</span>
                    <select value={g.mode} onChange={(e) => setGroupMode(g, e.target.value)}>
                      <option value="prime">Prime + backup</option>
                      <option value="merge">Merge (all at once)</option>
                    </select>
                  </div>
                </div>
                <p className="src-note">{g.note}</p>
                <div className="src-providers">
                  {g.providers.map((p) => <Provider key={p.id} g={g} p={p} commercial={commercial} onToggle={toggleProvider} onKey={setKey} />)}
                </div>
                {g.blocked ? <div className="src-blocked">⚠ The active source here isn't licensed for commercial use. Pick a licensed provider (or switch back to Personal).</div> : null}
              </section>
            ))}
          </>
        )}
      </main>
    </>
  );
}
